"use client"

import { useState, useRef, useEffect, useId } from "react"
import type { ReactNode } from "react"

type Props = {
  inkColor: string
  bgColor: string
  label: string
  children?: ReactNode
  imageUrl?: string
  fillContent?: ReactNode
  backFillContent?: ReactNode
  backLabel?: string
  rotation?: number
  flipped?: boolean
  onTap?: () => void
  // rendered below the stamp body, inside the same transform so it drags with the stamp
  below?: ReactNode
}

let interactionCounter = 0

const W = 152
const H = 184
const INSET = 10    // inner border inset + content margin
const FOOTER_H = 46 // tall enough for number + label + breathing room
const R = 4         // perforation hole radius
const SPACING = 12  // approximate hole center-to-center spacing

// ─── perforation math ────────────────────────────────────────────────────────
// Distribute n holes evenly along an edge of length `total`.
// Holes are offset by half-step so they never land exactly on corners —
// this avoids the evenodd double-count problem at corner intersections.
function holePositions(total: number): number[] {
  const n = Math.round(total / SPACING)
  if (n < 1) return []
  const step = total / n
  return Array.from({ length: n }, (_, i) => step * (i + 0.5))
}

function circleArc(cx: number, cy: number, r: number): string {
  // Two semicircular arcs trace a full circle for use in compound SVG paths
  return `M${cx - r},${cy} A${r},${r},0,1,0,${cx + r},${cy} A${r},${r},0,1,0,${cx - r},${cy}Z`
}

// ─── Face ────────────────────────────────────────────────────────────────────

