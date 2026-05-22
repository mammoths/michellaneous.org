"use client"

import { useState, useRef, useEffect } from "react"
import type { CounterConfig, RunEntry } from "@/data/stamps"
import type { TimeWindow } from "@/lib/time"
import StampShell from "./StampShell"
import NumberTransition from "./NumberTransition"

const INK = "#2a4a20"
const W = 152
const LS_KEY = "michellaneous-run-log"

type Props = {
  config: CounterConfig
  timeWindow: TimeWindow
  rotation?: number
  michelleMode?: boolean
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string { return new Date().toISOString().split("T")[0] }

function weekStart(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
  return d
}
function monthStart(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }
function yearStart():  Date { return new Date(new Date().getFullYear(), 0, 1) }

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number)
  return `${["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"][m-1]} ${d}`
}

function loadLogs(seed: RunEntry[]): RunEntry[] {
  try { const r = localStorage.getItem(LS_KEY); if (r) return JSON.parse(r) } catch {}
  return seed
}
function persistLogs(logs: RunEntry[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(logs)) } catch {}
}
// SET a specific total for a date (used by backlog/edit)
function upsertEntry(logs: RunEntry[], date: string, miles: number): RunEntry[] {
  const next = logs.filter(e => e.date !== date)
  next.push({ date, miles, logged_at: Date.now() })
  return next.sort((a, b) => b.date.localeCompare(a.date))
}
// ADD to the existing total for a date (used when logging a new run)
function addMiles(logs: RunEntry[], date: string, miles: number): RunEntry[] {
  const existing = logs.find(e => e.date === date)
  return upsertEntry(logs, date, (existing?.miles ?? 0) + miles)
}

// ─── RunLogFace ───────────────────────────────────────────────────────────────

