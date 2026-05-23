"use client"

import { useState, useEffect, useRef } from "react"
import type { CounterConfig } from "@/data/stamps"
import type { TimeWindow } from "@/lib/time"
import StampShell from "./StampShell"
import NumberTransition from "./NumberTransition"
import { playTick } from "@/lib/audio"

const INK = "#1a2a4a"
const W = 152
const LS_KEY = "michellaneous-pullup"

type PullupEntry = { date: string; count: number }
type PullupData  = { entries: PullupEntry[] }

type Props = {
  config: CounterConfig
  timeWindow: TimeWindow
  rotation?: number
  michelleMode?: boolean
  onRepLogged?: () => void
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string { return new Date().toISOString().split("T")[0] }

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}
function weekStart():  Date { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay()===0?6:d.getDay()-1)); return d }
function monthStart(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }
function yearStart():  Date { return new Date(new Date().getFullYear(), 0, 1) }

function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number)
  return `${["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"][m-1]} ${d}`
}

function loadData(): PullupData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p.entries)) return p }
  } catch {}
  return { entries: [] }
}
function persist(d: PullupData) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)) } catch {} }

function upsertEntry(data: PullupData, date: string, count: number): PullupData {
  const rest = data.entries.filter(e => e.date !== date)
  if (count > 0) rest.push({ date, count })
  return { entries: rest.sort((a, b) => b.date.localeCompare(a.date)) }
}

function addOne(data: PullupData): PullupData {
  const today = todayISO()
  const existing = data.entries.find(e => e.date === today)
  return upsertEntry(data, today, (existing?.count ?? 0) + 1)
}

// ─── PullupLogFace ────────────────────────────────────────────────────────────

