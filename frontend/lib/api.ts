const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Preferences {
  budget_lakh: number;
  fuel_pref: string;
  seats_needed: number;
  transmission: string;
  use_case: string;
  top_priority: string;
  home_charging: boolean;
  name?: string;
}

export interface Car {
  id: string;
  make: string;
  model: string;
  variant: string;
  type: string;
  segment: string;
  price_lakh: number;
  fuel: string;
  transmission: string;
  mileage_kmpl?: number;
  range_km?: number;
  engine_cc?: number;
  seats: number;
  boot_litres?: number;
  safety_rating: number;
  features: string[];
  pros: string[];
  cons: string[];
  best_for: string[];
  monthly_emi_approx: number;
  rank?: number;
  match_pct?: number;
  ai_reason?: string;
  _score?: number;
}

export interface RecommendResponse {
  session_id: string;
  cars: Car[];
  prefs: Preferences;
}

export interface CompareResponse {
  cars: Car[];
  comparison_table: Array<{ field: string; [carId: string]: string }>;
}

export async function getRecommendations(prefs: Preferences): Promise<RecommendResponse> {
  const res = await fetch(`${API_BASE}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to get recommendations");
  }
  return res.json();
}

export async function compareCars(carIds: string[]): Promise<CompareResponse> {
  const res = await fetch(`${API_BASE}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ car_ids: carIds }),
  });
  if (!res.ok) throw new Error("Compare failed");
  return res.json();
}

export async function addToShortlist(sessionId: string, carId: string): Promise<void> {
  await fetch(`${API_BASE}/api/shortlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, car_id: carId }),
  });
}

export async function getShortlist(sessionId: string): Promise<{ cars: Car[] }> {
  const res = await fetch(`${API_BASE}/api/shortlist/${sessionId}`);
  return res.json();
}

export async function getStats(): Promise<{
  total_cars: number;
  sessions_created: number;
  shortlist_saves: number;
}> {
  const res = await fetch(`${API_BASE}/api/stats`);
  return res.json();
}
