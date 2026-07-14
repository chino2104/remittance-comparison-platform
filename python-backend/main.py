from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from fastapi.middleware.cors import CORSMiddleware
import requests
from datetime import datetime, timedelta

app = FastAPI(title="GlobalRemit API")

# NOTE: no cookies/auth are used, so we do NOT enable credentials. Combining
# allow_credentials=True with allow_origins=["*"] is rejected by browsers anyway.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# --- Static reference data -------------------------------------------------

# Approximate USD -> currency rates, used only when the live FX API is
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

# Provider model. `spread` is the fraction of the mid-market rate the provider
# actually gives you (all BELOW 1.0 — no real remittance beats mid-market).
# Fees and delivery times vary per provider, so the "best" provider genuinely
# depends on the amount: high-fee/high-rate providers win on large transfers,
# low-fee providers win on small ones.
#
# IMPORTANT: these are ILLUSTRATIVE estimates, not live per-provider quotes.
PROVIDERS = [
    {"provider": "Wise",             "spread": 0.995, "stdFee": 8.5,  "expFee": 15.0, "stdHours": 24, "expHours": 1, "url": "https://wise.com"},
    {"provider": "Remitly",          "spread": 0.992, "stdFee": 4.0,  "expFee": 9.0,  "stdHours": 24, "expHours": 1, "url": "https://www.remitly.com"},
    {"provider": "Federal Exchange", "spread": 0.989, "stdFee": 9.0,  "expFee": 16.0, "stdHours": 24, "expHours": 2, "url": "https://federalexchange.ae"},
    {"provider": "LuLu Exchange",    "spread": 0.990, "stdFee": 10.0, "expFee": 18.0, "stdHours": 48, "expHours": 4, "url": "https://www.luluexchange.com"},
    {"provider": "Al Ansari",        "spread": 0.988, "stdFee": 12.0, "expFee": 22.0, "stdHours": 48, "expHours": 2, "url": "https://alansariexchange.com"},
    {"provider": "Wall Street",      "spread": 0.986, "stdFee": 14.0, "expFee": 20.0, "stdHours": 48, "expHours": 4, "url": "https://wallstreetexch.com"},
]


class QuoteRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10_000_000, description="Amount to send, in the source currency.")
    fromCurrency: str = Field(..., min_length=3, max_length=3)
    toCurrency: str = Field(..., min_length=3, max_length=3)
    method: str = Field("STANDARD")

    @field_validator("fromCurrency", "toCurrency")
    @classmethod
    def uppercase_currency(cls, v: str) -> str:
        return v.upper()

    @field_validator("method")
    @classmethod
    def valid_method(cls, v: str) -> str:
        v = v.upper()
        if v not in ("STANDARD", "EXPRESS"):
            raise ValueError("method must be STANDARD or EXPRESS")
        return v


def _fallback_rate(from_ccy: str, to_ccy: str) -> float:
    """Source -> target mid-market rate using offline fallback tables."""
    usd_from = FALLBACK_USD_RATES.get(from_ccy)
    usd_to = FALLBACK_USD_RATES.get(to_ccy)
    if not usd_from or not usd_to:
        return 1.0
    return usd_to / usd_from


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/quote")
def get_quote(req: QuoteRequest):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    url = f"https://api.frankfurter.dev/v1/{start_str}..{end_str}?base=USD"

    trend = []
    base_rate = None
    # The trend only reflects real movement when the TARGET currency is in the
    # live feed. Frankfurter (ECB data) omits some currencies (e.g. PKR, AED),
    # for which we fall back to a single constant per day -> a flat, meaningless
    # line. We flag that so the frontend can hide the chart instead of lying.
    target_is_live = False

    # --- Live FX with graceful degradation -------------------------------
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        historical_rates = response.json().get("rates", {})

        for date in sorted(historical_rates.keys()):
            daily = historical_rates[date]

            # USD is the base, so USD->currency comes straight from the feed
            # (with offline fallbacks for anything the feed omits).
            live_target = daily.get(req.toCurrency)
            if live_target:
                target_is_live = True

            usd_to_source = daily.get(req.fromCurrency) or FALLBACK_USD_RATES.get(req.fromCurrency)
            usd_to_target = live_target or FALLBACK_USD_RATES.get(req.toCurrency)

            if not usd_to_source or not usd_to_target:
                continue

            source_to_target = usd_to_target / usd_to_source
            display_date = datetime.strptime(date, "%Y-%m-%d").strftime("%b %d")
            trend.append({"date": display_date, "rate": round(source_to_target, 4)})
            base_rate = source_to_target  # latest sorted date wins

    except (requests.RequestException, ValueError) as exc:
        # Network/parse failure: log and fall through to the fallback rate.
        print(f"[quote] live FX unavailable, using fallback: {exc}")

    if not base_rate:
        base_rate = _fallback_rate(req.fromCurrency, req.toCurrency)

    # --- Build provider quotes from the data-driven table ----------------
    is_express = req.method == "EXPRESS"
    quotes = []
    for p in PROVIDERS:
        rate = round(base_rate * p["spread"], 4)
        fee = p["expFee"] if is_express else p["stdFee"]
        hours = p["expHours"] if is_express else p["stdHours"]
        receive = round(max(0.0, req.amount - fee) * rate, 2)
        quotes.append({
            "provider": p["provider"],
            "rate": rate,
            "fee": fee,
            "receiveAmount": receive,
            "deliveryHours": hours,
            "url": p["url"],
        })

    best_quote = max(quotes, key=lambda x: x["receiveAmount"])
    worst_quote = min(quotes, key=lambda x: x["receiveAmount"])
    max_savings = round(best_quote["receiveAmount"] - worst_quote["receiveAmount"], 2)

    # Only expose the trend when it reflects real market movement.
    trend_available = target_is_live and len(trend) > 1

    return {
        "bestProvider": best_quote["provider"],
        "maxSavings": max_savings,
        "sendCurrency": req.fromCurrency,
        "currency": req.toCurrency,
        "quotes": quotes,
        "trend": trend if trend_available else [],
        "trendAvailable": trend_available,
        "estimated": True,  # per-provider spreads are illustrative, not live quotes
    }
