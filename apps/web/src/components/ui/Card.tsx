'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'glow' | 'solid'
  children: ReactNode
}

export function Card({ variant = 'glass', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-3xl p-5 overflow-hidden',
        variant === 'glass' && 'glass shadow-glass',
        variant === 'glow' && 'glass gradient-border shadow-glass',
        variant === 'solid' && 'bg-bg-mid border border-line shadow-glass',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
