"use client"

import { useState, useRef, useEffect, useId } from "react"
import type { StampTemplate } from "@/lib/planner"
import { plannerStore, newSlotId, type DrawerFavorite } from "@/lib/planner"
import type { DropPayload } from "./CorkBoard"

type Props = {
  stamps: StampTemplate[]
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  onRegisterAddFavorite?: (fn: (stampId: string) => void) => void
  width: number
}

const INK   = "#2C1A0E"
const PARCH = "#F5ECD7"
const TERRA = "#C0392B"
const SAGE  = "#7A8C6E"

const INSET = 7
const R = 3
const STEP = 11

const STICKY_COLORS = [
  "#FDF3C0", // yellow
  "#F5C2C2", // pink
  "#C8DBC4", // sage
  "#C2D8F5", // sky
  "#DDD0F0", // lavender
  "#F5ECD7", // warm white
]

function holePositions(total: number): number[] {
  const n = Math.round(total / STEP)
  if (n < 1) return []
  const step = total / n
  return Array.from({ length: n }, (_, i) => step * (i + 0.5))
}
function circleArc(cx: number, cy: number): string {
  return `M${cx - R},${cy} A${R},${R},0,1,0,${cx + R},${cy} A${R},${R},0,1,0,${cx - R},${cy}Z`
}