function PullupLogFace({ data, onEdit, onDelete, michelleMode }: {
  data: PullupData
  onEdit: (date: string, count: number) => void
  onDelete: (date: string) => void
  michelleMode: boolean
}) {
  const [editDate, setEditDate]     = useState<string | null>(null)
  const [editVal, setEditVal]       = useState("")
  const [addingBack, setAddingBack] = useState(false)
  const [backDate, setBackDate]     = useState("")
  const [backCount, setBackCount]   = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const weekTotal  = data.entries.filter(e => parseISO(e.date) >= weekStart()).reduce((s,e) => s+e.count, 0)
  const monthTotal = data.entries.filter(e => parseISO(e.date) >= monthStart()).reduce((s,e) => s+e.count, 0)

  function startEdit(date: string, current: number) {
    setEditDate(date); setEditVal(String(current))
    setTimeout(() => inputRef.current?.focus(), 40)
  }
  function commit() {
    if (!editDate) return
    const n = parseInt(editVal, 10)
    if (!isNaN(n) && n > 0) onEdit(editDate, n)
    setEditDate(null)
  }
  function submitBacklog() {
    const n = parseInt(backCount, 10)
    if (backDate && !isNaN(n) && n > 0) { onEdit(backDate, n); setBackDate(""); setBackCount(""); setAddingBack(false) }
  }

  function fmtCount(n: number): string { return n === 1 ? "1 pullup" : `${n} pull-ups` }

  return (
    <div style={{ height: "100%", padding: "7px 9px 5px", display: "flex", flexDirection: "column", fontFamily: "var(--font-type)" }}>
      <div style={{ fontSize: 7.5, letterSpacing: "2.5px", color: INK, opacity: 0.55, textTransform: "uppercase", marginBottom: 3 }}>pull-up log</div>
      <div style={{ height: "0.5px", background: INK, opacity: 0.25, marginBottom: 4 }} />

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        {data.entries.length === 0 ? (
          <div style={{ fontSize: 7.5, color: INK, opacity: 0.35, textAlign: "center", paddingTop: 10, fontStyle: "italic" }}>no pull-ups logged yet</div>
        ) : data.entries.map(entry => (
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
                {fmtCount(entry.count)}
              </span>
            )}
            {michelleMode && editDate !== entry.date && (
              <>
                <button onClick={e => { e.stopPropagation(); startEdit(entry.date, entry.count) }}
                  style={{ marginLeft: 4, fontSize: 9, color: INK, opacity: 0.3, background: "none", border: "none", padding: 0, lineHeight: 1 }}>✎</button>
                <button onClick={e => { e.stopPropagation(); onDelete(entry.date) }}
                  style={{ marginLeft: 3, fontSize: 11, color: INK, opacity: 0.2, background: "none", border: "none", padding: 0, lineHeight: 1 }}>×</button>
              </>
            )}
          </div>
        ))}
      </div>

      {michelleMode && (
        addingBack ? (
          <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "4px 0" }} onClick={e => e.stopPropagation()}>
            <input type="date" value={backDate} max={todayISO()}
              onChange={e => setBackDate(e.target.value)}
              style={{ flex: 2, fontSize: 7, fontFamily: "var(--font-type)", border: "none", borderBottom: `0.8px solid ${INK}44`, background: "transparent", outline: "none", color: INK }} />
            <input value={backCount} onChange={e => setBackCount(e.target.value)} placeholder="reps"
              onKeyDown={e => { if (e.key === "Enter") submitBacklog(); e.stopPropagation() }}
              onClick={e => e.stopPropagation()}
              style={{ width: 28, fontSize: 7, fontFamily: "var(--font-type)", border: "none", borderBottom: `0.8px solid ${INK}44`, background: "transparent", outline: "none", color: INK, textAlign: "center" }} />
            <button onClick={e => { e.stopPropagation(); submitBacklog() }}
              style={{ fontSize: 9, color: INK, opacity: 0.6, background: "none", border: "none", padding: 0 }}>✓</button>
            <button onClick={e => { e.stopPropagation(); setAddingBack(false) }}
              style={{ fontSize: 11, color: INK, opacity: 0.3, background: "none", border: "none", padding: 0 }}>×</button>
          </div>
        ) : (
          <button onClick={e => { e.stopPropagation(); setAddingBack(true) }}
            style={{ fontSize: 7, color: INK, opacity: 0.4, background: "none", border: "none", padding: "3px 0 0", letterSpacing: "1px", textTransform: "uppercase", textAlign: "left" }}>
            + past day
          </button>
        )
      )}

      <div style={{ height: "0.5px", background: INK, opacity: 0.25, margin: "4px 0 3px" }} />
      <div style={{ fontSize: 7.5, color: INK, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {[{ label: "this week", val: weekTotal }, { label: "this month", val: monthTotal }].map(({ label, val }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.5 }}>{label}</span>
            <span style={{ fontWeight: 700 }}>{val === 1 ? "1 pullup" : `${val} pull-ups`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PullupStamp ─────────────────────────────────────────────────────────────

export default function PullupStamp({ config, timeWindow, rotation, michelleMode = false, onRepLogged }: Props) {
  const [data, setData]         = useState<PullupData>({ entries: [] })
  const [flipped, setFlipped]   = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const [bubble, setBubble]     = useState<{ id: number } | null>(null)
  const [logKey, setLogKey]     = useState(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setData(loadData()) }, []) // eslint-disable-line

  const totalToday = data.entries.find(e => e.date === todayISO())?.count ?? 0
  const weekTotal  = data.entries.filter(e => parseISO(e.date) >= weekStart()).reduce((s,e) => s+e.count, 0)
  const monthTotal = data.entries.filter(e => parseISO(e.date) >= monthStart()).reduce((s,e) => s+e.count, 0)
  const yearTotal  = data.entries.filter(e => parseISO(e.date) >= yearStart()).reduce((s,e)  => s+e.count, 0)

  const displayValue = timeWindow === "today" ? totalToday
    : timeWindow === "week"  ? weekTotal
    : timeWindow === "month" ? monthTotal
    : yearTotal

  const todayEmpty = timeWindow === "today" && totalToday === 0
  const stampLabel = todayEmpty ? "" : displayValue === 1 ? "pull-up" : "pull-ups"

  function handleTap() {
    if (!michelleMode) { setFlipped(f => !f); return }
    if (flipped) { setFlipped(false); return }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null; setFlipped(true)
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null
        const updated = addOne(data)
        setData(updated); persist(updated)
        setLogKey(k => k + 1)
        playTick()
        setBouncing(true); setTimeout(() => setBouncing(false), 260)
        setBubble({ id: Date.now() }); setTimeout(() => setBubble(null), 850)
        onRepLogged?.()
      }, 260)
    }
  }

  function handleEdit(date: string, count: number) {
    const updated = upsertEntry(data, date, count)
    setData(updated); persist(updated)
  }
  function handleDelete(date: string) {
    const updated = { entries: data.entries.filter(e => e.date !== date) }
    setData(updated); persist(updated)
  }

  return (
    <div style={{ position: "relative", width: W, transform: bouncing ? "scale(1.08)" : "scale(1)", transition: "transform 130ms ease-in-out" }}>
      <style>{`@keyframes pu-bubble { 0%{transform:translateX(-50%) translateY(0);opacity:1} 100%{transform:translateX(-50%) translateY(-28px);opacity:0} }`}</style>

     

      <StampShell
        inkColor={config.inkColor}
        bgColor={config.bgColor}
        label={stampLabel}
        imageUrl="/stamps/pullup1.png"
        backFillContent={<PullupLogFace data={data} onEdit={handleEdit} onDelete={handleDelete} michelleMode={michelleMode} />}
        backLabel="pull-ups"
        rotation={rotation}
        flipped={flipped}
        onTap={handleTap}
      >
        {/* NumberTransition stays mounted so logKey 0→1 is detectable and animates from 0 */}
        <div style={{ display: todayEmpty ? "none" : "block" }}>
          <NumberTransition
            value={displayValue}
            logKey={logKey}
            format={(n) => String(Math.round(n))}
            style={{ fontFamily: "var(--font-stamp)", fontSize: 28, fontWeight: 700, lineHeight: 1, color: INK }}
            sounds={false}
          />
        </div>
        {todayEmpty && (
          <span style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "0.8px", textTransform: "uppercase", color: INK, opacity: 0.55, lineHeight: 1.6, textAlign: "center", display: "block" }}>
            TIME FOR SOME PULL-UPS!
          </span>
        )}
      </StampShell>
    </div>
  )
}
