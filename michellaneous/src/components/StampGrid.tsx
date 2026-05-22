"use client"

import { useState, useEffect } from "react"
import type { TimeWindow } from "@/lib/time"
import type { StampConfig } from "@/data/stamps"
import { STAMPS } from "@/data/stamps"
import Stamp from "./stamps/Stamp"

type Props = {
  timeWindow: TimeWindow
  michelleMode?: boolean
}

function isVisible(config: StampConfig, timeWindow: TimeWindow): boolean {
  // run + pullup manage their own state in localStorage — always show them
  if (config.id === "run" || config.id === "pullups") return true
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

export default function StampGrid({ timeWindow, michelleMode = false }: Props) {
  const filtered = STAMPS.filter((s) => isVisible(s, timeWindow))
  // Start unshuffled so server and client HTML match, then shuffle after hydration
  const [visible, setVisible] = useState(filtered)

  useEffect(() => {
    setVisible(shuffle(STAMPS.filter((s) => isVisible(s, timeWindow))))
  }, [timeWindow])

  if (visible.length === 0) {
    return (
      <p
        className="text-ink-faint"
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22 }}
      >
        a quiet day.
      </p>
    )
  }

  return (
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
  )
}
