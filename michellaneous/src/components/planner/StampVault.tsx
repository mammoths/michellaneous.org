"use client"

import { useState, useId, useRef } from "react"
import type { StampTemplate, Goal, WeeklyBudget } from "@/lib/planner"
import { newSlotId } from "@/lib/planner"
import type { DropPayload } from "./CorkBoard"

type Props = {
  stamps: StampTemplate[]
  goals: Goal[]
  budgets: Record<string, WeeklyBudget>
  onStampsChange: (stamps: StampTemplate[]) => void
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  width: number
}

const CATEGORIES: { key: StampTemplate["category"]; label: string }[] = [
  { key: "body", label: "BODY" },
  { key: "mind", label: "MIND" },
  { key: "life", label: "LIFE" },
]

const INK   = "#2C1A0E"
const TERRA = "#C0392B"
const SAGE  = "#7A8C6E"
const PARCH = "#F5ECD7"

const INSET = 7
const R = 3
const STEP = 11

function holePositions(total: number): number[] {
  const n = Math.round(total / STEP)
  if (n < 1) return []
  const step = total / n
  return Array.from({ length: n }, (_, i) => step * (i + 0.5))
}
function circleArc(cx: number, cy: number): string {
  return `M${cx - R},${cy} A${R},${R},0,1,0,${cx + R},${cy} A${R},${R},0,1,0,${cx - R},${cy}Z`
}

// ─── Snap sound ───────────────────────────────────────────────────────────────

function playFlipSnap() {
  try {
    const ctx = new AudioContext()
    // Short white-noise burst — card flip snap
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
    src.connect(gain); gain.connect(ctx.destination)
    src.start(); src.stop(ctx.currentTime + 0.04)
    src.onended = () => ctx.close()
  } catch {}
}

// ─── VaultCard ────────────────────────────────────────────────────────────────

