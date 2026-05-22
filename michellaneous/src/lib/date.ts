import type { TimeWindow } from "./time"

export function getTooltip(window: TimeWindow): string {
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const yy = String(now.getFullYear()).slice(2)

  if (window === "today") {
    const weekday = now
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase()
    return `${weekday} · ${m}.${d}.${yy}`
  }

  if (window === "week") {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    const sm = start.getMonth() + 1
    const sd = start.getDate()
    return `${sm}.${sd} — ${m}.${d}`
  }

  if (window === "month") {
    return now
      .toLocaleDateString("en-US", { month: "long", year: "numeric" })
      .toLowerCase()
  }

  return String(now.getFullYear())
}
