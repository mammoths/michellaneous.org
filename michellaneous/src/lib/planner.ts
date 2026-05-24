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
  is_private?: boolean
}

export type DayKey  = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
export type Zone    = "morning" | "afternoon" | "evening"
export type PinState = "planned" | "done" | "private" | "missed1" | "missed2" | "milestone"

export type SlotConfig = {
  id: string
  stamp_id: string
  zone: Zone
  target_value?: number
  target_unit?: string
  is_private?: boolean
}

// ─── v1 PlacedStamp schema ────────────────────────────────────────────────────
// Two stamp types: recurring (week=null, lives in repeat zone) or one-time (week="YYYY-Www").
// Guard: any write must check targetWeek >= currentWeek. Past is read-only.

export type PlacedZone = "repeat" | Zone

export type PlacedStamp = {
  id: string
  stamp_id: string
  day: DayKey
  zone: PlacedZone
  is_recurring: boolean
  week: string | null   // null = recurring, "YYYY-Www" = one-time
  slot_index?: number   // 0-2 within the zone (top/middle/bottom). undefined = append.
  target_value?: number
  target_unit?: string
  is_pinned?: boolean   // false = unpinned (no badge, removable by clear); true = pinned (🌸 or 🤍)
  is_private?: boolean  // false=🌸 public, true=🤍 private. Only relevant once pinned.
  // sticky note fields — only set when stamp_id === "sticky"
  sticky_text?: string
  sticky_color?: string
  sticky_shape?: "rect" | "heart" | "star" | "diamond" | "flag"
  sticky_format?: "blank" | "list" | "oneliner"
  sticky_px?: number   // explicit pixel size from corner-drag resize
  stamp_px?: number    // explicit pixel size from corner-drag resize
  stamp_offset_x?: number  // horizontal nudge in px, applied via translateX
  stamp_offset_y?: number  // vertical nudge in px, applied via translateY
}

// ─── Quick Drawer ─────────────────────────────────────────────────────────────

export type DrawerFavorite = {
  stamp_id: string   // references StampTemplate.id
}

export type StickyNote = {
  id: string
  text: string
  color: string   // hex background color
  is_private: boolean
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
  planned: "🌸", done: "🎀", private: "🤍", missed1: "🐸", missed2: "💩", milestone: "⭐",
}

export type Completion = {
  slot_id: string
  stamp_id: string
  date: string       // "YYYY-MM-DD"
  value?: number
  is_private?: boolean
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STAMPS_KEY       = "michellaneous-planner-stamps"
const TEMPLATE_KEY     = "michellaneous-week-template"
const GOALS_KEY        = "michellaneous-goals"
const BUDGETS_KEY      = "michellaneous-weekly-budgets"
const COMPLETIONS_KEY  = "michellaneous-completions"
const PRIVATE_LOG_KEY  = "michellaneous-private-log"
const PLACED_KEY       = "michellaneous-placed-stamps-v1"
const DRAWER_KEY       = "michellaneous-drawer-favorites"

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
  { id: "pilates",    name: "pilates",category: "body", unit_type: "session",  unit_label: "class", default_duration_min: 55,  illustration_url: "/stamps/pilates1.png",  sort_order: 2, archived: false },
  { id: "aerials",    name: "aerials",  category: "body", unit_type: "session",  unit_label: "class", default_duration_min: 90,  illustration_url: "/stamps/aerial1.png",   sort_order: 3, archived: false },
  // MIND
  { id: "read",       name: "read",          category: "mind", unit_type: "counter",  unit_label: "pages", default_duration_min: 30,  illustration_url: "/stamps/reading1.png",  sort_order: 4, archived: false },
  { id: "building",   name: "building",      category: "mind", unit_type: "duration", unit_label: "hr",    default_duration_min: 120, illustration_url: "/stamps/building.png",  sort_order: 5, archived: false },
  // LIFE
  { id: "coffee",     name: "coffee",        category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "/stamps/coffee.png",    sort_order: 6,  archived: false },
  { id: "boardgames", name: "boardgames",    category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "/stamps/boardgames1.png",sort_order: 7, archived: false },
  { id: "crabbing",   name: "crabbing",      category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "/stamps/crabbing1.png", sort_order: 8,  archived: false },
  // PRIVATE (life maintenance — never surfaces publicly)
  { id: "dishes",     name: "do dishes",     category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "",                      sort_order: 9,  archived: false, is_private: true },
  { id: "laundry",    name: "laundry",       category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "",                      sort_order: 10, archived: false, is_private: true },
  { id: "hair",       name: "wash hair",     category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "",                      sort_order: 11, archived: false, is_private: true },
  { id: "vacuum",     name: "vacuum",        category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "",                      sort_order: 12, archived: false, is_private: true },
  { id: "vitamins",   name: "take vitamins", category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "",                      sort_order: 13, archived: false, is_private: true },
  { id: "bedsheets",  name: "bedsheets",     category: "life", unit_type: "binary",   unit_label: "",      default_duration_min: 0,   illustration_url: "",                      sort_order: 14, archived: false, is_private: true },
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

// Multi-week span — starts `weeksBack` weeks before this week, runs `weeksForward` weeks after.
// Used by CorkBoard so users can scroll backward/forward through time.
export function getMultiWeekDates(weeksBack: number = 1, weeksForward: number = 6): { day: DayKey; date: Date; dateNum: number }[] {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay() - weeksBack * 7)
  start.setHours(0, 0, 0, 0)
  const totalDays = (weeksBack + 1 + weeksForward) * 7
  const out: { day: DayKey; date: Date; dateNum: number }[] = []
  for (let i = 0; i < totalDays; i++) {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i)
    out.push({ day: DAY_KEYS[dt.getDay()], date: dt, dateNum: dt.getDate() })
  }
  return out
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

