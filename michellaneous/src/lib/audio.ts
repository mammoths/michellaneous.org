// Shared Web Audio context — one instance for the whole session.
// Creating a new AudioContext per sound hits Chrome's ~6 concurrent-context cap.

let _ctx: AudioContext | null = null

async function getCtx(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null
  try {
    if (!_ctx || _ctx.state === "closed") {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      _ctx = new AC()
    }
    // Browsers keep the context suspended until a user gesture. Resume here so
    // sounds that follow a user interaction (time-cycle click, stamp tap) always work.
    if (_ctx.state === "suspended") await _ctx.resume()
    return _ctx.state === "running" ? _ctx : null
  } catch { return null }
}

function noiseBurst(ctx: AudioContext, freq: number, gain: number, dur: number) {
  const now = ctx.currentTime
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d   = buf.getChannelData(0)
  const dec = ctx.sampleRate * dur * 0.14
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / dec)

  const bp = ctx.createBiquadFilter()
  bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 1.0

  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(bp); bp.connect(g); g.connect(ctx.destination)
  src.start(now)
}

/** Sharp bandpass burst — for odometer number rolls */
export async function playTick() {
  const ctx = await getCtx(); if (!ctx) return
  try { noiseBurst(ctx, 2800, 0.28, 0.018) } catch {}
}

/** Soft key-press click — for typewriter text reveals */
export async function playTypeTick() {
  const ctx = await getCtx(); if (!ctx) return
  try { noiseBurst(ctx, 1100, 0.07, 0.026) } catch {}
}
