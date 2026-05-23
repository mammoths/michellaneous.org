"use client"

import { useState, useEffect } from "react"
import type { TimeWindow } from "@/lib/time"
import type { StampConfig } from "@/data/stamps"
import { STAMPS } from "@/data/stamps"
import Stamp from "./stamps/Stamp"
import PlannedStamp from "./stamps/PlannedStamp"
import StampShell from "./stamps/StampShell"
import RunStamp from "./stamps/RunStamp"
import PullupStamp from "./stamps/PullupStamp"
import {
  plannerStore, getTodayDayKey, getTodayISO,
  type StampTemplate, type SlotConfig, type Completion, type Zone,
} from "@/lib/planner"
import type { CounterConfig } from "@/data/stamps"
import { playTick } from "@/lib/audio"

type Props = {
  timeWindow: TimeWindow
  michelleMode?: boolean
}

// Ambient stamps always shown in the LIFE shelf (Michelle today only)
// These are things done habitually, not planned day-to-day
const LIFE_IDS = ["coffee", "pullups"]

const ZONE_LABEL: Record<Zone, string> = {
  morning:   "morning",
  afternoon: "afternoon",
  evening:   "evening",
}
const ZONE_KEYS: Zone[] = ["morning", "afternoon", "evening"]

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

function isVisible(config: StampConfig, timeWindow: TimeWindow): boolean {
  if (timeWindow === "today") {
    if (config.type === "counter") return config.data.today > 0
    return config.data.today
  }
  return config.data[timeWindow] > 0
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function readTodayMiles(): boolean {
  try {
    const raw = localStorage.getItem("michellaneous-run-log")
    if (!raw) return false
    const logs: { date: string; miles: number }[] = JSON.parse(raw)
    const today = new Date().toISOString().split("T")[0]
    return logs.some(e => e.date === today && e.miles > 0)
  } catch { return false }
}

function readTodayPullups(): boolean {
  try {
    const raw = localStorage.getItem("michellaneous-pullup")
    if (!raw) return false
    const data: { entries: { date: string; count: number }[] } = JSON.parse(raw)
    const today = new Date().toISOString().split("T")[0]
    return data.entries.some(e => e.date === today && e.count > 0)
  } catch { return false }
}

function LifeRunStamp({ config }: { config: CounterConfig }) {
  const [hasMiles, setHasMiles] = useState(readTodayMiles)
  // Apply grayscale via a CSS class on a wrapper that does NOT use `filter` —
  // CSS filter creates a stacking context that clips the numpad's `below` overflow.
  // Instead we overlay a semi-transparent white div to desaturate visually.
  return (
    <div style={{ position: "relative" }}>
      <RunStamp config={config} timeWindow="today" michelleMode={true} onMilesLogged={() => setHasMiles(true)} />
      {!hasMiles && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(245,236,215,0.55)",
          mixBlendMode: "saturation",
          pointerEvents: "none",
          transition: "opacity 350ms ease",
        }} />
      )}
    </div>
  )
}

function LifePullupStamp({ config }: { config: CounterConfig }) {
  const [hasReps, setHasReps] = useState(readTodayPullups)

  return (
    <div style={{ filter: hasReps ? "none" : "grayscale(1) opacity(0.5)", transition: "filter 350ms ease" }}>
      <PullupStamp config={config} timeWindow="today" michelleMode={true} onRepLogged={() => setHasReps(true)} />
    </div>
  )
}

// Ambient counter stamp: tap increments, right-click resets; click sound + bounce
function LifeCounterStamp({ stampId, plannerStamps, completions, onComplete }: {
  stampId: string
  plannerStamps: StampTemplate[]
  completions: Completion[]
  onComplete: (c: Completion) => void
}) {
  const [bouncing, setBouncing] = useState(false)
  const publicStamp = STAMPS.find(s => s.id === stampId)
  if (!publicStamp) return null

  const today  = getTodayISO()
  const slotId = `life-${stampId}`
  const existing = completions.find(c => c.slot_id === slotId && c.date === today)
  const count  = existing?.value ?? 0
  const colors = COLOR_MAP[stampId] ?? FALLBACK
  const imageUrl = (publicStamp as { imageUrl?: string }).imageUrl
  const label = plannerStamps.find(s => s.id === stampId)?.name ?? publicStamp.label

  function increment() {
    const next = count + 1
    const c: Completion = { slot_id: slotId, stamp_id: stampId, date: today, value: next }
    const all = plannerStore.loadCompletions().filter(x => !(x.slot_id === slotId && x.date === today))
    plannerStore.saveCompletions([...all, c])
    onComplete(c)
    playTick()
    setBouncing(true); setTimeout(() => setBouncing(false), 260)
  }

  function reset() {
    const all = plannerStore.loadCompletions().filter(x => !(x.slot_id === slotId && x.date === today))
    plannerStore.saveCompletions(all)
    onComplete({ slot_id: slotId, stamp_id: stampId, date: today, value: 0 })
  }

  const countContent = count > 0 ? (
    <div style={{
      position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center",
      fontFamily: "var(--font-stamp)", fontSize: 26, fontWeight: 700, lineHeight: 1,
      color: colors.inkColor,
    }}>
      {count}
    </div>
  ) : null

  return (
    <div
      style={{
        filter: count > 0 ? "none" : "grayscale(1) opacity(0.5)",
        transition: "filter 350ms ease",
        transform: bouncing ? "scale(1.08)" : "scale(1)",
      }}
      onContextMenu={e => { e.preventDefault(); reset() }}
    >
      <StampShell
        inkColor={colors.inkColor}
        bgColor={colors.bgColor}
        label={count > 1 ? `${count}× ${label}` : label}
        imageUrl={imageUrl}
        fillContent={countContent}
        onTap={increment}
      />
    </div>
  )
}

