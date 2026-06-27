'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker, DateRange as RDPDateRange, Matcher } from 'react-day-picker'
import { CalendarDays } from 'lucide-react'
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

  // Close on Escape — keyboard parity with the click-outside dismissal.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
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

  const hasRange = Boolean(value.from && value.to)
  const isEmpty = !value.from

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-neutral-800">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-[var(--portal-control-height,40px)] w-full items-center gap-2.5 rounded-[var(--portal-radius-control,6px)] border px-3.5 text-left text-sm transition-colors',
          error
            ? 'border-error text-error focus:outline-none focus:ring-2 focus:ring-error/30'
            : open
              ? 'border-primary-500 ring-2 ring-primary-500/20'
              : 'border-neutral-300 text-neutral-800 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        )}
      >
        <CalendarDays
          className={cn(
            'h-4 w-4 shrink-0',
            error ? 'text-error' : open ? 'text-primary-600' : 'text-neutral-400'
          )}
        />
        <span
          className={cn(
            'tabular-nums',
            isEmpty && !error && 'text-neutral-500'
          )}
        >
          {value.from && value.to
            ? `${formatDate(value.from)} → ${formatDate(value.to)}`
            : value.from
              ? `${formatDate(value.from)} → …`
              : placeholder || 'Select date range'}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label || 'Choose dates'}
          className="absolute left-0 z-[var(--z-dropdown,30)] mt-2 rounded-[var(--portal-radius-card,8px)] border border-neutral-200 bg-white p-3 shadow-md"
        >
          <div className="cal-skin">
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
          {hasRange && (
            <div className="flex justify-end border-t border-neutral-100 pt-2">
              <button
                type="button"
                onClick={() => onChange({ from: null, to: null })}
                className="px-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}
