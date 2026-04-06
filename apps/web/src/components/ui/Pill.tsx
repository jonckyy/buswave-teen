'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'lime' | 'coral' | 'rose' | 'sun' | 'ink'
type Size = 'sm' | 'md' | 'lg'

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white',
  secondary: 'bg-secondary-500 text-white',
  lime: 'bg-lime-400 text-ink',
  coral: 'bg-coral-400 text-white',
  rose: 'bg-rose-500 text-white',
  sun: 'bg-sun-400 text-ink',
  ink: 'bg-ink text-white',
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
}

export function Pill({ variant = 'primary', size = 'md', className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-pill font-bold',
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
