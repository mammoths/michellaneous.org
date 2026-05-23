// ─── Types ────────────────────────────────────────────────────────────────────

export type StampTemplate = {
  id: string
  name: string
  category: "body" | "mind" | "life"
  unit_type: "counter" | "binary" | "duration" | "session"
  unit_label: string
  default_duration_min: number
  illustration_url: string
  sort_order: number
  archived: boolean
}

export type DayKey  = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
export type Zone    = "morning" | "afternoon" | "evening"
export type PinState = "planned" | "done" | "missed1" | "missed2" | "milestone"

export type SlotConfig = {
  id: string
  stamp_id: string
  zone: Zone
  target_value?: number
  target_unit?: string
}

export type WeekTemplate = {
  version: number
  days: Record<DayKey, { slots: SlotConfig[] }>
}

export type Goal = {
  id: string
  stamp_id: string
  description: string
  target_date: string
  period: "weekly" | "monthly" | "yearly"
  period_target: number
  period_unit: string
}

export type WeeklyBudget = {
  goal_id: string
  week: string
  total: number
  allocated: number
  remaining: number
  rollover: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export const DAY_LABELS: Record<DayKey, string> = {
  sun: "SUN", mon: "MON", tue: "TUE", wed: "WED",
  thu: "THU", fri: "FRI", sat: "SAT",
}

export const ZONE_KEYS: Zone[] = ["morning", "afternoon", "evening"]

export const ZONE_SYMBOL: Record<Zone, string> = {
  morning: "☀", afternoon: "○", evening: "☾",
}

export const PIN_EMOJI: Record<PinState, string> = {
  planned: "🌸", done: "🎀", missed1: "🐸", missed2: "💩", milestone: "⭐",
}

export type Completion = {
  slot_id: string
  stamp_id: string
  date: string       // "YYYY-MM-DD"
  value?: number
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STAMPS_KEY      = "michellaneous-planner-stamps"
const TEMPLATE_KEY    = "michellaneous-week-template"
const GOALS_KEY       = "michellaneous-goals"
const BUDGETS_KEY     = "michellaneous-weekly-budgets"
const COMPLETIONS_KEY = "michellaneous-completions"

export function getTodayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Default data ─────────────────────────────────────────────────────────────

// Only stamps with illustration_url are included — others hidden until images exist
export const DEFAULT_PLANNER_STAMPS: StampTemplate[] = [
  // BODY
  { id: "run",        name: "run",           category: "body", unit_type: "counter",  unit_label: "mi",    default_duration_min: 45,  illustration_url: "/stamps/run.png",       sort_order: 0, archived: false },
  { id: "pullups",    name: "pull-ups",      category: "body", unit_type: "counter",  unit_label: "reps",  default_duration_min: 15,  illustration_url: "/stamps/pullup1.png",   sort_order: 1, archived: false },
  { id: "pilates",    name: "studio pilates",category: "body", unit_type: "session",  unit_label: "class", default_duration_min: 55,  illustration_url: "/stamps/pilates1.png",  sort_order: 2, archived: false },
  { id: "aerials",    name: "aerial silks",  category: "body", unit_type: "session",  unit_label: "class", default_duration_min: 90,  illustration_url: "/stamps/aerial1.png",   sort_order: 3, archived: false },
  // MIND
  { id: "read",       name: "read",          category: "mind", unit_type: "counter",  unit_label: "pages", default_duration_min: 30,  illustration_url: "/stamps/reading1.png",  sort_order: 4, archived: false },
  { id: "building",   name: "building",      category: "mind", unit_type: "duration", unit_label: "hr",    default_duration_min: 120, illustration_url: "/stamps/building.png",  sort_order: 5, archived: false },
  // LIFE
  { id: "coffee",     name: "coffee",        category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "/stamps/coffee.png",    sort_order: 6, archived: false },
  { id: "boardgames", name: "boardgames",    category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "/stamps/boardgames1.png",sort_order: 7, archived: false },
  { id: "crabbing",   name: "crabbing",      category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "/stamps/crabbing1.png", sort_order: 8, archived: false },
]

export const DEFAULT_GOALS: Goal[] = [
  { id: "goal-run",  stamp_id: "run",  description: "run a half marathon",        target_date: "2026-09-14", period: "weekly",  period_target: 20, period_unit: "mi"      },
  { id: "goal-viet", stamp_id: "viet", description: "fluent in vietnamese by 30", target_date: "2026-12-31", period: "weekly",  period_target: 3,  period_unit: "sessions" },
  { id: "goal-read", stamp_id: "read", description: "read 15 books this year",    target_date: "2026-12-31", period: "yearly",  period_target: 15, period_unit: "books"   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function emptyTemplate(): WeekTemplate {
  const days = {} as Record<DayKey, { slots: SlotConfig[] }>
  DAY_KEYS.forEach(d => { days[d] = { slots: [] } })
  return { version: 1, days }
}

export function getWeekISO(date: Date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

export function getWeekDates(date: Date = new Date()): { day: DayKey; date: Date; dateNum: number }[] {
  const now = new Date(date)
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - now.getDay())
  sunday.setHours(0, 0, 0, 0)
  return DAY_KEYS.map((d, i) => {
    const dt = new Date(sunday)
    dt.setDate(sunday.getDate() + i)
    return { day: d, date: dt, dateNum: dt.getDate() }
  })
}

export function getTodayDayKey(): DayKey {
  return DAY_KEYS[new Date().getDay()]
}

export function newSlotId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ─── Budget calculation ───────────────────────────────────────────────────────

function calcAllocated(goal: Goal, template: WeekTemplate): number {
  let total = 0
  DAY_KEYS.forEach(d => {
    template.days[d].slots.forEach(slot => {
      if (slot.stamp_id === goal.stamp_id && slot.target_value != null) {
        total += slot.target_value
      }
    })
  })
  return total
}

export function recalcBudgets(
  goals: Goal[],
  template: WeekTemplate,
  existing: Record<string, WeeklyBudget>
): Record<string, WeeklyBudget> {
  const week = getWeekISO()
  const result: Record<string, WeeklyBudget> = {}
  for (const goal of goals) {
    const prev = existing[goal.id]
    const rollover = prev?.rollover ?? 0
    const weeklyTotal = goal.period === "weekly"
      ? goal.period_target
      : goal.period === "monthly"
        ? Math.ceil(goal.period_target / 4)
        : Math.ceil(goal.period_target / 52)
    const allocated = calcAllocated(goal, template)
    const remaining = Math.max(0, weeklyTotal + rollover - allocated)
    result[goal.id] = { goal_id: goal.id, week, total: weeklyTotal, allocated, remaining, rollover }
  }
  return result
}

// ─── Suggested target for a drop ─────────────────────────────────────────────

export function suggestTarget(goal: Goal, budget: WeeklyBudget | undefined): number {
  if (!budget) return 1
  const placed = Math.floor(budget.allocated / Math.max(1, budget.total / 7))
  if (placed === 0) return Math.round(budget.total * 0.30 * 10) / 10
  if (placed === 1) return Math.round(budget.total * 0.40 * 10) / 10
  return Math.max(1, budget.remaining)
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {}
  return fallback
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const plannerStore = {
  loadStamps:      () => load<StampTemplate[]>(STAMPS_KEY, DEFAULT_PLANNER_STAMPS),
  saveStamps:      (v: StampTemplate[]) => save(STAMPS_KEY, v),
  loadTemplate:    () => load<WeekTemplate>(TEMPLATE_KEY, emptyTemplate()),
  saveTemplate:    (v: WeekTemplate) => save(TEMPLATE_KEY, v),
  loadGoals:       () => load<Goal[]>(GOALS_KEY, DEFAULT_GOALS),
  saveGoals:       (v: Goal[]) => save(GOALS_KEY, v),
  loadBudgets:     () => load<Record<string, WeeklyBudget>>(BUDGETS_KEY, {}),
  saveBudgets:     (v: Record<string, WeeklyBudget>) => save(BUDGETS_KEY, v),
  loadCompletions: () => load<Completion[]>(COMPLETIONS_KEY, []),
  saveCompletions: (v: Completion[]) => save(COMPLETIONS_KEY, v),
  clearTodayCompletions: () => {
    const today = getTodayISO()
    const all = load<Completion[]>(COMPLETIONS_KEY, [])
    save(COMPLETIONS_KEY, all.filter(c => c.date !== today))
  },
}
