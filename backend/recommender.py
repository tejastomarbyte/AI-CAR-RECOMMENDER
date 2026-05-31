"""
Smart car filtering and scoring engine.
Takes user preferences and returns ranked car recommendations.
"""

from typing import Optional
from cars_data import CARS


def score_car(car: dict, prefs: dict) -> float:
    """
    Score a car against user preferences. Returns 0-100.
    Lower score = better match.
    """
    score = 0.0
    weights = {
        "budget": 40,
        "fuel": 20,
        "seats": 15,
        "transmission": 10,
        "use_case": 15,
    }

    # ── Budget fit (0-40 pts penalty) ────────────────────────────────────────
    budget = prefs.get("budget_lakh", 20)
    car_price = car["price_lakh"]
    if car_price > budget * 1.05:            # > 5% over budget: hard penalty
        over_pct = (car_price - budget) / budget
        score += min(40, over_pct * 80)
    elif car_price < budget * 0.45:          # way under budget: slight miss
        under_pct = (budget - car_price) / budget
        score += min(15, under_pct * 20)

    # ── Fuel preference (0-20 pts)────────────────────────────────────────────
    pref_fuel = prefs.get("fuel_pref", "any")
    if pref_fuel != "any":
        if car["fuel"].lower() != pref_fuel.lower():
            # Partial penalties — electric penalty higher if no home charging
            if car["fuel"] == "Electric" and not prefs.get("home_charging", False):
                score += 20
            elif pref_fuel == "Electric" and car["fuel"] != "Electric":
                score += 20
            else:
                score += 10

    # ── Seat requirement (0-15 pts) ───────────────────────────────────────────
    req_seats = prefs.get("seats_needed", 5)
    if car["seats"] < req_seats:
        score += 15  # Can't fit people: hard penalty
    elif car["seats"] > req_seats + 2 and req_seats <= 5:
        score += 3   # Overkill: slight hit

    # ── Transmission preference (0-10 pts) ────────────────────────────────────
    pref_trans = prefs.get("transmission", "any")
    if pref_trans == "automatic":
        if car["transmission"] == "Manual":
            score += 10
    elif pref_trans == "manual":
        if car["transmission"] not in ("Manual",):
            score += 5  # Light penalty; automatics are just easier

    # ── Use-case alignment (0-15 pts) ────────────────────────────────────────
    use_case = prefs.get("use_case", "mixed")
    car_best = " ".join(car.get("best_for", [])).lower()

    use_case_map = {
        "city":     ["city", "urban", "commute", "parking", "traffic"],
        "highway":  ["highway", "outstation", "long", "touring", "road trip"],
        "family":   ["family", "kids", "school", "7", "large"],
        "offroad":  ["off-road", "adventure", "terrain", "4wd", "rural"],
        "thrill":   ["enthusiast", "fun", "sport", "performance", "driving"],
        "mixed":    [],  # no penalty
    }

    relevant_keywords = use_case_map.get(use_case, [])
    if relevant_keywords:
        match = any(kw in car_best for kw in relevant_keywords)
        if not match:
            score += 8  # Slight mismatch

    # ── Priority bonuses (negative score = better) ───────────────────────────
    priority = prefs.get("top_priority", "")
    if priority == "mileage":
        mileage = car.get("mileage_kmpl", 0) or car.get("range_km", 0) / 10
        if mileage > 0:
            score -= min(10, (mileage - 15) * 0.5)
    elif priority == "safety":
        safety = car.get("safety_rating", 3)
        score -= (safety - 2) * 3       # 5-star gets -9
    elif priority == "features":
        n_features = len(car.get("features", []))
        score -= min(10, n_features * 0.8)
    elif priority == "low_running_cost":
        if car["fuel"] in ("CNG", "Electric", "Hybrid"):
            score -= 8

    return max(0, score)


def filter_and_rank(prefs: dict, top_n: int = 5) -> list[dict]:
    """
    Filter and rank cars by user preferences.
    Returns top N best-matching cars with scores.
    """
    results = []

    for car in CARS:
        # Hard filter: electric without home charging and budget < 20L
        # (won't cut, just penalise via score)

        s = score_car(car, prefs)
        results.append({**car, "_score": round(s, 2)})

    # Sort ascending (lower score = better match)
    results.sort(key=lambda c: c["_score"])

    # Return top N, add rank
    top = results[:top_n]
    for i, car in enumerate(top):
        car["rank"] = i + 1
        car["match_pct"] = max(10, 100 - int(car["_score"] * 1.5))

    return top


def get_car_by_id(car_id: str) -> Optional[dict]:
    for car in CARS:
        if car["id"] == car_id:
            return car
    return None


def get_all_makes() -> list[str]:
    return sorted(list({c["make"] for c in CARS}))


def get_budget_range() -> dict:
    prices = [c["price_lakh"] for c in CARS]
    return {"min": min(prices), "max": max(prices)}
