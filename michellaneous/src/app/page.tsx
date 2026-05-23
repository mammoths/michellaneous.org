"use client"

import { useState, useEffect } from "react"
import { WINDOWS, type TimeWindow } from "@/lib/time"
import Header from "@/components/Header"
import StampGrid from "@/components/StampGrid"
import PlannerView from "@/components/planner/PlannerView"

export default function Home() {
  const [windowIdx, setWindowIdx] = useState(0)
  const [cardsVisible, setCardsVisible] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [michelleMode, setMichelleMode] = useState(false)
  const [stampResetKey, setStampResetKey] = useState(0)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const timeWindow: TimeWindow = WINDOWS[windowIdx]

  useEffect(() => {
    const handleMouseDown = () => {
      document.body.classList.add("clicking")
      setTimeout(() => document.body.classList.remove("clicking"), 340)
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  function cycleWindow() {
    setCardsVisible(false)
    setFadingOut(true)
    setTimeout(() => {
      setWindowIdx((i) => (i + 1) % WINDOWS.length)
      setFadingOut(false)
    }, 450)
  }

  return (
    <>
    <main className="flex flex-col items-center px-4 py-16 min-h-dvh gap-12">
      <Header
        timeWindow={timeWindow}
        onCycleWindow={cycleWindow}
        fadingOut={fadingOut}
        onSequenceComplete={() => setCardsVisible(true)}
        onMichelleUnlock={() => setMichelleMode(true)}
        onPlannerUnlock={() => setPlannerOpen(true)}
        onMichelleLock={() => {
          setMichelleMode(false)
          setCardsVisible(false)
          setTimeout(() => {
            setStampResetKey(k => k + 1)
            setTimeout(() => setCardsVisible(true), 80)
          }, 700)
        }}
      />
      <div
        style={{
          opacity: cardsVisible ? 1 : 0,
          transform: cardsVisible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 700ms ease, transform 700ms ease",
        }}
      >
        <StampGrid key={stampResetKey} timeWindow={timeWindow} michelleMode={michelleMode} />
      </div>
    </main>

    {plannerOpen && <PlannerView onClose={() => { setPlannerOpen(false); setStampResetKey(k => k + 1) }} />}
    </>
  )
}
