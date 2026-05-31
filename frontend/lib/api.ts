const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

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

// Shared fetch wrapper with clear error messages
async function apiFetch(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
  } catch (e) {
    // Network-level failure: backend unreachable, wrong URL, CORS preflight blocked
    throw new Error(
      `Cannot reach backend at ${API_BASE}. ` +
      `Check that NEXT_PUBLIC_API_URL is set correctly in Vercel environment variables ` +
      `and that your Railway backend is running. (${String(e)})`
    );
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch { /* ignore parse errors */ }
    throw new Error(`Backend error: ${detail}`);
  }

  return res.json();
}

export async function getRecommendations(prefs: Preferences): Promise<RecommendResponse> {
  return apiFetch("/api/recommend", {
    method: "POST",
    body: JSON.stringify(prefs),
  });
}

export async function compareCars(carIds: string[]): Promise<CompareResponse> {
  return apiFetch("/api/compare", {
    method: "POST",
    body: JSON.stringify({ car_ids: carIds }),
  });
}

export async function addToShortlist(sessionId: string, carId: string): Promise<void> {
  await apiFetch("/api/shortlist", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, car_id: carId }),
  });
}

export async function getShortlist(sessionId: string): Promise<{ cars: Car[] }> {
  return apiFetch(`/api/shortlist/${sessionId}`);
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export { API_BASE };
