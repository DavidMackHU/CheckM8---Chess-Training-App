import { useSyncExternalStore } from 'react'

// Counts API calls that have been waiting a long time. On the free hosting
// plan the server sleeps when idle and takes up to a minute to wake, so the
// app says so instead of looking broken.

const SLOW_AFTER_MS = 4000
let slow = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Wraps a request; while it runs past SLOW_AFTER_MS it counts as slow. */
export async function trackSlow<T>(work: Promise<T>): Promise<T> {
  let counted = false
  const timer = setTimeout(() => {
    counted = true
    slow++
    notify()
  }, SLOW_AFTER_MS)
  try {
    return await work
  } finally {
    clearTimeout(timer)
    if (counted) {
      slow--
      notify()
    }
  }
}

/** True while any API call has been waiting longer than a few seconds. */
export function useSlowRequests(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => slow > 0,
  )
}
