"use client"

import { useState } from "react"
import type { StampConfig } from "@/data/stamps"
import type { TimeWindow } from "@/lib/time"
import StampShell from "./StampShell"
import RunStamp from "./RunStamp"
import PullupStamp from "./PullupStamp"
import SessionLog from "./SessionLog"

type Props = {
  config: StampConfig
  timeWindow: TimeWindow
  michelleMode?: boolean
}

const ROTATIONS: Record<string, number> = {
  run:      -3,
  book:      2,
  building: -1,
  crabbing:  2,
}

const numStyle = (inkColor: string): React.CSSProperties => ({
  fontFamily: "var(--font-stamp)",
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1,
  color: inkColor,
  display: "block",
})

// Stamps with multiple variants — public view picks one randomly on mount
const MULTI_IMAGES: Record<string, string[]> = {
  aerials:  ["/stamps/aerial1.png", "/stamps/aerial2.png", "/stamps/aerial3.png", "/stamps/aerials4.png", "/stamps/aerials5.png"],
  pullups:  ["/stamps/pullup1.png", "/stamps/pullup2.png"],
  crabbing: ["/stamps/crabbing1.png", "/stamps/crabbing2.png", "/stamps/crabbing3.png"],
  building: ["/stamps/building.png", "/stamps/building2.png"],
}

function pickImage(config: StampConfig): string | undefined {
  const multi = MULTI_IMAGES[config.id]
  if (multi) return multi[Math.floor(Math.random() * multi.length)]
  return config.imageUrl
}

export default function Stamp({ config, timeWindow, michelleMode = false }: Props) {
  const [todayCount, setTodayCount] = useState(
    config.type === "counter" ? config.data.today : 0
  )
  const [stampImage] = useState(() => pickImage(config))

  const rotation = ROTATIONS[config.id]

  if (config.id === "run" && config.type === "counter") {
    return <RunStamp config={config} timeWindow={timeWindow} rotation={rotation} michelleMode={michelleMode} />
  }

  if (config.id === "pullups" && config.type === "counter") {
    return <PullupStamp config={config} timeWindow={timeWindow} rotation={rotation} michelleMode={michelleMode} />
  }

  if (config.type === "counter") {
    const value = timeWindow === "today" ? todayCount : config.data[timeWindow]
    const showPlus = michelleMode && config.canIncrement && timeWindow === "today"

    return (
      <StampShell inkColor={config.inkColor} bgColor={config.bgColor} label={config.label}
        imageUrl={stampImage} rotation={rotation}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <span style={numStyle(config.inkColor)}>{config.format(value)}</span>
          {showPlus && (
            <button
              onClick={() => setTodayCount((n) => n + 1)}
              style={{
                position: "absolute", top: -6, right: -14,
                fontSize: 14, lineHeight: 1, color: config.inkColor,
                opacity: 0.6, cursor: "pointer", userSelect: "none",
              }}
            >
              +
            </button>
          )}
        </div>
      </StampShell>
    )
  }

  const count = timeWindow === "today" ? null : config.data[timeWindow]
  const showCount = count !== null && count > 0

  const sessionLog = (config.type === "binary" || config.type === "session")
    ? <SessionLog stampId={config.id} inkColor={config.inkColor} />
    : undefined

  return (
    <StampShell
      inkColor={config.inkColor} bgColor={config.bgColor} label={config.label}
      imageUrl={stampImage} rotation={rotation}
      backFillContent={sessionLog}
      backLabel="log"
    >
      {showCount && (
        <span style={numStyle(config.inkColor)}>
          {count}
          <span style={{ fontSize: 16, fontWeight: 400, opacity: 0.7 }}>×</span>
        </span>
      )}
    </StampShell>
  )
}
