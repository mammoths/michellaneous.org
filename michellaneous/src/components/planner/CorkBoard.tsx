"use client"

import { useState, useRef, useEffect, useId } from "react"
import type { StampTemplate, WeekTemplate, Goal, WeeklyBudget, SlotConfig, Zone, DayKey } from "@/lib/planner"
import {
  DAY_LABELS, ZONE_KEYS, ZONE_SYMBOL, PIN_EMOJI,
  getWeekDates, getTodayDayKey, newSlotId, suggestTarget,
} from "@/lib/planner"

type Props = {
  stamps: StampTemplate[]
  template: WeekTemplate
  goals: Goal[]
  budgets: Record<string, WeeklyBudget>
  onTemplateChange: (t: WeekTemplate) => void
  registerDragHandler: (fn: (e: React.MouseEvent, payload: DropPayload) => void) => void
}

export type DropPayload =
  | { type: "place"; stamp_id: string }
  | { type: "move";  slot_id: string; from_day: DayKey }

const INK   = "#2C1A0E"
const CORK  = "#D4A574"
const PARCH = "#F5ECD7"
const TERRA = "#C0392B"

// Perforation constants — square stamps on the board
const MW = 72
const MH = 72
const MR = 2
const MS = 8

function mHolePositions(total: number): number[] {
  const n = Math.round(total / MS)
  if (n < 1) return []
  const step = total / n
  return Array.from({ length: n }, (_, i) => step * (i + 0.5))
}
function mCircleArc(cx: number, cy: number) {
  return `M${cx-MR},${cy} A${MR},${MR},0,1,0,${cx+MR},${cy} A${MR},${MR},0,1,0,${cx-MR},${cy}Z`
}

const MAX_PER_ZONE = 3

// ─── MiniStamp ────────────────────────────────────────────────────────────────

function MiniStamp({ stamp, slot, dayKey, onRemove, onPointerDragStart }: {
  stamp: StampTemplate
  slot: SlotConfig
  dayKey: DayKey
  onRemove: () => void
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
}) {
  const rawId  = useId()
  const clipId = `ms${rawId.replace(/:/g, "")}`
  const tilt   = useRef(`${(Math.random() * 6 - 3).toFixed(1)}deg`)
  const [showX, setShowX] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStarted = useRef(false)

  useEffect(() => {
    if (!showX) return
    const hide = () => setShowX(false)
    document.addEventListener("pointerdown", hide)
    return () => document.removeEventListener("pointerdown", hide)
  }, [showX])

  const hPos = mHolePositions(MW)
  const vPos = mHolePositions(MH)
  const clipD = [
    `M0,0 H${MW} V${MH} H0 Z`,
    ...hPos.map(x => mCircleArc(x, 0)),
    ...hPos.map(x => mCircleArc(x, MH)),
    ...vPos.map(y => mCircleArc(0, y)),
    ...vPos.map(y => mCircleArc(MW, y)),
  ].join(" ")

  const IMG_H = 54
  const statText = slot.target_value != null
    ? `${slot.target_value}${slot.target_unit ? " " + slot.target_unit : ""}`
    : stamp.name.slice(0, 9)

  return (
    <div
      style={{
        position: "relative",
        width: MW,
        flexShrink: 0,
        margin: "0 auto 4px",
        transform: `rotate(${tilt.current})`,
        filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.15))",
        cursor: "grab",
        userSelect: "none",
      }}
      onMouseDown={e => {
        if (e.button !== 0) return
        dragStarted.current = false
        pressTimer.current = setTimeout(() => {
          setShowX(true)
        }, 500)
        // Start drag after tiny threshold
        const startX = e.clientX, startY = e.clientY
        const onMove = (mv: MouseEvent) => {
          if (Math.abs(mv.clientX - startX) > 4 || Math.abs(mv.clientY - startY) > 4) {
            if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
            dragStarted.current = true
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            onPointerDragStart(e, { type: "move", slot_id: slot.id, from_day: dayKey })
          }
        }
        const onUp = () => {
          if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
          document.removeEventListener("mousemove", onMove)
          document.removeEventListener("mouseup", onUp)
        }
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
      }}
    >
      {showX && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{
            position: "absolute", top: -2, right: -2, zIndex: 5,
            width: 14, height: 14,
            background: TERRA, color: "white",
            border: "none", borderRadius: "50%",
            fontSize: 9, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      )}

      <div style={{ textAlign: "center", fontSize: 10, lineHeight: 1, marginBottom: 2 }}>
        {PIN_EMOJI.planned}
      </div>

      <svg aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipD} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      <div style={{
        position: "relative",
        width: MW, height: MH,
        clipPath: `url(#${clipId})`,
        background: PARCH,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ height: IMG_H, flexShrink: 0, margin: "4px 4px 0", overflow: "hidden", background: "#e8dcc8" }}>
          {stamp.illustration_url
            ? <img src={stamp.illustration_url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-type)", fontSize: 8, color: INK, opacity: 0.35 }}>{stamp.name.slice(0, 7)}</div>
          }
        </div>
        <div style={{ flex: 1, margin: "0 4px 4px", background: "#f0ead8", display: "flex", alignItems: "center", justifyContent: "center", padding: "1px 3px" }}>
          <div style={{ fontFamily: "var(--font-type)", fontSize: 6, color: INK, textAlign: "center", lineHeight: 1.2, letterSpacing: "0.3px" }}>{statText}</div>
        </div>
        <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 4, border: `0.6px solid ${INK}`, pointerEvents: "none", opacity: 0.15 }} />
      </div>
    </div>
  )
}

