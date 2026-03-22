'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Countdown hook — ticks every second locally.
 * Resets when predictedArrivalUnix changes (i.e. after a refetch).
 *
 * Returns seconds remaining (clamped to 0).
 */
export function useCountdown(predictedArrivalUnix: number): number {
  const calcRemaining = () =>
    Math.max(0, Math.round(predictedArrivalUnix - Date.now() / 1000))

  const [remaining, setRemaining] = useState(calcRemaining)
  const prevUnix = useRef(predictedArrivalUnix)

  // Reset on refetch
  if (prevUnix.current !== predictedArrivalUnix) {
    prevUnix.current = predictedArrivalUnix
    // Update synchronously during render (avoids a flash)
    // eslint-disable-next-line react-hooks/rules-of-hooks -- intentional sync update
    setRemaining(calcRemaining())
  }

  useEffect(() => {
    const interval = setInterval(() => setRemaining(calcRemaining()), 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictedArrivalUnix])

  return remaining
}

/** Formats seconds into mm:ss */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'maintenant'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m${s.toString().padStart(2, '0')}s`
}
