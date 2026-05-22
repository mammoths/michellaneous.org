export type TimeWindow = "today" | "week" | "month" | "year"
export const WINDOWS: TimeWindow[] = ["today", "week", "month", "year"]

export function filterLogs<T extends { logged_at: string | Date }>(
  logs: T[],
  window: TimeWindow
): T[] {
  const now = new Date()
  return logs.filter((log) => {
    const date = new Date(log.logged_at)
    if (window === "today") {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      )
    }
    const days = window === "week" ? 7 : window === "month" ? 31 : 365
    const cutoff = new Date(now)
    cutoff.setDate(now.getDate() - days)
    return date >= cutoff
  })
}
