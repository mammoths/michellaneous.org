"use client"

import { useState, useEffect, useRef } from "react"
import { type TimeWindow } from "@/lib/time"
import { getTooltip } from "@/lib/date"
import { playTypeTick } from "@/lib/audio"

const WEATHER_GLYPHS: Record<number, string> = {
  0: "○", 1: "◌", 2: "◑", 3: "●",
  45: "≈", 48: "≈",
  51: "∵", 53: "∵", 55: "∵",
  61: "⌇", 63: "⌇", 65: "⌇",
  71: "❄", 73: "❄", 75: "❄",
  80: "⌇", 95: "↯",
}

const WINDOW_CONFIG: Record<TimeWindow, { prefix: string; word: string }> = {
  today: { prefix: "",      word: "today" },
  week:  { prefix: "this ", word: "week"  },
  month: { prefix: "this ", word: "month" },
  year:  { prefix: "this ", word: "year"  },
}

type Weather = { glyph: string; temp: number; sunrise?: string; sunset?: string } | null

const DEFAULT_LAT = 37.7749
const DEFAULT_LON = -122.4194

const BRIDGE_IMG = "https://cdn.cursors-4u.net/previews/golden-gate-bridge-21232359-32.webp"

// ─── Michelle mode ─────────────────────────────────────────
const SECRET = ["s", "c", "h", "m", "e", "h"]
const WORD   = "michellaneous"

const LETTER_NOTES: Record<string, string> = {
  m: "C4", i: "D4", c: "E4", h: "G4",
  e: "A4", l: "C5", a: "D5", n: "E5",
  o: "G5", u: "A5", s: "C5",
}

// Shared synthesis chain — single gentle instrument, no rotation
// PolySynth(AMSynth) → Reverb → Destination
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _chain: { synth: any; reverb: any } | null = null

async function getChain() {
  if (_chain) return _chain
  const Tone = await import("tone")

  // Long, airy reverb for a gentle, spacious feel
  const reverb = new Tone.Reverb({ decay: 5, wet: 0.65 }).toDestination()

  // Soft sine-based AMSynth — slow attack, quick decay, whispery sustain
  const synth = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 1.5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.06, decay: 0.55, sustain: 0.08, release: 4 },
    modulation: { type: "sine" },
    modulationEnvelope: { attack: 0.4, decay: 0.2, sustain: 0.08, release: 3.5 },
    volume: -11,
  }).connect(reverb)

  _chain = { synth, reverb }
  return _chain
}

async function playNote(note: string) {
  if (!note) return
  try {
    const Tone = await import("tone")
    await Tone.start()
    const { synth } = await getChain()
    synth.triggerAttackRelease(note, 0.1, Tone.now())
  } catch (_) { /* silently swallow */ }
}

async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=sunrise,sunset&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const code: number = data.current.weathercode
  const temp: number = Math.round(data.current.temperature_2m)
  const sunrise = data.daily?.sunrise?.[0]
  const sunset = data.daily?.sunset?.[0]
  return { glyph: WEATHER_GLYPHS[code] ?? "·", temp, sunrise, sunset }
}

function roundToNearestQuarter(d: Date): Date {
  const ms = 15 * 60 * 1000
  return new Date(Math.round(d.getTime() / ms) * ms)
}

function formatDisplayTime(isoOrDate?: string | Date): string {
  if (!isoOrDate) return ""
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (isNaN(date.getTime())) return ""
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, "0")
  const ampm = h >= 12 ? "pm" : "am"
  const display = h % 12 || 12
  return `${display}:${m} ${ampm}`
}

function isValidISO(iso?: string): boolean {
  if (!iso) return false
  return !isNaN(Date.parse(iso))
}

const PILL: React.CSSProperties = {
  display: "inline-block",
  background: "#efe6d8",
  color: "#3b2f2f",
  padding: "3px 9px",
  borderRadius: "2px",
  fontFamily: "var(--font-type)",
  fontSize: "11px",
  letterSpacing: "0.05em",
}

type Raindrop = { id: number; x: number; duration: number; size: number; opacity: number }

type Props = {
  timeWindow: TimeWindow
  onCycleWindow: () => void
  onSequenceComplete?: () => void
  fadingOut?: boolean
  onMichelleUnlock?: () => void
  onMichelleLock?: () => void
}

