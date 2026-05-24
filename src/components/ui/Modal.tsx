'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        'fixed inset-0 m-auto p-0 rounded-[1rem] border border-[#E5E7EB] shadow-xl',
        'w-full max-w-lg backdrop:bg-black/40',
        'open:flex open:flex-col',
        className,
      )}
    >
      <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
        {title && (
          <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
        )}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="ml-auto p-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition-colors duration-150"
        >
          <X size={18} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}
