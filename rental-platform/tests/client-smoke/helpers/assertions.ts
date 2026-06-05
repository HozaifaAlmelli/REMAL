import { expect } from "@playwright/test";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?20|0)?1[0125][0-9]{8}\b/;

export function formatExpectedCurrency(amount: number): string {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

export function parseCurrencyText(value: string): number {
  const normalized = value.replace(/EGP/gi, "").replace(/,/g, "").trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`Could not parse currency from "${value}"`);
  return Number(match[0]);
}

export function expectMoneyFormat(value: string): void {
  expect(value).toMatch(/\d[\d,]*\.\d{2}\s*EGP/);
}

export function collectStringValues(value: unknown, path = "$"): string[] {
  if (typeof value === "string") return [`${path}: ${value}`];
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectStringValues(entry, `${path}[${index}]`)
    );
  }

  return Object.entries(value).flatMap(([key, entry]) =>
    collectStringValues(entry, `${path}.${key}`)
  );
}

export function expectNoPii(value: unknown, label: string): void {
  const strings = collectStringValues(value);
  const leaks = strings.filter(
    (entry) => EMAIL_PATTERN.test(entry) || PHONE_PATTERN.test(entry)
  );
  expect(leaks, `${label} must not expose phone/email strings`).toEqual([]);
}

export async function pollUntil<T>(
  producer: () => Promise<T>,
  predicate: (value: T) => boolean,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    description?: string;
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const intervalMs = options?.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;

  while (Date.now() <= deadline) {
    lastValue = await producer();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for ${options?.description ?? "condition"}. Last value: ${JSON.stringify(lastValue)}`
  );
}

export function generateFutureStay(offsetDays: number, nights: number) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + offsetDays);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + nights);

  const format = (date: Date) => date.toISOString().slice(0, 10);
  return {
    checkInDate: format(start),
    checkOutDate: format(end),
  };
}
