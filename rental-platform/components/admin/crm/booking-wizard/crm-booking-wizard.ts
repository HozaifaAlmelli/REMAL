import type { CrmLeadDetailsResponse } from "@/lib/types/crm.types";
import { UNIT_NO_LONGER_AVAILABLE } from "@/lib/constants/crm-recommendation";

export type CrmBookingWizardLocale = "en" | "ar";
export type CrmBookingWizardStepId =
  | "stay"
  | "unit"
  | "client"
  | "booking"
  | "review";
export type CrmBookingWizardStepStatus =
  | "current"
  | "completed"
  | "upcoming"
  | "blocked";

export interface CrmBookingWizardDomainState {
  checkInDate: string;
  checkOutDate: string;
  selectedUnitId: string | null;
  clientId: string | null;
  guestCount: number;
  hasGuestCapacityConflict: boolean;
}

export interface CrmBookingWizardStep {
  id: CrmBookingWizardStepId;
  label: string;
  status: CrmBookingWizardStepStatus;
  isRequired: true;
  isComplete: boolean;
  isVisible: boolean;
  isBlocked: boolean;
  validate: (state: CrmBookingWizardDomainState) => boolean;
}

interface BuildWizardStepsOptions {
  locale: CrmBookingWizardLocale;
  currentStep: CrmBookingWizardStepId;
  state: CrmBookingWizardDomainState;
  requiresStayStep: boolean;
  requiresUnitStep: boolean;
  requiresClientStep: boolean;
}

