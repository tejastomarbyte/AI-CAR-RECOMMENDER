"""
CarFind AI - FastAPI Backend
Handles car recommendations, comparisons, and AI-powered personalization.
"""

import os
import json
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from openai import OpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from recommender import filter_and_rank, get_car_by_id, get_all_makes, get_budget_range
from cars_data import CARS, SEGMENT_LABELS

# ── Lifespan: DB init ─────────────────────────────────────────────────────────
DB_PATH = "carfind.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            preferences TEXT NOT NULL,
            results TEXT NOT NULL,
            ai_reasoning TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS shortlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            car_id TEXT NOT NULL,
            added_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CarFind AI API",
    description="Smart car recommendation engine for Indian market",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────
class Preferences(BaseModel):
    budget_lakh: float
    fuel_pref: str = "any"          # petrol | diesel | electric | cng | hybrid | any
    seats_needed: int = 5
    transmission: str = "any"       # automatic | manual | any
    use_case: str = "mixed"         # city | highway | family | offroad | thrill | mixed
    top_priority: str = ""          # mileage | safety | features | low_running_cost
    home_charging: bool = False     # relevant for EV
    name: Optional[str] = None


class ShortlistItem(BaseModel):
    session_id: str
    car_id: str


class CompareRequest(BaseModel):
    car_ids: list[str]


# ── Helper: OpenRouter / Gemma 4 AI reasoning ────────────────────────────────
OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free"

def generate_ai_reasoning(prefs: dict, top_cars: list[dict]) -> str:
    """
    Use Gemma 4 via OpenRouter to generate personalized reasoning for each
    car recommendation. Falls back gracefully if API key is missing.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        return _fallback_reasoning(prefs, top_cars)

    # OpenRouter exposes an OpenAI-compatible endpoint
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    cars_summary = []
    for c in top_cars[:3]:
        cars_summary.append(
            f"- {c['make']} {c['model']} {c['variant']} (Rs {c['price_lakh']}L, {c['fuel']}, "
            f"{c['transmission']}, {c['seats']} seats, "
            f"{c.get('mileage_kmpl') or c.get('range_km', 'N/A')} "
            f"{'kmpl' if c.get('mileage_kmpl') else 'km range'}, "
            f"safety: {c['safety_rating']}/5 stars)"
        )

    prompt = f"""You are a friendly, expert car advisor in India. A buyer has shared their needs and I have algorithmically shortlisted cars for them.

Buyer profile:
- Budget: Rs {prefs.get('budget_lakh')} lakh
- Fuel preference: {prefs.get('fuel_pref', 'any')}
- Seats needed: {prefs.get('seats_needed', 5)}
- Transmission: {prefs.get('transmission', 'any')}
- Main use: {prefs.get('use_case', 'mixed')}
- Top priority: {prefs.get('top_priority') or 'balanced'}
- Has home EV charging: {prefs.get('home_charging', False)}

Top 3 shortlisted cars:
{chr(10).join(cars_summary)}

Write SHORT, punchy, PERSONALIZED "why this car for YOU" reasoning for each car. 2-3 sentences max per car. Be specific to their stated needs, not generic.