// ─── Milestone detection ──────────────────────────────────────────────────────

/** Returns milestone label if the stamp just crossed a goal threshold, or null. */
export function checkMilestone(
  stampId: string,
  newTotalToday: number,
  goals: Goal[],
  completions: Completion[],
  today: string,
): string | null {
  const goal = goals.find(g => g.stamp_id === stampId)
  if (!goal) return null

  const weekTotal = completions
    .filter(c => c.stamp_id === stampId && c.date >= getWeekStart(today))
    .reduce((sum, c) => sum + (c.value ?? 0), 0) + newTotalToday

  const periodTarget =
    goal.period === "weekly"  ? goal.period_target :
    goal.period === "monthly" ? goal.period_target / 4 :
    goal.period_target / 52

  if (weekTotal >= periodTarget && weekTotal - newTotalToday < periodTarget) {
    return `${periodTarget} ${goal.period_unit} this week ✦`
  }
  return null
}

function getWeekStart(today: string): string {
  const d = new Date(today)
  const day = d.getDay() // 0=sun
  d.setDate(d.getDate() - day)
  return d.toISOString().split("T")[0]
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
  loadStamps:        () => load<StampTemplate[]>(STAMPS_KEY, DEFAULT_PLANNER_STAMPS),
  saveStamps:        (v: StampTemplate[]) => save(STAMPS_KEY, v),
  loadTemplate:      () => load<WeekTemplate>(TEMPLATE_KEY, emptyTemplate()),
  saveTemplate:      (v: WeekTemplate) => save(TEMPLATE_KEY, v),
  loadGoals:         () => load<Goal[]>(GOALS_KEY, DEFAULT_GOALS),
  saveGoals:         (v: Goal[]) => save(GOALS_KEY, v),
  loadBudgets:       () => load<Record<string, WeeklyBudget>>(BUDGETS_KEY, {}),
  saveBudgets:       (v: Record<string, WeeklyBudget>) => save(BUDGETS_KEY, v),
  loadCompletions:   () => load<Completion[]>(COMPLETIONS_KEY, []),
  saveCompletions:   (v: Completion[]) => save(COMPLETIONS_KEY, v),
  loadPrivateLog:    () => load<Completion[]>(PRIVATE_LOG_KEY, []),
  savePrivateLog:    (v: Completion[]) => save(PRIVATE_LOG_KEY, v),
  clearTodayCompletions: () => {
    const today = getTodayISO()
    const all = load<Completion[]>(COMPLETIONS_KEY, [])
    save(COMPLETIONS_KEY, all.filter(c => c.date !== today))
  },
  upsertCompletion(c: Completion) {
    const all = load<Completion[]>(COMPLETIONS_KEY, [])
    const idx = all.findIndex(x => x.slot_id === c.slot_id && x.date === c.date)
    if (idx >= 0) { const next = [...all]; next[idx] = c; save(COMPLETIONS_KEY, next) }
    else save(COMPLETIONS_KEY, [...all, c])
  },
  removeCompletion(slotId: string, date: string) {
    const all = load<Completion[]>(COMPLETIONS_KEY, [])
    save(COMPLETIONS_KEY, all.filter(c => !(c.slot_id === slotId && c.date === date)))
  },
  loadPlaced:        () => load<PlacedStamp[]>(PLACED_KEY, []),
  savePlaced:        (v: PlacedStamp[]) => save(PLACED_KEY, v),
  loadDrawer:        () => load<DrawerFavorite[]>(DRAWER_KEY, []),
  saveDrawer:        (v: DrawerFavorite[]) => save(DRAWER_KEY, v),
}

