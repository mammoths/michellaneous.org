"use client"

import { useState, useEffect, useRef } from "react"
import { playTick } from "@/lib/audio"

type Props = {
  value: number
  logKey: number                  // increment only on a real log — triggers count-up
  format: (n: number) => string
  style?: React.CSSProperties
  sounds?: boolean                // default true; pass false for a single external click
}

export default function NumberTransition({ value, logKey, format, style, sounds = true }: Props) {
  const [renderValue, setRenderValue] = useState(value)
  const animatedRef = useRef(value)
  const prevKey     = useRef(logKey)
  const rafRef      = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    if (logKey === prevKey.current) {
      animatedRef.current = value
      setRenderValue(value)
      return
    }
    prevKey.current = logKey

    const from = animatedRef.current
    const to   = value
    if (from === to) return

    const DURATION = 600
    const TICK_MS  = 30

    const startTime  = performance.now()
    let lastTickTime = startTime - TICK_MS

    function frame(now: number) {
      const t       = Math.min((now - startTime) / DURATION, 1)
      const eased   = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased

      animatedRef.current = current
      setRenderValue(current)

      if (sounds && now - lastTickTime >= TICK_MS) {
        playTick()
        lastTickTime = now
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        animatedRef.current = to
        setRenderValue(to)
        if (sounds) playTick()
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [logKey, value, sounds])

  return (
    <span style={{ display: "block", ...style }}>
      {format(renderValue)}
    </span>
  )
}
