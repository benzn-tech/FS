"use client"

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { Spinner } from './Spinner'
import { motion } from 'framer-motion'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[#FFD966] text-gray-900 font-semibold hover:bg-[#FFC107] transition-colors duration-200',
  outline:
    'bg-transparent border-2 border-[#FFD966] text-[#FF8F00] font-semibold hover:bg-[#FFD966] hover:text-gray-900 transition-all duration-200',
  ghost:
    'bg-transparent text-gray-700 font-medium hover:bg-gray-100 transition-colors duration-200',
  danger:
    'bg-[#EF4444] text-white font-semibold hover:bg-red-600 transition-colors duration-200',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-5 py-2.5 text-sm rounded-lg',
  lg: 'px-7 py-3 text-base rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const MotionButton = motion.button as React.ComponentType<
      React.ComponentPropsWithRef<'button'> & { whileTap?: object }
    >
    return (
      <MotionButton
        ref={ref}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.96 }}
        className={cn(
          'inline-flex items-center justify-center gap-2 cursor-pointer select-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading && <Spinner size="sm" />}
        {children}
      </MotionButton>
    )
  },
)

Button.displayName = 'Button'