// ─── v1 placed-stamp helpers + guards ─────────────────────────────────────────

/** Compare ISO week strings ("2026-W21"). Returns -1, 0, 1. */
export function compareWeek(a: string, b: string): number {
  if (a === b) return 0
  const [ay, aw] = a.split("-W").map(Number)
  const [by, bw] = b.split("-W").map(Number)
  if (ay !== by) return ay - by
  return aw - bw
}

/** Returns true if write to targetWeek (or null=recurring) is allowed against current week. */
export function canWriteWeek(targetWeek: string | null): boolean {
  if (targetWeek === null) return true   // recurring writes always allowed (future-only by design)
  return compareWeek(targetWeek, getWeekISO()) >= 0
}

/** ISO date for a (week, dayKey). */
export function dateForWeekDay(weekISO: string, day: DayKey): string {
  const [yearStr, weekStr] = weekISO.split("-W")
  const year = parseInt(yearStr, 10)
  const wk   = parseInt(weekStr, 10)
  // ISO week: week 1 contains Jan 4. Find Monday of week 1, then offset.
  const jan4 = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7   // 0=Mon
  const week1Mon = new Date(jan4); week1Mon.setDate(jan4.getDate() - jan4Day)
  const target = new Date(week1Mon); target.setDate(week1Mon.getDate() + (wk - 1) * 7)
  // Now shift from Monday to requested day (sun..sat where sun=0)
  const offsets: Record<DayKey, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
  const d = new Date(target); d.setDate(target.getDate() + offsets[day])
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

/** Stamps active on a given (week, day).
 *  Recurring entries (week=null) show on current week and forward.
 *  One-time entries show only on their exact week. */
export function placedFor(all: PlacedStamp[], weekISO: string, day: DayKey): PlacedStamp[] {
  const isCurrentOrFuture = compareWeek(weekISO, getWeekISO()) >= 0
  return all.filter(p => {
    if (p.day !== day) return false
    if (p.is_recurring) return isCurrentOrFuture
    return p.week === weekISO
  })
}

/** Add a stamp. Returns new array if allowed, original if blocked by week guard. */
export function addPlaced(all: PlacedStamp[], stamp: PlacedStamp, force = false): PlacedStamp[] {
  if (!force && !canWriteWeek(stamp.week)) return all
  return [...all, stamp]
}

/** Remove by id. Recurring removes from current week forward (i.e. just delete the recurring entry).
 *  One-time on a past week is blocked unless force=true. */
export function removePlaced(all: PlacedStamp[], id: string, force = false): PlacedStamp[] {
  const target = all.find(p => p.id === id)
  if (!target) return all
  if (!force && !canWriteWeek(target.week)) return all
  return all.filter(p => p.id !== id)
}

/** Toggle is_private on a placed stamp (blocked for past one-time entries; also blocked if unpinned). */
export function togglePlacedPrivate(all: PlacedStamp[], id: string): PlacedStamp[] {
  const target = all.find(p => p.id === id)
  if (!target) return all
  if (!canWriteWeek(target.week)) return all
  if (!target.is_pinned) return all   // unpinned stamps have no pin to toggle
  return all.map(p => p.id === id ? { ...p, is_private: !p.is_private } : p)
}

/** Pin every currently unpinned stamp (in writable weeks). Pins default to public (🌸). */
export function pinAllUnpinned(all: PlacedStamp[]): PlacedStamp[] {
  return all.map(p => {
    if (p.is_pinned) return p
    if (!canWriteWeek(p.week)) return p
    return { ...p, is_pinned: true, is_private: p.is_private ?? false }
  })
}

/** Remove every unpinned stamp (in writable weeks). Past unpinned stamps are left alone. */
export function clearUnpinned(all: PlacedStamp[]): PlacedStamp[] {
  return all.filter(p => p.is_pinned || !canWriteWeek(p.week))
}

// ─── Running budget — Presidio Half, June 21 2026 ─────────────────────────────
// Maps ISO week → total miles for that week. 4-week build into race.
export const RUN_BUDGET: Record<string, number> = {
  "2026-W21": 17,
  "2026-W22": 20,
  "2026-W23": 22,
  "2026-W24": 13,
}

/** Previous ISO week string, e.g. "2026-W22" → "2026-W21". */
function prevISOWeek(weekISO: string): string {
  const [y, w] = weekISO.split("-W").map(Number)
  if (w > 1) return `${y}-W${String(w - 1).padStart(2, "0")}`
  // Cross year boundary — week 52 or 53 of previous year
  const dec28 = new Date(y - 1, 11, 28)
  const lastWeek = getWeekISO(dec28)
  return lastWeek
}

/** Mileage already allocated to running stamps in a Sun–Sat week.
 *  Sunday drops land in the previous ISO week, so we include those too. */
export function runMilesAllocated(all: PlacedStamp[], weekISO: string): number {
  const prev = prevISOWeek(weekISO)
  let total = 0
  for (const p of all) {
    if (p.stamp_id !== "run") continue
    if (p.is_recurring || p.week === weekISO) { total += p.target_value ?? 0; continue }
    // Sunday of the previous ISO week belongs to this visual week
    if (p.day === "sun" && p.week === prev) total += p.target_value ?? 0
  }
  return total
}

/** Remaining mileage for the visible week (>= 0). */
export function runMilesRemaining(all: PlacedStamp[], weekISO: string): number {
  const total = RUN_BUDGET[weekISO] ?? 0
  return Math.max(0, total - runMilesAllocated(all, weekISO))
}

/** Total miles logged (completed) for run stamps in a Sun–Sat week containing the ISO week. */
export function runMilesLogged(completions: Completion[], weekISO: string): number {
  // ISO week starts Monday — find that Monday, then go back to Sunday
  const [yearStr, weekStr] = weekISO.split("-W")
  const year = parseInt(yearStr, 10)
  const wk   = parseInt(weekStr, 10)
  const jan4 = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7
  const week1Mon = new Date(jan4); week1Mon.setDate(jan4.getDate() - jan4Day)
  const mon = new Date(week1Mon); mon.setDate(week1Mon.getDate() + (wk - 1) * 7)
  // Sun–Sun window: Sunday before Monday → Sunday after Saturday (matches visual week Mon–Sun)
  const sun = new Date(mon); sun.setDate(mon.getDate() - 1)
  const sat = new Date(mon); sat.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
  const weekStart = fmt(sun), weekEnd = fmt(sat)
  return completions
    .filter(c => c.stamp_id === "run" && c.date >= weekStart && c.date <= weekEnd)
    .reduce((sum, c) => sum + (c.value ?? 1), 0)
}

/** Classify a run's type based on its miles relative to the week's schedule. */
export function runType(miles: number, weekISO: string): "EASY RUN" | "LONG RUN" | "RUN" {
  const schedules: Record<string, number[]> = {
    "2026-W21": [3, 4, 4, 6],
    "2026-W22": [4, 4, 5, 7],
    "2026-W23": [4, 5, 6, 7],
    "2026-W24": [3, 3, 4, 13.1],
  }
  const sched = schedules[weekISO]
  if (!sched) return "RUN"
  const max = Math.max(...sched)
  const min = Math.min(...sched)
  if (miles >= max) return "LONG RUN"
  if (miles <= min) return "EASY RUN"
  return "RUN"
}

/** Suggest miles for the NEXT run dropped this week, draining the schedule [3,4,4,6] etc. */
export function suggestNextRunMiles(all: PlacedStamp[], weekISO: string): number {
  const schedules: Record<string, number[]> = {
    "2026-W21": [3, 4, 4, 6],
    "2026-W22": [4, 4, 5, 7],
    "2026-W23": [4, 5, 6, 7],
    "2026-W24": [3, 3, 4, 13.1],
  }
  const sched = schedules[weekISO]
  if (!sched) return 3
  const prev = prevISOWeek(weekISO)
  // How many runs already placed this visual week (include Sunday of prev ISO week)
  const placedCount = all.filter(p =>
    p.stamp_id === "run" && (p.is_recurring || p.week === weekISO || (p.day === "sun" && p.week === prev))
  ).length
  return sched[Math.min(placedCount, sched.length - 1)]
}
