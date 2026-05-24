"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  plannerStore, recalcBudgets, emptyTemplate, pinAllUnpinned, clearUnpinned, getWeekISO,
  type StampTemplate, type WeekTemplate, type Goal, type WeeklyBudget, type PlacedStamp, type Completion,
} from "@/lib/planner"
import StampVault from "./StampVault"
import QuickDrawer from "./QuickDrawer"
import CorkBoard from "./CorkBoard"
import NorthStar from "./NorthStar"
import TargetsBar from "./TargetsBar"
import type { DropPayload } from "./CorkBoard"

type Props = { onClose: () => void }

const DEFAULT_VAULT_W   = 180
const DEFAULT_STAR_W    = 200
const DEFAULT_DRAWER_W  = 180
const MIN_PANEL_W       = 120
const MAX_PANEL_W       = 360
const TAB_W             = 22   // drawer edge strip width

const INK  = "#2C1A0E"
const SAGE = "#7A8C6E"

const PANEL_OPEN_KEY  = "michellaneous-planner-panels"

function playTabClack() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.28
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    src.connect(gain).connect(ctx.destination)
    src.start()
    src.onended = () => ctx.close()
  } catch {}
}

// Rapid ticker — like a card shuffle / odometer rolling to a stop
function playCollapseChord(panelCount: number = 1) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const t = ctx.currentTime
    const ticks = panelCount === 1 ? 1 : panelCount === 2 ? 6 : 14
    for (let i = 0; i < ticks; i++) {
      // Spacing accelerates then decelerates (ease-in-out feel)
      const progress = ticks > 1 ? i / (ticks - 1) : 0
      const spacing = 0.018 + 0.055 * Math.pow(progress, 1.8)  // tight start, spread at end
      const offset = Array.from({ length: i }, (_, k) => {
        const p = k / (ticks - 1)
        return 0.018 + 0.055 * Math.pow(p, 1.8)
      }).reduce((a, b) => a + b, 0)

      // Each tick: very short noise burst — like a card flick
      const len = Math.round(ctx.sampleRate * 0.012)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let s = 0; s < len; s++) {
        data[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / len, 3) * 0.5
      }
      const src  = ctx.createBufferSource()
      const gain = ctx.createGain()
      src.buffer = buf
      // Volume tapers off toward end (deceleration = quieter)
      const vol = 0.55 * (1 - progress * 0.6)
      gain.gain.setValueAtTime(vol, t + offset)
      src.connect(gain).connect(ctx.destination)
      src.start(t + offset)
      void spacing
    }
    setTimeout(() => ctx.close(), 1200)
  } catch {}
}

type PanelState = { vault: boolean; star: boolean; drawer: boolean; vaultW: number; starW: number; drawerW: number }

function loadPanelState(): PanelState {
  if (typeof window === "undefined") return { vault: false, star: false, drawer: false, vaultW: DEFAULT_VAULT_W, starW: DEFAULT_STAR_W, drawerW: DEFAULT_DRAWER_W }
  try {
    const raw = localStorage.getItem(PANEL_OPEN_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<PanelState>
      return {
        vault:   p.vault   ?? false,
        star:    p.star    ?? false,
        drawer:  p.drawer  ?? false,
        vaultW:  p.vaultW  ?? DEFAULT_VAULT_W,
        starW:   p.starW   ?? DEFAULT_STAR_W,
        drawerW: p.drawerW ?? DEFAULT_DRAWER_W,
      }
    }
  } catch {}
  return { vault: false, star: false, drawer: false, vaultW: DEFAULT_VAULT_W, starW: DEFAULT_STAR_W, drawerW: DEFAULT_DRAWER_W }
}

function savePanelState(p: PanelState) {
  try { localStorage.setItem(PANEL_OPEN_KEY, JSON.stringify(p)) } catch {}
}

