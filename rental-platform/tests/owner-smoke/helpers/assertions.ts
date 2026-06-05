import { expect } from "@playwright/test";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const EGYPT_PHONE_RE = /(^|[^\d])(?:\+?2?01[0125]\d{8})([^\d]|$)/;
const PII_FIELD_RE = /(email|phone|mobile|contactEmail|contactPhone)/i;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? String(value);
}

export function findPiiLeaks(value: unknown, path = "$"): string[] {
  const leaks: string[] = [];

  if (typeof value === "string") {
    if (EMAIL_RE.test(value) || EGYPT_PHONE_RE.test(value)) {
      leaks.push(`${path}: ${value}`);
    }
    return leaks;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      leaks.push(...findPiiLeaks(item, `${path}[${index}]`));
    });
    return leaks;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, nested]) => {
      const nestedPath = `${path}.${key}`;
      if (
        PII_FIELD_RE.test(key) &&
        nested !== null &&
        nested !== undefined &&
        describeValue(nested).trim() !== ""
      ) {
        leaks.push(`${nestedPath}: ${describeValue(nested)}`);
      }
      leaks.push(...findPiiLeaks(nested, nestedPath));
    });
  }

  return leaks;
}

export function expectNoPiiInPayload(value: unknown, label: string): void {
  const leaks = findPiiLeaks(value);
  expect(leaks, `${label} contains PII leaks:\n${leaks.join("\n")}`).toEqual(
    []
  );
}

export function expectNoPiiInText(text: string, label: string): void {
  expect(text, `${label} contains an email address`).not.toMatch(EMAIL_RE);
  expect(text, `${label} contains an Egyptian phone number`).not.toMatch(
    EGYPT_PHONE_RE
  );
}

export function parseCurrencyAmount(text: string): number {
  const match = text.match(/[\d,.]+/);
  return match ? Number.parseFloat(match[0].replace(/,/g, "")) : 0;
}

export function formatExpectedCurrency(amount: number): string {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

export function expectTwoDecimalCurrency(text: string): void {
  expect(text).toMatch(/[\d,]+\.\d{2}\s+EGP/);
}

export async function pollUntil<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    description?: string;
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const intervalMs = options?.intervalMs ?? 500;
  const startedAt = Date.now();
  let lastValue = await read();

  while (!predicate(lastValue)) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `Timed out waiting for ${options?.description ?? "condition"}. Last value: ${JSON.stringify(
          lastValue
        )}`
      );
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
    lastValue = await read();
  }

  return lastValue;
}
