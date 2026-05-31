"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getRecommendations, compareCars, addToShortlist,
  type Preferences, type Car, type RecommendResponse, type CompareResponse,
} from "@/lib/api";

// ── Icons ─────────────────────────────────────────────────────────────────────
const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "#C5A028" : "none"} stroke="#C5A028" strokeWidth="2">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
);
const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const BarChartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "#E8450A" : "none"} stroke="#E8450A" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "intro" | "questions" | "loading" | "results" | "compare";

interface QuizState {
  name: string;
  budget_lakh: number;
  fuel_pref: string;
  seats_needed: number;
  transmission: string;
  use_case: string;
  top_priority: string;
  home_charging: boolean;
}

const DEFAULT_QUIZ: QuizState = {
  name: "",
  budget_lakh: 15,
  fuel_pref: "any",
  seats_needed: 5,
  transmission: "any",
  use_case: "mixed",
  top_priority: "",
  home_charging: false,
};

// ── Reusable option card ──────────────────────────────────────────────────────
function OptionCard({
  selected, onClick, icon, label, sub, wide = false,
}: {
  selected: boolean; onClick: () => void; icon?: string;
  label: string; sub?: string; wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border-2 p-4 text-left cursor-pointer select-none",
        "transition-all duration-150 active:scale-95",
        wide ? "col-span-2" : "",
        selected
          ? "bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-200"
          : "bg-white border-stone-200 text-stone-700 hover:border-orange-400 hover:shadow-md",
      ].join(" ")}
    >
      {icon && <div className="text-2xl mb-2 leading-none">{icon}</div>}
      <div className="font-semibold text-sm leading-tight">{label}</div>
      {sub && (
        <div className={`text-xs mt-0.5 leading-snug ${selected ? "text-orange-100" : "text-stone-400"}`}>
          {sub}
        </div>
      )}
    </button>
  );
}

