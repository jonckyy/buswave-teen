'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'lime' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white shadow-pop hover:bg-primary-700 active:shadow-none active:translate-y-1.5',
  secondary: 'bg-secondary-500 text-white shadow-pop-cyan hover:bg-secondary-600 active:shadow-none active:translate-y-1.5',
  lime: 'bg-lime-500 text-ink shadow-pop-lime hover:bg-lime-600 active:shadow-none active:translate-y-1.5',
  ghost: 'bg-transparent text-ink hover:bg-primary-50',
  danger: 'bg-rose-500 text-white shadow-pop hover:bg-rose-600 active:shadow-none active:translate-y-1.5',
}

const sizes: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-5 text-base',
  lg: 'h-14 px-7 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', iconLeft, iconRight, loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill font-bold',
        'transition-all duration-150',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  )
})