const GRAB_CURSOR = `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAA/CAYAAABXXxDfAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAB7ElEQVRoge3YzWncQBjG8b9CChh1sLOwBSQlBJIC4hJiV2DIxWfnYMg1p801t6SADXEDht0CDDvpYKaDyUFfIyRiryU0Njw/EOyOPt/5fCUQEREREREREREREREREVlYkfn+caSs+E/5rF7NfcETxGOM9DbvAeJ2t++V/XFHqCok3SbL1fLxGKvnt0mhAwgBFzx2lewJgcOdw2wM7j5QAmcf3sLE588avB3Z4dI/IXTlwXe/Z6qA1089cbIQcMYMKsDS9QAYBj2nbGP++st3rj9/5fave/hgxgP/udvDhPGfo+VjPYEB8OPbLw4by+XFx8UfJEu3Tyezq5tL3FjrG9Mb86lypufI1u1tuq3sYF/721Sh2o0ZXqQcKTtBtuDTth6b9ZeQI/hiXeROLCs5MzweN88P+YcPeZRcwbetf0oF2I1px74HvJ+27ufsf/HofTWrM5Lmwuhs3yQ9zbo/JdPL2e2LdVl2mVyyAf3Ajekqycy10OVMbyvFuiwj0LzRDdg6aAft2u/uA6HJDVZPXytyBw91d20qYVulrAC8e/+md+Dt70MX9Fw3fmYiwKebLVcXZ213HwvcrCznE97snmPwjbjd7bH1O3wauKm7+pTAJ524kJgOg0YdNLzQjxmnWOR7noiIiIiIyIv0Dx7VtFd/LQhtAAAAAElFTkSuQmCC") 16 16, move`

// ─── DrawerEdge ───────────────────────────────────────────────────────────────
// Thin border line in flex flow with a small protruding pill handle at center.
// Click pill → toggle. Drag pill → resize 1:1.

