'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'cyan' | 'lime' | 'magenta' | 'rose' | 'sun' | 'glass' | 'ink'
type Size = 'sm' | 'md' | 'lg'

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-btn-primary text-white shadow-glow-sm',
  cyan: 'bg-btn-cyan text-white shadow-glow-cyan',
  lime: 'bg-btn-lime text-bg-deep shadow-glow-lime',
  magenta: 'bg-magenta text-white shadow-glow-magenta',
  rose: 'bg-rose text-white',
  sun: 'bg-sun text-bg-deep',
  glass: 'glass-strong text-ink',
  ink: 'bg-bg-mid text-ink border border-line',
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
}

export function Pill({ variant = 'primary', size = 'md', className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-pill font-extrabold tracking-wide whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
