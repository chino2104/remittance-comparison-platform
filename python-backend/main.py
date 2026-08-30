from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator
from fastapi.middleware.cors import CORSMiddleware
import requests
from datetime import datetime, timedelta

app = FastAPI(title="GlobalRemit API")

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
# unreachable so the app still returns a sensible answer offline.
FALLBACK_USD_RATES = {
    "USD": 1.0,
    "AED": 3.6725,
    "EUR": 0.92,
    "INR": 83.5,
    "PKR": 278.0,
    "PHP": 58.5,
    "GBP": 0.79,
}

# --- Provider model (rate-only comparison) ---------------------------------
#
# Each provider's shown rate = LIVE mid-market rate x markup.
# The live mid-market rate updates automatically every day (free, no key, from
# open.er-api.com), so the displayed provider rates update daily on their own.
# `markup` is the provider's typical rate relative to mid-market (e.g. 0.994 =
# ~0.6% below mid). `lastVerified` records when it was last checked and is shown
# on every card.
#
# FEES ARE NOT MODELLED: UAE exchange houses bundle their margin into the rate
# and don't publish a simple fee, and digital apps' fees vary by amount and
# corridor. So the app compares on EXCHANGE RATE and tells users to confirm the
# fee with the provider. Every card is labelled "Estimated".
#
# Markup sources (Jul 2026):
#   - Al Ansari, LuLu (UAE exchange houses): remit.ae per-provider pages.
#   - Wise, Remitly, WorldRemit, Instarem (digital): Wise Comparison API, real
#     advertised rates on USD->INR (markup% is roughly corridor-stable).
# Wall Street Exchange closed and was removed; Federal Exchange had no public
# rate source and was replaced by WorldRemit + Instarem. Re-check occasionally
# and bump `lastVerified`.
PROVIDERS = [
    {"provider": "Wise",          "markup": 0.996, "url": "https://wise.com",             "lastVerified": "2026-07-29"},
    {"provider": "Remitly",       "markup": 0.994, "url": "https://www.remitly.com",      "lastVerified": "2026-07-29"},
    {"provider": "WorldRemit",    "markup": 0.996, "url": "https://www.worldremit.com",   "lastVerified": "2026-07-29"},
    {"provider": "Instarem",      "markup": 0.991, "url": "https://www.instarem.com",     "lastVerified": "2026-07-29"},
    {"provider": "Al Ansari",     "markup": 0.995, "url": "https://alansariexchange.com", "lastVerified": "2026-07-29"},
    {"provider": "LuLu Exchange", "markup": 0.992, "url": "https://www.luluexchange.com", "lastVerified": "2026-07-29"},
]


class QuoteRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10_000_000, description="Amount to send, in the source currency.")
    fromCurrency: str = Field(..., min_length=3, max_length=3)
    toCurrency: str = Field(..., min_length=3, max_length=3)

    @field_validator("fromCurrency", "toCurrency")
    @classmethod
    def uppercase_currency(cls, v: str) -> str:
        return v.upper()


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
    #    back to the Frankfurter latest, then to the offline table.
    live_rate, rate_is_live = get_live_rate(req.fromCurrency, req.toCurrency)
    base_rate = live_rate or frankfurter_latest or _fallback_rate(req.fromCurrency, req.toCurrency)

    # 3) Build each provider quote from the live rate x its markup. Fees are not
    #    modelled — we compare on exchange rate and tell users to confirm the fee
    #    with the provider (see feeKnown: False below).
    quotes = []
    for p in PROVIDERS:
        rate = round(base_rate * p["markup"], 4)
        receive = round(req.amount * rate, 2)
        quotes.append({
            "provider": p["provider"],
            "rate": rate,
            "receiveAmount": receive,
            "url": p["url"],
            "lastVerified": p["lastVerified"],
            "feeKnown": False,   # fee is not modelled — user should check provider
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
