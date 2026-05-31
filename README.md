# CarFind AI 🚗

> **Smart car recommendations for the Indian market.** Answer 6 questions. Get a personalized shortlist with AI-powered reasoning, side-by-side comparison, and a clear path from "confused" to "confident."

---

## Live Demo

> If deployed: `https://carfind.vercel.app` (replace with your URL)

---

## Quick Start (2 minutes)

### Option A — Shell script (recommended for local dev)

```bash
git clone <your-repo>
cd cardekho-ai

# Optional: add your Anthropic key for AI reasoning
export ANTHROPIC_API_KEY=sk-ant-...

bash dev.sh
```

→ Frontend: **http://localhost:3000**  
→ Backend API: **http://localhost:8000**  
→ Swagger docs: **http://localhost:8000/docs**

### Option B — Docker Compose

```bash
# With AI reasoning (optional)
ANTHROPIC_API_KEY=sk-ant-... docker compose up

# Without AI reasoning (falls back gracefully to rule-based explanations)
docker compose up
```

### Option C — Manual (backend + frontend separately)

```bash
# Terminal 1 — Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

---

## What I Built & Why

### The Product

**CarFind AI** is a 6-question personalized car advisor for the Indian market.

The user answers:
1. Budget (slider + quick-select pills)
2. Fuel type preference
3. Seat count
4. Primary use case (city / highway / family / off-road / thrill)
5. Transmission preference
6. Top priority (safety / mileage / features / lowest cost)

The backend filters and scores **40+ cars** from a realistic Indian market dataset (hatchbacks → luxury SUVs, all fuel types), ranks them against the user's stated preferences using a weighted scoring engine, and returns a shortlist of 5 cars with:

- Match percentage
- AI-generated "why this car for YOU" reasoning (Claude Sonnet)
- Key specs, pros/cons, estimated EMI
- Save-to-shortlist (persisted in SQLite)
- Side-by-side comparison table (up to 4 cars)

### Why this scope and not something else

I deliberately cut:
- **User authentication** — no car buyer needs to log in to get a recommendation. Added 30–40 minutes for zero user value.
- **Real scraped data** — a well-curated static dataset is more reliable and demonstrably correct. Scrapers break.
- **Image carousel** — CDN latency and image rights complexity for cosmetic value.
- **Saved sessions across devices** — session IDs are stored client-side (localStorage-style). This is the correct MVP tradeoff.
- **More than 5 results** — a shortlist of 5 is enough. More creates the same analysis paralysis the product is supposed to solve.

What I shipped instead of polish: a comparison table, save-to-shortlist with DB persistence, a graceful AI fallback when no API key is present, and a clean API with Swagger docs.

---

## Tech Stack & Why

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript** | Fast, zero-config, deployes to Vercel in one click |
| Styling | **Tailwind CSS** | Ship fast, no CSS files to manage |
| Backend | **FastAPI (Python)** | Best DX for AI-adjacent backends; async; auto-generated Swagger |
| AI | **Anthropic Claude Sonnet** via API | Best reasoning quality for personalized explanations |
| Database | **SQLite** | No infra setup; sufficient for sessions + shortlists at this scale |
| Dataset | **Custom (40+ cars)** | Hand-curated, realistic, fully controlled — no scraping brittleness |

**What I'd swap at scale:** SQLite → Postgres, static dataset → real-time scraper + admin panel, Next.js → same (it scales fine).

---

## Architecture

```
┌─────────────────────┐       HTTP        ┌──────────────────────────────┐
│   Next.js Frontend  │ ◄────────────────► │     FastAPI Backend           │
│   (port 3000)       │                   │     (port 8000)               │
│                     │                   │                               │
│  • Quiz wizard      │                   │  /api/recommend               │
│  • Results grid     │                   │    → filter_and_rank()        │
│  • Compare table    │                   │    → generate_ai_reasoning()  │
│  • Save shortlist   │                   │    → persist session (SQLite) │
└─────────────────────┘                   │                               │
                                          │  /api/compare                 │
                                          │  /api/shortlist               │
                                          │  /api/browse                  │
                                          │  /api/stats                   │
                                          └──────────────┬───────────────┘
                                                         │
                                          ┌──────────────▼───────────────┐
                                          │     Anthropic Claude API      │
                                          │  (graceful fallback if missing)│
                                          └──────────────────────────────┘