export const CRM_BOOKING_WIZARD_COPY = {
  en: {
    direction: "ltr" as const,
    title: "Create booking from lead",
    description:
      "Complete one task at a time. Your selections are kept until the booking is created.",
    steps: {
      stay: "Stay details",
      unit: "Choose unit",
      client: "Client",
      booking: "Booking details",
      review: "Review and create",
    },
    stepCount: (current: number, total: number) =>
      `Step ${current} of ${total}`,
    back: "Back",
    continue: "Continue",
    createBooking: "Create booking",
    chooseUnitTitle: "Choose an available unit",
    chooseUnitDescription:
      "Choose from units currently available for the requested stay. Availability will be checked again when the booking is created.",
    noUnits: "No available units were found for the selected stay.",
    searchUnits: "Search units by name or project",
    loadingUnits: "Loading available units…",
    retry: "Try again",
    allTypes: "All",
    refreshing: "Refreshing…",
    availableCount: (count: number) =>
      `${count} ${count === 1 ? "unit" : "units"} available`,
    noSearchResults: (query: string) => `No units match “${query}”.`,
    selected: "Selected",
    stayTitle: "Stay details",
    stayDescription:
      "Add the missing dates so availability can be checked before choosing a unit.",
    checkIn: "Check-in",
    checkOut: "Check-out",
    stayDateError: "Check-out must be after check-in.",
    stayLockedError:
      "These lead dates are invalid and must be corrected on the lead before conversion.",
    clientTitle: "Create or attach a client",
    clientDescription:
      "Create a client from the lead’s contact details. If the phone number or email already exists, the existing client will be attached.",
    fullName: "Full name",
    phone: "Phone number",
    emailOptional: "Email (optional)",
    createOrAttach: "Create or attach client",
    linkedClient: "Linked client",
    changeClient: "Change",
    clientRequired: "Enter the client name.",
    phoneInvalid: "Enter 10 to 15 digits, optionally starting with +.",
    emailInvalid: "Enter a valid email address.",
    clientLookupError:
      "The client could not be created or attached. Review the details and try again.",
    matchedExisting: "An existing client was found and attached.",
    temporaryPassword: "Temporary password",
    temporaryPasswordHint:
      "This password is shown once. Share it with the client securely.",
    copyPassword: "Copy temporary password",
    copied: "Copied",
    bookingTitle: "Booking details",
    bookingDescription:
      "Confirm the operational details that will be saved with the booking.",
    guests: "Guests",
    internalNotes: "Internal notes (optional)",
    notesPlaceholder: "Add context for operations or finance",
    guestMinimum: "At least one guest is required.",
    capacity: (name: string, count: number) =>
      `${name} accepts up to ${count} ${count === 1 ? "guest" : "guests"}.`,
    reviewTitle: "Review and create",
    reviewDescription:
      "Check the booking details before the final availability check.",
    stayGroup: "Stay",
    unitGroup: "Unit",
    clientGroup: "Client",
    bookingGroup: "Booking details",
    edit: "Edit",
    nights: (count: number) => `${count} ${count === 1 ? "night" : "nights"}`,
    guestCount: (count: number) =>
      `${count} ${count === 1 ? "guest" : "guests"}`,
    perNight: "per night",
    noNotes: "No internal notes",
    availabilityNotice:
      "The unit is not reserved until the booking is successfully created. Availability will be checked again when you confirm.",
    conflict: UNIT_NO_LONGER_AVAILABLE,
    availabilityChecking: "Checking availability",
    availabilityUnavailable: "Unavailable",
    unitLoadError:
      "Available units could not be loaded. Check your connection and try again.",
    leadSummary: "Lead summary",
    requestedStay: "Requested stay",
    notProvided: "Not provided",
    unit: "Unit",
    client: "Client",
    bookingError:
      "The booking could not be created. Your entries have been preserved.",
    currentStep: "Current step",
    completedStep: "Completed step",
    upcomingStep: "Upcoming step",
    blockedStep: "Complete the previous step first",
  },
  ar: {
    direction: "rtl" as const,
    title: "إنشاء حجز من الـ Lead",
    description:
      "أكمل كل مهمة على حدة. سيتم الاحتفاظ باختياراتك حتى إنشاء الحجز.",
    steps: {
      stay: "تفاصيل الإقامة",
      unit: "اختيار الوحدة",
      client: "العميل",
      booking: "تفاصيل الحجز",
      review: "مراجعة وإنشاء الحجز",
    },
    stepCount: (current: number, total: number) =>
      `الخطوة ${current} من ${total}`,
    back: "رجوع",
    continue: "متابعة",
    createBooking: "إنشاء الحجز",
    chooseUnitTitle: "اختر وحدة متاحة",
    chooseUnitDescription:
      "اختر من الوحدات المتاحة حاليًا خلال فترة الإقامة المطلوبة. سيتم التحقق من التوفر مرة أخرى عند إنشاء الحجز.",
    noUnits: "لا توجد وحدات متاحة خلال فترة الإقامة المحددة.",
    searchUnits: "ابحث باسم الوحدة أو المشروع",
    loadingUnits: "جارٍ تحميل الوحدات المتاحة…",
    retry: "إعادة المحاولة",
    allTypes: "الكل",
    refreshing: "جارٍ التحديث…",
    availableCount: (count: number) => `${count} وحدة متاحة`,
    noSearchResults: (query: string) =>
      `لا توجد وحدات مطابقة لعبارة «${query}».`,
    selected: "تم الاختيار",
    stayTitle: "تفاصيل الإقامة",
    stayDescription:
      "أضف التواريخ الناقصة حتى يمكن التحقق من التوفر قبل اختيار الوحدة.",
    checkIn: "تسجيل الوصول",
    checkOut: "تسجيل المغادرة",
    stayDateError: "يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول.",
    stayLockedError:
      "تواريخ الـ Lead غير صالحة ويجب تصحيحها قبل التحويل إلى حجز.",
    clientTitle: "إنشاء أو ربط عميل",
    clientDescription:
      "أنشئ عميلًا من بيانات الـ Lead. إذا كان رقم الهاتف أو البريد الإلكتروني موجودًا بالفعل، فسيتم ربط العميل الموجود.",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    emailOptional: "البريد الإلكتروني (اختياري)",
    createOrAttach: "إنشاء أو ربط العميل",
    linkedClient: "العميل المرتبط",
    changeClient: "تغيير",
    clientRequired: "أدخل اسم العميل.",
    phoneInvalid: "أدخل من 10 إلى 15 رقمًا، ويمكن أن يبدأ الرقم بعلامة +.",
    emailInvalid: "أدخل بريدًا إلكترونيًا صالحًا.",
    clientLookupError:
      "تعذر إنشاء العميل أو ربطه. راجع البيانات وحاول مرة أخرى.",
    matchedExisting: "تم العثور على عميل موجود وربطه.",
    temporaryPassword: "كلمة المرور المؤقتة",
    temporaryPasswordHint:
      "تظهر كلمة المرور هذه مرة واحدة. شاركها مع العميل بطريقة آمنة.",
    copyPassword: "نسخ كلمة المرور المؤقتة",
    copied: "تم النسخ",
    bookingTitle: "تفاصيل الحجز",
    bookingDescription:
      "أكد التفاصيل التشغيلية التي سيتم حفظها مع الحجز.",
    guests: "عدد الضيوف",
    internalNotes: "ملاحظات داخلية (اختياري)",
    notesPlaceholder: "أضف سياقًا لفريق التشغيل أو المالية",
    guestMinimum: "مطلوب ضيف واحد على الأقل.",
    capacity: (name: string, count: number) =>
      `${name} تستوعب حتى ${count} ضيف.`,
    reviewTitle: "مراجعة وإنشاء الحجز",
    reviewDescription:
      "راجع تفاصيل الحجز قبل التحقق النهائي من التوفر.",
    stayGroup: "الإقامة",
    unitGroup: "الوحدة",
    clientGroup: "العميل",
    bookingGroup: "تفاصيل الحجز",
    edit: "تعديل",
    nights: (count: number) => `${count} ليلة`,
    guestCount: (count: number) => `${count} ضيف`,
    perNight: "لليلة",
    noNotes: "لا توجد ملاحظات داخلية",
    availabilityNotice:
      "لا تعتبر الوحدة محجوزة إلا بعد إنشاء الحجز بنجاح. سيتم التحقق من التوفر مرة أخرى عند التأكيد.",
    conflict:
      "الوحدة المحددة لم تعد متاحة خلال هذه التواريخ. اختر وحدة أخرى متاحة للمتابعة.",
    availabilityChecking: "جارٍ التحقق من التوفر",
    availabilityUnavailable: "غير متاحة",
    unitLoadError:
      "تعذر تحميل الوحدات المتاحة. تحقق من الاتصال وحاول مرة أخرى.",
    leadSummary: "ملخص الـ Lead",
    requestedStay: "الإقامة المطلوبة",
    notProvided: "غير متوفر",
    unit: "الوحدة",
    client: "العميل",
    bookingError:
      "تعذر إنشاء الحجز. تم الاحتفاظ بجميع البيانات التي أدخلتها.",
    currentStep: "الخطوة الحالية",
    completedStep: "خطوة مكتملة",
    upcomingStep: "خطوة قادمة",
    blockedStep: "أكمل الخطوة السابقة أولًا",
  },
} as const;

