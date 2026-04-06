'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'pop'
  children: ReactNode
}

export function Card({ variant = 'flat', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-surface border-2 border-line p-5',
        variant === 'pop' && 'shadow-pop',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
