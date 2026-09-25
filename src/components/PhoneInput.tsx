import React, { useState } from 'react'

// Indian mobile number: exactly 10 digits, starting with 6, 7, 8 or 9
export const isTenDigitMobile = (v: string) => /^[6-9]\d{9}$/.test(v)

// Pasted numbers often carry +91, 0 or spaces: keep just the 10-digit number
export function tidyPastedNumber(text: string): string {
  let d = text.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 10)
}

interface PhoneInputProps {
  value: string
  onChange: (digits: string) => void
  required?: boolean
  ariaLabel?: string
}

// The one box used everywhere a mobile number is typed: digits only, never more than 10
export function PhoneInput({ value, onChange, required, ariaLabel = 'Mobile number' }: PhoneInputProps) {
  const [touched, setTouched] = useState(false)
  const tooShort = value.length > 0 && value.length < 10
  const badStart = value.length === 10 && !isTenDigitMobile(value)
  const showError = touched && (tooShort || badStart)

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    onChange(tidyPastedNumber(e.clipboardData.getData('text')))
  }

  return (
    <div>
      <div
        className={`flex overflow-hidden rounded-xl border bg-white focus-within:ring-2 ${
          showError ? 'border-red-400 focus-within:ring-red-300' : 'border-secondary-300 focus-within:ring-primary-500'
        }`}
      >
        <span className="flex select-none items-center border-r border-secondary-200 bg-secondary-50 px-3 text-sm text-secondary-600">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onPaste={handlePaste}
          onBlur={() => setTouched(true)}
          placeholder="9876543210"
          aria-label={ariaLabel}
          required={required}
          className="w-full min-w-0 px-3 py-2.5 tracking-wide focus:outline-none"
        />
      </div>
      <p className={`mt-1 text-xs ${showError ? 'text-red-600' : 'text-secondary-400'}`}>
        {showError
          ? tooShort
            ? `${value.length}/10 digits: enter all 10 digits`
            : 'Mobile numbers start with 6, 7, 8 or 9'
          : `${value.length}/10 digits`}
      </p>
    </div>
  )
}
