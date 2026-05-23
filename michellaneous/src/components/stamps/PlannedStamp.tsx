"use client"

import { useState } from "react"
import type { StampTemplate, SlotConfig, Completion } from "@/lib/planner"
import { getTodayISO, plannerStore } from "@/lib/planner"
import { playTick } from "@/lib/audio"
import StampShell from "./StampShell"

type Props = {
  stamp: StampTemplate
  slot: SlotConfig
  completions: Completion[]
  onComplete: (c: Completion) => void
  onUncomplete: (slotId: string) => void
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
}
const FALLBACK = { inkColor: "#2C1A0E", bgColor: "#e8dcc8" }

export default function PlannedStamp({ stamp, slot, completions, onComplete, onUncomplete }: Props) {
  const [bouncing, setBouncing] = useState(false)
  const today  = getTodayISO()
  const done   = completions.some(c => c.slot_id === slot.id && c.date === today)
  const colors = COLOR_MAP[stamp.id] ?? FALLBACK

  function handleTap() {
    if (done) {
      const all = plannerStore.loadCompletions()
      plannerStore.saveCompletions(all.filter(c => !(c.slot_id === slot.id && c.date === today)))
      onUncomplete(slot.id)
    } else {
      const c: Completion = { slot_id: slot.id, stamp_id: stamp.id, date: today, value: slot.target_value }
      const all = plannerStore.loadCompletions()
      plannerStore.saveCompletions([...all, c])
      onComplete(c)
      playTick()
      setBouncing(true); setTimeout(() => setBouncing(false), 260)
    }
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

  return (
    <div style={{
      filter: done ? "none" : "grayscale(1) opacity(0.5)",
      transition: "filter 350ms ease",
      transform: bouncing ? "scale(1.08)" : "scale(1)",
    }}>
      <StampShell
        inkColor={colors.inkColor}
        bgColor={colors.bgColor}
        label={stamp.name}
        imageUrl={stamp.illustration_url || undefined}
        fillContent={statContent}
        onTap={handleTap}
      />
    </div>
  )
}
