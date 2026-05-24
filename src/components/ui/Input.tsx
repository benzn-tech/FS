import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#111827]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border bg-white text-[#111827]',
            'placeholder:text-[#6B7280]',
            'focus:outline-none focus:ring-2 focus:ring-[#FFD966] focus:border-[#FFD966]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#F9FAFB]',
            'transition-colors duration-150',
            error
              ? 'border-[#EF4444] focus:ring-[#EF4444] focus:border-[#EF4444]'
              : 'border-[#E5E7EB]',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[#EF4444]">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-[#6B7280]">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
