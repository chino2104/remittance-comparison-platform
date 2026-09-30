from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator
from fastapi.middleware.cors import CORSMiddleware
import requests
from datetime import datetime, timedelta

app = FastAPI(title="RemitDubai API")

# Public, read-only API with no cookies/auth, so allowing all origins is safe
# (allow_credentials stays False). This lets the deployed frontend call the API
# from its production domain without hard-coding it here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# --- Static reference data -------------------------------------------------

# Approximate USD -> currency rates, used only when BOTH live FX sources are
# unreachable AND no live rate has been cached since the server started.
# Refreshed from open.er-api on 2026-09-30 — re-check occasionally.
FALLBACK_USD_RATES = {
    "USD": 1.0,
    "AED": 3.6725,
    "EUR": 0.8815,
    "INR": 96.06,
    "PKR": 276.88,
    "PHP": 62.60,
    "GBP": 0.756,
}

# Only these currencies have a rate source (live or fallback). Anything else is
# rejected with HTTP 422 rather than silently priced at a meaningless rate.
SUPPORTED_CURRENCIES = set(FALLBACK_USD_RATES)

# Last successful live rate per corridor, so an outage falls back to a recent
# real rate before resorting to the hard-coded table above.
_last_live_rates: dict[tuple[str, str], float] = {}

# --- Provider model ---------------------------------------------------------
#
# Each provider's shown rate = LIVE mid-market rate x markup, and the recipient
# gets (amount - fixed fee) x rate. The live mid-market rate updates daily
# (open.er-api.com), so displayed rates update on their own; markups are
# re-checked by hand and `lastVerified` is shown on every card.
#
# Markups were calibrated on 2026-09-30 from real quotes for 1,000 AED -> INR,
# divided by the real-time mid-market rate at the time (26.1219, Wise live
# rate). The comparison is FEES INCLUDED, so `feeType` says how each fee is
# handled:
#   - "included": UAE exchange houses quote an all-in amount, so the fee is
#     already inside the markup.
#   - "fixed":    a flat fee in AED (`fee`) deducted from the amount sent;
#     `markup` is the pure exchange rate.
#   - "varies":   the fee depends on amount and destination. `markup` is the
#     effective all-in rate observed at 1,000 AED, so it is less exact at other
#     amounts and the card warns the user.
# Observed quotes (1,000 AED -> INR): Remitly 26,200 + 5 AED fee; LuLu 26,110;
# Al Ansari 25,974; Al Fardan 25,950; Wise 25,913; GCC 25,905.
# Remitly's rate is ~0.3% ABOVE mid-market — as quoted on the day; re-check it
# is not a time-limited or first-transfer offer.
PROVIDERS = [
    {"provider": "Remitly",            "markup": 1.0030, "feeType": "fixed",    "fee": 5, "url": "https://www.remitly.com",          "lastVerified": "2026-09-30"},
    {"provider": "LuLu Exchange",      "markup": 0.9995, "feeType": "included", "fee": 0, "url": "https://www.luluexchange.com",     "lastVerified": "2026-09-30"},
    {"provider": "Al Ansari",          "markup": 0.9943, "feeType": "included", "fee": 0, "url": "https://alansariexchange.com",     "lastVerified": "2026-09-30"},
    {"provider": "Al Fardan Exchange", "markup": 0.9934, "feeType": "included", "fee": 0, "url": "https://www.alfardanexchange.com", "lastVerified": "2026-09-30"},
    {"provider": "Wise",               "markup": 0.9920, "feeType": "varies",   "fee": 0, "url": "https://wise.com",                 "lastVerified": "2026-09-30"},
    {"provider": "GCC Exchange",       "markup": 0.9917, "feeType": "included", "fee": 0, "url": "https://www.gccexchange.com",      "lastVerified": "2026-09-30"},
]


class QuoteRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10_000_000, description="Amount to send, in the source currency.")
    fromCurrency: str = Field(..., min_length=3, max_length=3)
    toCurrency: str = Field(..., min_length=3, max_length=3)

    @field_validator("fromCurrency", "toCurrency")
    @classmethod
    def supported_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency: {v}")
        return v


