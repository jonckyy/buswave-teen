import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Delay color based on seconds */
export function delayColor(delaySeconds: number): string {
  if (delaySeconds <= 60) return 'text-on-time'
  if (delaySeconds <= 300) return 'text-slight-delay'
  return 'text-large-delay'
}

/** Format delay for display: "+3 min", "-1 min", "à l'heure" */
export function formatDelay(delaySeconds: number): string {
  if (Math.abs(delaySeconds) <= 30) return "à l'heure"
  const mins = Math.round(delaySeconds / 60)
  if (mins > 0) return `+${mins} min`
  return `${mins} min`
}