function RunLogFace({ logs, onEdit, onDelete, michelleMode }: {
  logs: RunEntry[]
  onEdit: (date: string, miles: number) => void
  onDelete: (date: string) => void
  michelleMode: boolean
}) {
  const [editDate, setEditDate]   = useState<string | null>(null)
  const [editVal, setEditVal]     = useState("")
  const [addingBack, setAddingBack] = useState(false)
  const [backDate, setBackDate]   = useState("")
  const [backMiles, setBackMiles] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const weekTotal  = logs.filter(e => parseISO(e.date) >= weekStart()).reduce((s, e) => s + e.miles, 0)
  const monthTotal = logs.filter(e => parseISO(e.date) >= monthStart()).reduce((s, e) => s + e.miles, 0)

  function startEdit(date: string, current: number) {
    setEditDate(date); setEditVal(current.toFixed(1))
    setTimeout(() => inputRef.current?.focus(), 40)
  }
  function commit() {
    if (!editDate) return
    const miles = parseFloat(editVal)
    if (!isNaN(miles) && miles > 0) onEdit(editDate, miles)
    setEditDate(null)
  }
  function submitBacklog() {
    const miles = parseFloat(backMiles)
    if (backDate && !isNaN(miles) && miles > 0) { onEdit(backDate, miles); setBackDate(""); setBackMiles(""); setAddingBack(false) }
  }

  return (
    <div style={{ height: "100%", padding: "7px 9px 5px", display: "flex", flexDirection: "column", fontFamily: "var(--font-type)" }}>
      <div style={{ fontSize: 7.5, letterSpacing: "2.5px", color: INK, opacity: 0.55, textTransform: "uppercase", marginBottom: 3 }}>run log</div>
      <div style={{ height: "0.5px", background: INK, opacity: 0.25, marginBottom: 4 }} />

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        {logs.length === 0 ? (
          <div style={{ fontSize: 7.5, color: INK, opacity: 0.35, textAlign: "center", paddingTop: 10, fontStyle: "italic" }}>no runs logged yet</div>
        ) : logs.map(entry => (
          <div key={entry.date} style={{ display: "flex", alignItems: "center", padding: "2.5px 0", borderBottom: `0.4px solid ${INK}20` }}>
            <span style={{ fontSize: 7.5, color: INK, opacity: 0.55, width: 34, flexShrink: 0 }}>{fmtDate(entry.date)}</span>
            {editDate === entry.date ? (
              <input ref={inputRef} value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === "Enter") commit(); e.stopPropagation() }}
                onClick={e => e.stopPropagation()}
                style={{ flex: 1, fontFamily: "var(--font-type)", fontSize: 8.5, color: INK, background: "transparent", border: "none", borderBottom: `0.8px solid ${INK}88`, outline: "none", textAlign: "right", padding: "0 2px" }} />
            ) : (
              <span style={{ flex: 1, fontSize: 8.5, fontWeight: 700, color: INK, textAlign: "right" }}>
                {entry.miles === 1 ? "1 mile" : `${entry.miles.toFixed(1)} mi`}
              </span>
            )}
            {michelleMode && editDate !== entry.date && (
              <>
                <button onClick={e => { e.stopPropagation(); startEdit(entry.date, entry.miles) }}
                  style={{ marginLeft: 4, fontSize: 9, color: INK, opacity: 0.3, background: "none", border: "none", padding: 0, lineHeight: 1 }}>✎</button>
                <button onClick={e => { e.stopPropagation(); onDelete(entry.date) }}
                  style={{ marginLeft: 3, fontSize: 11, color: INK, opacity: 0.2, background: "none", border: "none", padding: 0, lineHeight: 1 }}>×</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* backlog row */}
      {michelleMode && (
        addingBack ? (
          <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "4px 0" }} onClick={e => e.stopPropagation()}>
            <input type="date" value={backDate} max={todayISO()}
              onChange={e => setBackDate(e.target.value)}
              style={{ flex: 2, fontSize: 7, fontFamily: "var(--font-type)", border: "none", borderBottom: `0.8px solid ${INK}44`, background: "transparent", outline: "none", color: INK }} />
            <input value={backMiles} onChange={e => setBackMiles(e.target.value)} placeholder="mi"
              onKeyDown={e => { if (e.key === "Enter") submitBacklog(); e.stopPropagation() }}
              onClick={e => e.stopPropagation()}
              style={{ width: 24, fontSize: 7, fontFamily: "var(--font-type)", border: "none", borderBottom: `0.8px solid ${INK}44`, background: "transparent", outline: "none", color: INK, textAlign: "center" }} />
            <button onClick={e => { e.stopPropagation(); submitBacklog() }}
              style={{ fontSize: 9, color: INK, opacity: 0.6, background: "none", border: "none", padding: 0 }}>✓</button>
            <button onClick={e => { e.stopPropagation(); setAddingBack(false) }}
              style={{ fontSize: 11, color: INK, opacity: 0.3, background: "none", border: "none", padding: 0 }}>×</button>
          </div>
        ) : (
          <button onClick={e => { e.stopPropagation(); setAddingBack(true) }}
            style={{ fontSize: 7, color: INK, opacity: 0.4, background: "none", border: "none", padding: "3px 0 0", letterSpacing: "1px", textTransform: "uppercase", textAlign: "left" }}>
            + past run
          </button>
        )
      )}

      <div style={{ height: "0.5px", background: INK, opacity: 0.25, margin: "4px 0 3px" }} />
      <div style={{ fontSize: 7.5, color: INK, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {[{ label: "this week", val: weekTotal }, { label: "this month", val: monthTotal }].map(({ label, val }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.5 }}>{label}</span>
            <span style={{ fontWeight: 700 }}>{val === 1 ? "1 mile" : `${val.toFixed(1)} mi`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── NumberPad ────────────────────────────────────────────────────────────────

function NumberPad({ value, onChange, onLog }: { value: string; onChange: (v: string) => void; onLog: () => void }) {
  function press(key: string) {
    if (key === "⌫") { onChange(value.slice(0, -1)); return }
    if (key === "." && value.includes(".")) return
    if (value.replace(".", "").length >= 4) return
    onChange(value + key)
  }
  const rows = [["1","2","3"], ["4","5","6"], ["7","8","9"], [".","0","⌫"]]
  return (
    <div style={{ background: "#F5ECD7", borderTop: `1px solid ${INK}18`, padding: "5px 5px 7px", boxShadow: "0 6px 16px rgba(0,0,0,0.12)", borderRadius: "0 0 3px 3px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 10, color: INK, opacity: 0.55, textAlign: "center", marginBottom: 1 }}>miles today</div>
      <div style={{ fontFamily: "var(--font-type)", fontSize: 24, fontWeight: 700, color: INK, textAlign: "center", lineHeight: 1, borderBottom: `1px solid ${INK}28`, paddingBottom: 4, marginBottom: 5, minHeight: 28, letterSpacing: "1px" }}>
        {value || <span style={{ opacity: 0.25 }}>0</span>}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 3, marginBottom: 3 }}>
          {row.map(key => (
            <button key={key} onClick={e => { e.stopPropagation(); press(key) }}
              style={{ flex: 1, height: 27, fontFamily: "var(--font-type)", fontSize: key === "⌫" ? 11 : 13, color: INK, background: "#EDE4CF", border: "none", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
              {key}
            </button>
          ))}
        </div>
      ))}
      <button onClick={e => { e.stopPropagation(); onLog() }}
        style={{ width: "100%", height: 29, marginTop: 1, fontFamily: "var(--font-type)", fontSize: 9, letterSpacing: "2.5px", textTransform: "uppercase", color: "#F5ECD7", background: INK, border: "none", borderRadius: 2, userSelect: "none" }}>
        log
      </button>
    </div>
  )
}

// ─── RunStamp ─────────────────────────────────────────────────────────────────

export default function RunStamp({ config, timeWindow, rotation, michelleMode = false }: Props) {
  const [logs, setLogs]     = useState<RunEntry[]>(config.log ?? [])
  const [flipped, setFlipped] = useState(false)
  const [padOpen, setPadOpen] = useState(false)
  const [input, setInput]   = useState("")
  const [bouncing, setBouncing] = useState(false)
  const [logKey, setLogKey] = useState(0)  // increments only when a run is actually logged

  useEffect(() => { setLogs(loadLogs(config.log ?? [])) }, []) // eslint-disable-line

  const wrapperRef = useRef<HTMLDivElement>(null)
  const tapTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (padOpen) setInput("") }, [padOpen])

  useEffect(() => {
    if (!padOpen) return
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setPadOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [padOpen])

  function handleTap() {
    if (!michelleMode) { setFlipped(f => !f); return }
    if (flipped) { setFlipped(false); return }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null
      setPadOpen(false); setFlipped(true)
    } else {
      tapTimer.current = setTimeout(() => { tapTimer.current = null; setPadOpen(p => !p) }, 260)
    }
  }

  function handleLog() {
    const miles = parseFloat(input)
    if (isNaN(miles) || miles <= 0) { setPadOpen(false); return }
    const updated = addMiles(logs, todayISO(), miles)
    setLogs(updated); persistLogs(updated)
    setPadOpen(false)
    setLogKey(k => k + 1)  // trigger the fanfare
    setBouncing(true); setTimeout(() => setBouncing(false), 260)
  }

  function handleEdit(date: string, miles: number) {
    const updated = upsertEntry(logs, date, miles)
    setLogs(updated); persistLogs(updated)
  }
  function handleDelete(date: string) {
    const updated = logs.filter(e => e.date !== date)
    setLogs(updated); persistLogs(updated)
  }

  function displayValue(): number {
    switch (timeWindow) {
      case "today":  return logs.find(e => e.date === todayISO())?.miles ?? 0
      case "week":   return logs.filter(e => parseISO(e.date) >= weekStart()).reduce((s, e) => s + e.miles, 0)
      case "month":  return logs.filter(e => parseISO(e.date) >= monthStart()).reduce((s, e) => s + e.miles, 0)
      case "year":   return logs.filter(e => parseISO(e.date) >= yearStart()).reduce((s, e) => s + e.miles, 0)
    }
  }

  const val = displayValue()
  const todayEmpty = timeWindow === "today" && val === 0
  const stampLabel = todayEmpty ? "" : val === 1 ? "mile ran" : "miles ran"

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: W, transform: bouncing ? "scale(1.08)" : "scale(1)", transition: "transform 130ms ease-in-out" }}>
      <StampShell
        inkColor={config.inkColor}
        bgColor={config.bgColor}
        label={stampLabel}
        imageUrl="/stamps/run.png"
        backFillContent={<RunLogFace logs={logs} onEdit={handleEdit} onDelete={handleDelete} michelleMode={michelleMode} />}
        backLabel="run log"
        rotation={rotation}
        flipped={flipped}
        onTap={handleTap}
        below={
          <div onClick={e => e.stopPropagation()} style={{ overflow: "hidden", maxHeight: padOpen ? "220px" : "0px", transition: "max-height 220ms ease-in-out" }}>
            <NumberPad value={input} onChange={setInput} onLog={handleLog} />
          </div>
        }
      >
        {/* NumberTransition stays mounted so logKey 0→1 is detectable and animates from 0 */}
        <div style={{ display: todayEmpty ? "none" : "block" }}>
          <NumberTransition
            value={val}
            logKey={logKey}
            format={(n) => { const v = Math.round(n * 10) / 10; return v === 1 ? "1" : v.toFixed(1) }}
            style={{ fontFamily: "var(--font-stamp)", fontSize: 28, fontWeight: 700, lineHeight: 1, color: INK }}
          />
        </div>
        {todayEmpty && (
          <span style={{ fontFamily: "var(--font-type)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: INK, opacity: 0.55, lineHeight: 1.6, textAlign: "center", display: "block" }}>
            good day{"\n"}for a run!
          </span>
        )}
      </StampShell>
    </div>
  )
}