def _fallback_rate(from_ccy: str, to_ccy: str) -> float:
    """Source -> target mid-market rate using the offline fallback tables."""
    usd_from = FALLBACK_USD_RATES.get(from_ccy)
    usd_to = FALLBACK_USD_RATES.get(to_ccy)
    if not usd_from or not usd_to:
        return 1.0
    return usd_to / usd_from


def get_live_rate(from_ccy: str, to_ccy: str):
    """Live mid-market source->target rate from open.er-api.com (free, no key,
    covers AED and PKR). Returns (rate, is_live); (None, False) on failure."""
    try:
        resp = requests.get(f"https://open.er-api.com/v6/latest/{from_ccy}", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("result") == "success":
            rate = data.get("rates", {}).get(to_ccy)
            if rate:
                _last_live_rates[(from_ccy, to_ccy)] = float(rate)
                return float(rate), True
    except (requests.RequestException, ValueError) as exc:
        print(f"[quote] live FX (open.er-api) unavailable: {exc}")
    return None, False


def get_trend(from_ccy: str, to_ccy: str):
    """7-day source->target history from Frankfurter (ECB). Returns
    (trend_list, target_is_live, latest_rate_or_None). ECB omits some currencies
    (e.g. PKR, AED) so the trend is only meaningful when the target is present."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    url = (
        f"https://api.frankfurter.dev/v1/{start_date:%Y-%m-%d}..{end_date:%Y-%m-%d}"
        "?base=USD"
    )

    trend = []
    target_is_live = False
    latest = None
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        historical = resp.json().get("rates", {})
        for date in sorted(historical.keys()):
            daily = historical[date]
            live_target = daily.get(to_ccy)
            if live_target:
                target_is_live = True
            usd_from = daily.get(from_ccy) or FALLBACK_USD_RATES.get(from_ccy)
            usd_to = live_target or FALLBACK_USD_RATES.get(to_ccy)
            if not usd_from or not usd_to:
                continue
            rate = usd_to / usd_from
            trend.append({"date": datetime.strptime(date, "%Y-%m-%d").strftime("%b %d"),
                          "rate": round(rate, 4)})
            latest = rate
    except (requests.RequestException, ValueError) as exc:
        print(f"[quote] trend history unavailable: {exc}")
    return trend, target_is_live, latest


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/quote")
def get_quote(req: QuoteRequest):
    # 1) 7-day trend history (Frankfurter). Also gives a fallback latest rate.
    trend, target_is_live, frankfurter_latest = get_trend(req.fromCurrency, req.toCurrency)

    # 2) Live current mid-market rate (open.er-api — covers AED & PKR). Falls
    #    back to the Frankfurter latest (only if ECB actually publishes the
    #    target — otherwise that "latest" is built from the offline table), then
    #    the last cached live rate, then the offline table.
    live_rate, rate_is_live = get_live_rate(req.fromCurrency, req.toCurrency)
    ecb_latest = frankfurter_latest if target_is_live else None
    base_rate = (live_rate or ecb_latest
                 or _last_live_rates.get((req.fromCurrency, req.toCurrency))
                 or _fallback_rate(req.fromCurrency, req.toCurrency))

    # 3) Build each provider quote from the live rate x its markup, after
    #    deducting any fixed fee (see feeType in PROVIDERS).
    quotes = []
    for p in PROVIDERS:
        rate = round(base_rate * p["markup"], 4)
        receive = round(max(req.amount - p["fee"], 0) * rate, 2)
        quotes.append({
            "provider": p["provider"],
            "rate": rate,
            "receiveAmount": receive,
            "fee": p["fee"],
            "feeType": p["feeType"],
            "url": p["url"],
            "lastVerified": p["lastVerified"],
            "estimated": True,
        })

    best_quote = max(quotes, key=lambda x: x["receiveAmount"])
    worst_quote = min(quotes, key=lambda x: x["receiveAmount"])
    max_savings = round(best_quote["receiveAmount"] - worst_quote["receiveAmount"], 2)

    trend_available = target_is_live and len(trend) > 1

    return {
        "bestProvider": best_quote["provider"],
        "maxSavings": max_savings,
        "sendCurrency": req.fromCurrency,
        "currency": req.toCurrency,
        "quotes": quotes,
        "trend": trend if trend_available else [],
        "trendAvailable": trend_available,
        "rateLive": rate_is_live,  # was the mid-market base a live rate?
        "estimated": True,         # per-provider markups are estimates, not live quotes
    }
