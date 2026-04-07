'use client'

import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GradientTextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  variant?: 'aurora' | 'cyan'
  children: ReactNode
}

export function GradientText({
  as: Component = 'span',
  variant = 'aurora',
  className,
  children,
  ...rest
}: GradientTextProps) {
  return (
    <Component
      className={cn(
        variant === 'aurora' && 'text-gradient',
        variant === 'cyan' && 'text-gradient-cyan',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  )
}
