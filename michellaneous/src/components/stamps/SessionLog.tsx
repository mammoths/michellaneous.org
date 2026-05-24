"use client"

import type { Completion } from "@/lib/planner"

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAY_SHORT   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function loadCompletionsFor(stampId: string): Completion[] {
  try {
    const raw = localStorage.getItem("michellaneous-completions")
    if (!raw) return []
    const all: Completion[] = JSON.parse(raw)
    return all.filter(c => c.stamp_id === stampId && c.date)
  } catch { return [] }
}

export function loadUpcomingPlanned(stampId: string): string[] {
  try {
    const raw = localStorage.getItem("michellaneous-placed-stamps-v1")
    if (!raw) return []
    const placed: { stamp_id: string; week: string | null; day: string; zone: string; is_recurring?: boolean }[] = JSON.parse(raw)
    const today = new Date(); today.setHours(0,0,0,0)
    const todayISO = today.toISOString().split("T")[0]
    const DAY_IDX: Record<string,number> = { sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6 }
    const dates: string[] = []

    placed.filter(p => p.stamp_id === stampId && p.zone !== "repeat").forEach(p => {
      if (p.is_recurring) {
        const dayIdx = DAY_IDX[p.day] ?? 0
        for (let i = 0; i < 28; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i)
          if (d.getDay() === dayIdx) {
            const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
            if (iso >= todayISO) dates.push(iso)
            if (dates.length >= 8) break
          }
        }
      } else if (p.week) {
        try {
          const [yearStr, weekStr] = p.week.split("-W")
          const year = parseInt(yearStr), wk = parseInt(weekStr)
          const jan4 = new Date(year, 0, 4)
          const jan4Day = (jan4.getDay() + 6) % 7
          const week1Mon = new Date(jan4); week1Mon.setDate(jan4.getDate() - jan4Day)
          const mon = new Date(week1Mon); mon.setDate(week1Mon.getDate() + (wk-1)*7)
          const off: Record<string,number> = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 }
          const d = new Date(mon); d.setDate(mon.getDate() + (off[p.day] ?? 0))
          const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
          if (iso >= todayISO) dates.push(iso)
        } catch {}
      }
    })

    return [...new Set(dates)].sort()
  } catch { return [] }
}

export default function SessionLog({ stampId, inkColor }: { stampId: string; inkColor: string }) {
  const done = loadCompletionsFor(stampId)
  const seen = new Set<string>()
  const entries = done
    .filter(e => { if (seen.has(e.date)) return false; seen.add(e.date); return true })
    .sort((a, b) => b.date.localeCompare(a.date))

  const upcoming = loadUpcomingPlanned(stampId)

  const todayISO   = new Date().toISOString().split("T")[0]
  const thisMonth  = todayISO.slice(0, 7)
  const thisYear   = todayISO.slice(0, 4)
  const monthCount = entries.filter(e => e.date.startsWith(thisMonth)).length
  const yearCount  = entries.filter(e => e.date.startsWith(thisYear)).length
  const INK        = inkColor

  function Row({ iso, done: isDone }: { iso: string; done: boolean }) {
    const d   = isoToDate(iso)
    const dow = DAY_SHORT[d.getDay()]
    const mon = MONTH_SHORT[d.getMonth()]
    const day = d.getDate()
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "2px 0",
        borderBottom: "0.5px solid rgba(0,0,0,0.06)",
        opacity: isDone ? 1 : 0.5,
      }}>
        <span style={{ fontFamily: "var(--font-stamp)", fontSize: 6, color: INK, opacity: 0.4, width: 16, textAlign: "right", flexShrink: 0 }}>{dow}</span>
        <span style={{ fontFamily: "var(--font-hand)", fontSize: 9, color: INK, flex: 1 }}>{mon} {day}</span>
        <span style={{ fontSize: 8 }}>{isDone ? "🎀" : "○"}</span>
      </div>
    )
  }

  return (
    <div style={{ overflowY: "auto", maxHeight: "100%", padding: "4px 6px 0", scrollbarWidth: "none" }}>

      {/* totals */}
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 6 }}>
        {[
          { label: "month", val: monthCount },
          { label: "year",  val: yearCount  },
          { label: "total", val: entries.length },
        ].map(({ label, val }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-stamp)", fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1 }}>{val}</div>
            <div style={{ fontFamily: "var(--font-stamp)", fontSize: 5, letterSpacing: "0.8px", textTransform: "uppercase", color: INK, opacity: 0.4, marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* upcoming */}
      {upcoming.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-stamp)", fontSize: 5, letterSpacing: "1px", textTransform: "uppercase", color: INK, opacity: 0.35, marginBottom: 2, marginTop: 2 }}>upcoming</div>
          {upcoming.slice(0, 4).map(iso => <Row key={iso} iso={iso} done={false} />)}
        </>
      )}

      {/* completed log */}
      {entries.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-stamp)", fontSize: 5, letterSpacing: "1px", textTransform: "uppercase", color: INK, opacity: 0.35, marginBottom: 2, marginTop: 6 }}>completed</div>
          {entries.map(e => <Row key={e.date} iso={e.date} done={true} />)}
        </>
      )}

      {entries.length === 0 && upcoming.length === 0 && (
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, color: INK, opacity: 0.4, textAlign: "center", paddingTop: 8 }}>
          no sessions yet
        </div>
      )}
    </div>
  )
}
