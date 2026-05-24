'use client'

import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface DropdownOption {
  label: string
  value: string
  disabled?: boolean
}

interface DropdownProps {
  options: DropdownOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  className?: string
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  disabled,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const enabledOptions = options.filter((o) => !o.disabled)

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!open) {
          setOpen(true)
          setFocusedIndex(0)
        } else if (focusedIndex >= 0) {
          onChange(enabledOptions[focusedIndex]?.value ?? '')
          setOpen(false)
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!open) {
          setOpen(true)
          setFocusedIndex(0)
        } else {
          setFocusedIndex((i) => Math.min(i + 1, enabledOptions.length - 1))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  return (
    <div className={cn('flex flex-col gap-1', className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-[#111827]">{label}</label>
      )}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'relative flex items-center justify-between px-3 py-2 text-sm rounded-lg border bg-white cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-[#FFD966] focus:border-[#FFD966]',
          'transition-colors duration-150',
          disabled && 'opacity-50 cursor-not-allowed bg-[#F9FAFB]',
          error ? 'border-[#EF4444]' : 'border-[#E5E7EB]',
        )}
      >
        <span className={selected ? 'text-[#111827]' : 'text-[#6B7280]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'text-[#6B7280] transition-transform duration-150',
            open && 'rotate-180',
          )}
        />

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#E5E7EB] rounded-lg shadow-md overflow-hidden"
          >
            {options.map((option, i) => {
              const enabledIndex = options
                .filter((o) => !o.disabled)
                .indexOf(option)
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!option.disabled) {
                      onChange(option.value)
                      setOpen(false)
                    }
                  }}
                  className={cn(
                    'px-3 py-2 cursor-pointer text-sm',
                    option.disabled && 'opacity-40 cursor-not-allowed',
                    !option.disabled && focusedIndex === enabledIndex && 'bg-[#FFFDE7]',
                    !option.disabled && 'hover:bg-[#FFFDE7]',
                    option.value === value && 'font-medium text-[#FF8F00]',
                  )}
                >
                  {option.label}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