export type CrmBookingWizardCopy =
  (typeof CRM_BOOKING_WIZARD_COPY)[CrmBookingWizardLocale];

export function isValidStayRange(checkIn: string, checkOut: string): boolean {
  return Boolean(checkIn && checkOut && checkOut > checkIn);
}

export function requiresStayDetailsStep(
  lead: CrmLeadDetailsResponse
): boolean {
  return !isValidStayRange(
    lead.desiredCheckInDate ?? "",
    lead.desiredCheckOutDate ?? ""
  );
}

export function getInitialWizardStep(
  lead: CrmLeadDetailsResponse
): CrmBookingWizardStepId {
  if (requiresStayDetailsStep(lead)) return "stay";
  if (lead.needsRecommendation && !lead.targetUnitId) return "unit";
  if (!lead.clientId) return "client";
  return "booking";
}

export function buildCrmBookingWizardSteps({
  locale,
  currentStep,
  state,
  requiresStayStep,
  requiresUnitStep,
  requiresClientStep,
}: BuildWizardStepsOptions): CrmBookingWizardStep[] {
  const copy = CRM_BOOKING_WIZARD_COPY[locale];
  const definitions: Array<
    Omit<
      CrmBookingWizardStep,
      "status" | "isComplete" | "isBlocked"
    >
  > = [
    {
      id: "stay",
      label: copy.steps.stay,
      isRequired: true,
      isVisible: requiresStayStep,
      validate: (value) =>
        isValidStayRange(value.checkInDate, value.checkOutDate),
    },
    {
      id: "unit",
      label: copy.steps.unit,
      isRequired: true,
      isVisible: requiresUnitStep,
      validate: (value) => Boolean(value.selectedUnitId),
    },
    {
      id: "client",
      label: copy.steps.client,
      isRequired: true,
      isVisible: requiresClientStep,
      validate: (value) => Boolean(value.clientId),
    },
    {
      id: "booking",
      label: copy.steps.booking,
      isRequired: true,
      isVisible: true,
      validate: (value) =>
        Number.isInteger(value.guestCount) &&
        value.guestCount >= 1 &&
        !value.hasGuestCapacityConflict,
    },
    {
      id: "review",
      label: copy.steps.review,
      isRequired: true,
      isVisible: true,
      validate: () => false,
    },
  ];

  const visible = definitions.filter((step) => step.isVisible);

  return visible.map((definition, index) => {
    const isComplete = definition.validate(state);
    const priorIncomplete = visible
      .slice(0, index)
      .some((step) => !step.validate(state));
    const isBlocked = priorIncomplete && definition.id !== currentStep;
    const status: CrmBookingWizardStepStatus =
      definition.id === currentStep
        ? "current"
        : isComplete
          ? "completed"
          : isBlocked
            ? "blocked"
            : "upcoming";

    return {
      ...definition,
      status,
      isComplete,
      isBlocked,
    };
  });
}
