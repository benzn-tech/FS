import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

type Padding = 'none' | 'sm' | 'md' | 'lg'
type Shadow = 'none' | 'sm' | 'md'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding
  shadow?: Shadow
}

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const shadowClasses: Record<Shadow, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
}

export function Card({
  padding = 'md',
  shadow = 'sm',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-[1rem] border border-[#E5E7EB]',
        paddingClasses[padding],
        shadowClasses[shadow],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