// Ambient life stamp dispatcher
function LifeStamp({ stampId, plannerStamps, completions, onComplete }: {
  stampId: string
  plannerStamps: StampTemplate[]
  completions: Completion[]
  onComplete: (c: Completion) => void
}) {
  const publicStamp = STAMPS.find(s => s.id === stampId)
  if (!publicStamp) return null

  if (stampId === "run" && publicStamp.type === "counter")
    return <LifeRunStamp config={publicStamp as CounterConfig} />
  if (stampId === "pullups" && publicStamp.type === "counter")
    return <LifePullupStamp config={publicStamp as CounterConfig} />

  return <LifeCounterStamp stampId={stampId} plannerStamps={plannerStamps} completions={completions} onComplete={onComplete} />
}

export default function StampGrid({ timeWindow, michelleMode = false }: Props) {
  const filtered = STAMPS.filter((s) => isVisible(s, timeWindow))
  const [visible, setVisible] = useState(filtered)

  const [plannerStamps, setPlannerStamps] = useState<StampTemplate[]>([])
  const [todaySlots, setTodaySlots]       = useState<{ zone: Zone; slot: SlotConfig; stamp: StampTemplate }[]>([])
  const [completions, setCompletions]     = useState<Completion[]>([])

  useEffect(() => {
    const base = STAMPS.filter((s) => isVisible(s, timeWindow))
    if (timeWindow === "today") {
      const comps    = plannerStore.loadCompletions()
      const todayStr = getTodayISO()
      const completedIds = new Set(comps.filter(c => c.date === todayStr).map(c => c.stamp_id))
      const extra = STAMPS.filter(s => completedIds.has(s.id) && !base.some(b => b.id === s.id))
      setVisible(shuffle([...base, ...extra]))
    } else {
      setVisible(shuffle(base))
    }
  }, [timeWindow])

  useEffect(() => {
    if (!michelleMode || timeWindow !== "today") return
    const stamps = plannerStore.loadStamps()
    const tmpl   = plannerStore.loadTemplate()
    const comps  = plannerStore.loadCompletions()
    const dayKey = getTodayDayKey()
    const slots  = tmpl.days[dayKey]?.slots ?? []

    const entries = slots.flatMap(slot => {
      const stamp = stamps.find(s => s.id === slot.stamp_id)
      if (!stamp) return []
      return [{ zone: slot.zone as Zone, slot, stamp }]
    })

    setPlannerStamps(stamps)
    setTodaySlots(entries)
    setCompletions(comps)
  }, [michelleMode, timeWindow])

  function handleComplete(c: Completion) {
    setCompletions(prev => {
      // value:0 means reset — remove the entry
      if (c.value === 0) return prev.filter(x => !(x.slot_id === c.slot_id && x.date === c.date))
      // upsert: replace existing entry for this slot+date, or append
      const existing = prev.findIndex(x => x.slot_id === c.slot_id && x.date === c.date)
      if (existing >= 0) {
        const next = [...prev]; next[existing] = c; return next
      }
      return [...prev, c]
    })
    setVisible(prev => {
      const alreadyShown = prev.some(s => s.id === c.stamp_id)
      if (alreadyShown) return prev
      const cfg = STAMPS.find(s => s.id === c.stamp_id)
      return cfg ? [...prev, cfg] : prev
    })
  }

  function handleUncomplete(slotId: string) {
    const today = getTodayISO()
    setCompletions(prev => prev.filter(c => !(c.slot_id === slotId && c.date === today)))
  }

  const showPlanner = michelleMode && timeWindow === "today"
  const hasPlanned  = todaySlots.length > 0

  if (visible.length === 0 && !showPlanner) {
    return (
      <p className="text-ink-faint"
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22 }}>
        a quiet day.
      </p>
    )
  }

  const SAGE = "#7A8C6E"

  function ShelfLabel({ label }: { label: string }) {
    return (
      <div style={{
        fontFamily: "var(--font-type)", fontSize: 8,
        letterSpacing: "2.5px", textTransform: "uppercase",
        color: SAGE, marginBottom: 12,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span>{label}</span>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(44,26,14,0.1)" }} />
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>

      {/* ── Michelle today: planned shelves ───────────────────────────────── */}
      {showPlanner && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28, width: "100%", maxWidth: 900 }}>

          {/* morning / afternoon / evening zones */}
          {hasPlanned && ZONE_KEYS.map(zone => {
            const zoneSlots = todaySlots.filter(e => e.zone === zone)
            if (zoneSlots.length === 0) return null
            return (
              <div key={zone}>
                <ShelfLabel label={zone} />
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24 }}>
                  {zoneSlots.map(({ slot, stamp }) => (
                    <PlannedStamp
                      key={slot.id}
                      stamp={stamp}
                      slot={slot}
                      completions={completions}
                      onComplete={handleComplete}
                      onUncomplete={handleUncomplete}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* LIFE shelf — always present in Michelle today */}
          <div>
            <ShelfLabel label="life" />
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24 }}>
              {LIFE_IDS.map(id => (
                <LifeStamp
                  key={id}
                  stampId={id}
                  plannerStamps={plannerStamps}
                  completions={completions}
                  onComplete={handleComplete}
                />
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Public stamp grid (non-Michelle, or non-today) ────────────────── */}
      {!showPlanner && visible.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6 max-w-4xl">
          {visible.map((config) => (
            <Stamp
              key={`${config.id}-${timeWindow}`}
              config={config}
              timeWindow={timeWindow}
              michelleMode={michelleMode}
            />
          ))}
        </div>
      )}

    </div>
  )
}
