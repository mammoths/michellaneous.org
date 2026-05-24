"use client"

import { useState, useRef, useEffect, useId } from "react"
import { createPortal } from "react-dom"
import type { StampTemplate, Goal, WeeklyBudget, Zone, DayKey, PlacedStamp, PlacedZone, Completion } from "@/lib/planner"
import {
  DAY_LABELS, ZONE_KEYS, ZONE_SYMBOL, PIN_EMOJI,
  getTodayISO, newSlotId,
  getWeekISO, canWriteWeek, placedFor, addPlaced, removePlaced, togglePlacedPrivate,
  suggestNextRunMiles, runType, plannerStore,
} from "@/lib/planner"

type Props = {
  stamps: StampTemplate[]
  placed: PlacedStamp[]
  goals: Goal[]
  budgets: Record<string, WeeklyBudget>
  onPlacedChange: (p: PlacedStamp[]) => void
  registerDragHandler: (fn: (e: React.MouseEvent, payload: DropPayload) => void) => void
  registerBeforeMutate?: (fn: () => void) => void
  registerSnapToToday?: (fn: () => void) => void
  onVisibleWeekChange?: (weekISO: string) => void
  onCompletionsChange?: (c: Completion[]) => void
}

export type StickyShape = "rect" | "heart" | "star" | "diamond" | "flag"
export type StickyFormat = "blank" | "list" | "oneliner"
export type StickySize = "regular" | "small"

export type DropPayload =
  | { type: "place"; stamp_id: string; sticky_text?: string; sticky_color?: string; sticky_shape?: StickyShape; sticky_format?: StickyFormat; sticky_size?: StickySize; sticky_id?: string }
  | { type: "move";  placed_id: string; from_day: DayKey; from_zone: PlacedZone; from_date: string }

const INK   = "#2C1A0E"
const CORK  = "#D4A574"
const PARCH = "#F5ECD7"
const TERRA = "#C0392B"

// Perforation constants — square stamps on the board
const MW = 72
const MH = 72
const MR = 2
const MS = 8

const STAMP_MIN = 44
const STAMP_MAX = 280

function mHolePositions(total: number): number[] {
  const n = Math.round(total / MS)
  if (n < 1) return []
  const step = total / n
  return Array.from({ length: n }, (_, i) => step * (i + 0.5))
}
function mCircleArc(cx: number, cy: number) {
  return `M${cx-MR},${cy} A${MR},${MR},0,1,0,${cx+MR},${cy} A${MR},${MR},0,1,0,${cx-MR},${cy}Z`
}

// Module-level singleton: only one resize popover open at a time
let activeResizeClose: (() => void) | null = null

// ─── MiniStickyNote ───────────────────────────────────────────────────────────

const STICKY_DEFAULT = 80   // default square px on the board
const STICKY_MIN     = 60
const STICKY_MAX     = 280

// Scale font to fill the note — fits text into the available area
function stickyFontSize(text: string, boxPx: number): number {
  const chars = text.length || 1
  const charsPerLine = Math.max(1, Math.round(boxPx / 8))
  const lines = Math.ceil(chars / charsPerLine)
  const fs = Math.floor((boxPx * 0.72) / (lines * 1.4))
  return Math.max(9, Math.min(28, fs))
}

// Render list lines — [] → □ prefix, otherwise plain line
function StickyListLines({ text, fontSize, color }: { text: string; fontSize: number; color: string }) {
  const lines = text.split("\n").filter(Boolean)
  return (
    <div style={{ width: "100%", textAlign: "left" }}>
      {lines.map((line, i) => {
        const isCb = line.trimStart().startsWith("[]")
        const label = isCb ? "□" : "·"
        const body  = isCb ? line.replace(/^\[\]\s*/, "") : line
        return (
          <div key={i} style={{ fontFamily: "var(--font-hand)", fontSize, color, lineHeight: 1.4, display: "flex", gap: "0.3em", alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0 }}>{label}</span>
            <span style={{ wordBreak: "break-word" }}>{body}</span>
          </div>
        )
      })}
    </div>
  )
}