// ── Car Card ──────────────────────────────────────────────────────────────────
function CarCard({
  car, rank, sessionId, inCompare, onToggleCompare, onSaveShortlist, saved,
}: {
  car: Car; rank: number; sessionId: string; inCompare: boolean;
  onToggleCompare: (id: string) => void; onSaveShortlist: (id: string) => void; saved: boolean;
}) {
  const fuelColor: Record<string, string> = {
    Petrol: "bg-amber-100 text-amber-800",
    Diesel: "bg-blue-100 text-blue-800",
    Electric: "bg-green-100 text-green-800",
    CNG: "bg-teal-100 text-teal-800",
    Hybrid: "bg-purple-100 text-purple-800",
  };

  return (
    <div
      className={`car-card bg-white rounded-2xl border overflow-hidden ${rank === 1 ? "border-orange-400 shadow-xl" : "border-stone-200 shadow-sm"}`}
      style={{ animation: `slideUp 0.45s ease ${rank * 0.08}s both` }}
    >
      {/* Rank bar */}
      <div className={`px-5 py-2.5 flex items-center justify-between ${rank === 1 ? "bg-orange-600" : "bg-stone-50 border-b border-stone-100"}`}>
        <div className="flex items-center gap-2">
          <span className={`font-serif font-bold text-base ${rank === 1 ? "text-white" : "text-stone-500"}`}>
            #{rank}
          </span>
          {rank === 1 && (
            <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full font-medium">
              Best Match
            </span>
          )}
        </div>
        <span className={`text-sm font-bold ${rank === 1 ? "text-white" : "text-green-700"}`}>
          {car.match_pct}% match
        </span>
      </div>

      <div className="p-5">
        {/* Name + price */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-serif font-bold text-xl text-stone-900 leading-tight">
              {car.make} {car.model}
            </h3>
            <p className="text-stone-400 text-xs mt-0.5">{car.variant}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="font-serif font-bold text-2xl text-stone-900">₹{car.price_lakh}L</div>
            <div className="text-xs text-stone-400">ex-showroom</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${fuelColor[car.fuel] || "bg-gray-100 text-gray-600"}`}>
            {car.fuel}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-600">
            {car.transmission}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-600">
            {car.type}
          </span>
        </div>

        {/* Specs row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-stone-50 rounded-xl p-3 text-center">
            <div className="font-serif font-bold text-lg text-stone-900 leading-none">
              {car.mileage_kmpl ? car.mileage_kmpl : `${car.range_km}`}
            </div>
            <div className="text-xs text-stone-400 mt-1">
              {car.mileage_kmpl ? "kmpl" : "km range"}
            </div>
          </div>
          <div className="bg-stone-50 rounded-xl p-3 text-center">
            <div className="flex justify-center gap-0.5 mb-1">
              {[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= car.safety_rating} />)}
            </div>
            <div className="text-xs text-stone-400">Safety</div>
          </div>
          <div className="bg-stone-50 rounded-xl p-3 text-center">
            <div className="font-serif font-bold text-lg text-stone-900 leading-none">{car.seats}</div>
            <div className="text-xs text-stone-400 mt-1">seats</div>
          </div>
        </div>

        {/* AI reasoning */}
        {car.ai_reason && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <div className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
              ✨ Why this car for you
            </div>
            <p className="text-sm text-amber-900 leading-relaxed">{car.ai_reason}</p>
          </div>
        )}

        {/* Pros */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Strengths
          </div>
          <div className="space-y-1.5">
            {car.pros.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="text-green-500 mt-0.5 shrink-0"><CheckIcon /></span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cons */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Watch out for
          </div>
          <div className="space-y-1.5">
            {car.cons.slice(0, 2).map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-stone-400">
                <span className="mt-0.5 shrink-0 text-orange-300">—</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* EMI */}
        <div className="bg-stone-50 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-stone-400">Est. EMI (5yr, 10%)</span>
          <span className="font-semibold text-stone-900">
            ₹{car.monthly_emi_approx?.toLocaleString()}/mo
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSaveShortlist(car.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
              saved
                ? "bg-orange-50 border-orange-300 text-orange-600"
                : "border-stone-200 text-stone-400 hover:border-orange-400 hover:text-orange-500"
            }`}
          >
            <HeartIcon filled={saved} />
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => onToggleCompare(car.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
              inCompare
                ? "bg-stone-900 text-white border-stone-900"
                : "border-stone-200 text-stone-400 hover:border-stone-700 hover:text-stone-700"
            }`}
          >
            <BarChartIcon />
            {inCompare ? "In Compare" : "Compare"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Compare Table ─────────────────────────────────────────────────────────────
function CompareTable({ data, onBack }: { data: CompareResponse; onBack: () => void }) {
  const cars = data.cars;
  const table = data.comparison_table;

  const bestIdx = (field: string, values: string[]) => {
    if (field === "Safety Rating") {
      const ns = values.map(v => (v.match(/⭐/g) || []).length);
      return ns.indexOf(Math.max(...ns));
    }
    if (field === "Mileage / Range") {
      const ns = values.map(v => parseFloat(v) || 0);
      const m = Math.max(...ns);
      return m > 0 ? ns.indexOf(m) : -1;
    }
    if (field === "Price (ex-showroom)") {
      const ns = values.map(v => parseFloat(v.replace("₹","").replace("L","")) || 99999);
      return ns.indexOf(Math.min(...ns));
    }
    return -1;
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease both" }}>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBack}
          className="text-sm text-stone-400 hover:text-stone-900 transition-colors cursor-pointer">
          ← Back
        </button>
        <h2 className="font-serif font-bold text-2xl text-stone-900">Side-by-Side Comparison</h2>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-auto shadow-sm">
        <div className="grid border-b border-stone-100 min-w-max"
          style={{ gridTemplateColumns: `200px repeat(${cars.length}, 1fr)` }}>
          <div className="p-4 bg-stone-50" />
          {cars.map(car => (
            <div key={car.id} className="p-4 bg-stone-50 border-l border-stone-100 text-center min-w-[180px]">
              <div className="font-serif font-bold text-stone-900 text-sm">{car.make}</div>
              <div className="font-serif font-bold text-stone-900">{car.model}</div>
              <div className="text-xs text-stone-400 mt-0.5">{car.variant}</div>
            </div>
          ))}
        </div>
        {table.map((row, i) => {
          const vals = cars.map(c => row[c.id] || "—");
          const bi = bestIdx(row.field, vals);
          return (
            <div key={i}
              className={`grid border-b border-stone-100 last:border-0 min-w-max ${i % 2 ? "bg-stone-50/40" : ""}`}
              style={{ gridTemplateColumns: `200px repeat(${cars.length}, 1fr)` }}>
              <div className="p-3 px-4 text-sm font-medium text-stone-400 flex items-center">{row.field}</div>
              {vals.map((val, ci) => (
                <div key={ci}
                  className={`p-3 text-center text-sm border-l border-stone-100 flex items-center justify-center font-medium min-w-[180px] ${
                    ci === bi ? "text-green-700 bg-green-50" : "text-stone-800"
                  }`}>
                  {val}
                  {ci === bi && <span className="ml-1 text-green-400 text-xs">✓</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quiz Step ────────────────────────────────────────────────────────────────
function QuizStep({
  initialQuiz,
  onSubmit,
}: {
  initialQuiz: QuizState;
  onSubmit: (q: QuizState) => void;
}) {
  const [quiz, setQuiz] = useState<QuizState>(initialQuiz);
  const [page, setPage] = useState(0);
  const TOTAL = 6;

  // Generic field updater — always uses functional update so never stale
  function update<K extends keyof QuizState>(key: K, val: QuizState[K]) {
    setQuiz(prev => {
      const next = { ...prev, [key]: val };
      return next;
    });
  }

  const progress = Math.round(((page + 1) / TOTAL) * 100);

  // ── Labels for the summary strip ───────────────────────────────────────────
  const summaryLabels: Record<string, string> = {
    any: "Any", petrol: "Petrol", diesel: "Diesel",
    electric: "Electric", cng: "CNG", hybrid: "Hybrid",
    automatic: "Auto", manual: "Manual",
    city: "City", highway: "Highway", family: "Family",
    offroad: "Off-road", thrill: "Fun", mixed: "Mixed",
    safety: "Safety", mileage: "Mileage", features: "Features",
    low_running_cost: "Low cost", "": "Balanced",
  };

  // ── Question renderers — defined as functions, called at render time ────────
  // This means they always read the latest quiz state.

  function renderBudget() {
    return (
      <div>
        <div className="flex items-end justify-between mb-5">
          <div>
            <span className="font-serif text-5xl font-bold text-orange-600">
              ₹{quiz.budget_lakh}L
            </span>
            <span className="text-stone-400 ml-2 text-sm">ex-showroom</span>
          </div>
          <span className="text-sm text-stone-400 pb-1">
            {quiz.budget_lakh <= 7 ? "Entry"
              : quiz.budget_lakh <= 12 ? "Budget"
              : quiz.budget_lakh <= 18 ? "Mid"
              : quiz.budget_lakh <= 30 ? "Premium"
              : "Luxury"}
          </span>
        </div>
        <input
          type="range" min={4} max={50} step={0.5}
          value={quiz.budget_lakh}
          onChange={e => {
            const v = parseFloat(e.target.value);
            update("budget_lakh", v);
            (e.target as HTMLInputElement).style.setProperty(
              "--range-pct", `${((v - 4) / 46) * 100}%`
            );
          }}
          style={{ "--range-pct": `${((quiz.budget_lakh - 4) / 46) * 100}%` } as React.CSSProperties}
          className="w-full cursor-pointer"
        />
        <div className="flex justify-between text-xs text-stone-400 mt-1.5">
          <span>₹4L</span><span>₹50L+</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          {[7, 10, 15, 20, 25, 35].map(b => (
            <button
              key={b}
              type="button"
              onClick={() => update("budget_lakh", b)}
              className={[
                "px-4 py-1.5 rounded-full text-sm font-medium border-2 cursor-pointer transition-all",
                quiz.budget_lakh === b
                  ? "bg-orange-600 text-white border-orange-600 shadow-md"
                  : "border-stone-200 text-stone-500 hover:border-orange-400 hover:text-orange-600 bg-white",
              ].join(" ")}
            >
              ₹{b}L
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderFuel() {
    const opts = [
      { v: "any",      l: "No preference", icon: "🔄", sub: "Show all options" },
      { v: "petrol",   l: "Petrol",         icon: "⛽", sub: "Widest choice" },
      { v: "diesel",   l: "Diesel",          icon: "🛢️", sub: "Best for highways" },
      { v: "electric", l: "Electric",        icon: "⚡", sub: "Lowest running cost" },
      { v: "cng",      l: "CNG",             icon: "🌿", sub: "Ultra-low fuel cost" },
      { v: "hybrid",   l: "Hybrid",          icon: "🔋", sub: "Best mileage" },
    ];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {opts.map(({ v, l, icon, sub }) => (
          <OptionCard
            key={v}
            selected={quiz.fuel_pref === v}
            onClick={() => update("fuel_pref", v)}
            icon={icon} label={l} sub={sub}
          />
        ))}
      </div>
    );
  }

  function renderSeats() {
    const opts = [
      { v: 2, l: "2 seats", sub: "Just me" },
      { v: 4, l: "4 seats", sub: "Couple + kids" },
      { v: 5, l: "5 seats", sub: "Family" },
      { v: 6, l: "6 seats", sub: "Large family" },
      { v: 7, l: "7 seats", sub: "Extended family" },
    ];
    return (
      <div className="grid grid-cols-3 gap-3">
        {opts.map(({ v, l, sub }) => (
          <OptionCard
            key={v}
            selected={quiz.seats_needed === v}
            onClick={() => update("seats_needed", v)}
            label={l} sub={sub}
          />
        ))}
      </div>
    );
  }

  function renderUseCase() {
    const opts = [
      { v: "city",    l: "City only",     icon: "🏙️", sub: "Traffic, tight parking" },
      { v: "highway", l: "Long drives",   icon: "🛣️", sub: "Outstation, touring" },
      { v: "family",  l: "Family hauler", icon: "👨‍👩‍👧‍👦", sub: "School runs, trips" },
      { v: "offroad", l: "Off-road",      icon: "🏔️", sub: "Adventure & terrain" },
      { v: "thrill",  l: "Fun driving",   icon: "🏎️", sub: "Sporty, enthusiast" },
      { v: "mixed",   l: "All of above",  icon: "⚖️", sub: "Balanced use" },
    ];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {opts.map(({ v, l, icon, sub }) => (
          <OptionCard
            key={v}
            selected={quiz.use_case === v}
            onClick={() => update("use_case", v)}
            icon={icon} label={l} sub={sub}
          />
        ))}
      </div>
    );
  }

  function renderTransmission() {
    const opts = [
      { v: "automatic", l: "Automatic",     icon: "🤖", sub: "Effortless in traffic" },
      { v: "manual",    l: "Manual",         icon: "🎮", sub: "More control, cheaper service" },
      { v: "any",       l: "No preference", icon: "🔄", sub: "Show me all" },
    ];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {opts.map(({ v, l, icon, sub }) => (
          <OptionCard
            key={v}
            selected={quiz.transmission === v}
            onClick={() => update("transmission", v)}
            icon={icon} label={l} sub={sub}
          />
        ))}
      </div>
    );
  }

  function renderPriority() {
    const opts = [
      { v: "safety",           l: "Safety above all",     icon: "🛡️", sub: "NCAP, airbags" },
      { v: "mileage",          l: "Fuel efficiency",       icon: "💧", sub: "Low running cost" },
      { v: "features",         l: "Feature-packed",        icon: "📱", sub: "Sunroof, ADAS, audio" },
      { v: "low_running_cost", l: "Lowest ownership cost", icon: "💰", sub: "CNG/EV/Hybrid" },
      { v: "",                 l: "Balanced",              icon: "⚖️", sub: "No preference" },
    ];
    return (
      <div className="grid grid-cols-2 gap-3">
        {opts.map(({ v, l, icon, sub }) => (
          <OptionCard
            key={v}
            selected={quiz.top_priority === v}
            onClick={() => update("top_priority", v)}
            icon={icon} label={l} sub={sub}
          />
        ))}
        {quiz.fuel_pref === "electric" && (
          <OptionCard
            selected={quiz.home_charging}
            onClick={() => update("home_charging", !quiz.home_charging)}
            icon="🔌"
            label="I have home EV charging"
            sub="Can charge overnight at home"
            wide
          />
        )}
      </div>
    );
  }

  const pages = [
    { id: "budget",       title: "What's your budget?",         subtitle: "We'll find cars within your range — no surprises",             render: renderBudget },
    { id: "fuel",         title: "Fuel type preference?",        subtitle: "This directly impacts your monthly running costs",              render: renderFuel },
    { id: "seats",        title: "How many seats do you need?",  subtitle: "Be honest — buying more than you need wastes money",           render: renderSeats },
    { id: "use_case",     title: "How will you mainly use it?",  subtitle: "This shapes which car is genuinely right for your life",        render: renderUseCase },
    { id: "transmission", title: "Gear preference?",             subtitle: "Automatics are strongly recommended for city driving",          render: renderTransmission },
    { id: "priority",     title: "What matters most to you?",    subtitle: "Pick one — we'll personalise AI reasoning accordingly",        render: renderPriority },
  ];

  const current = pages[page];
  const isLast = page === TOTAL - 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-stone-400 font-medium whitespace-nowrap">
          {page + 1} / {TOTAL}
        </span>
      </div>

      {/* Live selections summary strip */}
      <div className="flex flex-wrap gap-1.5 mb-7 min-h-[28px]">
        {quiz.budget_lakh !== DEFAULT_QUIZ.budget_lakh && (
          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
            ₹{quiz.budget_lakh}L
          </span>
        )}
        {quiz.fuel_pref !== DEFAULT_QUIZ.fuel_pref && (
          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
            {summaryLabels[quiz.fuel_pref] || quiz.fuel_pref}
          </span>
        )}
        {quiz.seats_needed !== DEFAULT_QUIZ.seats_needed && (
          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
            {quiz.seats_needed} seats
          </span>
        )}
        {quiz.use_case !== DEFAULT_QUIZ.use_case && (
          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
            {summaryLabels[quiz.use_case] || quiz.use_case}
          </span>
        )}
        {quiz.transmission !== DEFAULT_QUIZ.transmission && (
          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
            {summaryLabels[quiz.transmission] || quiz.transmission}
          </span>
        )}
        {quiz.top_priority !== DEFAULT_QUIZ.top_priority && (
          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
            Priority: {summaryLabels[quiz.top_priority] || quiz.top_priority}
          </span>
        )}
        {quiz.home_charging && (
          <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">
            🔌 Home charging
          </span>
        )}
      </div>

      {/* Question */}
      <h2 className="font-serif font-bold text-3xl text-stone-900 mb-1.5">
        {current.title}
      </h2>
      <p className="text-stone-400 mb-7">{current.subtitle}</p>

      {/* Options — render() called at render time, always sees latest quiz */}
      <div>
        {current.render()}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between mt-10">
        <button
          type="button"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          className={`text-sm text-stone-400 hover:text-stone-900 transition-colors cursor-pointer px-4 py-2 rounded-lg hover:bg-stone-100 ${page === 0 ? "invisible" : ""}`}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (isLast) {
              onSubmit(quiz);
            } else {
              setPage(p => p + 1);
            }
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-700 active:scale-95 transition-all cursor-pointer shadow-md shadow-orange-200"
        >
          {isLast ? "Find My Cars 🚗" : "Next"}
          {!isLast && <ChevronRight />}
        </button>
      </div>
    </div>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen({ name }: { name: string }) {
  const [idx, setIdx] = useState(0);
  const steps = [
    "Scanning 40+ cars across all segments...",
    "Applying your budget filter...",
    "Weighing fuel, safety & features...",
    "Asking Gemma AI for personalised reasoning...",
    "Assembling your shortlist...",
  ];
  useEffect(() => {
    const t = setInterval(() => setIdx(i => Math.min(i + 1, steps.length - 1)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center animate-pulse">
          <span className="text-5xl">🚗</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-sm">
          ✦
        </div>
      </div>
      <h2 className="font-serif font-bold text-2xl text-stone-900 mb-2">
        {name ? `Finding ${name}'s perfect car…` : "Finding your perfect car…"}
      </h2>
      <p className="text-stone-400 text-sm mt-2 h-5" key={idx} style={{ animation: "fadeIn 0.4s ease both" }}>
        {steps[idx]}
      </p>
      <div className="flex gap-2 mt-8">
        {steps.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i <= idx ? "bg-orange-600" : "bg-stone-200"}`} />
        ))}
      </div>
    </div>
  );
}

// ── Results View ──────────────────────────────────────────────────────────────
function ResultsView({
  result, onReset, onCompare,
}: {
  result: RecommendResponse; onReset: () => void; onCompare: (ids: string[]) => void;
}) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const toggleCompare = (id: string) =>
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev.slice(-3), id]
    );

  const handleSave = async (carId: string) => {
    setSavedIds(prev => new Set([...prev, carId]));
    await addToShortlist(result.session_id, carId).catch(() => {});
  };

  const { prefs } = result;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-serif font-bold text-3xl text-stone-900 mb-1">Your Shortlist</h2>
          <p className="text-stone-400 text-sm">
            ₹{prefs.budget_lakh}L · {prefs.fuel_pref === "any" ? "Any fuel" : prefs.fuel_pref} ·{" "}
            {prefs.use_case === "mixed" ? "Mixed use" : prefs.use_case} · {prefs.seats_needed} seats
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 text-sm text-stone-400 border border-stone-200 px-4 py-2 rounded-full hover:border-stone-700 hover:text-stone-700 transition-all cursor-pointer"
        >
          <RefreshIcon /> Start over
        </button>
      </div>

      {compareIds.length >= 2 && (
        <div
          className="sticky top-16 z-10 mb-6 bg-stone-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl"
          style={{ animation: "slideUp 0.3s ease both" }}
        >
          <span className="text-sm">
            <strong>{compareIds.length} cars</strong> selected
          </span>
          <button
            type="button"
            onClick={() => onCompare(compareIds)}
            className="bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-orange-700 transition-colors cursor-pointer"
          >
            Compare now →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {result.cars.map(car => (
          <CarCard
            key={car.id}
            car={car}
            rank={car.rank || 1}
            sessionId={result.session_id}
            inCompare={compareIds.includes(car.id)}
            onToggleCompare={toggleCompare}
            onSaveShortlist={handleSave}
            saved={savedIds.has(car.id)}
          />
        ))}
      </div>

      <div className="mt-10 bg-stone-50 border border-stone-200 rounded-2xl p-5 text-center">
        <p className="text-stone-500 text-sm mb-1">
          💡 <strong>Tip:</strong> Select 2–3 cars to compare side-by-side
        </p>
        <p className="text-xs text-stone-400">
          Prices are approximate ex-showroom. Always verify at your local dealer.
        </p>
      </div>
    </div>
  );
}

// ── Intro Screen ──────────────────────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="text-center max-w-xl mx-auto py-16 px-4">
      <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-2 mb-8 text-sm">
        <span className="text-orange-600 font-semibold">Gemma AI-powered</span>
        <span className="text-stone-400">·</span>
        <span className="text-stone-500">Indian market</span>
      </div>

      <h1 className="font-serif font-black text-5xl sm:text-6xl text-stone-900 mb-5 leading-[1.1]">
        Find your{" "}
        <span className="text-orange-600">perfect car</span>
        {" "}in 60 seconds.
      </h1>

      <p className="text-stone-400 text-lg mb-10 leading-relaxed">
        Too many options. Too many opinions. Not enough clarity.
        <br />
        Answer 6 quick questions — get a personalised shortlist.
      </p>

      <div className="mb-6 max-w-xs mx-auto">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onStart(name); }}
          className="w-full bg-white border-2 border-stone-200 rounded-full px-5 py-3 text-center text-stone-900 placeholder:text-stone-300 outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      <button
        type="button"
        onClick={() => onStart(name)}
        className="inline-flex items-center gap-3 bg-stone-900 text-white px-9 py-4 rounded-full text-lg font-semibold hover:bg-orange-600 transition-colors duration-200 cursor-pointer group"
      >
        Let&apos;s find my car
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </button>

      {/* Stats grid — fixed layout */}
      <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto">
        {[
          { n: "40+",  l: "Cars in dataset" },
          { n: "6",    l: "Smart questions" },
          { n: "AI",   l: "Gemma reasoning" },
          { n: "Free", l: "No account needed" },
        ].map(({ n, l }) => (
          <div
            key={l}
            className="flex flex-col items-center gap-1.5 p-4 bg-white rounded-2xl border border-stone-200 shadow-sm"
          >
            <div className="font-serif font-bold text-2xl text-orange-600 leading-none">{n}</div>
            <div className="text-xs text-stone-400 text-center leading-snug">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [step, setStep] = useState<Step>("intro");
  const [nameForLoader, setNameForLoader] = useState("");
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState("");

  const handleStart = (name: string) => {
    setNameForLoader(name);
    setStep("questions");
  };

  const handleSubmit = async (quiz: QuizState) => {
    setStep("loading");
    setError("");
    try {
      const prefs: Preferences = {
        budget_lakh:   quiz.budget_lakh,
        fuel_pref:     quiz.fuel_pref,
        seats_needed:  quiz.seats_needed,
        transmission:  quiz.transmission,
        use_case:      quiz.use_case,
        top_priority:  quiz.top_priority,
        home_charging: quiz.home_charging,
        name:          quiz.name || undefined,
      };
      const res = await getRecommendations(prefs);
      setResult(res);
      setStep("results");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Is the backend running on port 8000?"
      );
      setStep("questions");
    }
  };

  const handleCompare = async (ids: string[]) => {
    try {
      const data = await compareCars(ids);
      setCompareData(data);
      setStep("compare");
    } catch {
      alert("Compare failed. Please try again.");
    }
  };

  const handleReset = () => {
    setResult(null);
    setCompareData(null);
    setError("");
    setStep("intro");
  };

  return (
    <div className="min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* Nav */}
      <nav className="border-b border-stone-200 bg-white/70 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="font-serif font-bold text-xl text-stone-900 hover:text-orange-600 transition-colors cursor-pointer"
          >
            Car<span className="text-orange-600">Find</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Indian market · {new Date().getFullYear()}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 mb-6 text-sm">
            ⚠️ {error}
          </div>
        )}

        {step === "intro" && (
          <IntroScreen onStart={handleStart} />
        )}

        {step === "questions" && (
          <QuizStep
            initialQuiz={{ ...DEFAULT_QUIZ, name: nameForLoader }}
            onSubmit={handleSubmit}
          />
        )}

        {step === "loading" && <LoadingScreen name={nameForLoader} />}

        {step === "results" && result && (
          <ResultsView result={result} onReset={handleReset} onCompare={handleCompare} />
        )}

        {step === "compare" && compareData && (
          <CompareTable data={compareData} onBack={() => setStep("results")} />
        )}
      </main>

      <footer className="border-t border-stone-200 mt-20 py-8 text-center text-xs text-stone-400">
        <p>CarFind AI — Built for CarDekho Group take-home assignment</p>
        <p className="mt-1">Prices approximate ex-showroom. Verify with local dealers before purchase.</p>
      </footer>
    </div>
  );
}
