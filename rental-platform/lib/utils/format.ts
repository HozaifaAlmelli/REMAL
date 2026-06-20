import { differenceInDays, format, parseISO, isValid } from "date-fns";

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount))
    return "—";
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

// Keep only digits and a single optional leading '+'.
export function sanitizePhoneInput(value: string): string {
  const plus = value.trimStart().startsWith("+") ? "+" : "";
  return plus + value.replace(/\D/g, "");
}

export function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatDateForApi(new Date());
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day);
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? parseISO(input) : input;
  if (!isValid(date)) return "—";
  return format(date, "d MMM yyyy");
}

export function maskPhone(phone: string): string {
  if (!phone) return "—";
  if (phone.length <= 4) return phone;
  return "••••••" + phone.slice(-4);
}

export function formatDateLong(
  input: string | Date | null | undefined
): string {
  if (!input) return "—";
  const date = typeof input === "string" ? parseISO(input) : input;
  if (!isValid(date)) return "—";
  return format(date, "EEEE, d MMMM yyyy");
}

export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start || !end) return "—";
  const startDate = typeof start === "string" ? parseISO(start) : start;
  const endDate = typeof end === "string" ? parseISO(end) : end;
  if (!isValid(startDate) || !isValid(endDate)) return "—";
  return `${formatDate(startDate)} → ${formatDate(endDate)}`;
}

export function getNights(
  checkIn: string | Date | null | undefined,
  checkOut: string | Date | null | undefined
): number {
  if (!checkIn || !checkOut) return 0;
  const a = typeof checkIn === "string" ? parseISO(checkIn) : checkIn;
  const b = typeof checkOut === "string" ? parseISO(checkOut) : checkOut;
  if (!isValid(a) || !isValid(b)) return 0;
  return Math.max(0, differenceInDays(b, a));
}

export function formatRelativeTime(
  input: string | Date | null | undefined
): string {
  if (!input) return "—";
  const date = typeof input === "string" ? parseISO(input) : input;
  if (!isValid(date)) return "—";
  const now = new Date();
  const diffDays = differenceInDays(now, date);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7 && diffDays > 0) return `${diffDays} days ago`;
  return formatDate(date);
}

export function formatRelativeTimeSafe(
  input: string | Date | null | undefined
): string {
  if (!input) return "—";
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else {
    let str = input;
    // If the string lacks timezone indicator (Z or offset), append Z to parse as UTC
    if (typeof str === "string" && !str.endsWith("Z") && !str.includes("+") && !/[-+]\d{2}:\d{2}$/.test(str)) {
      str = str.includes("T") ? `${str}Z` : `${str.replace(" ", "T")}Z`;
    }
    date = parseISO(str);
  }

  if (!isValid(date)) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  // Stale Local Storage Clocks: cap negative or small positive diffs at "Just now"
  if (diffSec < 10) {
    return "Just now";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 1) {
    return "Just now";
  }
  if (diffMin === 1) {
    return "1 minute ago";
  }
  if (diffMin < 60) {
    return `${diffMin} minutes ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) {
    return "1 hour ago";
  }
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return format(date, "d MMM yyyy");
}

