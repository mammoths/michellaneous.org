"use client"

import { useState, useRef, useEffect } from "react"
import type { StampTemplate, SlotConfig, Completion } from "@/lib/planner"
import { getTodayISO, plannerStore, checkMilestone } from "@/lib/planner"
import { playTick } from "@/lib/audio"
import StampShell from "./StampShell"

type Props = {
  stamp: StampTemplate
  slot: SlotConfig
  completions: Completion[]
  onComplete: (c: Completion) => void
  onUncomplete: (slotId: string) => void
  editMode?: boolean
}

const COLOR_MAP: Record<string, { inkColor: string; bgColor: string }> = {
  run:        { inkColor: "#2a4a20", bgColor: "#c4d8b4" },
  pullups:    { inkColor: "#1a2a4a", bgColor: "#bac4d8" },
  pilates:    { inkColor: "#1a4030", bgColor: "#b4ccbf" },
  aerials:    { inkColor: "#3a1a5a", bgColor: "#cabcd4" },
  read:       { inkColor: "#3a2010", bgColor: "#d4c8b4" },
  building:   { inkColor: "#3a2a5a", bgColor: "#cabcd4" },
  coffee:     { inkColor: "#5a3010", bgColor: "#d4b896" },
  boardgames: { inkColor: "#2a3a5a", bgColor: "#b8c4d8" },
  crabbing:   { inkColor: "#5a2a10", bgColor: "#d4b8a0" },
  dishes:     { inkColor: "#5a4020", bgColor: "#d4c8b0" },
  laundry:    { inkColor: "#3a3a5a", bgColor: "#c4c4d8" },
  hair:       { inkColor: "#5a2a4a", bgColor: "#d4b8cc" },
  vacuum:     { inkColor: "#2a3a2a", bgColor: "#b8c8b8" },
  vitamins:   { inkColor: "#5a3a1a", bgColor: "#d4bc9a" },
  bedsheets:  { inkColor: "#3a2a5a", bgColor: "#c8c0d4" },
}
const FALLBACK = { inkColor: "#2C1A0E", bgColor: "#e8dcc8" }

export default function PlannedStamp({
  stamp, slot, completions, onComplete, onUncomplete, editMode = false,
}: Props) {
  const today  = getTodayISO()
  const colors = COLOR_MAP[stamp.id] ?? FALLBACK

  const existing = completions.find(c => c.slot_id === slot.id && c.date === today)
  const isDone   = !!existing

  // ── Lifecycle animation state ──────────────────────────────────────────────
  // "idle"     → grey, waiting
  // "flash"    → full color floods in (600ms ease)
  // "dissolve" → opacity→0, translateY -8px (400ms), then "gone"
  type Phase = "idle" | "flash" | "dissolve" | "gone"
  const [phase, setPhase] = useState<Phase>(isDone ? "gone" : "idle")
  const [bouncing, setBouncing] = useState(false)
  const [milestoneLabel, setMilestoneLabel] = useState<string | null>(null)
  const [showMilestoneTip, setShowMilestoneTip] = useState(false)
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When completions change externally (edit mode restores), sync phase
  useEffect(() => {
    if (!isDone && phase === "gone") setPhase("idle")
  }, [isDone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (dissolveTimer.current) clearTimeout(dissolveTimer.current) }
  }, [])

  function handleTap() {
    if (editMode) return

    if (isDone) {
      plannerStore.removeCompletion(slot.id, today)
      onUncomplete(slot.id)
      setPhase("idle")
      return
    }

    if (phase !== "idle") return

    playTick()
    setBouncing(true); setTimeout(() => setBouncing(false), 260)

    const isPrivate = !!slot.is_private
    const c: Completion = {
      slot_id: slot.id,
      stamp_id: stamp.id,
      date: today,
      value: slot.target_value,
      is_private: isPrivate,
    }
    plannerStore.upsertCompletion(c)
    onComplete(c)

    // Check milestone
    const goals = plannerStore.loadGoals()
    const allComps = plannerStore.loadCompletions()
    const hit = checkMilestone(stamp.id, slot.target_value ?? 0, goals, allComps, today)
    if (hit) setMilestoneLabel(hit)

    // COMPLETED → flash → FADE OUT → gone
    setPhase("flash")
    dissolveTimer.current = setTimeout(() => {
      setPhase("dissolve")
      setTimeout(() => setPhase("gone"), 400)
    }, 2500)
  }

  if (phase === "gone" && !editMode) return null

  const isGhost = editMode && isDone

  // ── Visual state ───────────────────────────────────────────────────────────
  let stampFilter  = "none"
  let stampOpacity = 1
  let stampTranslateY = "0px"
  const stampTransition = "filter 600ms ease, opacity 400ms ease, transform 400ms ease"

  if (phase === "idle") {
    stampFilter  = "grayscale(1) opacity(0.38)"
    stampOpacity = 1
  } else if (phase === "dissolve") {
    stampOpacity    = 0
    stampTranslateY = "-8px"
  }

  if (isGhost) {
    stampFilter  = "none"
    stampOpacity = 0.5
  }

  const valueLabel = slot.target_value != null
    ? `${slot.target_value}${slot.target_unit ? " " + slot.target_unit : ""}`
    : undefined

  const statContent = valueLabel ? (
    <div style={{
      position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center",
      fontFamily: "var(--font-stamp)", fontSize: 11,
      color: colors.inkColor, opacity: 0.5,
    }}>
      {valueLabel}
    </div>
  ) : null

  // Milestone ⭐ tooltip — shown above the stamp when milestone is hit
  const milestoneBadge = milestoneLabel ? (
    <div
      onClick={() => setShowMilestoneTip(t => !t)}
      style={{
        position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
        fontSize: 14, cursor: "help", userSelect: "none", zIndex: 10,
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
      }}
    >
      ⭐
      {showMilestoneTip && (
        <div style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-hand)",
          fontSize: 12,
          color: "#2C1A0E",
          background: "#F5ECD7",
          border: "0.5px solid rgba(44,26,14,0.2)",
          borderRadius: 4,
          padding: "3px 8px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          pointerEvents: "none",
        }}>
          {milestoneLabel}
        </div>
      )}
    </div>
  ) : null

  return (
    <div style={{ position: "relative" }}>
      {milestoneBadge}

      <div
        style={{
          filter: stampFilter,
          opacity: stampOpacity,
          transform: `translateY(${stampTranslateY}) ${bouncing ? "scale(1.08)" : "scale(1)"}`,
          transition: stampTransition,
        }}
      >
        <StampShell
          inkColor={colors.inkColor}
          bgColor={colors.bgColor}
          label={stamp.name}
          imageUrl={stamp.illustration_url || undefined}
          fillContent={statContent}
          onTap={handleTap}
        />
      </div>

      {/* Edit mode pencil icon overlay */}
      {isGhost && (
        <div style={{
          position: "absolute",
          bottom: 8, right: 8,
          fontSize: 14,
          color: colors.inkColor,
          opacity: 0.7,
          userSelect: "none",
          pointerEvents: "none",
        }}>
          ✎
        </div>
      )}
    </div>
  )
}