function Face({
  isBack, inkColor, bgColor, label, imageUrl, fillContent, children,
}: {
  isBack: boolean; inkColor: string; bgColor: string; label: string
  imageUrl?: string; fillContent?: ReactNode; children?: ReactNode
}) {
  // Unique ID per face instance — needed because SVG clip IDs are global in the DOM
  const rawId = useId()
  const clipId = `sc${rawId.replace(/:/g, "")}`

  const hPos = holePositions(W)
  const vPos = holePositions(H)

  // evenodd compound path:
  //   outer rect (count 1 → inside/shown)
  //   each circle punches a hole (count 2 → outside/hidden for overlapping region)
  // Circles centered ON the stamp edge (y=0, y=H, x=0, x=W) so each is half
  // inside, half outside — the outer half is clipped by the SVG viewport itself.
  const clipD = [
    `M0,0 H${W} V${H} H0 Z`,
    ...hPos.map(x => circleArc(x, 0, R)),
    ...hPos.map(x => circleArc(x, H, R)),
    ...vPos.map(y => circleArc(0, y, R)),
    ...vPos.map(y => circleArc(W, y, R)),
  ].join(" ")

  return (
    <div style={{
      position: "absolute", inset: 0,
      backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
      transform: isBack ? "rotateY(180deg)" : undefined,
    }}>
      {/* hidden SVG — provides the clip definition only, renders nothing visible */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipD} clipRule="evenodd" />
          </clipPath>
        </defs>
      </svg>

      {/* stamp body — clipped to the perforated outline */}
      <div style={{
        position: "absolute", inset: 0,
        clipPath: `url(#${clipId})`,
        background: "#F5ECD7",
        display: "flex", flexDirection: "column",
      }}>
        {/* illustration — square-ish area inset from stamp edges */}
        <div style={{
          flex: 1, position: "relative", overflow: "hidden",
          marginTop: INSET, marginLeft: INSET, marginRight: INSET,
        }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none", userSelect: "none" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              backgroundColor: bgColor,
              backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, ${inkColor}22 4px, ${inkColor}22 5px)`,
            }} />
          )}
          {fillContent && (
            <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 0, overflow: "hidden" }}>
              {fillContent}
            </div>
          )}
        </div>

        {/* footer strip */}
        <div style={{
          height: FOOTER_H, flexShrink: 0,
          marginLeft: INSET, marginRight: INSET, marginBottom: INSET,
          backgroundColor: "#f5f0e2",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          paddingBottom: 6, gap: 2,
        }}>
          {!isBack && children}
          <div style={{
            fontFamily: "var(--font-stamp)", fontSize: 8, letterSpacing: "2px",
            textTransform: "uppercase", color: inkColor, opacity: 0.8, lineHeight: 1,
          }}>
            {label}
          </div>
        </div>

        {/* inner decorative double border */}
        <div style={{
          position: "absolute",
          top: INSET, left: INSET, right: INSET, bottom: INSET,
          border: `0.8px solid ${inkColor}`,
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", inset: 3,
            border: `0.3px solid ${inkColor}`,
            opacity: 0.3,
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── StampShell ──────────────────────────────────────────────────────────────

export default function StampShell({
  inkColor, bgColor, label, children,
  imageUrl, fillContent, backFillContent, backLabel,
  rotation = 0,
  flipped: controlledFlipped,
  onTap,
  below,
}: Props) {
  const [internalFlipped, setInternalFlipped] = useState(false)
  const flipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped
  const [hovered, setHovered] = useState(false)
  const [myOrder, setMyOrder] = useState(0)

  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [mouseDownActive, setMouseDownActive] = useState(false)
  const isDraggingRef = useRef(false)
  const wasGrabbed = useRef(false)
  const dragStartMouse = useRef({ x: 0, y: 0 })
  const savedTranslate = useRef({ x: 0, y: 0 })
  const liveTranslate = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!mouseDownActive) return

    function applyMove(clientX: number, clientY: number) {
      const dx = clientX - dragStartMouse.current.x
      const dy = clientY - dragStartMouse.current.y

      if (!isDraggingRef.current) {
        if (Math.sqrt(dx * dx + dy * dy) < 5) return
        isDraggingRef.current = true
        wasGrabbed.current = true
        liveTranslate.current = savedTranslate.current
        document.body.classList.add("is-grabbing")
        setMyOrder(++interactionCounter)
        setIsDragging(true)
      }

      const next = { x: savedTranslate.current.x + dx, y: savedTranslate.current.y + dy }
      liveTranslate.current = next
      setTranslate(next)
    }

    function applyEnd() {
      if (isDraggingRef.current) {
        savedTranslate.current = liveTranslate.current
        document.body.classList.remove("is-grabbing")
      }
      isDraggingRef.current = false
      setIsDragging(false)
      setMouseDownActive(false)
    }

    const onMouseMove = (e: MouseEvent) => applyMove(e.clientX, e.clientY)
    const onMouseUp = () => applyEnd()
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const t = e.touches[0]
      if (t) applyMove(t.clientX, t.clientY)
    }
    const onTouchEnd = () => applyEnd()

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)

    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
      document.body.classList.remove("is-grabbing")
    }
  }, [mouseDownActive])

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    wasGrabbed.current = false
    isDraggingRef.current = false
    dragStartMouse.current = { x: e.clientX, y: e.clientY }
    setMouseDownActive(true)
  }

  function handleClick() {
    if (wasGrabbed.current) return
    setMyOrder(++interactionCounter)
    if (onTap) {
      onTap()
    } else {
      setInternalFlipped((f: boolean) => !f)
    }
  }

  const isDragged = translate.x !== 0 || translate.y !== 0

  return (
    <div
      style={{
        width: W, height: H, flexShrink: 0,
        perspective: "900px",
        position: "relative",
        zIndex: isDragging ? 1000 : myOrder > 0 ? myOrder : "auto",
        filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.2))",
        transform: isDragging
          ? `rotate(${rotation}deg) translate(${translate.x}px, ${translate.y}px) scale(1.06)`
          : isDragged
            ? hovered
              ? `rotate(${rotation}deg) translate(${translate.x}px, ${translate.y}px) translateY(-6px) scale(1.04)`
              : `rotate(${rotation}deg) translate(${translate.x}px, ${translate.y}px)`
            : hovered
              ? `rotate(${rotation}deg) translateY(-6px) scale(1.04)`
              : `rotate(${rotation}deg) translateY(0) scale(1)`,
        transition: isDragging ? "transform 0ms" : "transform 180ms ease",
        userSelect: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (!t) return
        wasGrabbed.current = false
        isDraggingRef.current = false
        dragStartMouse.current = { x: t.clientX, y: t.clientY }
        setMouseDownActive(true)
      }}
    >
      <div
        style={{
          width: "100%", height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
          outline: "none",
        }}
        onClick={handleClick}
      >
        <Face isBack={false} inkColor={inkColor} bgColor={bgColor} label={label}
          imageUrl={imageUrl} fillContent={fillContent}>
          {children}
        </Face>
        <Face isBack={true} inkColor={inkColor} bgColor={bgColor}
          label={backLabel ?? label} fillContent={backFillContent} />
      </div>

      {/* below — rendered outside stamp body but inside the same transform, so it drags with the stamp */}
      {below && (
        <div style={{ position: "absolute", top: H, left: 0, width: W }}>
          {below}
        </div>
      )}
    </div>
  )
}