function VaultCard({ stamp, goal, budget, onPointerDragStart, cardSize }: {
  stamp: StampTemplate
  goal?: Goal
  budget?: WeeklyBudget
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  cardSize: number
}) {
  const rawId   = useId()
  const clipId  = `vc${rawId.replace(/:/g, "")}`
  const [flipped, setFlipped] = useState(false)
  const dragMoved = useRef(false)

  const W     = cardSize
  const H     = cardSize
  const IMG_H = Math.round(cardSize * 0.77)
  const nameFs = Math.max(7,  Math.round(W * 0.07))
  const statFs = Math.max(6,  Math.round(W * 0.065))
  const backFs = Math.max(8,  Math.round(W * 0.085))
  const backSmFs = Math.max(6, Math.round(W * 0.065))

  const hPos = holePositions(W)
  const vPos = holePositions(H)
  const clipD = [
    `M0,0 H${W} V${H} H0 Z`,
    ...hPos.map(x => circleArc(x, 0)),
    ...hPos.map(x => circleArc(x, H)),
    ...vPos.map(y => circleArc(0, y)),
    ...vPos.map(y => circleArc(W, y)),
  ].join(" ")

  // Back-face: goal stats + target editable
  const [editVal, setEditVal] = useState(String(goal?.period_target ?? ""))

  return (
    // Perspective wrapper — no pointer events; child handles events
    <div style={{
      width: W, height: H,
      perspective: W * 5,
      flexShrink: 0,
      filter: "drop-shadow(1px 3px 5px rgba(0,0,0,0.2))",
      transition: "filter 120ms ease",
    }}
    onMouseEnter={e => (e.currentTarget.style.filter = "drop-shadow(1px 5px 8px rgba(0,0,0,0.28))")}
    onMouseLeave={e => (e.currentTarget.style.filter = "drop-shadow(1px 3px 5px rgba(0,0,0,0.2))")}
    >
      {/* SVG clip defs — outside the flip container so it doesn't get clipped itself */}
      <svg aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipD} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      {/* Flip container */}
      <div
        style={{
          width: W, height: H,
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 380ms cubic-bezier(0.4,0,0.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          cursor: flipped ? "default" : "grab",
          userSelect: "none",
        }}
        onMouseDown={e => {
          if (e.button !== 0) return
          dragMoved.current = false
          const startX = e.clientX, startY = e.clientY
          const onMove = (mv: MouseEvent) => {
            if (Math.abs(mv.clientX - startX) > 4 || Math.abs(mv.clientY - startY) > 4) {
              dragMoved.current = true
              document.removeEventListener("mousemove", onMove)
              document.removeEventListener("mouseup", onUp)
              if (!flipped) onPointerDragStart(e, { type: "place", stamp_id: stamp.id })
            }
          }
          const onUp = () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
          }
          document.addEventListener("mousemove", onMove)
          document.addEventListener("mouseup", onUp)
        }}
        onClick={() => {
          if (dragMoved.current) return
          playFlipSnap()
          setFlipped(f => !f)
        }}
      >
        {/* ── FRONT ── */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          clipPath: `url(#${clipId})`,
          background: PARCH,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ height: IMG_H, flexShrink: 0, margin: `${INSET}px ${INSET}px 0`, overflow: "hidden", background: "#e8dcc8" }}>
            <img
              src={stamp.illustration_url} alt="" draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
            />
          </div>
          <div style={{ flex: 1, margin: `0 ${INSET}px ${INSET}px`, background: "#f0ead8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3px 6px", gap: 2 }}>
            <div style={{ fontFamily: "var(--font-stamp)", fontSize: nameFs, letterSpacing: "2px", textTransform: "uppercase", color: INK, opacity: 0.75, lineHeight: 1 }}>
              {stamp.name}
            </div>
            {budget && (
              <div style={{ fontFamily: "var(--font-type)", fontSize: statFs, color: TERRA, lineHeight: 1 }}>
                {budget.allocated}/{budget.total + budget.rollover} {goal?.period_unit}
              </div>
            )}
          </div>
          <div style={{ position: "absolute", top: INSET, left: INSET, right: INSET, bottom: INSET, border: `0.8px solid ${INK}`, pointerEvents: "none", opacity: 0.2 }} />
        </div>

        {/* ── BACK ── */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          clipPath: `url(#${clipId})`,
          background: "#EDE4CE",
          display: "flex", flexDirection: "column",
          alignItems: "stretch",
          padding: `${INSET + 2}px ${INSET}px ${INSET}px`,
          gap: 4,
        }}>
          {/* Stamp name header */}
          <div style={{ fontFamily: "var(--font-stamp)", fontSize: nameFs, letterSpacing: "2px", textTransform: "uppercase", color: INK, opacity: 0.6, lineHeight: 1, textAlign: "center", marginBottom: 2 }}>
            {stamp.name}
          </div>

          {/* Budget bar */}
          {budget && goal && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontFamily: "var(--font-type)", fontSize: backSmFs, color: INK, opacity: 0.5, letterSpacing: "0.5px" }}>
                this week
              </div>
              {/* Progress bar */}
              <div style={{ height: 4, background: "rgba(44,26,14,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, Math.round((budget.allocated / Math.max(1, budget.total + budget.rollover)) * 100))}%`,
                  background: TERRA,
                  borderRadius: 2,
                  transition: "width 300ms ease",
                }} />
              </div>
              <div style={{ fontFamily: "var(--font-type)", fontSize: backSmFs, color: TERRA, lineHeight: 1 }}>
                {budget.allocated} / {budget.total + budget.rollover} {goal.period_unit}
              </div>
            </div>
          )}

          {/* Weekly target edit */}
          {goal && (
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontFamily: "var(--font-type)", fontSize: backSmFs, color: INK, opacity: 0.45, letterSpacing: "0.5px" }}>
                weekly target
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <input
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-type)", fontSize: backFs,
                    color: INK, background: "transparent",
                    border: "none", borderBottom: `0.8px solid rgba(44,26,14,0.3)`,
                    outline: "none", textAlign: "center",
                    padding: "1px 0",
                  }}
                />
                <span style={{ fontFamily: "var(--font-type)", fontSize: backSmFs, color: INK, opacity: 0.4, whiteSpace: "nowrap" }}>
                  {goal.period_unit}
                </span>
              </div>
            </div>
          )}

          {/* No goal */}
          {!goal && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: "var(--font-hand)", fontSize: backSmFs, color: INK, opacity: 0.35, textAlign: "center", lineHeight: 1.4 }}>
                no goal set
              </div>
            </div>
          )}

          {/* Inner border */}
          <div style={{ position: "absolute", top: INSET, left: INSET, right: INSET, bottom: INSET, border: `0.8px solid ${INK}`, pointerEvents: "none", opacity: 0.15 }} />
        </div>
      </div>
    </div>
  )
}

