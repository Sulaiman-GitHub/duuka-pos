// The business operates in Uganda (UTC+3, no DST). Servers run in UTC, so day boundaries are computed explicitly.
const OFFSET_MS = 3 * 60 * 60 * 1000;

/** Start (as a UTC Date) of the Kampala calendar day that contains `d`. */
export function startOfKampalaDay(d = new Date()) {
  const local = new Date(d.getTime() + OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - OFFSET_MS);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** yyyy-mm-dd for the Kampala day containing `d`. */
export function kampalaDateString(d = new Date()) {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Parse a yyyy-mm-dd string as the start of that Kampala day. Returns null if invalid. */
export function parseKampalaDate(s: string | undefined | null) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(d);

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", dateStyle: "medium" }).format(d);