function DrawerEdge({
  label, open, side, onToggle, onDelta, onDragStart, onDragEnd,
}: {
  label: string
  open: boolean
  side: "left" | "right"
  onToggle: () => void
  onDelta: (dx: number) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [active,  setActive]  = useState(false)
  const didDrag = useRef(false)

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    didDrag.current = false
    setActive(true)

    const overlay = document.createElement("div")
    overlay.style.cssText = `position:fixed;inset:0;z-index:99999;cursor:${GRAB_CURSOR};`
    document.body.appendChild(overlay)

    let last = e.clientX
    function onMove(ev: MouseEvent) {
      if (!didDrag.current && Math.abs(ev.clientX - e.clientX) > 2) {
        didDrag.current = true
        onDragStart()
      }
      onDelta(ev.clientX - last)
      last = ev.clientX
    }
    function onUp() {
      overlay.remove()
      setActive(false)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      if (didDrag.current) { onDragEnd() } else { onToggle() }
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // Pill dims
  const PILL_W = 16
  const PILL_H = 72
  const protrude = 8  // how far pill sticks out past the edge line

  return (
    // Thin strip in flex flow — just wide enough to not be zero
    <div style={{
      width: 1,
      flexShrink: 0,
      position: "relative",
      borderLeft: side === "right" ? "1px solid rgba(44,26,14,0.1)" : "none",
      borderRight: side === "left"  ? "1px solid rgba(44,26,14,0.1)" : "none",
      zIndex: 15,
    }}>
      {/* Protruding pill — absolutely centered, sticks out into the board */}
      <div
        onMouseDown={onMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "absolute",
          top: "50%",
          // Protrudes toward the board (away from the panel)
          ...(side === "left"
            ? { left: 0, transform: `translateY(-50%) translateX(0)` }
            : { right: 0, transform: `translateY(-50%) translateX(0)` }
          ),
          width: PILL_W,
          height: PILL_H,
          borderRadius: side === "left" ? "0 6px 6px 0" : "6px 0 0 6px",
          background: active
            ? "rgba(44,26,14,0.18)"
            : hovered
              ? "rgba(44,26,14,0.11)"
              : "rgba(44,26,14,0.06)",
          border: "1px solid rgba(44,26,14,0.13)",
          borderLeft:  side === "left"  ? "none" : undefined,
          borderRight: side === "right" ? "none" : undefined,
          cursor: active ? GRAB_CURSOR : "grab",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          transition: "background 120ms",
          userSelect: "none",
          zIndex: 16,
          // pill protrudes protrude px past the edge line into the board side
          marginLeft:  side === "left"  ? 0 : -protrude,
          marginRight: side === "right" ? 0 : -protrude,
        }}
        title={open ? `drag to resize · click to close ${label}` : `click to open ${label}`}
      >
        {/* Label text — vertical, Special Elite, tracked */}
        <span style={{
          writingMode: side === "left" ? "vertical-lr" : "vertical-rl",
          fontFamily: "var(--font-type)",
          fontSize: 7,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
          color: INK,
          opacity: active ? 0.55 : hovered ? 0.4 : 0.22,
          transition: "opacity 150ms",
          userSelect: "none",
          marginBottom: 4,
        }}>
          {label}
        </span>
        {/* Three grip dots */}
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 2, height: 2,
            borderRadius: "50%",
            background: INK,
            opacity: active ? 0.6 : hovered ? 0.45 : 0.25,
            transition: "opacity 150ms",
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── PlannerView ──────────────────────────────────────────────────────────────

export default function PlannerView({ onClose }: Props) {
  const [stamps, setStamps]         = useState<StampTemplate[]>([])
  const [template, setTemplate]     = useState<WeekTemplate>(emptyTemplate())
  const [placed, setPlaced]         = useState<PlacedStamp[]>([])
  const [goals, setGoals]           = useState<Goal[]>([])
  const [budgets, setBudgets]       = useState<Record<string, WeeklyBudget>>({})
  const [completions, setCompletions] = useState<Completion[]>([])
  const [visibleWeek, setVisibleWeek] = useState<string>(getWeekISO())

  // Panel open/size state — persisted
  const init = loadPanelState()
  const [vaultOpen,      setVaultOpen]      = useState(init.vault)
  const [starOpen,       setStarOpen]       = useState(init.star)
  const [drawerOpen,     setDrawerOpen]     = useState(init.drawer)
  const [vaultW,         setVaultW]         = useState(init.vaultW)
  const [starW,          setStarW]          = useState(init.starW)
  const [drawerW,        setDrawerW]        = useState(init.drawerW)
  const [vaultResizing,  setVaultResizing]  = useState(false)
  const [starResizing,   setStarResizing]   = useState(false)
  const [drawerResizing, setDrawerResizing] = useState(false)

  // Detect mobile — panels become bottom sheets instead of side drawers
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)")
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // CorkBoard drag handler bridge
  const dragHandlerRef = useRef<((e: React.MouseEvent, payload: DropPayload) => void) | null>(null)
  const registerDragHandler = useCallback((fn: (e: React.MouseEvent, payload: DropPayload) => void) => {
    dragHandlerRef.current = fn
  }, [])

  // CorkBoard undo bridge — call before any mutation that originates outside CorkBoard
  const beforeMutateRef = useRef<(() => void) | null>(null)
  const registerBeforeMutate = useCallback((fn: () => void) => {
    beforeMutateRef.current = fn
  }, [])

  // CorkBoard snap bridge — call after panel open/close so today stays visible
  const snapToTodayRef = useRef<(() => void) | null>(null)
  const registerSnapToToday = useCallback((fn: () => void) => {
    snapToTodayRef.current = fn
  }, [])
  const handlePointerDragStart = useCallback((e: React.MouseEvent, payload: DropPayload) => {
    dragHandlerRef.current?.(e, payload)
  }, [])

  // Vault drag wrapped to intercept drops on the drawer drop zone → add to favorites
  const drawerFavAddRef = useRef<((stampId: string) => void) | null>(null)
  const handleVaultDragStart = useCallback((e: React.MouseEvent, payload: DropPayload) => {
    if (payload.type === "place" && payload.stamp_id !== "sticky") {
      const stampId = payload.stamp_id
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mouseup", onUp)
        const els = document.elementsFromPoint(ev.clientX, ev.clientY)
        const overDrawer = els.some(el => el instanceof HTMLElement && (el as HTMLElement).dataset.drawerDrop)
        if (overDrawer) drawerFavAddRef.current?.(stampId)
      }
      window.addEventListener("mouseup", onUp)
    }
    dragHandlerRef.current?.(e, payload)
  }, [])

  useEffect(() => {
    const s = plannerStore.loadStamps()
    const t = plannerStore.loadTemplate()
    const p = plannerStore.loadPlaced()
    const g = plannerStore.loadGoals()
    const b = plannerStore.loadBudgets()
    const c = plannerStore.loadCompletions()
    setStamps(s); setTemplate(t); setPlaced(p); setGoals(g); setCompletions(c)
    setBudgets(recalcBudgets(g, t, b))
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return }
      // Don't intercept when typing
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.code === "Space") {
        e.preventDefault()
        const anyOpen = vaultOpen || starOpen || drawerOpen
        if (anyOpen) {
          // Close all silently, play one chord
          if (vaultOpen)  { setVaultOpen(false);  savePanelState({ vault: false, star: starOpen,  drawer: drawerOpen, vaultW, starW, drawerW }) }
          if (starOpen)   { setStarOpen(false);   savePanelState({ vault: false, star: false,     drawer: drawerOpen, vaultW, starW, drawerW }) }
          if (drawerOpen) { setDrawerOpen(false);  savePanelState({ vault: false, star: false,     drawer: false,      vaultW, starW, drawerW }) }
          const openCount = [vaultOpen, starOpen, drawerOpen].filter(Boolean).length
          if (openCount === 1) playTabClack()
          else playCollapseChord(openCount)
          snapAfterTransition()
        } else {
          snapToTodayRef.current?.()
        }
        return
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleVault() }
      if (e.key === "g" || e.key === "G") { e.preventDefault(); toggleStar() }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); toggleDrawer() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, vaultOpen, starOpen, drawerOpen, vaultW, starW, drawerW])

  function snapAfterTransition() {
    // Snap immediately — CorkBoard's ResizeObserver will re-snap on every width tick live
    snapToTodayRef.current?.()
  }
  function toggleVault() {
    playTabClack()
    const next = !vaultOpen
    setVaultOpen(next)
    savePanelState({ vault: next, star: starOpen, drawer: drawerOpen, vaultW, starW, drawerW })
    snapAfterTransition()
  }
  function toggleStar() {
    playTabClack()
    const next = !starOpen
    setStarOpen(next)
    savePanelState({ vault: vaultOpen, star: next, drawer: drawerOpen, vaultW, starW, drawerW })
    snapAfterTransition()
  }
  function toggleDrawer() {
    playTabClack()
    const next = !drawerOpen
    setDrawerOpen(next)
    savePanelState({ vault: vaultOpen, star: starOpen, drawer: next, vaultW, starW, drawerW })
    snapAfterTransition()
  }
  function resizeVault(dx: number) {
    setVaultW(w => {
      const next = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, w + dx))
      savePanelState({ vault: vaultOpen, star: starOpen, drawer: drawerOpen, vaultW: next, starW, drawerW })
      return next
    })
  }
  function resizeStar(dx: number) {
    setStarW(w => {
      const next = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, w - dx))
      savePanelState({ vault: vaultOpen, star: starOpen, drawer: drawerOpen, vaultW, starW: next, drawerW })
      return next
    })
  }
  function resizeDrawer(dx: number) {
    setDrawerW(w => {
      const next = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, w + dx))
      savePanelState({ vault: vaultOpen, star: starOpen, drawer: drawerOpen, vaultW, starW, drawerW: next })
      return next
    })
  }

  function handleStampsChange(next: StampTemplate[]) {
    setStamps(next); plannerStore.saveStamps(next)
  }
  function handleTemplateChange(next: WeekTemplate) {
    setTemplate(next); plannerStore.saveTemplate(next)
    const nb = recalcBudgets(goals, next, budgets)
    setBudgets(nb); plannerStore.saveBudgets(nb)
  }
  function handlePlacedChange(next: PlacedStamp[]) {
    setPlaced(next); plannerStore.savePlaced(next)
  }
  function handleGoalsChange(next: Goal[]) {
    setGoals(next); plannerStore.saveGoals(next)
    const nb = recalcBudgets(next, template, budgets)
    setBudgets(nb); plannerStore.saveBudgets(nb)
  }
  function handlePinAll() {
    const next = pinAllUnpinned(placed)
    setPlaced(next); plannerStore.savePlaced(next)
  }
  function handleClearWeek() {
    beforeMutateRef.current?.()
    const next = clearUnpinned(placed)
    setPlaced(next); plannerStore.savePlaced(next)
  }

  // ── Desktop layout ────────────────────────────────────────────────────────

  if (!isMobile) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "#F5ECD7",
        display: "flex", flexDirection: "column",
        fontFamily: "var(--font-type)", color: INK,
        userSelect: "none",
      }}>
        {/* Top bar */}
        <div style={{
          height: 44, flexShrink: 0,
          borderBottom: "1px solid rgba(44,26,14,0.1)",
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: 12,
        }}>
          <button onClick={onClose} style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: SAGE, background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 1 }}>
            ← back
          </button>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 19, color: INK, opacity: 0.65, letterSpacing: "0.03em" }}>
            planner
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handlePinAll}
            style={{ fontFamily: "var(--font-type)", fontSize: 13, color: INK, opacity: 0.45, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.45")}
            title="pin all unconfirmed stamps"
          >📌</button>
          <button
            onClick={handleClearWeek}
            style={{ fontFamily: "var(--font-type)", fontSize: 8, letterSpacing: "1.5px", textTransform: "uppercase", color: INK, opacity: 0.3, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.3")}
          >clear week</button>
        </div>

        {/* Body — relative so DrawerTabs can position against it */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, position: "relative" }}>

          {/* ── Left drawer (Vault) ── */}
          <div style={{
            width: vaultOpen ? vaultW : 0,
            flexShrink: 0,
            overflow: "hidden",
            // No transition during resize drag — must be 1:1 with mouse
            transition: vaultResizing ? "none" : "width 300ms ease-in-out",
          }}>
            <div style={{ width: vaultW, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <StampVault
                stamps={stamps} goals={goals} budgets={budgets} placed={placed}
                completions={completions} visibleWeek={visibleWeek}
                onStampsChange={handleStampsChange}
                onPointerDragStart={handleVaultDragStart}
                width={vaultW}
              />
            </div>
          </div>

          {/* ── Vault edge — click toggles, drag resizes ── */}
          <DrawerEdge
            label="stamps" open={vaultOpen} side="left"
            onToggle={toggleVault} onDelta={resizeVault}
            onDragStart={() => setVaultResizing(true)}
            onDragEnd={() => setVaultResizing(false)}
          />

          {/* ── Quick Drawer panel ── */}
          <div style={{
            width: drawerOpen ? drawerW : 0,
            flexShrink: 0,
            overflow: "hidden",
            transition: drawerResizing ? "none" : "width 300ms ease-in-out",
          }}>
            <div style={{ width: drawerW, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <QuickDrawer
                stamps={stamps}
                onPointerDragStart={handlePointerDragStart}
                onRegisterAddFavorite={fn => { drawerFavAddRef.current = fn }}
                width={drawerW}
              />
            </div>
          </div>

          {/* ── Drawer edge — click toggles, drag resizes ── */}
          <DrawerEdge
            label="drawer" open={drawerOpen} side="left"
            onToggle={toggleDrawer} onDelta={resizeDrawer}
            onDragStart={() => setDrawerResizing(true)}
            onDragEnd={() => setDrawerResizing(false)}
          />

          {/* ── Cork board — takes all remaining space ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            <CorkBoard
              stamps={stamps} placed={placed} goals={goals} budgets={budgets}
              onPlacedChange={handlePlacedChange}
              registerDragHandler={registerDragHandler}
              registerBeforeMutate={registerBeforeMutate}
              registerSnapToToday={registerSnapToToday}
              onVisibleWeekChange={setVisibleWeek}
              onCompletionsChange={setCompletions}
            />
          </div>

          {/* ── North Star edge — click toggles, drag resizes ── */}
          <DrawerEdge
            label="goals" open={starOpen} side="right"
            onToggle={toggleStar} onDelta={resizeStar}
            onDragStart={() => setStarResizing(true)}
            onDragEnd={() => setStarResizing(false)}
          />

          {/* ── Right drawer (North Star) ── */}
          <div style={{
            width: starOpen ? starW : 0,
            flexShrink: 0,
            overflow: "hidden",
            transition: starResizing ? "none" : "width 300ms ease-in-out",
          }}>
            <div style={{ width: starW, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <NorthStar goals={goals} stamps={stamps} budgets={budgets} onGoalsChange={handleGoalsChange} width={starW} />
            </div>
          </div>

        </div>

        <TargetsBar goals={goals} budgets={budgets} stamps={stamps} />
      </div>
    )
  }

  // ── Mobile layout — bottom sheet overlays ─────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "#F5ECD7",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-type)", color: INK,
      userSelect: "none",
    }}>
      {/* Top bar */}
      <div style={{
        height: 44, flexShrink: 0,
        borderBottom: "1px solid rgba(44,26,14,0.1)",
        display: "flex", alignItems: "center",
        padding: "0 12px", gap: 10,
      }}>
        <button onClick={onClose} style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: SAGE, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          ← back
        </button>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, color: INK, opacity: 0.65 }}>
          planner
        </span>
        <div style={{ flex: 1 }} />
        {/* Mobile panel toggles in top bar */}
        <button
          onClick={toggleVault}
          style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "1.5px", textTransform: "uppercase", color: vaultOpen ? SAGE : INK, opacity: vaultOpen ? 0.9 : 0.4, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >stamps</button>
        <button
          onClick={toggleDrawer}
          style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "1.5px", textTransform: "uppercase", color: drawerOpen ? SAGE : INK, opacity: drawerOpen ? 0.9 : 0.4, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >drawer</button>
        <button
          onClick={toggleStar}
          style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "1.5px", textTransform: "uppercase", color: starOpen ? SAGE : INK, opacity: starOpen ? 0.9 : 0.4, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >goals</button>
        <button
          onClick={handlePinAll}
          style={{ fontSize: 13, color: INK, opacity: 0.45, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.45")}
          title="pin all unconfirmed stamps"
        >📌</button>
        <button
          onClick={handleClearWeek}
          style={{ fontFamily: "var(--font-type)", fontSize: 7, letterSpacing: "1.5px", textTransform: "uppercase", color: INK, opacity: 0.3, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.3")}
        >clear</button>
      </div>

      {/* Full-width cork board underneath */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <CorkBoard
          stamps={stamps} placed={placed} goals={goals} budgets={budgets}
          onPlacedChange={handlePlacedChange}
          registerDragHandler={registerDragHandler}
          registerSnapToToday={registerSnapToToday}
          onVisibleWeekChange={setVisibleWeek}
          onCompletionsChange={setCompletions}
        />
      </div>

      <TargetsBar goals={goals} budgets={budgets} stamps={stamps} />

      {/* Bottom sheet — Vault */}
      <>
        {/* Backdrop */}
        {vaultOpen && (
          <div
            onClick={toggleVault}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 50, transition: "opacity 300ms" }}
          />
        )}
        <div style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          height: "80%",
          background: "#F5ECD7",
          borderTop: "1px solid rgba(44,26,14,0.15)",
          borderRadius: "12px 12px 0 0",
          zIndex: 51,
          transform: vaultOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms ease-in-out",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Sheet handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(44,26,14,0.15)" }} />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <StampVault
              stamps={stamps} goals={goals} budgets={budgets} placed={placed}
              completions={completions} visibleWeek={visibleWeek}
              onStampsChange={handleStampsChange}
              onPointerDragStart={handleVaultDragStart}
              width={Math.min(320, window.innerWidth - 24)}
            />
          </div>
        </div>
      </>

      {/* Bottom sheet — Drawer */}
      <>
        {drawerOpen && (
          <div onClick={toggleDrawer} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 50 }} />
        )}
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, height: "80%",
          background: "#F5ECD7",
          borderTop: "1px solid rgba(44,26,14,0.15)",
          borderRadius: "12px 12px 0 0",
          zIndex: 51,
          transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms ease-in-out",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(44,26,14,0.15)" }} />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <QuickDrawer
              stamps={stamps}
              onPointerDragStart={handlePointerDragStart}
              onRegisterAddFavorite={fn => { drawerFavAddRef.current = fn }}
              width={Math.min(320, window.innerWidth - 24)}
            />
          </div>
        </div>
      </>

      {/* Bottom sheet — North Star */}
      <>
        {starOpen && (
          <div
            onClick={toggleStar}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 50 }}
          />
        )}
        <div style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          height: "80%",
          background: "#F5ECD7",
          borderTop: "1px solid rgba(44,26,14,0.15)",
          borderRadius: "12px 12px 0 0",
          zIndex: 52,
          transform: starOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms ease-in-out",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(44,26,14,0.15)" }} />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <NorthStar goals={goals} stamps={stamps} budgets={budgets} onGoalsChange={handleGoalsChange} width={Math.min(320, window.innerWidth - 24)} />
          </div>
        </div>
      </>
    </div>
  )
}