// ─── StampVault ───────────────────────────────────────────────────────────────

export default function StampVault({ stamps, goals, budgets, onStampsChange, onPointerDragStart, width }: Props) {
  const cardSize = Math.max(80, width - 24)
  const [addingFor, setAddingFor] = useState<StampTemplate["category"] | null>(null)
  const [newName, setNewName]           = useState("")
  const [newUnitType, setNewUnitType]   = useState<StampTemplate["unit_type"]>("session")
  const [newUnitLabel, setNewUnitLabel] = useState("")

  const labelFs = Math.max(8, Math.round(cardSize * 0.07))

  function handleAdd(category: StampTemplate["category"]) {
    if (!newName.trim()) return
    const stamp: StampTemplate = {
      id: newName.toLowerCase().replace(/\s+/g, "-") + "-" + newSlotId(),
      name: newName.trim(),
      category,
      unit_type: newUnitType,
      unit_label: newUnitLabel.trim(),
      default_duration_min: 30,
      illustration_url: "",
      sort_order: stamps.length,
      archived: false,
    }
    onStampsChange([...stamps, stamp])
    setNewName(""); setNewUnitType("session"); setNewUnitLabel(""); setAddingFor(null)
  }

  return (
    <div style={{
      width: "100%",
      overflowY: "auto", overflowX: "hidden",
      padding: "12px 12px",
      scrollbarWidth: "none",
    }}>
      <div style={{ fontFamily: "var(--font-hand)", fontSize: Math.max(13, labelFs + 4), color: INK, opacity: 0.5, marginBottom: 10 }}>
        Stamps
      </div>

      {CATEGORIES.map(({ key, label }) => {
        const catStamps = stamps.filter(s => s.category === key && !s.archived && s.illustration_url)
        if (catStamps.length === 0 && addingFor !== key) return null
        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: Math.max(7, Math.round(labelFs * 0.65)), letterSpacing: "2.5px", color: SAGE, marginBottom: 8, textTransform: "uppercase" }}>
              {label}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catStamps.map(stamp => {
                const goal   = goals.find(g => g.stamp_id === stamp.id)
                const budget = goal ? budgets[goal.id] : undefined
                return (
                  <VaultCard key={stamp.id} stamp={stamp} goal={goal} budget={budget} onPointerDragStart={onPointerDragStart} cardSize={cardSize} />
                )
              })}
            </div>

            {addingFor === key ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }} onClick={e => e.stopPropagation()}>
                <input
                  autoFocus placeholder="stamp name"
                  value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(key); if (e.key === "Escape") setAddingFor(null); e.stopPropagation() }}
                  style={{ fontSize: 9, fontFamily: "var(--font-type)", width: "100%", background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.3)", outline: "none", color: INK, padding: "1px 0" }}
                />
                <select value={newUnitType} onChange={e => setNewUnitType(e.target.value as StampTemplate["unit_type"])}
                  style={{ fontSize: 8, fontFamily: "var(--font-type)", background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none", color: INK }}>
                  <option value="counter">counter</option>
                  <option value="session">session</option>
                  <option value="duration">duration</option>
                  <option value="binary">binary</option>
                </select>
                <input placeholder="unit label" value={newUnitLabel} onChange={e => setNewUnitLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(key); e.stopPropagation() }}
                  style={{ fontSize: 8, fontFamily: "var(--font-type)", background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none", color: INK, padding: "1px 0" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button onClick={() => handleAdd(key)} style={{ fontSize: 8, color: SAGE, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-type)" }}>save</button>
                  <button onClick={() => setAddingFor(null)} style={{ fontSize: 8, color: INK, opacity: 0.35, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-type)" }}>cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingFor(key)} style={{ display: "block", marginTop: 8, fontSize: 8, letterSpacing: "1px", color: INK, opacity: 0.28, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)", padding: 0 }}>
                + new stamp
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
