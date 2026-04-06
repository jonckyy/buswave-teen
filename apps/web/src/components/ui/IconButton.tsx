'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'lime' | 'ghost' | 'danger'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon: ReactNode
  label: string
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-100 text-primary-700 hover:bg-primary-200',
  secondary: 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200',
  lime: 'bg-lime-100 text-lime-600 hover:bg-lime-200',
  ghost: 'bg-transparent text-ink2 hover:bg-line',
  danger: 'bg-coral-50 text-rose-600 hover:bg-coral-100',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', icon, label, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
        'transition-all duration-150 active:scale-90',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
        variants[variant],
        className
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})