function playFlipSnap() {
  try {
    const ctx = new AudioContext()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
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

// ─── DrawerCard — drags to board only ────────────────────────────────────────

function DrawerCard({ stamp, cardSize, editing, onPointerDragStart, onMoveUp, onMoveDown, onRemove, canMoveUp, canMoveDown }: {
  stamp: StampTemplate
  cardSize: number
  editing: boolean
  onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const rawId  = useId()
  const clipId = `dc${rawId.replace(/:/g, "")}`
  const [flipped, setFlipped] = useState(false)
  const dragMoved = useRef(false)

  const W      = cardSize
  const H      = cardSize
  const IMG_H  = Math.round(cardSize * 0.77)
  const nameFs = Math.max(7, Math.round(W * 0.07))

  const hPos = holePositions(W)
  const vPos = holePositions(H)
  const clipD = [
    `M0,0 H${W} V${H} H0 Z`,
    ...hPos.map(x => circleArc(x, 0)),
    ...hPos.map(x => circleArc(x, H)),
    ...vPos.map(y => circleArc(0, y)),
    ...vPos.map(y => circleArc(W, y)),
  ].join(" ")

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    background: "none", border: "none", cursor: disabled ? "default" : "pointer",
    padding: "2px 5px", fontSize: 13, lineHeight: 1,
    color: INK, opacity: disabled ? 0.15 : 0.55,
    fontFamily: "var(--font-type)",
  })

  return (
    <div style={{ position: "relative", width: W, flexShrink: 0 }}>

      {/* Edit-mode controls — row above card */}
      {editing && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 2 }}>
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMoveUp() }} disabled={!canMoveUp} style={btnStyle(!canMoveUp)}>↑</button>
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMoveDown() }} disabled={!canMoveDown} style={btnStyle(!canMoveDown)}>↓</button>
          </div>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove() }}
            style={{ background: TERRA, border: "none", borderRadius: "50%", width: 16, height: 16, color: "white", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>
        </div>
      )}

      <svg aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipD} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      <div
        style={{ width: W, height: H, perspective: W * 5, filter: "drop-shadow(1px 3px 5px rgba(0,0,0,0.2))" }}
        onMouseEnter={e => (e.currentTarget.style.filter = "drop-shadow(1px 5px 8px rgba(0,0,0,0.28))")}
        onMouseLeave={e => (e.currentTarget.style.filter = "drop-shadow(1px 3px 5px rgba(0,0,0,0.2))")}
      >
        <div
          style={{
            width: W, height: H, position: "relative",
            transformStyle: "preserve-3d",
            transition: "transform 380ms cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            cursor: editing ? "default" : flipped ? "default" : "grab",
            userSelect: "none",
          }}
          onMouseDown={e => {
            if (e.button !== 0 || editing) return
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
            if (dragMoved.current || editing) return
            playFlipSnap()
            setFlipped(f => !f)
          }}
        >
          {/* FRONT */}
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", clipPath: `url(#${clipId})`, background: PARCH, display: "flex", flexDirection: "column" }}>
            <div style={{ height: IMG_H, flexShrink: 0, margin: `${INSET}px ${INSET}px 0`, overflow: "hidden", background: "#e8dcc8" }}>
              {stamp.illustration_url
                ? <img src={stamp.illustration_url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-type)", fontSize: 8, color: INK, opacity: 0.35 }}>{stamp.name}</div>
              }
            </div>
            <div style={{ flex: 1, margin: `0 ${INSET}px ${INSET}px`, background: "#f0ead8", display: "flex", alignItems: "center", justifyContent: "center", padding: "3px 6px" }}>
              <div style={{ fontFamily: "var(--font-stamp)", fontSize: nameFs, letterSpacing: "2px", textTransform: "uppercase", color: INK, opacity: 0.75, lineHeight: 1 }}>{stamp.name}</div>
            </div>
            <div style={{ position: "absolute", top: INSET, left: INSET, right: INSET, bottom: INSET, border: `0.8px solid ${INK}`, pointerEvents: "none", opacity: 0.2 }} />
          </div>

          {/* BACK */}
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", clipPath: `url(#${clipId})`, background: "#EDE4CE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `${INSET + 2}px ${INSET}px ${INSET}px`, gap: 6 }}>
            <div style={{ fontFamily: "var(--font-stamp)", fontSize: nameFs, letterSpacing: "2px", textTransform: "uppercase", color: INK, opacity: 0.6, textAlign: "center" }}>{stamp.name}</div>
            <div style={{ fontFamily: "var(--font-hand)", fontSize: Math.max(9, nameFs - 1), color: INK, opacity: 0.4, textAlign: "center", lineHeight: 1.4 }}>{stamp.unit_type} · {stamp.unit_label || stamp.category}</div>
            <div style={{ position: "absolute", top: INSET, left: INSET, right: INSET, bottom: INSET, border: `0.8px solid ${INK}`, pointerEvents: "none", opacity: 0.15 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── StickyComposer ───────────────────────────────────────────────────────────

const PREVIEW_SZ = 120   // drawer preview size — bigger than board default so text is comfortable to write

function stickyPreviewFontSize(text: string, boxPx: number): number {
  const chars = text.length || 1
  const charsPerLine = Math.max(1, Math.round(boxPx / 8))
  const lines = Math.ceil(chars / charsPerLine)
  const fs = Math.floor((boxPx * 0.72) / (lines * 1.4))
  return Math.max(11, Math.min(28, fs))
}

function StickyComposer({ onPointerDragStart }: { onPointerDragStart: (e: React.MouseEvent, payload: DropPayload) => void }) {
  const [text,  setText]  = useState("")
  const [color, setColor] = useState(STICKY_COLORS[0])
  const isList = text.includes("[]")
  const PAD    = Math.round(PREVIEW_SZ * 0.1)
  const innerSz = PREVIEW_SZ - PAD * 2
  const fontSize = stickyPreviewFontSize(text, innerSz)

  function startDrag(e: React.MouseEvent) {
    if (!text.trim()) return
    const startX = e.clientX, startY = e.clientY
    const onMove = (mv: MouseEvent) => {
      if (Math.abs(mv.clientX - startX) > 4 || Math.abs(mv.clientY - startY) > 4) {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        onPointerDragStart(e, {
          type: "place",
          stamp_id: "sticky",
          sticky_text: text.trim(),
          sticky_color: color,
          sticky_id: "sticky-" + newSlotId(),
        })
      }
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid rgba(44,26,14,0.1)" }}>
      <div style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "2px", textTransform: "uppercase", color: INK, opacity: 0.35, marginBottom: 10 }}>sticky note</div>

      {/* Color swatches */}
      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        {STICKY_COLORS.map(c => (
          <div
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 16, height: 16, borderRadius: "50%",
              background: c, cursor: "pointer", flexShrink: 0,
              border: color === c ? `2px solid ${INK}` : "1.5px solid rgba(44,26,14,0.2)",
              boxShadow: color === c ? "0 0 0 1.5px rgba(44,26,14,0.3)" : "none",
              transition: "box-shadow 100ms",
            }}
          />
        ))}
      </div>

      {/* Live-preview sticky — IS the writing surface, drag to place */}
      <div
        onMouseDown={startDrag}
        style={{
          position: "relative",
          width: PREVIEW_SZ, height: PREVIEW_SZ,
          background: color,
          borderRadius: 3,
          boxShadow: "2px 3px 10px rgba(0,0,0,0.15), inset 0 -2px 0 rgba(0,0,0,0.07)",
          cursor: text.trim() ? "grab" : "default",
          flexShrink: 0,
        }}
      >
        {/* Textarea (writing surface) */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          placeholder={"write a note…\n[] for checklist"}
          style={{
            position: "absolute",
            top: PAD, left: PAD, right: PAD, bottom: PAD,
            width: `calc(100% - ${PAD * 2}px)`,
            background: "transparent", border: "none", outline: "none", resize: "none",
            fontFamily: "var(--font-hand)",
            fontSize,
            color: INK, lineHeight: 1.4, opacity: 0.9,
            textAlign: isList ? "left" : "center",
            overflow: "hidden",
          }}
        />

        {/* List badge */}
        {isList && (
          <div style={{ position: "absolute", bottom: 4, left: PAD, fontFamily: "var(--font-type)", fontSize: 6, color: INK, opacity: 0.3, letterSpacing: "1px" }}>□ list</div>
        )}
        {text.trim() && (
          <div style={{ position: "absolute", bottom: 4, right: 5, fontFamily: "var(--font-type)", fontSize: 6, color: INK, opacity: 0.3, letterSpacing: "1px" }}>drag →</div>
        )}
      </div>

      {text.trim() && (
        <button onClick={() => setText("")} style={{ marginTop: 6, fontSize: 7, fontFamily: "var(--font-type)", color: INK, opacity: 0.3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>clear</button>
      )}
    </div>
  )
}

// ─── QuickDrawer ──────────────────────────────────────────────────────────────

export default function QuickDrawer({ stamps, onPointerDragStart, onRegisterAddFavorite, width }: Props) {
  const [favorites, setFavorites] = useState<DrawerFavorite[]>(() => plannerStore.loadDrawer())
  const [editing, setEditing]     = useState(false)

  const cardSize = Math.max(80, width - 24)

  function saveFavs(next: DrawerFavorite[]) {
    setFavorites(next)
    plannerStore.saveDrawer(next)
  }

  function addFavorite(stampId: string) {
    setFavorites(prev => {
      if (prev.some(f => f.stamp_id === stampId)) return prev
      const next = [...prev, { stamp_id: stampId }]
      plannerStore.saveDrawer(next)
      return next
    })
  }

  function removeFavorite(stampId: string) {
    saveFavs(favorites.filter(f => f.stamp_id !== stampId))
  }

  function moveUp(i: number) {
    if (i === 0) return
    const next = [...favorites]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    saveFavs(next)
  }

  function moveDown(i: number) {
    if (i >= favorites.length - 1) return
    const next = [...favorites]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    saveFavs(next)
  }

  useEffect(() => {
    onRegisterAddFavorite?.(addFavorite)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const favStamps = favorites
    .map(f => stamps.find(s => s.id === f.stamp_id))
    .filter((s): s is StampTemplate => !!s)

  return (
    <div style={{ width: "100%", flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 12px", scrollbarWidth: "none" }}>

      {/* Header + edit toggle */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: Math.max(13, Math.round(cardSize * 0.1)), color: INK, opacity: 0.5 }}>
          Drawer
        </div>
        {favStamps.length > 0 && (
          <button
            onClick={() => setEditing(e => !e)}
            style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "1.5px", textTransform: "uppercase", color: INK, opacity: editing ? 0.7 : 0.3, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {editing ? "done" : "edit"}
          </button>
        )}
      </div>

      {/* Card list */}
      <div data-drawer-drop="1" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {favStamps.length === 0 && (
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, color: INK, opacity: 0.3, lineHeight: 1.6, padding: "4px 0 8px" }}>
            drag stamps here<br/>from the library
          </div>
        )}

        {favStamps.map((stamp, i) => (
          <DrawerCard
            key={stamp.id}
            stamp={stamp}
            cardSize={cardSize}
            editing={editing}
            onPointerDragStart={onPointerDragStart}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            onRemove={() => removeFavorite(stamp.id)}
            canMoveUp={i > 0}
            canMoveDown={i < favStamps.length - 1}
          />
        ))}
      </div>

      <StickyComposer onPointerDragStart={onPointerDragStart} />
    </div>
  )
}
