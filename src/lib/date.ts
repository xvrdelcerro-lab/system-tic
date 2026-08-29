import { format } from "date-fns";

type FirestoreTimestampLike = { toDate: () => Date };

/* ---------------- CORE SAFE PARSER ---------------- */

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  // Firestore Timestamp
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as FirestoreTimestampLike).toDate();
    } catch {
      return null;
    }
  }

  // ISO or date strings
  if (typeof value === "string") {
    // Fix YYYY-MM-DD parsing as UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const local = new Date(y, m - 1, d);
      return Number.isNaN(local.getTime()) ? null : local;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // epoch millis
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/* ---------------- FORMATTING HELPERS ---------------- */

/** Date only (existing behavior, keep it) */
export function formatDateSafe(value: unknown): string {
  const d = toDateSafe(value);
  if (!d) return "";
  return format(d, "MMM-dd-yy");
}

/** ✅ Date + time (LOCAL timezone) — use this for reports */
export function formatDateTimeSafe(
  value: unknown,
  pattern = "MMM-dd-yy 'at' HH:mm"
): string {
  const d = toDateSafe(value);
  if (!d) return "";
  return format(d, pattern);
}

/** ✅ Local ISO-like string (never UTC) */
export function toLocalISOString(value: unknown): string {
  const d = toDateSafe(value);
  if (!d) return "";

  const offsetMs = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offsetMs);

  return local.toISOString().slice(0, 19);
}