```

### Scoring Engine (`recommender.py`)

The car filtering uses a **penalty-based scoring system** (lower score = better match):

- **Budget fit** (40 pts weight): Linear penalty for over-budget cars. Slight penalty for cars far below budget (underutilization).
- **Fuel preference** (20 pts): Hard penalty for mismatches. Extra penalty for EV without home charging.
- **Seat requirement** (15 pts): Hard penalty if car can't fit required passengers.
- **Transmission** (10 pts): Penalty for manual when automatic requested. Lighter reverse penalty.
- **Use case** (15 pts): Keyword matching on `best_for` field.
- **Priority bonuses** (up to −10 pts): Safety rating, mileage, feature count, or fuel type bonuses applied when a priority is set.

---

## AI Tool Usage

### What I delegated to AI

- **Boilerplate scaffolding** — Next.js component skeletons, FastAPI route structure
- **CSS animations** — keyframe definitions, transition timing
- **Dataset expansion** — initial list of cars with specs; I verified and corrected each entry against known Indian market data
- **Error handling patterns** — try/catch wrappers, fallback logic

### Where AI helped most

- **Speed**: The quiz UI (`QuizStep`) went from concept to working in ~15 minutes. Manually writing all the conditional grid layouts would have taken 45.
- **API structure**: FastAPI + Pydantic models generated cleanly and required minimal editing.

### Where AI got in the way

- **Dataset accuracy**: AI-generated car specs were frequently wrong (wrong mileage, wrong price, wrong variant names). Every car was manually verified against CarDekho, CarWale, and official brand sites. The AI was useful for structure, not for facts.
- **Tailwind specifics**: AI suggestions sometimes used non-existent Tailwind classes or wrong responsive prefixes. Faster to write those myself.
- **Overengineering**: AI kept suggesting Redux, React Query, and full auth systems. Explicitly told it not to; the simpler approach is better for an MVP.

### The honest breakdown

~60% AI-assisted (structure, boilerplate, repetitive patterns), ~40% manual (scoring logic, dataset, verification, debugging, product decisions, anything requiring judgment).

---

## API Reference

All endpoints documented interactively at `/docs` (Swagger).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/recommend` | Core: takes preferences, returns ranked cars + AI reasoning |
| POST | `/api/compare` | Side-by-side comparison of 2–4 cars |
| POST | `/api/shortlist` | Save a car to session shortlist |
| GET | `/api/shortlist/{session_id}` | Retrieve saved shortlist |
| GET | `/api/browse` | Browse/filter all cars |
| GET | `/api/car/{car_id}` | Get full details for one car |
| GET | `/api/meta` | Dataset metadata (makes, budget range, segments) |
| GET | `/api/stats` | Platform stats (sessions, saves, total cars) |

---

## If I Had Another 4 Hours

In priority order:

1. **Dealer locator integration** — After shortlisting, show the 3 nearest authorized dealers for each shortlisted car using Google Maps API. Highest direct user value.

2. **"Convince me otherwise" mode** — User selects a car they're already leaning toward; AI cross-examines their choice against alternatives. More fun, more useful.

3. **Cost of ownership calculator** — 5-year TCO including fuel, insurance (approximate), maintenance, and depreciation. This is the data that actually changes minds.

4. **Real-time price sync** — A nightly scraper (Playwright + CarDekho) to keep prices and availability current. The static dataset is the biggest limitation right now.

5. **Share shortlist** — Generate a permalink for a shortlist to share with family before making the purchase decision. High virality.

---

## Dataset Coverage

40+ cars across all major Indian market segments:

| Segment | Examples |
|---|---|
| Entry Hatchback | Alto K10 |
| Budget Hatchback | WagonR, Tiago CNG |
| Premium Hatchback | i20 Turbo, Baleno, Polo |
| Compact Sedan | Dzire |
| Mid Sedan | City, Verna, Slavia |
| Compact SUV | Nexon, Brezza, Venue, Sonet, Thar Roxx |
| Mid-size SUV | Creta, Seltos, Taigun, Kushaq, Grand Vitara, Hyryder |
| 7-Seater SUV | Safari, XUV700, Scorpio N, Alcazar |
| Premium SUV | Fortuner, Meridian, Gloster |
| MPV | Carens, Ertiga, Innova Hycross |
| Electric | Nexon EV, Punch EV, ZS EV, Ioniq 5, BYD Seal |
| Hot Hatch | i20 N Line |

---

## Project Structure

```
cardekho-ai/
├── backend/
│   ├── main.py           # FastAPI app, all routes
│   ├── recommender.py    # Scoring + filtering engine
│   ├── cars_data.py      # 40+ car dataset
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx      # Full UI (intro → quiz → results → compare)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   └── api.ts        # Typed API client
│   ├── next.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── dev.sh               # One-command local dev
└── README.md
```

---

## Notes

- The Anthropic API key is **optional** — the app works fully without it, falling back to rule-based explanations.
- All car prices are approximate ex-showroom as of late 2024/early 2025. Always verify with dealers.
- The scoring engine is deterministic and transparent — no black-box ML, just weighted rules you can read and audit.
