import type { MoveOutcome } from './game.ts'

/**
 * Board sounds, synthesised with the Web Audio API so the app ships no audio
 * files. Each sound is one or two short tones.
 */
export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'wrong' | 'success'

type Tone = { freq: number; start: number; length: number; type?: OscillatorType; gain?: number }

const TONES: Record<SoundKind, Tone[]> = {
  move: [{ freq: 330, start: 0, length: 0.07, type: 'triangle' }],
  capture: [
    { freq: 220, start: 0, length: 0.06, type: 'square', gain: 0.12 },
    { freq: 165, start: 0.05, length: 0.09, type: 'triangle' },
  ],
  castle: [
    { freq: 330, start: 0, length: 0.06, type: 'triangle' },
    { freq: 330, start: 0.09, length: 0.06, type: 'triangle' },
  ],
  check: [
    { freq: 523, start: 0, length: 0.08, type: 'triangle' },
    { freq: 784, start: 0.08, length: 0.12, type: 'triangle' },
  ],
  wrong: [{ freq: 130, start: 0, length: 0.22, type: 'sawtooth', gain: 0.1 }],
  success: [
    { freq: 523, start: 0, length: 0.1, type: 'sine' },
    { freq: 659, start: 0.1, length: 0.1, type: 'sine' },
    { freq: 784, start: 0.2, length: 0.18, type: 'sine' },
  ],
}

const MUTE_KEY = 'od.muted'
let context: AudioContext | null = null

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Storage can be unavailable (private mode). The setting just won't persist.
  }
}

export function playSound(kind: SoundKind): void {
  if (isMuted() || typeof AudioContext === 'undefined') return
  try {
    context ??= new AudioContext()
    // Browsers suspend audio until the first user gesture; moves are gestures.
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    for (const tone of TONES[kind]) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const peak = tone.gain ?? 0.18
      const t0 = now + tone.start
      osc.type = tone.type ?? 'sine'
      osc.frequency.value = tone.freq
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.length)
      osc.connect(gain).connect(context.destination)
      osc.start(t0)
      osc.stop(t0 + tone.length + 0.02)
    }
  } catch {
    // Sound is a nicety. Never let an audio failure break a move.
  }
}

/** Picks the sound that best describes a move. */
export function soundForMove(move: MoveOutcome): SoundKind {
  if (move.check || move.mate) return 'check'
  if (move.capture) return 'capture'
  if (move.castle) return 'castle'
  return 'move'
}