Respond with ONLY a valid JSON array in this exact format, no extra text, no markdown:
[
  {{"car_id": "{top_cars[0]['id'] if len(top_cars) > 0 else 'car1'}", "reasoning": "..."}},
  {{"car_id": "{top_cars[1]['id'] if len(top_cars) > 1 else 'car2'}", "reasoning": "..."}},
  {{"car_id": "{top_cars[2]['id'] if len(top_cars) > 2 else 'car3'}", "reasoning": "..."}}
]"""

    try:
        response = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
            extra_headers={
                "HTTP-Referer": "https://carfind.ai",   # optional, shown in OR dashboard
                "X-Title": "CarFind AI",
            },
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if the model wraps output in them
        raw = raw.strip("```json").strip("```").strip()
        reasonings = json.loads(raw)
        result = {}
        for r in reasonings:
            result[r["car_id"]] = r["reasoning"]
        return json.dumps(result)
    except Exception as e:
        print(f"[OpenRouter] AI reasoning failed: {e} — using fallback")
        return _fallback_reasoning(prefs, top_cars)


def _fallback_reasoning(prefs: dict, top_cars: list[dict]) -> str:
    """Rule-based fallback reasoning when Anthropic API unavailable."""
    result = {}
    for car in top_cars[:3]:
        parts = []
        budget = prefs.get("budget_lakh", 20)
        if car["price_lakh"] <= budget * 0.85:
            parts.append(f"Priced well within your ₹{budget}L budget")
        if prefs.get("top_priority") == "safety" and car.get("safety_rating", 0) >= 4:
            parts.append(f"meets your safety priority with {car['safety_rating']}/5 stars")
        if prefs.get("top_priority") == "mileage":
            m = car.get("mileage_kmpl") or car.get("range_km")
            if m:
                parts.append(f"delivers strong efficiency at {m} {'kmpl' if car.get('mileage_kmpl') else 'km range'}")
        if prefs.get("use_case") == "family" and car.get("seats", 5) >= 7:
            parts.append("seats your whole family comfortably")
        if not parts:
            parts.append(f"a solid {car['type']} match for your stated preferences")
        result[car["id"]] = ". ".join(p.capitalize() for p in parts) + "."
    return json.dumps(result)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "CarFind AI backend is live", "cars_in_db": len(CARS)}


@app.get("/health")
def health():
    """Railway health check endpoint."""
    return {"ok": True}


@app.get("/api/meta")
def get_meta():
    """Return dataset metadata for UI dropdowns."""
    return {
        "makes": get_all_makes(),
        "budget_range": get_budget_range(),
        "total_cars": len(CARS),
        "segments": SEGMENT_LABELS,
    }


@app.post("/api/recommend")
def recommend(prefs: Preferences):
    """
    Core recommendation endpoint.
    Filters + ranks cars, gets AI reasoning, persists session.
    """
    pref_dict = prefs.model_dump()
    top_cars = filter_and_rank(pref_dict, top_n=5)

    if not top_cars:
        raise HTTPException(status_code=404, detail="No cars found matching your preferences. Try widening your budget or changing filters.")

    # AI reasoning for top 3
    ai_json = generate_ai_reasoning(pref_dict, top_cars)
    ai_reasonings = json.loads(ai_json)

    # Attach reasoning to cars
    for car in top_cars:
        car["ai_reason"] = ai_reasonings.get(car["id"], "")

    # Persist session
    session_id = f"s_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions VALUES (?, ?, ?, ?, ?)",
        (
            session_id,
            json.dumps(pref_dict),
            json.dumps([c["id"] for c in top_cars]),
            ai_json,
            datetime.utcnow().isoformat(),
        ),
    )
    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "cars": top_cars,
        "prefs": pref_dict,
    }


@app.get("/api/car/{car_id}")
def get_car(car_id: str):
    """Get full details for a single car."""
    car = get_car_by_id(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@app.post("/api/compare")
def compare_cars(req: CompareRequest):
    """
    Return a structured comparison of up to 4 cars.
    """
    if len(req.car_ids) < 2 or len(req.car_ids) > 4:
        raise HTTPException(status_code=400, detail="Compare 2-4 cars at a time")

    cars = []
    for cid in req.car_ids:
        car = get_car_by_id(cid)
        if not car:
            raise HTTPException(status_code=404, detail=f"Car {cid} not found")
        cars.append(car)

    # Build comparison matrix
    fields = [
        ("Price (ex-showroom)", lambda c: f"₹{c['price_lakh']}L"),
        ("Fuel Type", lambda c: c["fuel"]),
        ("Transmission", lambda c: c["transmission"]),
        ("Mileage / Range", lambda c: f"{c.get('mileage_kmpl', '')} kmpl" if c.get("mileage_kmpl") else f"{c.get('range_km', 'N/A')} km"),
        ("Engine", lambda c: f"{c.get('engine_cc', 'Electric')} cc" if c.get("engine_cc") else "Electric motor"),
        ("Seats", lambda c: str(c["seats"])),
        ("Boot (litres)", lambda c: str(c.get("boot_litres", "N/A"))),
        ("Safety Rating", lambda c: f"{'⭐' * c.get('safety_rating', 0)} ({c.get('safety_rating', 'N/A')}/5)"),
        ("Monthly EMI", lambda c: f"~₹{c.get('monthly_emi_approx', 'N/A'):,}"),
    ]

    table = []
    for label, getter in fields:
        row = {"field": label}
        for car in cars:
            row[car["id"]] = getter(car)
        table.append(row)

    return {
        "cars": cars,
        "comparison_table": table,
    }


@app.post("/api/shortlist")
def add_to_shortlist(item: ShortlistItem):
    """Save a car to the user's shortlist for a session."""
    conn = get_db()
    # Check not already in shortlist
    existing = conn.execute(
        "SELECT id FROM shortlists WHERE session_id=? AND car_id=?",
        (item.session_id, item.car_id),
    ).fetchone()
    if existing:
        conn.close()
        return {"message": "Already in shortlist"}
    conn.execute(
        "INSERT INTO shortlists (session_id, car_id, added_at) VALUES (?, ?, ?)",
        (item.session_id, item.car_id, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"message": "Added to shortlist"}


@app.get("/api/shortlist/{session_id}")
def get_shortlist(session_id: str):
    """Retrieve saved shortlist for a session."""
    conn = get_db()
    rows = conn.execute(
        "SELECT car_id FROM shortlists WHERE session_id=? ORDER BY added_at",
        (session_id,),
    ).fetchall()
    conn.close()
    car_ids = [r["car_id"] for r in rows]
    cars = [get_car_by_id(cid) for cid in car_ids if get_car_by_id(cid)]
    return {"session_id": session_id, "cars": cars}


@app.get("/api/browse")
def browse_cars(
    type: Optional[str] = None,
    fuel: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_safety: Optional[int] = None,
):
    """Browse / filter cars without personalization."""
    result = CARS[:]
    if type:
        result = [c for c in result if c["type"].lower() == type.lower()]
    if fuel:
        result = [c for c in result if c["fuel"].lower() == fuel.lower()]
    if min_price is not None:
        result = [c for c in result if c["price_lakh"] >= min_price]
    if max_price is not None:
        result = [c for c in result if c["price_lakh"] <= max_price]
    if min_safety is not None:
        result = [c for c in result if c.get("safety_rating", 0) >= min_safety]
    result.sort(key=lambda c: c["price_lakh"])
    return {"count": len(result), "cars": result}


@app.get("/api/stats")
def get_stats():
    """Fun stats for the platform."""
    conn = get_db()
    sessions = conn.execute("SELECT COUNT(*) as c FROM sessions").fetchone()["c"]
    shortlists = conn.execute("SELECT COUNT(*) as c FROM shortlists").fetchone()["c"]
    conn.close()
    return {
        "total_cars": len(CARS),
        "sessions_created": sessions,
        "shortlist_saves": shortlists,
        "fuels": list({c["fuel"] for c in CARS}),
        "types": list({c["type"] for c in CARS}),
    }