// ─── TargetInput ──────────────────────────────────────────────────────────────

function TargetInput({ goal, budget, onConfirm, onSkip }: {
  goal: Goal
  budget?: WeeklyBudget
  onConfirm: (n: number) => void
  onSkip: () => void
}) {
  const suggest = suggestTarget(goal, budget)
  const [val, setVal] = useState(String(suggest || ""))
  return (
    <div
      style={{
        position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
        transform: "translateX(-50%)",
        background: PARCH, border: "1px solid rgba(44,26,14,0.2)",
        borderRadius: 3, padding: "8px 10px", zIndex: 200,
        width: 120, boxShadow: "0 3px 10px rgba(0,0,0,0.14)",
        fontFamily: "var(--font-type)",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 7.5, color: INK, opacity: 0.5, marginBottom: 5 }}>{goal.period_unit} for this day?</div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <input
          autoFocus value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { const n = parseFloat(val); if (!isNaN(n) && n > 0) onConfirm(n) }
            if (e.key === "Escape") onSkip()
            e.stopPropagation()
          }}
          style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-type)", background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.3)", outline: "none", color: INK, textAlign: "center" }}
        />
        <span style={{ fontSize: 7.5, color: INK, opacity: 0.4 }}>{goal.period_unit}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
        <button onClick={() => { const n = parseFloat(val); if (!isNaN(n) && n > 0) onConfirm(n) }}
          style={{ flex: 1, fontSize: 8, letterSpacing: "1.5px", textTransform: "uppercase", color: PARCH, background: INK, border: "none", borderRadius: 2, padding: "4px 0", cursor: "pointer", fontFamily: "var(--font-type)" }}>log</button>
        <button onClick={onSkip}
          style={{ fontSize: 8, color: INK, opacity: 0.35, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)" }}>skip</button>
      </div>
    </div>
  )
}

// ─── DayColumn ────────────────────────────────────────────────────────────────

