"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  plannerStore, recalcBudgets, emptyTemplate,
  type StampTemplate, type WeekTemplate, type Goal, type WeeklyBudget,
} from "@/lib/planner"
import StampVault from "./StampVault"
import CorkBoard from "./CorkBoard"
import NorthStar from "./NorthStar"
import TargetsBar from "./TargetsBar"
import type { DropPayload } from "./CorkBoard"

type Props = { onClose: () => void }

const MIN_PANEL = 120
const DEFAULT_VAULT_W = 180
const DEFAULT_STAR_W  = 200

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onDelta }: { onDelta: (dx: number) => void }) {
  const [active, setActive] = useState(false)

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    setActive(true)
    let last = e.clientX
    function onMove(ev: MouseEvent) { onDelta(ev.clientX - last); last = ev.clientX }
    function onUp() { setActive(false); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 6, flexShrink: 0,
        cursor: "col-resize",
        background: active ? "rgba(44,26,14,0.12)" : "transparent",
        borderLeft: "1px solid rgba(44,26,14,0.1)",
        transition: "background 120ms",
        position: "relative",
        zIndex: 10,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(44,26,14,0.07)" }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}
    />
  )
}

// ─── PlannerView ──────────────────────────────────────────────────────────────

export default function PlannerView({ onClose }: Props) {
  const [stamps, setStamps]     = useState<StampTemplate[]>([])
  const [template, setTemplate] = useState<WeekTemplate>(emptyTemplate())
  const [goals, setGoals]       = useState<Goal[]>([])
  const [budgets, setBudgets]   = useState<Record<string, WeeklyBudget>>({})

  // Panel widths
  const [vaultW, setVaultW]   = useState(DEFAULT_VAULT_W)
  const [starW,  setStarW]    = useState(DEFAULT_STAR_W)

  // CorkBoard registers its drag handler here so StampVault can call it
  const dragHandlerRef = useRef<((e: React.MouseEvent, payload: DropPayload) => void) | null>(null)
  const registerDragHandler = useCallback((fn: (e: React.MouseEvent, payload: DropPayload) => void) => {
    dragHandlerRef.current = fn
  }, [])
  const handlePointerDragStart = useCallback((e: React.MouseEvent, payload: DropPayload) => {
    dragHandlerRef.current?.(e, payload)
  }, [])

  useEffect(() => {
    const s = plannerStore.loadStamps()
    const t = plannerStore.loadTemplate()
    const g = plannerStore.loadGoals()
    const b = plannerStore.loadBudgets()
    setStamps(s); setTemplate(t); setGoals(g)
    setBudgets(recalcBudgets(g, t, b))
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function handleStampsChange(next: StampTemplate[]) {
    setStamps(next); plannerStore.saveStamps(next)
  }
  function handleTemplateChange(next: WeekTemplate) {
    setTemplate(next); plannerStore.saveTemplate(next)
    const nb = recalcBudgets(goals, next, budgets)
    setBudgets(nb); plannerStore.saveBudgets(nb)
  }
  function handleGoalsChange(next: Goal[]) {
    setGoals(next); plannerStore.saveGoals(next)
    const nb = recalcBudgets(next, template, budgets)
    setBudgets(nb); plannerStore.saveBudgets(nb)
  }
  function handleClearWeek() {
    const empty = emptyTemplate()
    setTemplate(empty); plannerStore.saveTemplate(empty)
    const nb = recalcBudgets(goals, empty, budgets)
    setBudgets(nb); plannerStore.saveBudgets(nb)
    plannerStore.clearTodayCompletions()
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "#F5ECD7",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-type)", color: "#2C1A0E",
      userSelect: "none",
    }}>
      {/* Top bar */}
      <div style={{
        height: 44, flexShrink: 0,
        borderBottom: "1px solid rgba(44,26,14,0.1)",
        display: "flex", alignItems: "center",
        padding: "0 16px", gap: 12,
      }}>
        <button onClick={onClose} style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#7A8C6E", background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 1 }}>
          ← back
        </button>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 19, color: "#2C1A0E", opacity: 0.65, letterSpacing: "0.03em" }}>
          planner
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClearWeek}
          style={{ fontFamily: "var(--font-type)", fontSize: 8, letterSpacing: "1.5px", textTransform: "uppercase", color: "#2C1A0E", opacity: 0.3, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.3")}
        >clear week</button>
      </div>

      {/* Three-column area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Vault — fixed width, resizable */}
        <div style={{ width: vaultW, flexShrink: 0, display: "flex", overflow: "hidden" }}>
          <StampVault
            stamps={stamps} goals={goals} budgets={budgets}
            onStampsChange={handleStampsChange}
            onPointerDragStart={handlePointerDragStart}
            width={vaultW}
          />
        </div>

        <ResizeHandle onDelta={dx => setVaultW(w => Math.max(MIN_PANEL, w + dx))} />

        {/* Cork board — flex grows, scrolls horizontally */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <CorkBoard
            stamps={stamps} template={template} goals={goals} budgets={budgets}
            onTemplateChange={handleTemplateChange}
            registerDragHandler={registerDragHandler}
          />
        </div>

        <ResizeHandle onDelta={dx => setStarW(w => Math.max(MIN_PANEL, w - dx))} />

        {/* North Star — fixed width, resizable */}
        <div style={{ width: starW, flexShrink: 0, display: "flex", overflow: "hidden" }}>
          <NorthStar goals={goals} stamps={stamps} budgets={budgets} onGoalsChange={handleGoalsChange} width={starW} />
        </div>

      </div>

      <TargetsBar goals={goals} budgets={budgets} stamps={stamps} />
    </div>
  )
}
