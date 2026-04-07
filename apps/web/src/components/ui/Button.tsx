'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'cyan' | 'lime' | 'glass' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-btn-primary text-white shadow-glow hover:shadow-glow-magenta hover:scale-[1.02]',
  cyan:
    'bg-btn-cyan text-white shadow-glow-cyan hover:scale-[1.02]',
  lime:
    'bg-btn-lime text-bg-deep shadow-glow-lime hover:scale-[1.02] font-extrabold',
  glass:
    'glass-strong text-ink hover:bg-white/[0.14]',
  ghost:
    'bg-transparent text-ink2 hover:text-ink hover:bg-white/[0.06]',
  danger:
    'bg-btn-rose text-white shadow-glow-magenta hover:scale-[1.02]',
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
        'transition-all duration-200 active:scale-95',
        'disabled:opacity-40 disabled:pointer-events-none disabled:saturate-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep',
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
