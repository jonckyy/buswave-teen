'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'cyan' | 'lime' | 'magenta' | 'rose' | 'glass'
type Size = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon: ReactNode
  label: string
}

const variants: Record<Variant, string> = {
  primary: 'glass text-primary-light hover:shadow-glow hover:border-primary/40',
  cyan: 'glass text-cyan-light hover:shadow-glow-cyan hover:border-cyan/40',
  lime: 'glass text-lime hover:shadow-glow-lime hover:border-lime/40',
  magenta: 'glass text-magenta-light hover:shadow-glow-magenta hover:border-magenta/40',
  rose: 'glass text-rose-light hover:shadow-glow-magenta hover:border-rose/40',
  glass: 'glass text-ink2 hover:text-ink hover:border-line/30',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 w-9 rounded-2xl',
  md: 'h-11 w-11 rounded-2xl',
  lg: 'h-13 w-13 rounded-3xl',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'glass', size = 'md', icon, label, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-200',
        'active:scale-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})
