"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import {
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
  Info,
  Loader2,
  LogIn,
  CalendarX,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { platformAuthUrl } from "@/lib/auth/platform";
import { tokenStore } from "@/lib/auth/token-store";
import { useUnit, useUnitImages } from "@/lib/hooks/useCatalog";
import { availabilityService, bookingsService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/api-error";
import { getCoverImageUrl } from "@/lib/utils/image";
import {
  formatCurrency,
  formatDateForApi,
  getNights,
  parseDateOnly,
} from "@/lib/utils/format";

const PLATFORM_URL = (process.env.NEXT_PUBLIC_PLATFORM_URL ?? "").replace(/\/+$/, "");
const PHONE_PATTERN = /^\+?\d{10,15}$/;

type GuestContactForm = {
  firstName: string;
  lastName: string;
  phone: string;
};

type GuestContactErrors = Partial<Record<keyof GuestContactForm, string>>;

function getLastNightDate(checkOut: string): string {
  const lastNight = parseDateOnly(checkOut);
  lastNight.setDate(lastNight.getDate() - 1);
  return formatDateForApi(lastNight);
}

function buildNightDateStrings(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const current = parseDateOnly(checkIn);
  const endExclusive = parseDateOnly(checkOut);

  while (current < endExclusive) {
    dates.push(formatDateForApi(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function normalizePhoneInput(phone: string): string {
  return phone.trim().replace(/[\s()-]/g, "");
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get("unitId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = searchParams.get("guests") ?? "2";

  const { isAuthenticated, isReady } = useAuth();
  const { data: unit, isLoading } = useUnit(unitId);
  const images = useUnitImages(unitId);
  const cover = getCoverImageUrl(images);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [guestContact, setGuestContact] = useState<GuestContactForm>({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [guestErrors, setGuestErrors] = useState<GuestContactErrors>({});

  const hasDates = Boolean(checkIn && checkOut);
  const guestCount = Number(guests) || 1;
  const nights =
    checkIn && checkOut
      ? getNights(parseDateOnly(checkIn), parseDateOnly(checkOut))
      : 0;
  const basePrice = unit?.basePricePerNight ?? 0;
  const subtotal = nights * basePrice;
  const hasGuestCapacityConflict = Boolean(unit && guestCount > unit.maxGuests);

  const fmt = (value: string | null) =>
    value ? format(parseDateOnly(value), "d MMM yyyy", { locale: ar }) : "—";

  const updateGuestContact = (field: keyof GuestContactForm, value: string) => {
    setGuestContact((current) => ({ ...current, [field]: value }));
    setGuestErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateGuestContact = (): GuestContactForm | null => {
    const firstName = guestContact.firstName.trim();
    const lastName = guestContact.lastName.trim();
    const phone = normalizePhoneInput(guestContact.phone);
    const nextErrors: GuestContactErrors = {};

    if (!firstName) nextErrors.firstName = "اكتب الاسم الأول";
    if (!lastName) nextErrors.lastName = "اكتب اسم العائلة";
    if (!PHONE_PATTERN.test(phone)) {
      nextErrors.phone = "اكتب رقم هاتف صحيح من 10 إلى 15 رقم";
    }

    setGuestErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return { firstName, lastName, phone };
  };

  const submitBooking = async () => {
    if (isSubmitting || !unitId || !checkIn || !checkOut) return;
    setIsSubmitting(true);
    try {
      if (nights <= 0) {
        toast.error("اختر تاريخ وصول ومغادرة صحيحين قبل إرسال الطلب.");
        return;
      }

      if (hasGuestCapacityConflict) {
        toast.error(`هذه الوحدة تقبل حتى ${unit?.maxGuests} أفراد فقط.`);
        return;
      }

      const guestIdentity = isAuthenticated ? null : validateGuestContact();
      if (!isAuthenticated && !guestIdentity) return;

      const latestAvailability = await availabilityService.check(
        unitId,
        checkIn,
        getLastNightDate(checkOut)
      );
      const unavailableDates = new Set([
        ...(latestAvailability.blockedDates ?? []),
        ...(latestAvailability.heldDates ?? []),
      ]);
      const hasUnavailableNight = buildNightDateStrings(checkIn, checkOut).some(
        (date) => unavailableDates.has(date)
      );

      if (!latestAvailability.isAvailable || hasUnavailableNight) {
        toast.error("هذه التواريخ لم تعد متاحة. اختر تواريخ أخرى من صفحة الوحدة.");
        return;
      }

      const bookingPayload = {
        unitId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount,
      };

      if (isAuthenticated) {
        await bookingsService.createOwn(bookingPayload);
      } else if (guestIdentity) {
        const response = await bookingsService.createGuest({
          ...bookingPayload,
          ...guestIdentity,
        });
        tokenStore.setSession(response.auth.accessToken, response.auth.user);
      }

      setIsSuccess(true);
    } catch (err) {
      const message =
        err instanceof ApiError &&
        err.status === 409 &&
        err.message.toLowerCase().includes("account already exists")
          ? "هذا الرقم لديه حساب بالفعل. سجّل الدخول لتأكيد الحجز."
          : err instanceof ApiError && err.status === 409
          ? "هذه التواريخ تم طلبها أو حجزها للتو. اختر تواريخ أخرى."
          : err instanceof ApiError
          ? err.message
          : "تعذر إتمام الحجز. حاول مرة أخرى.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrimary = () => {
    void submitBooking();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F9] pt-32 pb-20 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-[#F7F7F9] pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h1 className="text-2xl font-black text-brand-950 mb-3">الوحدة غير متاحة</h1>
          <p className="text-gray-500 mb-8">قد تكون الوحدة غير نشطة أو تم حذفها.</p>
          <Link href="/search">
            <span className="inline-flex rounded-xl bg-brand-950 px-8 py-4 font-bold text-white">
              تصفّح الوحدات
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F9] pt-32 pb-20 font-sans">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link
          href={`/units/${unit.id}`}
          className="flex items-center gap-2 text-gray-500 hover:text-brand-950 mb-8 w-fit transition-colors font-bold"
        >
          <ChevronRight className="w-5 h-5" />
          <span>العودة لتفاصيل الوحدة</span>
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-brand-950 mb-3 tracking-tight">
            تأكيد طلب الحجز
          </h1>
          <p className="text-gray-500 text-lg font-medium">
            راجع تفاصيل إقامتك ثم أرسل طلب الحجز ليتابعه فريقنا.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {/* Details */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100">
              <h2 className="text-2xl font-black text-brand-950 mb-8">تفاصيل الإقامة</h2>

              {!hasDates ? (
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-amber-800">
                  <CalendarX className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">لم يتم اختيار التواريخ</p>
                    <p className="text-sm mt-1">
                      ارجع لصفحة الوحدة واختر تاريخ الوصول والمغادرة لإتمام الحجز.
                    </p>
                    <Link
                      href={`/units/${unit.id}`}
                      className="mt-3 inline-block font-bold underline"
                    >
                      اختيار التواريخ
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase mb-2">الوصول</div>
                    <div className="text-lg font-bold text-brand-950 tabular-nums">{fmt(checkIn)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase mb-2">المغادرة</div>
                    <div className="text-lg font-bold text-brand-950 tabular-nums">{fmt(checkOut)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase mb-2">عدد الليالي</div>
                    <div className="text-lg font-bold text-brand-950 tabular-nums">{nights}</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase mb-2">عدد الضيوف</div>
                    <div className="text-lg font-bold text-brand-950 tabular-nums">{guestCount}</div>
                  </div>
                </div>
              )}

              {hasGuestCapacityConflict && (
                <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                  هذه الوحدة تقبل حتى {unit.maxGuests} أفراد فقط. عدّل عدد الضيوف من صفحة الوحدة.
                </div>
              )}
            </div>

            {isReady && !isAuthenticated && (
              <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100">
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-brand-950 mb-2">بيانات التواصل</h2>
                  <p className="text-gray-500 leading-relaxed font-medium">
                    نحتاج الاسم ورقم الهاتف فقط لإرسال طلبك ومتابعته مع فريق الحجوزات.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-brand-950">
                      الاسم الأول
                    </span>
                    <input
                      value={guestContact.firstName}
                      onChange={(event) =>
                        updateGuestContact("firstName", event.target.value)
                      }
                      autoComplete="given-name"
                      aria-invalid={Boolean(guestErrors.firstName)}
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-brand-950 outline-none transition-colors focus:border-brand-500 focus:bg-white"
                    />
                    {guestErrors.firstName && (
                      <span className="mt-2 block text-xs font-bold text-red-600">
                        {guestErrors.firstName}
                      </span>
                    )}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-brand-950">
                      اسم العائلة
                    </span>
                    <input
                      value={guestContact.lastName}
                      onChange={(event) =>
                        updateGuestContact("lastName", event.target.value)
                      }
                      autoComplete="family-name"
                      aria-invalid={Boolean(guestErrors.lastName)}
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-brand-950 outline-none transition-colors focus:border-brand-500 focus:bg-white"
                    />
                    {guestErrors.lastName && (
                      <span className="mt-2 block text-xs font-bold text-red-600">
                        {guestErrors.lastName}
                      </span>
                    )}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-black text-brand-950">
                      رقم الهاتف
                    </span>
                    <input
                      value={guestContact.phone}
                      onChange={(event) =>
                        updateGuestContact("phone", event.target.value)
                      }
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      placeholder="01000000000"
                      aria-invalid={Boolean(guestErrors.phone)}
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-left text-brand-950 outline-none transition-colors focus:border-brand-500 focus:bg-white"
                    />
                    {guestErrors.phone && (
                      <span className="mt-2 block text-xs font-bold text-red-600">
                        {guestErrors.phone}
                      </span>
                    )}
                  </label>
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-brand-50 p-4 text-sm font-bold text-brand-950 sm:flex-row sm:items-center sm:justify-between">
                  <span>لديك حساب بالفعل؟</span>
                  <button
                    type="button"
                    onClick={() =>
                      window.location.assign(
                        platformAuthUrl("login", window.location.href)
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-white px-4 py-2 text-brand-950 transition-colors hover:border-brand-300"
                  >
                    <LogIn className="h-4 w-4" />
                    تسجيل الدخول
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100">
              <h2 className="text-2xl font-black text-brand-950 mb-6 flex items-center gap-3">
                <ShieldCheck className="text-emerald-500" /> ماذا يحدث بعد الإرسال؟
              </h2>
              <p className="text-gray-500 leading-relaxed font-medium">
                يصل طلبك لفريق Kaza Booking كـ «طلب مبدئي». نراجع توفّر التاريخ،
                نرسل لك فيديو فعلي وتفاصيل السعر الرسمية، ونتابع معك خطوات تأكيد
                الحجز والعربون. لن يتم خصم أي مبلغ الآن.
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 sticky top-32">
              <div className="flex gap-4 mb-8">
                {cover ? (
                  <img
                    src={cover}
                    alt={unit.name}
                    className="w-24 h-24 object-cover rounded-2xl shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-100 to-gray-100 shrink-0" />
                )}
                <div className="flex flex-col justify-center">
                  <div className="text-[10px] text-accent-600 font-black uppercase mb-1" dir="auto">
                    {unit.unitType}
                  </div>
                  <h3 className="font-black text-brand-950 leading-tight" dir="auto">
                    {unit.name}
                  </h3>
                </div>
              </div>

              {hasDates && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2 text-brand-950 font-black text-sm">
                    <Info size={14} className="text-accent-500" /> تفاصيل السعر التقديرية
                  </div>
                  <div className="flex justify-between text-gray-500 font-medium text-sm">
                    <span className="tabular-nums">
                      {formatCurrency(basePrice)} × {nights} ليالي
                    </span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-black text-brand-950 pt-4 border-t border-gray-100 text-xl">
                    <span>الإجمالي التقديري</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              )}

              {isSuccess ? (
                <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="font-black text-brand-950 mb-1">تم استلام طلب حجزك!</p>
                  <p className="text-sm text-gray-500 mb-4">
                    يمكنك متابعة حالة الطلب من حسابك.
                  </p>
                  {PLATFORM_URL && (
                    <a
                      href={`${PLATFORM_URL}/account/bookings`}
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-brand-950 py-4 font-black text-white"
                    >
                      عرض حجوزاتي
                    </a>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePrimary}
                  disabled={!hasDates || hasGuestCapacityConflict || isSubmitting || !isReady}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-950 py-5 text-lg font-black text-white shadow-lg transition-all enabled:hover:scale-[1.02] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> جارٍ إرسال الطلب…
                    </>
                  ) : !isReady ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> لحظة…
                    </>
                  ) : isAuthenticated ? (
                    <>تأكيد طلب الحجز</>
                  ) : (
                    <>إرسال طلب الحجز</>
                  )}
                </button>
              )}

              <a
                href="https://wa.me/201000082960"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" /> استفسار عبر واتساب
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[#F7F7F9] pt-32 pb-20" />}
    >
      <CheckoutContent />
    </Suspense>
  );
}
