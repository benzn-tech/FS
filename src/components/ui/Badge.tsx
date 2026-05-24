import { cn } from '@/lib/utils'
import { type SessionStatus } from '@/types'

type BadgeVariant = SessionStatus | 'default' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  INGESTED: 'bg-blue-100 text-blue-700',
  TRANSCRIBING: 'bg-purple-100 text-purple-700',
  READY: 'bg-green-100 text-green-700',
  EXPORTED: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
  info: 'bg-[#FFFDE7] text-[#FF8F00]',
}

const statusLabels: Partial<Record<BadgeVariant, string>> = {
  INGESTED: 'Ingested',
  TRANSCRIBING: 'Transcribing',
  READY: 'Ready',
  EXPORTED: 'Exported',
  FAILED: 'Failed',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge variant={status}>{statusLabels[status] ?? status}</Badge>
  )
}
