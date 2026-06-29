'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ChevronRight, Info, ShieldCheck, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { useAvailability } from '@/lib/hooks/useCatalog';
import { formatCurrency, formatDateForApi, getNights } from '@/lib/utils/format';
import { parseDateOnly } from '@/lib/utils/format';

interface Props {
  unitId: string;
  unitName: string;
  basePrice: number;
  maxGuests: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function UnitBookingWidget({ unitId, unitName, basePrice, maxGuests }: Props) {
  const router = useRouter();
  const today = useMemo(() => startOfToday(), []);
  const windowEnd = useMemo(() => addDays(today, 365), [today]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGuestsModal, setShowGuestsModal] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [guests, setGuests] = useState(1);

  // Pull all blocked days in the next year so the calendar can't offer dates
  // that are already booked/blocked (operational lockout).
  const { data: availability } = useAvailability(
    unitId,
    formatDateForApi(today),
    formatDateForApi(windowEnd)
  );

  const blockedDays = useMemo(
    () => (availability?.blockedDates ?? []).map(parseDateOnly),
    [availability]
  );
  const heldDays = useMemo(
    () => (availability?.heldDates ?? []).map(parseDateOnly),
    [availability]
  );
  const unavailableDays = useMemo(
    () => [...blockedDays, ...heldDays],
    [blockedDays, heldDays]
  );
  const unavailableDayKeys = useMemo(
    () => new Set(unavailableDays.map(formatDateForApi)),
    [unavailableDays]
  );

  const checkIn = range?.from ?? null;
  const checkOut = range?.to ?? null;
  const nights = getNights(checkIn, checkOut);
  const subtotal = nights * basePrice;
  const selectedRangeHasUnavailableNight = useMemo(() => {
    if (!checkIn || !checkOut) return false;

    const current = new Date(checkIn);
    while (current < checkOut) {
      if (unavailableDayKeys.has(formatDateForApi(current))) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }

    return false;
  }, [checkIn, checkOut, unavailableDayKeys]);
  const canBook = Boolean(
    checkIn && checkOut && nights > 0 && !selectedRangeHasUnavailableNight
  );

  const goToCheckout = () => {
    if (!checkIn || !checkOut || !canBook) return;
    const params = new URLSearchParams({
      unitId,
      checkIn: formatDateForApi(checkIn),
      checkOut: formatDateForApi(checkOut),
      guests: String(guests),
    });
    router.push(`/checkout?${params.toString()}`);
  };

  const fmt = (d: Date | null) =>
    d ? format(d, 'd MMM yyyy', { locale: ar }) : 'إضافة تاريخ';

  return (
    <>
      <div className="bg-white p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-brand-50">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-3xl font-black text-brand-950 tracking-tighter tabular-nums">
              {formatCurrency(basePrice)}
            </span>
            <span className="text-gray-500 font-bold mr-1"> / ليلة</span>
            <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-wider">
              أو حسب تاريخ رحلتك
            </p>
          </div>
        </div>

        <div className="border border-brand-50 rounded-2xl overflow-hidden mb-6 bg-surface shadow-sm">
          <div className="flex border-b border-brand-50 relative">
            <button
              type="button"
              className="p-4 flex-1 border-l border-brand-50 cursor-pointer hover:bg-gray-50 transition-colors text-right"
              onClick={() => setShowDatePicker(true)}
            >
              <div className="text-[10px] font-black text-brand-950 uppercase mb-1">الوصول</div>
              <div className="text-sm font-bold text-gray-900 truncate">{fmt(checkIn)}</div>
            </button>
            <button
              type="button"
              className="p-4 flex-1 cursor-pointer hover:bg-gray-50 transition-colors text-right"
              onClick={() => setShowDatePicker(true)}
            >
              <div className="text-[10px] font-black text-brand-950 uppercase mb-1">المغادرة</div>
              <div className="text-sm font-bold text-gray-900 truncate">{fmt(checkOut)}</div>
            </button>
          </div>
          <div
            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center relative"
            onClick={() => setShowGuestsModal((s) => !s)}
          >
            <div>
              <div className="text-[10px] font-black text-brand-950 uppercase mb-1">عدد الضيوف</div>
              <div className="text-sm font-bold text-gray-900">{guests} ضيوف</div>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showGuestsModal ? 'rotate-90' : ''}`} />

            <AnimatePresence>
              {showGuestsModal && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 shadow-xl rounded-2xl p-4 z-20"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">شخص بالغ</span>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full border flex items-center justify-center text-lg text-gray-500 disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); setGuests((g) => Math.max(1, g - 1)); }}
                        disabled={guests <= 1}
                      >-</button>
                      <span className="font-bold w-4 text-center tabular-nums">{guests}</span>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full border flex items-center justify-center text-lg text-gray-500 disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); setGuests((g) => Math.min(maxGuests, g + 1)); }}
                        disabled={guests >= maxGuests}
                      >+</button>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400 font-medium">الحد الأقصى {maxGuests} ضيوف</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <Button
          size="lg"
          onClick={goToCheckout}
          disabled={!canBook}
          className="w-full rounded-2xl py-8 text-xl bg-brand-950 hover:bg-brand-800 text-white font-black transition-all shadow-lg enabled:hover:scale-[1.02]"
        >
          {selectedRangeHasUnavailableNight
            ? 'هذه التواريخ غير متاحة'
            : canBook
              ? 'تابع الحجز'
              : 'اختر التواريخ'}
        </Button>

        <p className="text-xs text-center text-gray-500 mt-6 mb-2 font-medium">
          لن يتم سحب أي مبلغ نقدي الآن. تأكيد الحجز يتم بعد مراجعة التفاصيل.
        </p>

        {canBook && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 pt-6 border-t border-brand-50"
          >
            <div className="flex items-center gap-2 mb-2 text-brand-950 font-black text-sm">
              <Info size={14} className="text-accent-500" strokeWidth={1.5} /> تفاصيل السعر التقديرية
            </div>
            <div className="flex justify-between text-gray-500 font-medium text-sm">
              <span className="tabular-nums">
                {formatCurrency(basePrice)} × {nights} ليالي
              </span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between font-black text-brand-950 pt-4 border-t border-brand-50 text-2xl tracking-tighter">
              <span>الإجمالي التقديري</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Security banner */}
      <div className="mt-8 bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 relative overflow-hidden group shadow-soft">
        <div className="flex items-start gap-4 relative z-10">
          <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" strokeWidth={1.25} />
          <div>
            <h4 className="font-bold text-brand-950">حجز آمن 100%</h4>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed font-medium">
              نحن نضمن لك تطابق الوحدة مع الفيديو الفعلي. لا يتم تحويل أي مبالغ
              قبل مراجعة الـ Trust Pack الخاص بك بالكامل.
            </p>
          </div>
        </div>
      </div>

      {/* Date picker modal */}
      <AnimatePresence>
        {showDatePicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDatePicker(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-brand-950">اختيار التواريخ</h3>
                  <p className="text-gray-500 text-sm">
                    {unitName ? `لوحدة ${unitName}` : 'حدد تاريخ الوصول والمغادرة'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="flex justify-center">
                <DayPicker
                  mode="range"
                  locale={ar}
                  numberOfMonths={1}
                  selected={range}
                  onSelect={setRange}
                  startMonth={today}
                  endMonth={windowEnd}
                  excludeDisabled
                  disabled={[{ before: today }, { after: windowEnd }, ...unavailableDays]}
                  modifiers={{
                    blocked: blockedDays,
                    held: heldDays,
                  }}
                  modifiersClassNames={{
                    blocked: 'bg-red-50 text-red-800 line-through opacity-100',
                    held: 'bg-amber-50 text-amber-900 line-through opacity-100',
                    selected: 'bg-brand-950 text-white',
                    range_middle: 'bg-brand-100 text-brand-950',
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-4 border-t border-gray-100 pt-3 text-[11px] font-bold text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-red-50 ring-1 ring-red-200" />
                  محجوز
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-200" />
                  مطلوب حالياً
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRange(undefined)}
                  className="text-gray-500 font-bold underline"
                >
                  مسح التواريخ
                </button>
                <Button
                  onClick={() => setShowDatePicker(false)}
                  className="bg-brand-950 text-white rounded-xl px-8"
                >
                  تأكيد
                </Button>
              </div>

              {!availability && (
                <p className="mt-3 flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> جارٍ تحميل التواريخ المتاحة…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
