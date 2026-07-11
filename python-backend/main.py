from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI()

# security bypass to allow React to talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# define the incoming data bucket from react
class QuoteRequest(BaseModel):
    amount: float
    fromCurrency: str
    toCurrency: str
    method: str

@app.post("/api/quote")
def get_quote(request: QuoteRequest): #gets the value of the variables from the request
    amount = request.amount
    target_currency = request.toCurrency
    transfer_speed = request.method
    
    #call the api that refreshes live
    url = "https://open.er-api.com/v6/latest/AED"
    api_response = requests.get(url).json()
    rates = api_response.get("rates", {})
    
    if target_currency in rates:
        live_mid_market_rate = float(rates[target_currency])
    else:
        live_mid_market_rate = float(rates.get("INR", 1.0))
        target_currency = "INR"
        
    wise_rate = live_mid_market_rate - (live_mid_market_rate * 0.002)
    wise_fee = 8.5
    wise_hours = 24
    
    al_ansari_rate = live_mid_market_rate - (live_mid_market_rate * 0.015)
    al_ansari_fee = 15.0
    al_ansari_hours = 48
    
    # speed modifiers based on speed selected
    if transfer_speed.upper() == "EXPRESS":
        wise_fee += 12.0
        wise_hours = 1
        al_ansari_fee += 25.0
        al_ansari_hours = 4
        
    mid_market_receive = amount * live_mid_market_rate
    wise_receive = (amount - wise_fee) * wise_rate
    al_ansari_receive = (amount - al_ansari_fee) * al_ansari_rate
    
    max_savings = wise_receive - al_ansari_receive
    
    # pack and return the final JSON (FastAPI translates this dictionary automatically)
    return {
        "midMarketRate": round(live_mid_market_rate, 2),
        "midMarketReceiveAmount": round(mid_market_receive),
        "bestProvider": "Wise",
        "maxSavings": round(max_savings),
        "currency": target_currency,
        "quotes": [
            {
                "provider": "Wise",
                "fee": wise_fee,
                "rate": round(wise_rate, 2),
                "receiveAmount": round(wise_receive),
                "deliveryHours": wise_hours
            },
            {
                "provider": "Al Ansari",
                "fee": al_ansari_fee,
                "rate": round(al_ansari_rate, 2),
                "receiveAmount": round(al_ansari_receive),
                "deliveryHours": al_ansari_hours
            }
        ]
    }