function MiniStickyNote({ placed, dayKey, colDate, onRemove, onTogglePin, onToggleSide, onPointerDragStart }: {
  placed: PlacedStamp
  dayKey: DayKey
  colDate: string
  onRemove: () => void
  onTogglePin: () => void
  onToggleSide?: () => void
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
}) {
  const tilt   = useRef(`${(Math.random() * 6 - 3).toFixed(1)}deg`)
  const isList = !!(placed.sticky_text?.includes("[]"))

  const [showX,        setShowX]        = useState(false)
  const [showResize,   setShowResize]   = useState(false)
  const [hover,        setHover]        = useState(false)
  const [popoverPos,   setPopoverPos]   = useState<{ x: number; y: number } | null>(null)
  const [pinBouncing,  setPinBouncing]  = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText,setEditText]= useState(placed.sticky_text ?? "")
  const [sz,      setSz]      = useState(placed.sticky_px ?? STICKY_DEFAULT)
  const pressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap     = useRef(0)
  const textaRef    = useRef<HTMLTextAreaElement>(null)
  const stickyRef   = useRef<HTMLDivElement>(null)

  // Keep sz in sync if placed.sticky_px changes from undo/external
  useEffect(() => { setSz(placed.sticky_px ?? STICKY_DEFAULT) }, [placed.sticky_px])

  const bg   = placed.sticky_color ?? "#FDF3C0"
  const text = placed.sticky_text ?? ""
  const SZ   = sz

  const PAD      = Math.round(SZ * 0.1)
  const innerSz  = SZ - PAD * 2
  const fontSize = stickyFontSize(text, innerSz)

  useEffect(() => {
    if (!showX) return
    const hide = () => setShowX(false)
    document.addEventListener("pointerdown", hide)
    return () => document.removeEventListener("pointerdown", hide)
  }, [showX])

  useEffect(() => {
    if (!showResize) return
    if (activeResizeClose) activeResizeClose()
    const close = () => setShowResize(false)
    activeResizeClose = close
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-resize-popover]")) close()
    }
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      if (activeResizeClose === close) activeResizeClose = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResize])

  useEffect(() => {
    if (!editing) return
    textaRef.current?.focus()
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-sticky-editor]")) {
        setEditing(false)
        document.dispatchEvent(new CustomEvent("sticky-edit-save", { detail: { id: placed.id, text: editText } }))
      }
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [editing, editText, placed])

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || editing) return
    pressTimer.current = setTimeout(() => setShowX(true), 500)
    const startX = e.clientX, startY = e.clientY
    const onMove = (mv: MouseEvent) => {
      if (Math.abs(mv.clientX - startX) > 4 || Math.abs(mv.clientY - startY) > 4) {
        if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        onPointerDragStart(e, { type: "move", placed_id: placed.id, from_day: dayKey, from_zone: placed.zone, from_date: colDate })
      }
    }
    const onUp = (upEv: MouseEvent) => {
      if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      const el = upEv.target as HTMLElement
      if (el.closest("[data-resize-popover]")) return
      const now = Date.now()
      if (now - lastTap.current < 400) {
        setShowResize(false)
        setEditText(placed.sticky_text ?? "")
        setEditing(true)
      } else {
        setShowResize(v => {
          if (!v && stickyRef.current) {
            const r = stickyRef.current.getBoundingClientRect()
            setPopoverPos({ x: r.right + 6, y: r.top + r.height / 2 })
          }
          return !v
        })
      }
      lastTap.current = now
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  return (
    <div
      ref={stickyRef}
      data-sticky-editor={editing ? "1" : undefined}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: SZ > STICKY_DEFAULT ? "absolute" : "relative",
        width: SZ, height: SZ,
        flexShrink: 0,
        transform: `rotate(${tilt.current})`,
        cursor: editing ? "default" : "grab",
        userSelect: "none",
        filter: "drop-shadow(1px 2px 5px rgba(0,0,0,0.2))",
        zIndex: SZ > STICKY_DEFAULT || editing ? 10 : undefined,
        borderRadius: 4,
        outline: (hover || showResize) && !editing ? "2px solid #F5C842" : "2px solid transparent",
        outlineOffset: 3,
        transition: "outline-color 120ms",
      }}
    >
      {/* Square note body */}
      <div style={{
        position: "absolute", inset: 0,
        background: bg,
        borderRadius: 3,
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.07)",
      }} />

      {/* Thumbtack pin — only on body zone instances, not repeat */}
      {placed.zone !== "repeat" && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation()
            setPinBouncing(true); setTimeout(() => setPinBouncing(false), 200)
            onTogglePin()
          }}
          title={placed.is_pinned ? "pinned — click to unpin" : "click to pin"}
          style={{
            position: "absolute", top: -8, left: "50%",
            transform: `translateX(-50%) ${pinBouncing ? "scale(1.35) rotate(-15deg)" : "scale(1)"}`,
            fontSize: Math.max(9, Math.round(SZ * 0.16)), lineHeight: 1, zIndex: 20,
            cursor: "pointer", userSelect: "none",
            transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))",
            opacity: placed.is_pinned ? 1 : 0.2,
          }}
        >📍</div>
      )}

      {/* Text area */}
      <div style={{
        position: "absolute",
        top: PAD, left: PAD, right: PAD, bottom: PAD,
        display: "flex", alignItems: "center", justifyContent: isList ? "flex-start" : "center",
        overflow: "hidden",
        pointerEvents: editing ? "auto" : "none",
      }}>
        {editing ? (
          <textarea
            ref={textaRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            style={{
              width: "100%", height: "100%",
              background: "transparent", border: "none", outline: "none", resize: "none",
              fontFamily: "var(--font-hand)", fontSize,
              color: INK, lineHeight: 1.4, textAlign: isList ? "left" : "center",
            }}
          />
        ) : isList ? (
          <StickyListLines text={text} fontSize={fontSize} color={INK} />
        ) : (
          <p style={{
            fontFamily: "var(--font-hand)", fontSize,
            color: INK, lineHeight: 1.4, margin: 0,
            textAlign: "center", wordBreak: "break-word", opacity: 0.9,
            display: "-webkit-box", WebkitLineClamp: 10, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{text}</p>
        )}
      </div>

      {showX && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ position: "absolute", top: -2, right: -2, zIndex: 25, width: 14, height: 14, background: TERRA, color: "white", border: "none", borderRadius: "50%", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >×</button>
      )}

      {showResize && !editing && onToggleSide && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onToggleSide() }}
          title="swap side"
          style={{
            position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
            zIndex: 25, height: 13, padding: "0 5px",
            background: "rgba(44,26,14,0.12)", color: INK,
            border: "none", borderRadius: 6, fontSize: 8,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-type)", whiteSpace: "nowrap",
          }}
        >↔</button>
      )}

      {/* Resize popover — portaled to body so nothing clips or intercepts clicks */}
      {showResize && !editing && popoverPos && createPortal(
        <div
          data-resize-popover="1"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            left: popoverPos.x,
            top: popoverPos.y,
            transform: "translateY(-50%)",
            zIndex: 99999,
            background: PARCH,
            border: "0.5px solid rgba(44,26,14,0.18)",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: "6px 8px",
            display: "flex", flexDirection: "column", gap: 5,
            minWidth: 80,
          }}
        >
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            {([60, 80, 120, 180] as const).map((preset, i) => {
              const label = ["S","M","L","XL"][i]
              const active = sz === preset
              return (
                <button
                  key={preset}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    setSz(preset)
                    document.dispatchEvent(new CustomEvent("sticky-resize-save", { detail: { id: placed.id, px: preset } }))
                  }}
                  style={{
                    fontFamily: "var(--font-type)", fontSize: 9,
                    width: 22, height: 22,
                    background: active ? INK : "transparent",
                    color: active ? PARCH : INK,
                    border: `0.5px solid ${active ? INK : "rgba(44,26,14,0.25)"}`,
                    borderRadius: 4, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >{label}</button>
              )
            })}
          </div>
          <input
            type="range"
            min={STICKY_MIN} max={STICKY_MAX}
            value={sz}
            onMouseDown={e => e.stopPropagation()}
            onChange={e => setSz(Number(e.target.value))}
            onMouseUp={e => {
              e.stopPropagation()
              document.dispatchEvent(new CustomEvent("sticky-resize-save", { detail: { id: placed.id, px: sz } }))
            }}
            style={{ width: "100%", accentColor: INK, cursor: "pointer" }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── MiniStamp ────────────────────────────────────────────────────────────────

function MiniStamp({ stamp, placed, dayKey, colDate, size, completions, editable, onRemove, onPointerDragStart, onTogglePrivate, onToggleDone, onToggleSide }: {
  stamp: StampTemplate
  placed: PlacedStamp
  dayKey: DayKey
  colDate: string
  size: number
  completions: Completion[]
  editable: boolean
  onRemove: () => void
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  onTogglePrivate: () => void
  onToggleDone: (date: string, isDone: boolean, miles?: number) => void
  onToggleSide?: () => void
}) {
  const [sz, setSz] = useState(placed.stamp_px ?? size)
  const [offsetX, setOffsetX] = useState(placed.stamp_offset_x ?? 0)
  const [offsetY, setOffsetY] = useState(placed.stamp_offset_y ?? 0)
  const offsetXRef = useRef(placed.stamp_offset_x ?? 0)
  const offsetYRef = useRef(placed.stamp_offset_y ?? 0)
  useEffect(() => { setSz(placed.stamp_px ?? size) }, [placed.stamp_px, size])
  useEffect(() => { setOffsetX(placed.stamp_offset_x ?? 0); offsetXRef.current = placed.stamp_offset_x ?? 0 }, [placed.stamp_offset_x])
  useEffect(() => { setOffsetY(placed.stamp_offset_y ?? 0); offsetYRef.current = placed.stamp_offset_y ?? 0 }, [placed.stamp_offset_y])

  const W = sz, H = sz
  const rawId  = useId()
  const clipId = `ms${rawId.replace(/:/g, "")}`
  const tilt   = useRef(`${(Math.random() * 6 - 3).toFixed(1)}deg`)
  const [showX, setShowX] = useState(false)
  const [showResize, setShowResize] = useState(false)
  const [hover, setHover] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [pinBouncing, setPinBouncing] = useState(false)
  const [ribbonBouncing, setRibbonBouncing] = useState(false)
  const pressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStarted = useRef(false)
  const stampRef    = useRef<HTMLDivElement>(null)

  const isDone = completions.some(c => c.slot_id === placed.id && c.date === colDate)

  useEffect(() => {
    if (!showX) return
    const hide = () => setShowX(false)
    document.addEventListener("pointerdown", hide)
    return () => document.removeEventListener("pointerdown", hide)
  }, [showX])

  useEffect(() => {
    if (!showResize) return
    if (activeResizeClose) activeResizeClose()
    const close = () => setShowResize(false)
    activeResizeClose = close
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-resize-popover]")) close()
    }
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      if (activeResizeClose === close) activeResizeClose = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResize])

  const hPos = mHolePositions(W)
  const vPos = mHolePositions(H)
  const clipD = [
    `M0,0 H${W} V${H} H0 Z`,
    ...hPos.map(x => mCircleArc(x, 0)),
    ...hPos.map(x => mCircleArc(x, H)),
    ...vPos.map(y => mCircleArc(0, y)),
    ...vPos.map(y => mCircleArc(W, y)),
  ].join(" ")

  const IMG_H = Math.round(H * 0.75)
  const isRun = stamp.id === "run"
  const [targetVal, setTargetVal] = useState(placed.target_value ?? 0)
  const targetValRef = useRef(placed.target_value ?? 0)
  useEffect(() => { setTargetVal(placed.target_value ?? 0); targetValRef.current = placed.target_value ?? 0 }, [placed.target_value])

  const runWeek = placed.week ?? getWeekISO()
  // Use targetVal (local state) so badge + label update instantly on stepper click
  const effectiveTarget = isRun ? targetVal : (placed.target_value ?? 0)
  const rType = isRun && effectiveTarget > 0 ? runType(effectiveTarget, runWeek) : null

  const statText = placed.target_value != null || isRun
    ? isRun
      ? rType === "LONG RUN" ? "LONG RUN"
        : rType === "EASY RUN" ? "EASY RUN"
        : "RUN"
      : `${placed.target_value}${placed.target_unit ? " " + placed.target_unit : ""}`
    : stamp.name.slice(0, 9)

  return (
    <div
      ref={stampRef}
      style={{
        position: sz > size ? "absolute" : "relative",
        width: W,
        flexShrink: 0,
        margin: "0 auto 4px",
        transform: `translate(${offsetX}px, ${-offsetY}px) rotate(${tilt.current})`,
        cursor: editable ? "grab" : "default",
        userSelect: "none",
        zIndex: sz > size ? 10 : undefined,
        borderRadius: 4,
        outline: editable && (hover || showResize) ? "2px solid #F5C842" : "2px solid transparent",
        outlineOffset: 3,
        transition: "outline-color 120ms",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={e => {
        if (e.button !== 0) return
        if (!editable) return
        dragStarted.current = false
        pressTimer.current = setTimeout(() => {
          setShowX(true)
        }, 500)
        const startX = e.clientX, startY = e.clientY
        const onMove = (mv: MouseEvent) => {
          if (Math.abs(mv.clientX - startX) > 4 || Math.abs(mv.clientY - startY) > 4) {
            if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
            dragStarted.current = true
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            onPointerDragStart(e, { type: "move", placed_id: placed.id, from_day: dayKey, from_zone: placed.zone, from_date: colDate })
          }
        }
        const onUp = (upEv: MouseEvent) => {
          if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
          document.removeEventListener("mousemove", onMove)
          document.removeEventListener("mouseup", onUp)
          if (!dragStarted.current) {
            const el = upEv.target as HTMLElement
            if (!el.closest("[data-resize-popover]") && !el.closest("[data-stamp-action]")) {
              setShowResize(v => {
                if (!v && stampRef.current) {
                  const r = stampRef.current.getBoundingClientRect()
                  setPopoverPos({ x: r.right + 6, y: r.top + r.height / 2 })
                }
                return !v
              })
            }
          }
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

      <svg aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipD} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      <div style={{
        position: "relative",
        width: W, height: H,
        clipPath: `url(#${clipId})`,
        background: PARCH,
        display: "flex", flexDirection: "column",
        filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.15))",
      }}>
        <div style={{ height: IMG_H, flexShrink: 0, margin: "4px 4px 0", overflow: "hidden", background: "#e8dcc8", position: "relative" }}>
          {stamp.illustration_url
            ? <img src={stamp.illustration_url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-type)", fontSize: 8, color: INK, opacity: 0.35 }}>{stamp.name.slice(0, 7)}</div>
          }
          {/* Run goal badge — top right of image */}
          {isRun && effectiveTarget > 0 && (
            <div style={{
              position: "absolute", top: 2, right: 2,
              background: isDone ? "rgba(90,158,111,0.88)" : "rgba(44,26,14,0.55)",
              color: "#F5ECD7",
              fontFamily: "var(--font-type)",
              fontSize: Math.max(5, Math.round(W * 0.1)),
              letterSpacing: "0.3px",
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 2,
              pointerEvents: "none",
              fontWeight: 600,
            }}>
              {effectiveTarget}mi
            </div>
          )}
        </div>
        <div style={{ flex: 1, margin: "0 4px 4px", background: "#f0ead8", display: "flex", alignItems: "center", justifyContent: "center", padding: "1px 3px" }}>
          <div style={{
            fontFamily: "var(--font-type)",
            fontSize: Math.max(5, Math.round(W * (isRun ? 0.075 : 0.085))),
            color: INK,
            textAlign: "center", lineHeight: 1.2,
            letterSpacing: isRun ? "0.8px" : "0.3px",
            opacity: isRun && !isDone ? 0.55 : 1,
          }}>{statText}</div>
        </div>
        <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 4, border: `0.6px solid ${INK}`, pointerEvents: "none", opacity: 0.15 }} />
      </div>

      {/* Done ribbon 🎀 — bottom-center, toggles completion for this date */}
      <div
        data-stamp-action="1"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          setRibbonBouncing(true); setTimeout(() => setRibbonBouncing(false), 220)
          onToggleDone(colDate, isDone, isRun ? effectiveTarget : undefined)
        }}
        title={isDone ? "mark undone" : "mark done"}
        style={{
          position: "absolute", bottom: -8, left: "50%",
          transform: `translateX(-50%) ${ribbonBouncing ? "scale(1.35) rotate(8deg)" : "scale(1)"}`,
          fontSize: 12, lineHeight: 1, zIndex: 20,
          cursor: "pointer", userSelect: "none",
          transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1), opacity 150ms",
          opacity: isDone ? 1 : 0.25,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.2))",
        }}
      >
        🎀
      </div>

      {/* Pin — rendered after stamp body so it sits on top in DOM/stacking order */}
      {placed.is_pinned && (
        <div
          data-stamp-action="1"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation()
            setPinBouncing(true); setTimeout(() => setPinBouncing(false), 200)
            onTogglePrivate()
          }}
          title={placed.is_private ? "private — click to make public" : "public — click to make private"}
          style={{
            position: "absolute", top: -10, left: "50%",
            transform: `translateX(-50%) ${pinBouncing ? "scale(1.3) rotate(-12deg)" : "scale(1)"}`,
            fontSize: 13, lineHeight: 1, zIndex: 20,
            cursor: "pointer", userSelect: "none",
            transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))",
          }}
        >
          {placed.is_private ? PIN_EMOJI.private : PIN_EMOJI.planned}
        </div>
      )}

      {/* Popover — portaled to body so nothing clips or intercepts clicks */}
      {showResize && popoverPos && createPortal(
        <div
          data-resize-popover="1"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            left: popoverPos.x,
            top: popoverPos.y,
            transform: "translateY(-50%)",
            zIndex: 99999,
            background: PARCH,
            border: "0.5px solid rgba(44,26,14,0.18)",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: "6px 8px",
            display: "flex", flexDirection: "column", gap: 6,
            minWidth: 90,
          }}
        >
          {/* Size */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "var(--font-type)", fontSize: 9, color: INK, opacity: 0.5, width: 10, textAlign: "center", flexShrink: 0 }}>⤢</span>
            <input
              type="range"
              min={STAMP_MIN} max={STAMP_MAX}
              value={sz}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => setSz(Number(e.target.value))}
              onMouseUp={e => {
                e.stopPropagation()
                document.dispatchEvent(new CustomEvent("stamp-resize-save", { detail: { id: placed.id, px: sz } }))
              }}
              style={{ flex: 1, accentColor: INK, cursor: "pointer" }}
            />
          </div>

          {/* X offset */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "var(--font-type)", fontSize: 9, color: INK, opacity: 0.5, width: 10, textAlign: "center", flexShrink: 0 }}>↔</span>
            <input
              type="range"
              min={-60} max={60}
              value={offsetX}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => { const v = Number(e.target.value); setOffsetX(v); offsetXRef.current = v }}
              onMouseUp={e => {
                e.stopPropagation()
                document.dispatchEvent(new CustomEvent("stamp-offsetx-save", { detail: { id: placed.id, offsetX: offsetXRef.current } }))
              }}
              style={{ flex: 1, accentColor: INK, cursor: "pointer" }}
            />
          </div>

          {/* Y offset */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "var(--font-type)", fontSize: 9, color: INK, opacity: 0.5, width: 10, textAlign: "center", flexShrink: 0 }}>↕</span>
            <input
              type="range"
              min={-60} max={60}
              value={offsetY}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => { const v = Number(e.target.value); setOffsetY(v); offsetYRef.current = v }}
              onMouseUp={e => {
                e.stopPropagation()
                document.dispatchEvent(new CustomEvent("stamp-offsety-save", { detail: { id: placed.id, offsetY: offsetYRef.current } }))
              }}
              style={{ flex: 1, accentColor: INK, cursor: "pointer" }}
            />
          </div>

          {/* Run target stepper — only for run stamps */}
          {isRun && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-type)", fontSize: 9, color: INK, opacity: 0.45, flexShrink: 0 }}>mi</span>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  const v = Math.max(0.5, parseFloat((targetVal - 0.5).toFixed(1)))
                  setTargetVal(v); targetValRef.current = v
                  document.dispatchEvent(new CustomEvent("stamp-target-save", { detail: { id: placed.id, value: v } }))
                }}
                style={{ fontFamily: "var(--font-type)", fontSize: 13, width: 22, height: 22, background: "transparent", border: "0.5px solid rgba(44,26,14,0.2)", borderRadius: 4, cursor: "pointer", color: INK, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >−</button>
              <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-type)", fontSize: 11, color: INK }}>{targetVal}</div>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  const v = parseFloat((targetVal + 0.5).toFixed(1))
                  setTargetVal(v); targetValRef.current = v
                  document.dispatchEvent(new CustomEvent("stamp-target-save", { detail: { id: placed.id, value: v } }))
                }}
                style={{ fontFamily: "var(--font-type)", fontSize: 13, width: 22, height: 22, background: "transparent", border: "0.5px solid rgba(44,26,14,0.2)", borderRadius: 4, cursor: "pointer", color: INK, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >+</button>
            </div>
          )}

          {/* ✓ done toggle */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              setRibbonBouncing(true); setTimeout(() => setRibbonBouncing(false), 220)
              onToggleDone(colDate, isDone, isRun ? effectiveTarget : undefined)
            }}
            title={isDone ? "mark undone" : "mark done"}
            style={{
              fontFamily: "var(--font-type)", fontSize: 13,
              width: "100%", height: 22,
              background: isDone ? "#5a9e6f" : "transparent",
              color: isDone ? "#fff" : INK,
              border: `0.5px solid ${isDone ? "#5a9e6f" : "rgba(44,26,14,0.25)"}`,
              borderRadius: 4, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✓</button>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── DayColumn ────────────────────────────────────────────────────────────────

function DayColumn({ dayKey, dateNum, colDate, colW, isToday, isPast, unlocked, onUnlockToggle, placedOnDay, stamps, completions, onRemove, onTogglePrivate, onTogglePin, onToggleSide, onToggleDone, onPointerDragStart, dragOver, dragOverSlot }: {
  dayKey: DayKey
  dateNum: number
  colDate: string
  colW: number
  isToday: boolean
  isPast: boolean
  unlocked: boolean
  onUnlockToggle: () => void
  placedOnDay: PlacedStamp[]
  stamps: StampTemplate[]
  completions: Completion[]
  onRemove: (placedId: string, force?: boolean) => void
  onTogglePrivate: (placedId: string) => void
  onTogglePin: (placedId: string) => void
  onToggleSide: (placedId: string) => void
  onToggleDone: (placedId: string, stampId: string, date: string, isDone: boolean, miles?: number) => void
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  dragOver: PlacedZone | null
  dragOverSlot: number | null
}) {
  // Stamp fills most of the column width; sticky sits alongside at ~60% of stamp size
  const stampSz = Math.max(44, Math.min(100, Math.floor(colW * 0.62)))
  const repeatStamps = placedOnDay.filter(p => p.zone === "repeat")
  const zoneStamps = (z: Zone) => placedOnDay.filter(p => p.zone === z)

  const zoneTop: Record<Zone, string> = { morning: "0%", afternoon: "33.3%", evening: "66.6%" }

  return (
    <div
      data-col-date={colDate}
      style={{
        flex: 1,
        borderRight: "1px solid rgba(0,0,0,0.07)",
        display: "flex", flexDirection: "column",
        background: isToday ? "#D9A860" : CORK,
        position: "relative",
        opacity: isPast && !unlocked ? 0.45 : 1,
        overflow: "visible",
      }}
    >
      {/* Header — day/date + repeat drop zone */}
      <div
        style={{
          height: 48, flexShrink: 0, position: "relative",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: isToday ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.04)",
        }}
      >
        <span style={{ fontFamily: "var(--font-type)", fontSize: 8, letterSpacing: "2px", color: INK, opacity: isToday ? 0.9 : 0.55, fontWeight: isToday ? 700 : 400 }}>{DAY_LABELS[dayKey]}</span>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, color: INK, opacity: isToday ? 1 : 0.7, lineHeight: 1.1 }}>{dateNum}</span>

        {/* Repeat drop target — full header, shows ↻ on hover */}
        <div
          data-drop-day={isPast && !unlocked ? undefined : dayKey}
          data-drop-zone={isPast && !unlocked ? undefined : "repeat-header"}
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: dragOver === ("repeat-header" as PlacedZone) ? "rgba(255,255,255,0.22)" : "transparent",
            borderRadius: 2,
            transition: "background 120ms",
          }}
        >
          {dragOver === ("repeat-header" as PlacedZone) && (
            <span style={{
              fontFamily: "var(--font-type)", fontSize: 16, color: INK,
              opacity: 0.45, pointerEvents: "none", userSelect: "none",
              lineHeight: 1,
            }}>↻</span>
          )}
        </div>
      </div>

      {/* Repeat zone strip — only shown when stamps are staged here */}
      {(repeatStamps.length > 0 || dragOver === "repeat") && (
        <div
          data-drop-day={isPast && !unlocked ? undefined : dayKey}
          data-drop-zone={isPast && !unlocked ? undefined : "repeat"}
          style={{
            flexShrink: 0,
            background: dragOver === "repeat" ? "rgba(255,255,255,0.28)" : "rgba(245,236,215,0.55)",
            borderBottom: "1px dashed rgba(44,26,14,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "4px",
            gap: 4, flexWrap: "wrap",
            transition: "background 120ms",
          }}
        >
          {repeatStamps.map(p => {
            if (p.stamp_id === "sticky") {
              return (
                <MiniStickyNote
                  key={p.id}
                  placed={p}
                  dayKey={dayKey}
                  colDate={colDate}
                  onRemove={() => onRemove(p.id, unlocked)}
                  onTogglePin={() => onTogglePin(p.id)}
                  onPointerDragStart={onPointerDragStart}
                />
              )
            }
            const stamp = stamps.find(s => s.id === p.stamp_id)
            if (!stamp) return null
            return (
              <MiniStamp
                key={p.id}
                stamp={stamp}
                placed={p}
                dayKey={dayKey}
                colDate={colDate}
                size={stampSz}
                completions={completions}
                editable={!isPast || unlocked}
                onRemove={() => onRemove(p.id, unlocked)}
                onTogglePrivate={() => onTogglePrivate(p.id)}
                onToggleDone={(date, done, miles) => onToggleDone(p.id, p.stamp_id, date, done, miles)}
                onPointerDragStart={onPointerDragStart}
              />
            )
          })}
        </div>
      )}

      {/* Body — 3 zones */}
      <div style={{ flex: 1, position: "relative", overflow: "visible" }}>
        {/* Zone divider lines + labels */}
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

        {ZONE_KEYS.map(zone => {
          const ps = zoneStamps(zone)
          const isDragZone = dragOver === zone

          // Build a 3×2 grid: slot = row*2 + col (col 0=left, col 1=right)
          // Any item (stamp or sticky) can occupy any cell via its slot_index
          const grid: (PlacedStamp | null)[][] = [
            [null, null],
            [null, null],
            [null, null],
          ]
          ps.forEach(p => {
            const si = p.slot_index ?? 0
            const row = Math.min(2, Math.floor(si / 2))
            const col = si % 2
            if (grid[row][col] === null) grid[row][col] = p
          })

          return (
            <div key={zone} style={{
              position: "absolute",
              top: zoneTop[zone], height: "33.3%",
              left: 0, right: 0,
              display: "flex", flexDirection: "column",
              overflow: "visible",
            }}>
              {[0, 1, 2].map(rowIdx => (
                <div key={rowIdx} style={{
                  flex: 1, minHeight: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 3,
                  position: "relative", zIndex: 1,
                  overflow: "visible",
                }}>
                  {[0, 1].map(colIdx => {
                    const slotId = rowIdx * 2 + colIdx
                    const item   = grid[rowIdx][colIdx]
                    const isHovered = isDragZone && dragOverSlot === slotId
                    const isSticky  = item?.stamp_id === "sticky"
                    const stamp     = item && !isSticky ? stamps.find(s => s.id === item.stamp_id) : null

                    return (
                      <div
                        key={colIdx}
                        data-drop-day={isPast && !unlocked ? undefined : dayKey}
                        data-drop-zone={isPast && !unlocked ? undefined : zone}
                        data-drop-slot={slotId}
                        style={{
                          width: stampSz, height: stampSz, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isHovered && !item ? "rgba(255,255,255,0.22)" : "transparent",
                          borderRadius: 3,
                          transition: "background 120ms",
                          overflow: "visible",
                          position: "relative",
                        }}
                      >
                        {item && isSticky && (
                          <MiniStickyNote
                            placed={item}
                            dayKey={dayKey}
                            colDate={colDate}
                            onRemove={() => onRemove(item.id, unlocked)}
                            onTogglePin={() => onTogglePin(item.id)}
                            onToggleSide={
                              // offer swap if the adjacent col in the same row has a different item type
                              (() => {
                                const adj = grid[rowIdx][colIdx === 0 ? 1 : 0]
                                return adj ? () => onToggleSide(item.id) : undefined
                              })()
                            }
                            onPointerDragStart={onPointerDragStart}
                          />
                        )}
                        {item && !isSticky && stamp && (
                          <MiniStamp
                            stamp={stamp}
                            placed={item}
                            dayKey={dayKey}
                            colDate={colDate}
                            size={stampSz}
                            completions={completions}
                            editable={!isPast || unlocked}
                            onRemove={() => onRemove(item.id, unlocked)}
                            onTogglePrivate={() => onTogglePrivate(item.id)}
                            onToggleDone={(date, done, miles) => onToggleDone(item.id, item.stamp_id, date, done, miles)}
                            onToggleSide={
                              (() => {
                                const adj = grid[rowIdx][colIdx === 0 ? 1 : 0]
                                return adj ? () => onToggleSide(item.id) : undefined
                              })()
                            }
                            onPointerDragStart={onPointerDragStart}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Lock/unlock button — always above the overlay */}
      {isPast && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onUnlockToggle() }}
          title={unlocked ? "lock" : "unlock to edit past"}
          style={{
            position: "absolute", bottom: 6, right: 4,
            background: "none", border: "none", padding: 0,
            fontSize: 10, lineHeight: 1, cursor: "pointer",
            opacity: unlocked ? 0.85 : 0.5,
            transition: "opacity 150ms",
            zIndex: 12,
          }}
        >
          {unlocked ? "🔓" : "🔒"}
        </button>
      )}

      {/* Drop-blocking on locked past columns is handled via data-drop-day/zone being undefined */}
    </div>
  )
}

// ─── CorkBoard ────────────────────────────────────────────────────────────────

// Maplestory grab cursor data URL
const GRAB_CURSOR = `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAA/CAYAAABXXxDfAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAB7ElEQVRoge3YzWncQBjG8b9CChh1sLOwBSQlBJIC4hJiV2DIxWfnYMg1p801t6SADXEDht0CDDvpYKaDyUFfIyRiryU0Njw/EOyOPt/5fCUQEREREREREREREREREVlYkfn+caSs+E/5rF7NfcETxGOM9DbvAeJ2t++V/XFHqCok3SbL1fLxGKvnt0mhAwgBFzx2lewJgcOdw2wM7j5QAmcf3sLE588avB3Z4dI/IXTlwXe/Z6qA1089cbIQcMYMKsDS9QAYBj2nbGP++st3rj9/5fave/hgxgP/udvDhPGfo+VjPYEB8OPbLw4by+XFx8UfJEu3Tyezq5tL3FjrG9Mb86lypufI1u1tuq3sYF/721Sh2o0ZXqQcKTtBtuDTth6b9ZeQI/hiXeROLCs5MzweN88P+YcPeZRcwbetf0oF2I1px74HvJ+27ufsf/HofTWrM5Lmwuhs3yQ9zbo/JdPL2e2LdVl2mVyyAf3Ajekqycy10OVMbyvFuiwj0LzRDdg6aAft2u/uA6HJDVZPXytyBw91d20qYVulrAC8e/+md+Dt70MX9Fw3fmYiwKebLVcXZ213HwvcrCznE97snmPwjbjd7bH1O3wauKm7+pTAJ524kJgOg0YdNLzQjxmnWOR7noiIiIiIyIv0Dx7VtFd/LQhtAAAAAElFTkSuQmCC") 16 16, move`

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export default function CorkBoard({ stamps, placed, goals: _goals, budgets: _budgets, onPlacedChange, registerDragHandler, registerBeforeMutate, registerSnapToToday, onVisibleWeekChange, onCompletionsChange }: Props) {
  // LIVE MODE v1 scroll bounds:
  //   left  = start of current week (Sunday)
  //   right = today + 7 days
  // Always render Sun..(today+7) so the past portion of this week + 7 future days are visible.
  const todayISO    = getTodayISO()
  const currentWeek = getWeekISO()
  // Range: 7 days before today → today + 28 days (4 weeks forward).
  // Always at least a week of past visible so you can scroll back to edit.
  const weekDates = (() => {
    const now   = new Date()
    const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0,0,0,0)
    const end   = new Date(now); end.setDate(now.getDate() + 28); end.setHours(0,0,0,0)
    const out: { day: DayKey; date: Date; dateNum: number }[] = []
    const DAY_OF_WEEK: DayKey[] = ["sun","mon","tue","wed","thu","fri","sat"]
    const cur = new Date(start)
    while (cur.getTime() <= end.getTime()) {
      out.push({ day: DAY_OF_WEEK[cur.getDay()], date: new Date(cur), dateNum: cur.getDate() })
      cur.setDate(cur.getDate() + 1)
    }
    return out
  })()

  const [dragOverState,   setDragOverState]   = useState<{ day: DayKey; zone: PlacedZone; colDate: string; slot: number | null } | null>(null)
  const [removedToast,    setRemovedToast]    = useState(false)
  const [monthLabel,      setMonthLabel]      = useState("")
  const [unlockedDates,   setUnlockedDates]   = useState<Set<string>>(new Set())
  const [completions,     setCompletions]     = useState<Completion[]>(() => plannerStore.loadCompletions())
  const [canUndo,         setCanUndo]         = useState(false)

  // Undo history — stack of placed snapshots (max 20)
  const historyRef = useRef<PlacedStamp[][]>([])

  function pushHistory() {
    const stack = historyRef.current
    stack.push([...placedRef.current])
    if (stack.length > 20) stack.shift()
    setCanUndo(true)
  }

  function commitPlaced(next: PlacedStamp[]) {
    plannerStore.savePlaced(next)
    onPlacedChangeRef.current(next)
  }

  function handleUndo() {
    const stack = historyRef.current
    if (stack.length === 0) return
    const prev = stack.pop()!
    setCanUndo(stack.length > 0)
    commitPlaced(prev)
  }

  const completionsRef = useRef(completions)
  completionsRef.current = completions

  function handleToggleDone(placedId: string, stampId: string, date: string, isDone: boolean, miles?: number) {
    const all = completionsRef.current
    if (isDone) {
      // remove
      const next = all.filter(c => !(c.slot_id === placedId && c.date === date))
      plannerStore.saveCompletions(next)
      setCompletions(next)
      onCompletionsChange?.(next)
    } else {
      // add + implicitly pin the stamp so clearUnpinned won't erase it
      const runMiles = stampId === "run"
        ? (miles ?? placedRef.current.find(p => p.id === placedId)?.target_value ?? 1)
        : 1
      const c: Completion = { slot_id: placedId, stamp_id: stampId, date, value: runMiles }
      const next = [...all.filter(c2 => !(c2.slot_id === placedId && c2.date === date)), c]
      plannerStore.saveCompletions(next)
      setCompletions(next)
      onCompletionsChange?.(next)
      // pin the placed stamp if not already pinned
      const currentPlaced = placedRef.current
      const target = currentPlaced.find(p => p.id === placedId)
      if (target && !target.is_pinned) {
        pushHistory()
        const nextPlaced = currentPlaced.map(p => p.id === placedId ? { ...p, is_pinned: true } : p)
        commitPlaced(nextPlaced)
      }
    }
  }

  const unlockedRef = useRef(unlockedDates)
  unlockedRef.current = unlockedDates

  function toggleUnlock(iso: string) {
    setUnlockedDates(prev => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef   = useRef<HTMLDivElement>(null)

  // Refs to mutable state for closures
  const placedRef = useRef(placed)
  placedRef.current = placed
  const stampsRef = useRef(stamps)
  stampsRef.current = stamps
  const onPlacedChangeRef = useRef(onPlacedChange)
  onPlacedChangeRef.current = onPlacedChange

  const lastVisibleWeekRef = useRef<string | null>(null)

  // Compute month label and majority-visible week from visible columns
  function updateMonthLabel() {
    const scroll = scrollRef.current
    const grid   = gridRef.current
    if (!scroll || !grid) return
    const cols = grid.querySelectorAll<HTMLElement>("[data-col-date]")
    const scrollL = scroll.scrollLeft
    const viewW   = scroll.clientWidth
    const months = new Set<number>()
    const weekPx: Record<string, number> = {}
    cols.forEach(col => {
      const l = col.offsetLeft
      const r = l + col.offsetWidth
      if (r > scrollL && l < scrollL + viewW) {
        const m = parseInt(col.dataset.colDate!.split("-")[1], 10) - 1
        months.add(m)
        // Accumulate visible px per week
        const colWeek = col.closest<HTMLElement>("[data-col-week]")?.dataset.colWeek
        if (colWeek) {
          const visiblePx = Math.min(r, scrollL + viewW) - Math.max(l, scrollL)
          weekPx[colWeek] = (weekPx[colWeek] ?? 0) + visiblePx
        }
      }
    })
    const sorted = Array.from(months).sort((a, b) => a - b)
    setMonthLabel(sorted.map(m => MONTH_NAMES[m]).join(" / "))
    // Fire week change if majority week shifted
    if (onVisibleWeekChange) {
      const majorityWeek = Object.entries(weekPx).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (majorityWeek && majorityWeek !== lastVisibleWeekRef.current) {
        lastVisibleWeekRef.current = majorityWeek
        onVisibleWeekChange(majorityWeek)
      }
    }
  }

  useEffect(() => { updateMonthLabel() }, [])

  useEffect(() => {
    registerDragHandler(handlePointerDragStart)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerDragHandler])

  useEffect(() => {
    registerBeforeMutate?.(pushHistory)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBeforeMutate])

  useEffect(() => {
    registerSnapToToday?.(() => snapToToday(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSnapToToday])

  function showRemovedToast() {
    setRemovedToast(true)
    setTimeout(() => setRemovedToast(false), 1200)
  }

  function handlePointerDragStart(startEvent: React.MouseEvent, payload: DropPayload) {
    const GW = MW + 10
    const GH = MH + 10
    const imgUrl = payload.type === "place"
      ? stampsRef.current.find(s => s.id === payload.stamp_id)?.illustration_url ?? ""
      : (() => {
          const src = placedRef.current.find(p => p.id === payload.placed_id)
          return stampsRef.current.find(s => s.id === src?.stamp_id)?.illustration_url ?? ""
        })()

    const overlay = document.createElement("div")
    overlay.style.cssText = `position:fixed;inset:0;z-index:99998;cursor:${GRAB_CURSOR};`
    document.body.appendChild(overlay)

    const ghost = document.createElement("div")
    ghost.style.cssText = `
      position:fixed;z-index:99999;
      width:${GW}px;height:${GH}px;
      padding:5px;background:#F5ECD7;border-radius:3px;
      box-shadow:1px 4px 12px rgba(0,0,0,0.35);
      opacity:0.92;transform:rotate(-2deg);pointer-events:none;overflow:hidden;
    `
    const inner = document.createElement("div")
    inner.style.cssText = `width:100%;height:100%;border:1.5px dashed rgba(44,26,14,0.35);background:#e8dcc8;overflow:hidden;`
    if (imgUrl) {
      const img = document.createElement("img")
      img.src = imgUrl
      img.style.cssText = `width:100%;height:100%;object-fit:cover;display:block;`
      inner.appendChild(img)
    }
    ghost.appendChild(inner)
    document.body.appendChild(ghost)

    // Track whether we're hovering the grid
    let overGrid = false
    let curX = startEvent.clientX
    let rafId = 0
    const SCROLL_ZONE = 100  // px from edge that triggers auto-scroll
    const SCROLL_MAX  = 20   // max px/frame scroll speed
    // Snapshot scroll container rect once — it won't move during drag
    const scrollEl   = scrollRef.current!
    const scrollRect = scrollEl.getBoundingClientRect()

    function autoScroll() {
      const distLeft  = curX - scrollRect.left
      const distRight = scrollRect.right - curX
      let delta = 0
      // Only auto-scroll rightward — leftward goes into greyed past, which is non-droppable
      if (distRight < SCROLL_ZONE) delta = SCROLL_MAX * Math.max(0, 1 - distRight / SCROLL_ZONE)
      // Suppress unused-var warning
      void distLeft
      if (delta !== 0) {
        scrollEl.scrollLeft += delta
        updateMonthLabel()
        evaluateDrop(curX, lastY)
      }
      rafId = requestAnimationFrame(autoScroll)
    }

    let lastY = startEvent.clientY

    function evaluateDrop(x: number, y: number) {
      const els = document.elementsFromPoint(x, y)
      let found = false
      overGrid = false
      for (const el of els) {
        if (el instanceof HTMLElement) {
          if (el.dataset.dropDay && el.dataset.dropZone) {
            const col = el.closest<HTMLElement>("[data-col-date]")
            const colDate = col?.dataset.colDate ?? ""
            const slot = el.dataset.dropSlot != null ? parseInt(el.dataset.dropSlot, 10) : null
            setDragOverState({ day: el.dataset.dropDay as DayKey, zone: el.dataset.dropZone as PlacedZone, colDate, slot })
            found = true
            overGrid = true
            break
          }
          if (el.dataset.gridRoot) overGrid = true
        }
      }
      if (!found) setDragOverState(null)
      ghost.style.opacity   = overGrid ? "0.92" : "0.45"
      ghost.style.transform = overGrid ? "rotate(-2deg)" : "rotate(-2deg) scale(0.88)"
    }

    function position(x: number, y: number) {
      ghost.style.left = `${x - GW / 2}px`
      ghost.style.top  = `${y - GH / 2}px`
      curX = x; lastY = y
      evaluateDrop(x, y)
    }

    position(startEvent.clientX, startEvent.clientY)
    rafId = requestAnimationFrame(autoScroll)

    function onMove(e: MouseEvent) { position(e.clientX, e.clientY) }
    function onUp(e: MouseEvent) {
      cancelAnimationFrame(rafId)
      overlay.removeEventListener("mousemove", onMove)
      overlay.removeEventListener("mouseup", onUp)
      overlay.remove()
      ghost.remove()
      setDragOverState(null)

      const current = placedRef.current
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      let targetDay: DayKey | null = null
      let targetZone: PlacedZone | "repeat-header" | null = null
      let targetWeek: string | null = null
      let targetDate: string = ""
      let targetSlot: number | undefined = undefined
      for (const el of els) {
        if (el instanceof HTMLElement && el.dataset.dropDay && el.dataset.dropZone) {
          targetDay  = el.dataset.dropDay as DayKey
          targetZone = el.dataset.dropZone as PlacedZone | "repeat-header"
          const colW = el.closest<HTMLElement>("[data-col-week]")
          const colD = el.closest<HTMLElement>("[data-col-date]")
          targetWeek = colW?.dataset.colWeek ?? null
          targetDate = colD?.dataset.colDate ?? ""
          if (el.dataset.dropSlot != null) targetSlot = parseInt(el.dataset.dropSlot, 10)
          break
        }
      }

      const isUnlocked = (iso: string) => unlockedRef.current.has(iso)

      // Block drop if the target slot is already occupied
      if (targetDay && targetZone && targetZone !== "repeat-header" && targetZone !== "repeat" && targetSlot != null) {
        const colWeek = (() => {
          const els2 = document.elementsFromPoint(e.clientX, e.clientY)
          for (const el of els2) {
            if (el instanceof HTMLElement) {
              const cw = el.closest<HTMLElement>("[data-col-week]")
              if (cw?.dataset.colWeek) return cw.dataset.colWeek
            }
          }
          return null
        })()
        const occupant = current.find(p =>
          p.slot_index === targetSlot &&
          p.zone === targetZone &&
          p.day === targetDay &&
          (p.week === colWeek || (p.is_recurring && colWeek))
        )
        const movingId = payload.type === "move" ? payload.placed_id : null
        if (occupant && occupant.id !== movingId) return
      }

      // Dropped off-grid — remove if it was a move
      if (!targetDay || !targetZone) {
        if (payload.type === "move") {
          const src = current.find(p => p.id === payload.placed_id)
          if (src) {
            const force = isUnlocked(payload.from_date)
            if (canWriteWeek(src.week) || force) {
              pushHistory()
              onPlacedChange(removePlaced(current, payload.placed_id, force))
              showRemovedToast()
            }
          }
        }
        return
      }

      // Normalize "repeat-header" → "repeat"
      const dropZone: PlacedZone = targetZone === "repeat-header" ? "repeat" : (targetZone as PlacedZone)

      // ── VAULT → board ──────────────────────────────────────────────────────
      if (payload.type === "place") {
        const stampId = payload.stamp_id

        if (dropZone === "repeat") {
          // All stamps (including stickies) stage as recurring in the repeat strip
          const next: PlacedStamp = {
            id: payload.sticky_id ?? newSlotId(),
            stamp_id: stampId,
            day: targetDay,
            zone: "repeat",
            is_recurring: true,
            week: null,
          }
          if (stampId === "sticky") {
            next.sticky_text   = payload.sticky_text
            next.sticky_color  = payload.sticky_color
            next.sticky_shape  = payload.sticky_shape
            next.sticky_format = payload.sticky_format
            next.is_private    = true
          }
          if (stampId === "run") {
            next.target_value = suggestNextRunMiles(current, currentWeek)
            next.target_unit  = "mi"
          }
          pushHistory()
          onPlacedChange(addPlaced(current, next))
          return
        }

        // Body zone: one-time on that column's week
        if (!targetWeek || (!canWriteWeek(targetWeek) && !isUnlocked(targetDate))) return
        const next: PlacedStamp = {
          id: payload.sticky_id ?? newSlotId(),
          stamp_id: stampId,
          day: targetDay,
          zone: dropZone,
          is_recurring: false,
          week: targetWeek,
          slot_index: targetSlot,
        }
        if (stampId === "sticky") {
          next.sticky_text   = payload.sticky_text
          next.sticky_color  = payload.sticky_color
          next.sticky_shape  = payload.sticky_shape
          next.sticky_format = payload.sticky_format
          next.is_private    = true  // stickies are always private
        }
        if (stampId === "run") {
          next.target_value = suggestNextRunMiles(current, targetWeek)
          next.target_unit  = "mi"
        }
        pushHistory()
        onPlacedChange(addPlaced(current, next, isUnlocked(targetDate)))
        return
      }

      // ── MOVE within board ──────────────────────────────────────────────────
      const src = current.find(p => p.id === payload.placed_id)
      if (!src) return
      const srcUnlocked = isUnlocked(payload.from_date)
      if (!canWriteWeek(src.week) && !srcUnlocked) return

      // Drop onto repeat strip → stage as recurring
      if (dropZone === "repeat") {
        const moved: PlacedStamp = { ...src, day: targetDay, zone: "repeat", is_recurring: true, week: null, slot_index: undefined }
        pushHistory()
        onPlacedChange([...current.filter(p => p.id !== src.id), moved])
        return
      }

      if (!targetWeek || (!canWriteWeek(targetWeek) && !isUnlocked(targetDate))) return

      if (src.zone === "repeat") {
        // Repeat → body or header: fan out one-time copies across 4 weeks on the target day/zone
        const now = new Date()
        const DAY_OF_WEEK: DayKey[] = ["sun","mon","tue","wed","thu","fri","sat"]
        const targetDayIdx = DAY_OF_WEEK.indexOf(targetDay)
        const todayIdx = now.getDay()
        const daysUntil = (targetDayIdx - todayIdx + 7) % 7
        const first = new Date(now); first.setHours(0,0,0,0); first.setDate(now.getDate() + daysUntil)
        const copies: PlacedStamp[] = []
        for (let i = 0; i < 4; i++) {
          const d = new Date(first); d.setDate(first.getDate() + i * 7)
          const w = getWeekISO(d)
          if (!canWriteWeek(w)) continue
          copies.push({
            ...src,
            id: newSlotId(),
            day: targetDay,
            zone: dropZone,
            week: w,
            is_recurring: false,
            slot_index: targetSlot,
          })
        }
        pushHistory()
        onPlacedChange([...current.filter(p => p.id !== src.id), ...copies])
      } else {
        // Body → body: simple move of this one instance
        const moved: PlacedStamp = { ...src, day: targetDay, zone: dropZone, week: targetWeek, is_recurring: false, slot_index: targetSlot }
        pushHistory()
        onPlacedChange([...current.filter(p => p.id !== src.id), moved])
      }
    }
    overlay.addEventListener("mousemove", onMove)
    overlay.addEventListener("mouseup", onUp)
  }

  function handleRemove(placedId: string, force = false) {
    pushHistory()
    commitPlaced(removePlaced(placedRef.current, placedId, force))
  }

  function handleTogglePrivate(placedId: string) {
    pushHistory()
    commitPlaced(togglePlacedPrivate(placedRef.current, placedId))
  }

  function handleTogglePin(placedId: string) {
    pushHistory()
    const next = placedRef.current.map(p => p.id === placedId ? { ...p, is_pinned: !p.is_pinned } : p)
    commitPlaced(next)
  }

  function handleToggleSide(placedId: string) {
    pushHistory()
    const all = placedRef.current
    const src = all.find(p => p.id === placedId)
    if (!src) return
    const curSlot = src.slot_index ?? 0
    const adjSlot = curSlot % 2 === 0 ? curSlot + 1 : curSlot - 1
    // Swap src with whatever is in the adjacent cell (same zone/day/week)
    const occupant = all.find(p =>
      p.id !== placedId &&
      p.slot_index === adjSlot &&
      p.zone === src.zone &&
      p.day === src.day &&
      (p.week === src.week || (src.is_recurring && p.is_recurring))
    )
    const next = all.map(p => {
      if (p.id === placedId) return { ...p, slot_index: adjSlot }
      if (occupant && p.id === occupant.id) return { ...p, slot_index: curSlot }
      return p
    })
    commitPlaced(next)
  }

  // Listen for sticky edits and resizes from MiniStickyNote
  useEffect(() => {
    function onStickyEdit(e: Event) {
      const { id, text } = (e as CustomEvent<{ id: string; text: string }>).detail
      pushHistory()
      const next = placedRef.current.map(p => p.id === id ? { ...p, sticky_text: text } : p)
      commitPlaced(next)
    }
    function onStickyResize(e: Event) {
      const { id, px } = (e as CustomEvent<{ id: string; px: number }>).detail
      pushHistory()
      const next = placedRef.current.map(p => p.id === id ? { ...p, sticky_px: px } : p)
      commitPlaced(next)
    }
    function onStampResize(e: Event) {
      const { id, px } = (e as CustomEvent<{ id: string; px: number }>).detail
      pushHistory()
      const next = placedRef.current.map(p => p.id === id ? { ...p, stamp_px: px } : p)
      commitPlaced(next)
    }
    function onStampOffsetX(e: Event) {
      const { id, offsetX } = (e as CustomEvent<{ id: string; offsetX: number }>).detail
      const next = placedRef.current.map(p => p.id === id ? { ...p, stamp_offset_x: offsetX } : p)
      commitPlaced(next)
    }
    function onStampOffsetY(e: Event) {
      const { id, offsetY } = (e as CustomEvent<{ id: string; offsetY: number }>).detail
      const next = placedRef.current.map(p => p.id === id ? { ...p, stamp_offset_y: offsetY } : p)
      commitPlaced(next)
    }
    const targetHistoryIds = new Set<string>()
    function onStampTarget(e: Event) {
      const { id, value } = (e as CustomEvent<{ id: string; value: number }>).detail
      if (!targetHistoryIds.has(id)) { pushHistory(); targetHistoryIds.add(id) }
      const next = placedRef.current.map(p => p.id === id ? { ...p, target_value: value } : p)
      commitPlaced(next)
    }
    document.addEventListener("sticky-edit-save", onStickyEdit)
    document.addEventListener("sticky-resize-save", onStickyResize)
    document.addEventListener("stamp-resize-save", onStampResize)
    document.addEventListener("stamp-offsetx-save", onStampOffsetX)
    document.addEventListener("stamp-offsety-save", onStampOffsetY)
    document.addEventListener("stamp-target-save", onStampTarget)
    return () => {
      document.removeEventListener("sticky-edit-save", onStickyEdit)
      document.removeEventListener("sticky-resize-save", onStickyResize)
      document.removeEventListener("stamp-resize-save", onStampResize)
      document.removeEventListener("stamp-offsetx-save", onStampOffsetX)
      document.removeEventListener("stamp-offsety-save", onStampOffsetY)
      document.removeEventListener("stamp-target-save", onStampTarget)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const MIN_COLS = 2
  const MAX_COLS = 7
  const [colsInView, setColsInView] = useState(MAX_COLS)
  const colsInViewRef = useRef(MAX_COLS)
  colsInViewRef.current = colsInView
  const [containerW, setContainerW] = useState(0)
  const didSnapRef    = useRef(false)
  const snapPendingRef = useRef(false)
  const snapStableTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const todayIdx = weekDates.findIndex(d => {
    const iso = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`
    return iso === todayISO
  })

  // Measure scroll container width via ResizeObserver
  // While snapPendingRef is set, re-snap on every width change so today tracks 1:1 with panel animation
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setContainerW(w)
      if (w <= 0) return
      // Initial snap
      if (!didSnapRef.current) {
        didSnapRef.current = true
        const colW = Math.floor(w / MAX_COLS)
        if (todayIdx >= 0) el.scrollLeft = todayIdx * colW
        updateMonthLabel()
        return
      }
      // Live-track snap during panel transition
      if (snapPendingRef.current) {
        const colW = Math.floor(w / colsInViewRef.current)
        if (todayIdx >= 0) el.scrollLeft = todayIdx * colW
        updateMonthLabel()
        // Clear pending once width has been stable for 80ms
        if (snapStableTimer.current) clearTimeout(snapStableTimer.current)
        snapStableTimer.current = setTimeout(() => { snapPendingRef.current = false }, 80)
      }
    })
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const COL_W = containerW > 0 ? Math.floor(containerW / colsInView) : 140

  // Snap view so today's column is the leftmost visible. Used on spacebar.
  // Sets snapPendingRef so the ResizeObserver tracks width changes live during panel transitions.
  function snapToToday(smooth: boolean = false) {
    const scroll = scrollRef.current
    if (!scroll || todayIdx < 0) return
    const liveColW = Math.floor(scroll.clientWidth / colsInViewRef.current)
    const targetLeft = todayIdx * liveColW
    if (smooth) scroll.scrollTo({ left: targetLeft, behavior: "smooth" })
    else        scroll.scrollLeft = targetLeft
    updateMonthLabel()
    // Arm live-tracking so ResizeObserver re-snaps on every width tick during panel close
    snapPendingRef.current = true
  }

  // Spacebar → snap back to today; Ctrl+Z → undo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      if (e.code === "Space" && !typing) {
        e.preventDefault()
        snapToToday(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !typing) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pan-by-drag on empty board space
  function onScrollAreaMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Only plain left-click on the scroll container itself (not stamps/buttons)
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // If the click landed on a stamp, zone slot, or interactive child, let it bubble
    if (target.closest("[data-drop-day]") || target.tagName === "BUTTON" || target.tagName === "SELECT") return
    e.preventDefault()
    const scroll = scrollRef.current
    if (!scroll) return
    const startX   = e.clientX
    const startScroll = scroll.scrollLeft
    let moved = false

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      if (!moved && Math.abs(dx) < 3) return
      moved = true
      scroll!.scrollLeft = startScroll - dx
      updateMonthLabel()
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      if (moved) scroll!.style.cursor = "grab"
    }
    scroll.style.cursor = "grabbing"
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative" }}>

      {/* Month indicator + zoom controls */}
      <div style={{
        height: 28, flexShrink: 0,
        display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(44,26,14,0.08)",
        padding: "0 8px",
      }}>
        <span style={{
          flex: 1, textAlign: "center",
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 14,
          color: "#C0392B",
          opacity: 0.75,
          letterSpacing: "0.02em",
          pointerEvents: "none",
        }}>
          {monthLabel}
        </span>
        {/* Undo + Zoom buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="undo (⌘Z)"
            style={{
              fontFamily: "var(--font-type)", fontSize: 12, lineHeight: 1,
              width: 20, height: 20,
              background: "none", border: "1px solid rgba(44,26,14,0.15)",
              borderRadius: 3, cursor: !canUndo ? "default" : "pointer",
              color: INK, opacity: !canUndo ? 0.15 : 0.5,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
              transition: "opacity 150ms",
            }}
            onMouseEnter={e => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
            onMouseLeave={e => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.opacity = "0.5" }}
          >↩</button>

          <div style={{ width: 1, height: 14, background: "rgba(44,26,14,0.1)", flexShrink: 0 }} />

          {/* Zoom */}
          {[
            { label: "−", title: "zoom out (more days)", disabled: colsInView >= MAX_COLS, action: () => setColsInView(v => Math.min(MAX_COLS, v + 1)) },
            { label: "+", title: "zoom in (fewer days)", disabled: colsInView <= MIN_COLS, action: () => setColsInView(v => Math.max(MIN_COLS, v - 1)) },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              disabled={btn.disabled}
              title={btn.title}
              style={{
                fontFamily: "var(--font-type)", fontSize: 13, lineHeight: 1,
                width: 20, height: 20,
                background: "none", border: "1px solid rgba(44,26,14,0.15)",
                borderRadius: 3, cursor: btn.disabled ? "default" : "pointer",
                color: INK, opacity: btn.disabled ? 0.2 : 0.5,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0,
              }}
              onMouseEnter={e => { if (!btn.disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85" }}
              onMouseLeave={e => { if (!btn.disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.5" }}
            >{btn.label}</button>
          ))}
        </div>
      </div>

      {/* Scrollable grid */}
      <div
        ref={scrollRef}
        data-grid-root="1"
        onScroll={updateMonthLabel}
        onMouseDown={onScrollAreaMouseDown}
        style={{
          flex: 1,
          display: "flex",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(44,26,14,0.2) transparent",
          cursor: "grab",
        }}
      >
        <div ref={gridRef} data-grid-root="1" style={{ display: "flex", width: COL_W * weekDates.length, flexShrink: 0 }}>
          {weekDates.map(({ day, dateNum, date }) => {
            const iso     = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
            const colWeek = getWeekISO(date)
            const isPast  = iso < todayISO
            const onDay   = placedFor(placed, colWeek, day)
            return (
              <div key={iso} data-col-week={colWeek} style={{ width: COL_W, flexShrink: 0, display: "flex" }}>
                <DayColumn
                  dayKey={day}
                  dateNum={dateNum}
                  colDate={iso}
                  colW={COL_W}
                  isToday={iso === todayISO}
                  isPast={isPast}
                  unlocked={unlockedDates.has(iso)}
                  onUnlockToggle={() => toggleUnlock(iso)}
                  placedOnDay={onDay}
                  stamps={stamps}
                  completions={completions}
                  onRemove={handleRemove}
                  onTogglePrivate={handleTogglePrivate}
                  onTogglePin={handleTogglePin}
                  onToggleSide={handleToggleSide}
                  onToggleDone={handleToggleDone}
                  onPointerDragStart={handlePointerDragStart}
                  dragOver={dragOverState?.colDate === iso ? dragOverState.zone : null}
                  dragOverSlot={dragOverState?.colDate === iso ? dragOverState.slot : null}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* "removed" toast */}
      <div style={{
        position: "absolute",
        bottom: 16, left: "50%", transform: "translateX(-50%)",
        fontFamily: "var(--font-hand)",
        fontSize: 13,
        color: "#2C1A0E",
        background: "#F5ECD7",
        border: "0.5px solid rgba(44,26,14,0.15)",
        borderRadius: 4,
        padding: "4px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        opacity: removedToast ? 0.9 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}>
        removed
      </div>
    </div>
  )
}
