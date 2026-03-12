/**
 * Timezone utilities — convert timestamps between timezones and format
 * times for users in different zones.
 */

/** Get the user's local timezone string (e.g. "America/New_York"). */
export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Format an ISO timestamp in a specific timezone. */
export function formatInTimezone(
  isoTimestamp: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(isoTimestamp);
  const defaults: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    ...options,
  };
  return new Intl.DateTimeFormat("en-US", defaults).format(date);
}

/** Get the UTC offset string for a timezone (e.g. "+05:30", "-08:00"). */
export function getUtcOffset(timezone: string, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  if (!tzPart) return "+00:00";
  // Format: "GMT+5:30" or "GMT-8" or "GMT"
  const match = tzPart.value.match(/GMT([+-]?\d{1,2}(?::?\d{2})?)?/);
  if (!match || !match[1]) return "+00:00";
  const raw = match[1];
  const sign = raw.startsWith("-") ? "-" : "+";
  const abs = raw.replace(/^[+-]/, "");
  const [h, m] = abs.includes(":") ? abs.split(":") : [abs, "0"];
  return `${sign}${h.padStart(2, "0")}:${(m || "0").padStart(2, "0")}`;
}

/** Calculate the time difference in hours between two timezones. */
export function hourDifference(tzA: string, tzB: string, date: Date = new Date()): number {
  const offsetA = getOffsetMinutes(tzA, date);
  const offsetB = getOffsetMinutes(tzB, date);
  return (offsetB - offsetA) / 60;
}

/** Internal: get offset in minutes from UTC for a timezone. */
function getOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return (tzDate.getTime() - utcDate.getTime()) / 60_000;
}

/** Check if a timezone string is valid. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Format "User's local time" label for display in headers. */
export function formatLocalTimeLabel(timezone: string): string {
  const now = new Date();
  const time = formatInTimezone(now.toISOString(), timezone);
  const offset = getUtcOffset(timezone, now);
  return `${time} (UTC${offset})`;
}

/** Get a list of common timezone options for a dropdown. */
export function commonTimezones(): { value: string; label: string }[] {
  return [
    { value: "America/New_York", label: "Eastern Time (US)" },
    { value: "America/Chicago", label: "Central Time (US)" },
    { value: "America/Denver", label: "Mountain Time (US)" },
    { value: "America/Los_Angeles", label: "Pacific Time (US)" },
    { value: "Europe/London", label: "London" },
    { value: "Europe/Berlin", label: "Berlin" },
    { value: "Europe/Paris", label: "Paris" },
    { value: "Asia/Tokyo", label: "Tokyo" },
    { value: "Asia/Shanghai", label: "Shanghai" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Australia/Sydney", label: "Sydney" },
    { value: "Pacific/Auckland", label: "Auckland" },
    { value: "UTC", label: "UTC" },
  ];
}