function DayColumn({ dayKey, dateNum, isToday, slots, stamps, goals, budgets, onPlace, onRemove, onPointerDragStart, dragOver }: {
  dayKey: DayKey
  dateNum: number
  isToday: boolean
  slots: SlotConfig[]
  stamps: StampTemplate[]
  goals: Goal[]
  budgets: Record<string, WeeklyBudget>
  onPlace: (slot: SlotConfig) => void
  onRemove: (slotId: string) => void
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  dragOver: Zone | null
}) {
  const [pending, setPending] = useState<{ stamp_id: string; zone: Zone } | null>(null)

  function confirmTarget(value: number) {
    if (!pending) return
    const goal = goals.find(g => g.stamp_id === pending.stamp_id)
    onPlace({ id: newSlotId(), stamp_id: pending.stamp_id, zone: pending.zone, target_value: value, target_unit: goal?.period_unit })
    setPending(null)
  }

  const zoneTop: Record<Zone, string> = { morning: "0%", afternoon: "33.3%", evening: "66.6%" }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        borderRight: "1px solid rgba(0,0,0,0.07)",
        display: "flex", flexDirection: "column",
        background: isToday ? "#D9A860" : CORK,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{
        height: 48, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: isToday ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.04)",
      }}>
        <span style={{ fontFamily: "var(--font-type)", fontSize: 8, letterSpacing: "2px", color: INK, opacity: isToday ? 0.9 : 0.55, fontWeight: isToday ? 700 : 400 }}>{DAY_LABELS[dayKey]}</span>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, color: INK, opacity: isToday ? 1 : 0.7, lineHeight: 1.1 }}>{dateNum}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Zone dividers */}
        {ZONE_KEYS.slice(1).map(zone => (
          <div key={zone} style={{
            position: "absolute",
            top: zone === "afternoon" ? "33.3%" : "66.6%",
            left: 0, right: 0,
            borderTop: "1px solid rgba(0,0,0,0.1)",
            height: 0, overflow: "visible",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-type)", fontSize: 8, color: INK, opacity: 0.3, background: isToday ? "#D9A860" : CORK, padding: "0 3px", lineHeight: 1, position: "relative", top: -5 }}>
              {ZONE_SYMBOL[zone]}
            </span>
          </div>
        ))}

        {/* Drag-over highlight */}
        {dragOver && (
          <div style={{
            position: "absolute",
            top: zoneTop[dragOver], height: "33.3%",
            left: 4, right: 4,
            background: "rgba(255,255,255,0.22)",
            border: "1.5px dashed rgba(44,26,14,0.25)",
            borderRadius: 3,
            pointerEvents: "none",
          }} />
        )}

        {/* Slots per zone */}
        {ZONE_KEYS.map(zone => (
          <div
            key={zone}
            data-drop-day={dayKey}
            data-drop-zone={zone}
            style={{
              position: "absolute",
              top: zoneTop[zone], height: "33.3%",
              left: 0, right: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center",
              padding: "6px 4px 4px",
              overflowY: "auto", overflowX: "hidden",
              scrollbarWidth: "none",
            }}
          >
            {slots.filter(s => s.zone === zone).map(slot => {
              const stamp = stamps.find(s => s.id === slot.stamp_id)
              if (!stamp) return null
              return (
                <MiniStamp
                  key={slot.id}
                  stamp={stamp}
                  slot={slot}
                  dayKey={dayKey}
                  onRemove={() => onRemove(slot.id)}
                  onPointerDragStart={onPointerDragStart}
                />
              )
            })}
          </div>
        ))}

        {/* Target input popup */}
        {pending && (() => {
          const goal   = goals.find(g => g.stamp_id === pending.stamp_id)
          const budget = goal ? budgets[goal.id] : undefined
          if (!goal) { onPlace({ id: newSlotId(), stamp_id: pending.stamp_id, zone: pending.zone }); setPending(null); return null }
          return (
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 100 }}>
              <TargetInput goal={goal} budget={budget} onConfirm={confirmTarget} onSkip={() => { onPlace({ id: newSlotId(), stamp_id: pending.stamp_id, zone: pending.zone }); setPending(null) }} />
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── CorkBoard ────────────────────────────────────────────────────────────────

// Maplestory grab cursor data URL
const GRAB_CURSOR = `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAA/CAYAAABXXxDfAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAB7ElEQVRoge3YzWncQBjG8b9CChh1sLOwBSQlBJIC4hJiV2DIxWfnYMg1p801t6SADXEDht0CDDvpYKaDyUFfIyRiryU0Njw/EOyOPt/5fCUQEREREREREREREREREVlYkfn+caSs+E/5rF7NfcETxGOM9DbvAeJ2t++V/XFHqCok3SbL1fLxGKvnt0mhAwgBFzx2lewJgcOdw2wM7j5QAmcf3sLE588avB3Z4dI/IXTlwXe/Z6qA1089cbIQcMYMKsDS9QAYBj2nbGP++st3rj9/5fave/hgxgP/udvDhPGfo+VjPYEB8OPbLw4by+XFx8UfJEu3Tyezq5tL3FjrG9Mb86lypufI1u1tuq3sYF/721Sh2o0ZXqQcKTtBtuDTth6b9ZeQI/hiXeROLCs5MzweN88P+YcPeZRcwbetf0oF2I1px74HvJ+27ufsf/HofTWrM5Lmwuhs3yQ9zbo/JdPL2e2LdVl2mVyyAf3Ajekqycy10OVMbyvFuiwj0LzRDdg6aAft2u/uA6HJDVZPXytyBw91d20qYVulrAC8e/+md+Dt70MX9Fw3fmYiwKebLVcXZ213HwvcrCznE97snmPwjbjd7bH1O3wauKm7+pTAJ524kJgOg0YdNLzQjxmnWOR7noiIiIiIyIv0Dx7VtFd/LQhtAAAAAElFTkSuQmCC") 16 16, move`

export default function CorkBoard({ stamps, template, goals, budgets, onTemplateChange, registerDragHandler }: Props) {
  const weekDates = getWeekDates()
  const today     = getTodayDayKey()

  // dragOver state: which day+zone is currently hovered
  const [dragOverState, setDragOverState] = useState<{ day: DayKey; zone: Zone } | null>(null)

  // Refs to mutable state for use inside closures without stale captures
  const templateRef = useRef(template)
  templateRef.current = template
  const goalsRef = useRef(goals)
  goalsRef.current = goals
  const stampsRef = useRef(stamps)
  stampsRef.current = stamps

  // Register our drag handler with PlannerView so StampVault can call it too
  useEffect(() => {
    registerDragHandler(handlePointerDragStart)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerDragHandler])

  function handlePointerDragStart(startEvent: React.MouseEvent, payload: DropPayload) {
    const GW = MW + 10  // ghost slightly larger to show perforation ring
    const GH = MH + 10
    const imgUrl = payload.type === "place"
      ? stampsRef.current.find(s => s.id === payload.stamp_id)?.illustration_url ?? ""
      : (() => {
          const p = payload as { slot_id: string; from_day: DayKey }
          const slot = templateRef.current.days[p.from_day]?.slots.find(sl => sl.id === p.slot_id)
          return stampsRef.current.find(s => s.id === slot?.stamp_id)?.illustration_url ?? ""
        })()

    const overlay = document.createElement("div")
    overlay.style.cssText = `position:fixed;inset:0;z-index:99998;cursor:${GRAB_CURSOR};`
    document.body.appendChild(overlay)

    // Ghost: parchment card with image + perforation ring simulation
    const ghost = document.createElement("div")
    // Perforation ring: repeating dots via box-shadow on a wrapper
    ghost.style.cssText = `
      position:fixed;z-index:99999;
      width:${GW}px;height:${GH}px;
      padding:5px;
      background:#F5ECD7;
      border-radius:3px;
      box-shadow:1px 4px 12px rgba(0,0,0,0.35);
      opacity:0.92;transform:rotate(-2deg);
      pointer-events:none;
      overflow:hidden;
    `
    // Dotted inner border to simulate perforation
    const inner = document.createElement("div")
    inner.style.cssText = `
      width:100%;height:100%;
      border:1.5px dashed rgba(44,26,14,0.35);
      background:#e8dcc8;
      overflow:hidden;
      position:relative;
    `
    if (imgUrl) {
      const img = document.createElement("img")
      img.src = imgUrl
      img.style.cssText = `width:100%;height:100%;object-fit:cover;display:block;`
      inner.appendChild(img)
    }
    ghost.appendChild(inner)
    document.body.appendChild(ghost)

    function position(x: number, y: number) {
      ghost.style.left = `${x - GW / 2}px`
      ghost.style.top  = `${y - GH / 2}px`
      // Update dragOver highlight
      const els = document.elementsFromPoint(x, y)
      let found = false
      for (const el of els) {
        if (el instanceof HTMLElement && el.dataset.dropDay && el.dataset.dropZone) {
          setDragOverState({ day: el.dataset.dropDay as DayKey, zone: el.dataset.dropZone as Zone })
          found = true; break
        }
      }
      if (!found) setDragOverState(null)
    }

    position(startEvent.clientX, startEvent.clientY)

    function onMove(e: MouseEvent) { position(e.clientX, e.clientY) }
    function onUp(e: MouseEvent) {
      overlay.removeEventListener("mousemove", onMove)
      overlay.removeEventListener("mouseup", onUp)
      overlay.remove()
      ghost.remove()
      setDragOverState(null)
      // fire the registered drop handler
      // read from templateRef/goalsRef inline (already done in registerDropHandler callback)
      const t = templateRef.current
      const g = goalsRef.current
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      let targetDay: DayKey | null = null
      let targetZone: Zone | null  = null
      for (const el of els) {
        if (el instanceof HTMLElement && el.dataset.dropDay && el.dataset.dropZone) {
          targetDay = el.dataset.dropDay as DayKey
          targetZone = el.dataset.dropZone as Zone
          break
        }
      }
      if (!targetDay || !targetZone) return
      const zoneSlots = t.days[targetDay].slots.filter(s => s.zone === targetZone)
      if (zoneSlots.length >= MAX_PER_ZONE) return

      if (payload.type === "place") {
        const slot: SlotConfig = { id: newSlotId(), stamp_id: payload.stamp_id, zone: targetZone }
        onTemplateChange({ ...t, version: t.version + 1, days: { ...t.days, [targetDay]: { slots: [...t.days[targetDay].slots, slot] } } })
      } else {
        const { slot_id, from_day } = payload
        const srcSlot = t.days[from_day].slots.find(s => s.id === slot_id)
        if (!srcSlot) return
        const movedSlot = { ...srcSlot, zone: targetZone }
        let days = { ...t.days, [from_day]: { slots: t.days[from_day].slots.filter(s => s.id !== slot_id) } }
        days = { ...days, [targetDay]: { slots: [...days[targetDay].slots, movedSlot] } }
        onTemplateChange({ ...t, version: t.version + 1, days })
      }
    }
    overlay.addEventListener("mousemove", onMove)
    overlay.addEventListener("mouseup", onUp)
  }

  function handleRemove(dayKey: DayKey, slotId: string) {
    const next = { ...template, version: template.version + 1, days: { ...template.days, [dayKey]: { slots: template.days[dayKey].slots.filter(s => s.id !== slotId) } } }
    onTemplateChange(next)
  }

  // Minimum column width: 120px × 7 days = 840px; if panel is wider, columns flex-grow evenly
  const COL_MIN = 120

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative" }}>
      <div style={{
        flex: 1,
        display: "flex",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(44,26,14,0.2) transparent",
      }}>
        {/* Inner row: min-width forces horizontal scroll when panel is too narrow */}
        <div style={{ display: "flex", flex: 1, minWidth: COL_MIN * 7 }}>
        {weekDates.map(({ day, dateNum }) => (
          <DayColumn
            key={day}
            dayKey={day}
            dateNum={dateNum}
            isToday={day === today}
            slots={template.days[day]?.slots ?? []}
            stamps={stamps}
            goals={goals}
            budgets={budgets}
            onPlace={slot => {
              const next = { ...template, version: template.version + 1, days: { ...template.days, [day]: { slots: [...template.days[day].slots, slot] } } }
              onTemplateChange(next)
            }}
            onRemove={slotId => handleRemove(day, slotId)}
            onPointerDragStart={handlePointerDragStart}
            dragOver={dragOverState?.day === day ? dragOverState.zone : null}
          />
        ))}
        </div>
      </div>
    </div>
  )
}