export default function Header({ timeWindow, onCycleWindow, onSequenceComplete, fadingOut = false, onMichelleUnlock, onMichelleLock }: Props) {
  const [typedChars, setTypedChars] = useState(0)
  const [pillDone, setPillDone] = useState(false)
  const [pillPermanent, setPillPermanent] = useState(true)
  const [wordHovered, setWordHovered] = useState(false)
  const [wordPhase, setWordPhase] = useState(0)
  const [titleVisible, setTitleVisible] = useState(false)
  const [titleCharCount, setTitleCharCount] = useState(0)
  const [weatherVisible, setWeatherVisible] = useState(false)
  const [weather, setWeather] = useState<Weather>(null)
  const [cityHovered, setCityHovered] = useState(false)

  // michelle mode
  const [michelleUnlocked, setMichelleUnlocked] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [highlightSpanIdx, setHighlightSpanIdx] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapBuffer = useRef<string[]>([])

  // raindrops
  const [raindrops, setRaindrops] = useState<Raindrop[]>([])
  const raindropCounter = useRef(0)

  function spawnRaindrop() {
    const id = raindropCounter.current++
    const x = 8 + Math.random() * (window.innerWidth - 16)
    const duration = 1100 + Math.random() * 600
    const size = 2.5 + Math.random() * 2.5
    const opacity = 0.3 + Math.random() * 0.35
    setRaindrops(prev => [...prev, { id, x, duration, size, opacity }])
    setTimeout(() => setRaindrops(prev => prev.filter(d => d.id !== id)), duration + 100)
  }

  function showToast(msg: string, duration = 2000) {
    setStatusMessage(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setStatusMessage(null), duration)
  }

  function handleLetterTap(letter: string, spanIdx?: number) {
    playNote(LETTER_NOTES[letter])
    spawnRaindrop()
    const idx = spanIdx ?? WORD.indexOf(letter)
    if (idx !== -1) {
      setHighlightSpanIdx(idx)
      setTimeout(() => setHighlightSpanIdx(null), 150)
    }
    const next = [...tapBuffer.current, letter].slice(-6)
    tapBuffer.current = next
    if (next.length === 6 && next.every((l, i) => l === SECRET[i])) {
      tapBuffer.current = []
      if (michelleUnlocked) {
        setMichelleUnlocked(false)
        onMichelleLock?.()
        showToast("Michelle locked!", 1400)
      } else {
        setMichelleUnlocked(true)
        onMichelleUnlock?.()
        showToast("welcome back, Michelle!", 2800)
      }
    }
  }

  // keyboard listener — always active, only guard against text fields
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return
      if (e.key === " ") { e.preventDefault(); return }
      handleLetterTap(e.key.toLowerCase())
    }
    const onKeyUp = () => setHighlightSpanIdx(null)
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [michelleUnlocked]) // eslint-disable-line react-hooks/exhaustive-deps

  // stamp state
  const [isStamped, setIsStamped] = useState(false)
  const [stampPos, setStampPos] = useState<{ x: number; y: number } | null>(null)
  const [stampVisible, setStampVisible] = useState(false)
  // fake cursor — bridge img we control so dismiss snaps to stamp location
  const [fakeCursorPos, setFakeCursorPos] = useState<{ x: number; y: number } | null>(null)

  const sequenceCompleted = useRef(false)
  const fakeCursorRef = useRef<HTMLImageElement>(null)
  const justDismissed = useRef(false)
  const { prefix, word } = WINDOW_CONFIG[timeWindow]
  const pillText = getTooltip(timeWindow)
  const allWords: string[] = prefix.trim() ? [prefix.trim(), word, "on"] : [word, "on"]
  const buttonIdx = prefix.trim() ? 1 : 0

  // — typewriter for pill, resets on timeWindow change
  useEffect(() => {
    let startTimer: ReturnType<typeof setTimeout>
    let interval: ReturnType<typeof setInterval>

    setTypedChars(0)
    setPillDone(false)
    setPillPermanent(true)
    setWordPhase(0)
    // fade the stamp out cleanly — stampPos cleared by onTransitionEnd on the img
    setIsStamped(false)
    setStampVisible(false)
    setFakeCursorPos(null)

    startTimer = setTimeout(() => {
      let chars = 0
      interval = setInterval(() => {
        chars++
        setTypedChars(chars)
        if (chars >= pillText.length) {
          clearInterval(interval)
          setPillDone(true)
        }
      }, 38)
    }, 150)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
    }
  }, [timeWindow]) // eslint-disable-line react-hooks/exhaustive-deps

  // — after pill done: words one-by-one → title → weather → cards
  useEffect(() => {
    if (!pillDone) return

    const numWords = allWords.length
    const timers: ReturnType<typeof setTimeout>[] = []

    for (let i = 0; i < numWords; i++) {
      const idx = i
      timers.push(setTimeout(() => setWordPhase(idx + 1), idx * 370))
    }

    const wordsEnd = (numWords - 1) * 370 + 370

    if (!sequenceCompleted.current) {
      timers.push(setTimeout(() => setTitleVisible(true), wordsEnd + 100))
      timers.push(setTimeout(() => {
        setWeatherVisible(true)
        sequenceCompleted.current = true
        setPillPermanent(false)
        onSequenceComplete?.()
      }, wordsEnd + 750))
    } else {
      timers.push(setTimeout(() => {
        setPillPermanent(false)
        onSequenceComplete?.()
      }, wordsEnd))
    }

    return () => timers.forEach(clearTimeout)
  }, [pillDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // — typewriter reveal for the title
  useEffect(() => {
    if (!titleVisible) return
    setTitleCharCount(0)
    let count = 0
    const iv = setInterval(() => {
      count++
      setTitleCharCount(count)
      playTypeTick()
      if (count >= WORD.length) clearInterval(iv)
    }, 75)
    return () => clearInterval(iv)
  }, [titleVisible])

  // — pressed cursor on body while stamped
  useEffect(() => {
    document.body.classList.toggle("is-stamped", isStamped)
    return () => document.body.classList.remove("is-stamped")
  }, [isStamped])

  // — weather polling
  useEffect(() => {
    fetchWeather(DEFAULT_LAT, DEFAULT_LON).then(setWeather)
    const interval = setInterval(
      () => fetchWeather(DEFAULT_LAT, DEFAULT_LON).then(setWeather),
      10 * 60 * 1000
    )
    return () => clearInterval(interval)
  }, [])


  function smoothMoveFakeCursor(x: number, y: number) {
    if (justDismissed.current && fakeCursorRef.current) {
      justDismissed.current = false
      fakeCursorRef.current.style.transition = "left 220ms ease, top 220ms ease"
      setTimeout(() => {
        if (fakeCursorRef.current) fakeCursorRef.current.style.transition = ""
      }, 230)
    }
    setFakeCursorPos({ x, y })
  }

  function handleCityClick(e: React.MouseEvent) {
    if (isStamped) {
      // snap fake cursor to stamp location; next mouse move will slide it smoothly
      setFakeCursorPos({ x: stampPos!.x, y: stampPos!.y })
      justDismissed.current = true
      setIsStamped(false)
      setStampVisible(false)
      setCityHovered(false)
    } else {
      setStampPos({ x: e.clientX, y: e.clientY })
      setFakeCursorPos(null)
      setIsStamped(true)
      setStampVisible(true)
    }
  }

  const displayedPill = pillText.slice(0, typedChars)
  const cursor = !pillDone ? <span style={{ opacity: 0.4 }}>|</span> : null

  return (
    <header className="flex flex-col items-center gap-3 text-center select-none">

      {/* raindrop keyframe */}
      <style>{`
        @keyframes raindrop-fall {
          0%   { transform: translateY(-8px) scaleY(0.8); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translateY(55vh) scaleY(1.1); opacity: 0; }
        }
      `}</style>

      {/* raindrop layer */}
      {raindrops.map(drop => (
        <div
          key={drop.id}
          style={{
            position: "fixed",
            left: drop.x,
            top: 0,
            width: drop.size,
            height: drop.size * 2.2,
            borderRadius: "50% 50% 45% 45% / 40% 40% 60% 60%",
            background: "rgba(140, 195, 225, 0.7)",
            pointerEvents: "none",
            zIndex: 9999,
            animation: `raindrop-fall ${drop.duration}ms cubic-bezier(0.4, 0, 1, 1) forwards`,
            opacity: drop.opacity,
          }}
        />
      ))}

      {/* 0 — pill */}
      <div style={{
        minHeight: "1.6em",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: (pillPermanent || wordHovered) && typedChars > 0 && !fadingOut ? 1 : 0,
        transition: "opacity 500ms ease",
      }}>
        <span style={PILL}>
          {displayedPill}{cursor}
        </span>
      </div>

      {/* 1 — "today on" / "this week on", words fade in one by one */}
      <p
        className="text-xs text-ink-muted tracking-widest"
        style={{ fontFamily: "var(--font-type)" }}
      >
        {allWords.map((w, i) => (
          <span key={i}>
            {i > 0 && " "}
            <span style={{ opacity: wordPhase > i && !fadingOut ? 1 : 0, transition: "opacity 450ms ease", display: "inline" }}>
              {i === buttonIdx ? (
                <span onMouseEnter={() => setWordHovered(true)} onMouseLeave={() => setWordHovered(false)}>
                  <button
                    onClick={onCycleWindow}
                    className="cursor-pointer underline underline-offset-4 decoration-dotted transition-opacity hover:opacity-60"
                  >
                    {w}
                  </button>
                </span>
              ) : w}
            </span>
          </span>
        ))}
      </p>

      {/* 2 — michellaneous */}
      <h1
        className="leading-none tracking-tight"
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: "5.5rem",
          color: "#2a4a20",
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0ms, transform 400ms ease, text-shadow 1200ms ease",
          textShadow: michelleUnlocked
            ? "0 0 18px rgba(210,160,50,0.55), 0 0 48px rgba(210,160,50,0.25)"
            : "none",
        }}
      >
        {WORD.split("").map((letter, i) => (
          <span
            key={i}
            onClick={() => handleLetterTap(letter, i)}
            style={{
              display: "inline-block",
              cursor: "default",
              opacity: i < titleCharCount ? 1 : 0,
              transform: highlightSpanIdx === i ? "scale(1.15)" : "scale(1)",
              fontWeight: highlightSpanIdx === i ? 600 : undefined,
              transition: "transform 0.1s ease",
            }}
          >
            {letter}
          </span>
        ))}
      </h1>

      {/* status bubble — welcome back / saving and sending */}
      <div
        style={{
          opacity: statusMessage ? 1 : 0,
          transition: "opacity 500ms ease",
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: "1rem",
          color: "rgba(180, 130, 40, 0.85)",
          letterSpacing: "0.06em",
          pointerEvents: "none",
          userSelect: "none",
          minHeight: "1.4em",
        }}
      >
        {statusMessage}
      </div>

      {/* 3 — city · weather */}
      <p
        className="text-sm text-ink-muted"
        style={{
          fontFamily: "var(--font-type)",
          opacity: weatherVisible && weather !== null ? 1 : 0,
          transform: weatherVisible && weather !== null ? "translateY(0)" : "translateY(4px)",
          transition: "opacity 1000ms ease, transform 1000ms ease",
        }}
      >
        <span
          className="relative inline-block city-stamp-span"
          onMouseEnter={(e) => {
            setCityHovered(true)
            if (!isStamped) {
              smoothMoveFakeCursor(e.clientX, e.clientY)
            }
          }}
          onMouseMove={(e) => {
            if (!isStamped) {
              smoothMoveFakeCursor(e.clientX, e.clientY)
            }
          }}
          onMouseLeave={() => { setCityHovered(false); if (!isStamped) setFakeCursorPos(null) }}
          onClick={handleCityClick}
        >
          <span style={{ color: cityHovered ? "#2a1a08" : "inherit", transition: "color 180ms ease" }}>
            san francisco
          </span>
          &nbsp;
          {weather && `${weather.glyph} ${weather.temp}°f`}
          {isValidISO(weather?.sunset) && (
            <span
              className="pointer-events-none absolute top-full whitespace-nowrap tracking-widest"
              style={{
                display: "block",
                fontFamily: "var(--font-type)",
                fontSize: "11px",
                color: "#8a6a3a",
                letterSpacing: "0.05em",
                textAlign: "center",
                left: "50%",
                transform: (cityHovered || isStamped) ? "translateX(-50%) translateY(6px)" : "translateX(-50%) translateY(0px)",
                opacity: (cityHovered || isStamped) ? 1 : 0,
                transition: "opacity 180ms ease, transform 180ms ease",
              }}
            >
              ↑ {isValidISO(weather?.sunrise) ? formatDisplayTime(new Date(weather?.sunrise!)) : ""}
              <span style={{ marginLeft: 24, marginRight: 24 }} />
              {formatDisplayTime(roundToNearestQuarter(new Date(weather?.sunset!)))} ↓
            </span>
          )}
        </span>
      </p>

      {/* Bridge stamp — fixed at click position, natural image size, fades out */}
      {stampPos && (
        <img
          src={BRIDGE_IMG}
          alt=""
          style={{
            position: "fixed",
            left: stampPos.x - 16,
            top: stampPos.y - 16,
            pointerEvents: "none",
            zIndex: 9000,
            opacity: stampVisible ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
          onTransitionEnd={() => {
            if (!stampVisible) setStampPos(null)
          }}
        />
      )}

      {/* Fake cursor — tracks mouse over SF span; snaps to stamp pos on dismiss */}
      {fakeCursorPos && (
        <img
          ref={fakeCursorRef}
          src={BRIDGE_IMG}
          alt=""
          style={{
            position: "fixed",
            left: fakeCursorPos.x - 16,
            top: fakeCursorPos.y - 16,
            pointerEvents: "none",
            zIndex: 9001,
          }}
        />
      )}
    </header>
  )
}
