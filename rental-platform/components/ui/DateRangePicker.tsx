'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker, DateRange as RDPDateRange, Matcher } from 'react-day-picker'
import 'react-day-picker/style.css'
import { cn } from '@/lib/utils/cn'

export interface DateRange {
  from: Date | null
  to: Date | null
}

export interface DateRangePickerProps {
  label?: string
  value: DateRange
  onChange: (range: DateRange) => void
  placeholder?: string
  error?: string
  minDate?: Date
  maxDate?: Date
  disabledDates?: Date[]
}

export function DateRangePicker({
  label,
  value,
  onChange,
  placeholder,
  error,
  minDate,
  maxDate,
  disabledDates = [],
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected: RDPDateRange | undefined =
    value.from ? { from: value.from, to: value.to ?? undefined } : undefined

  // Backward-compatible disabling: callers that pass neither bound keep the
  // future-only default (booking / availability flows). Passing maxDate opts a
  // caller into historical ranges (analytics) — past allowed, future disabled.
  const disabledMatchers: Matcher[] = []
  if (minDate) disabledMatchers.push({ before: minDate })
  if (maxDate) disabledMatchers.push({ after: maxDate })
  if (disabledDates.length > 0) disabledMatchers.push(disabledDates)
  if (!minDate && !maxDate) disabledMatchers.push({ before: new Date() })

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm mb-1.5 text-neutral-800 font-medium">{label}</label>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full h-10 px-3.5 border rounded-lg text-left text-sm transition-colors',
          error
            ? 'border-error text-error focus:ring-error/20'
            : 'border-neutral-300 text-neutral-800 hover:border-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
          (!value.from || !value.to) && !error && 'text-neutral-500'
        )}
      >
        {value.from && value.to
          ? `${formatDate(value.from)} → ${formatDate(value.to)}`
          : value.from
            ? `${formatDate(value.from)} → ...`
            : placeholder || 'Select date range'}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
          <DayPicker
            mode="range"
            selected={selected}
            defaultMonth={value.from ?? value.to ?? maxDate ?? undefined}
            onSelect={(range) => {
              onChange({ from: range?.from ?? null, to: range?.to ?? null })
              if (
                range?.from &&
                range?.to &&
                range.from.getTime() !== range.to.getTime()
              ) {
                setOpen(false)
              }
            }}
            disabled={disabledMatchers}
            numberOfMonths={2}
            showOutsideDays
          />
        </div>
      )}

      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  )
}
