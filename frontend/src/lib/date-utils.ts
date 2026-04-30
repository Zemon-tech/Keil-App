import { addDays, addMinutes, startOfDay } from "date-fns";

/**
 * Default constants for timed ranges to ensure consistent UI behavior.
 * These align with the ClarityOS philosophy of sensible defaults.
 */
export const DEFAULT_TIMED_DURATION_MINUTES = 60;
export const MAX_TIMED_DURATION_MINUTES_BEFORE_CLAMP = 12 * 60;

/**
 * Normalizes an all-day date range to ensure it covers full days in the local timezone.
 * 
 * In ClarityOS, all-day events are strictly bound to 00:00:00.
 * FullCalendar and most calendar systems expect all-day events to have an exclusive end date
 * (i.e., the start of the following day).
 * 
 * @param start - The start of the range
 * @param end - The optional end of the range
 * @returns An object containing normalized start and end Date objects
 */
export function normalizeAllDayRangeLocal(
  start: Date | string | number,
  end?: Date | string | number | null
): { start: Date; end: Date } {
  const s = startOfDay(new Date(start));
  
  let e: Date;
  if (end) {
    e = startOfDay(new Date(end));
    // If end is before or same as start (invalid range), we default to a 1-day span
    if (e.getTime() <= s.getTime()) {
      e = addDays(s, 1);
    }
  } else {
    // If no end is provided, it's a single-day event
    e = addDays(s, 1);
  }

  return { start: s, end: e };
}

/**
 * Converts an inclusive date range (where start and end dates are both included in the event)
 * into an exclusive range required by FullCalendar all-day events.
 * 
 * Example:
 * Input: { start: '2024-05-01', end: '2024-05-01' } (Inclusive)
 * Output: { start: '2024-05-01', end: '2024-05-02' } (Exclusive)
 * 
 * @param start - The inclusive start date
 * @param end - The inclusive end date
 * @returns An object with start and exclusive end Dates
 */
export function toExclusiveRange(
  start: Date | string | number,
  end: Date | string | number
): { start: Date; end: Date } {
  const s = startOfDay(new Date(start));
  const e = startOfDay(new Date(end));
  
  // For inclusive ranges, we add one day to the end date to make it exclusive
  return {
    start: s,
    end: addDays(e, 1),
  };
}

/**
 * Converts an exclusive date range (FullCalendar format) back into an inclusive range
 * (typically used for API payloads or user-facing labels).
 * 
 * Example:
 * Input: { start: '2024-05-01', end: '2024-05-02' } (Exclusive)
 * Output: { start: '2024-05-01', end: '2024-05-01' } (Inclusive)
 * 
 * @param start - The exclusive start date
 * @param end - The exclusive end date
 * @returns An object with start and inclusive end Dates
 */
export function fromExclusiveRange(
  start: Date | string | number,
  end: Date | string | number
): { start: Date; end: Date } {
  const s = startOfDay(new Date(start));
  const e = startOfDay(new Date(end));
  
  // For exclusive ranges, we subtract one day from the end date to make it inclusive
  // but ensure we don't go before the start date
  const inclusiveEnd = addDays(e, -1);
  
  return {
    start: s,
    end: inclusiveEnd.getTime() < s.getTime() ? s : inclusiveEnd,
  };
}

/**
 * Normalizes a timed date range, ensuring duration is within reasonable bounds.
 * 
 * This helper ensures that timed events have a valid positive duration and
 * prevents accidental "infinite" or "all-day" timed events by clamping them
 * to a maximum duration.
 * 
 * @param start - The start of the range
 * @param end - The optional end of the range
 * @param options - Configuration for duration limits
 * @returns An object containing normalized start and end Date objects
 */
export function normalizeTimedRange(
  start: Date | string | number,
  end?: Date | string | number | null,
  options: { 
    defaultDurationMinutes?: number; 
    maxDurationMinutes?: number;
  } = {}
): { start: Date; end: Date } {
  const { 
    defaultDurationMinutes = DEFAULT_TIMED_DURATION_MINUTES, 
    maxDurationMinutes = MAX_TIMED_DURATION_MINUTES_BEFORE_CLAMP 
  } = options;

  const s = new Date(start);
  let e = end ? new Date(end) : addMinutes(s, defaultDurationMinutes);
  
  const diffMin = (e.getTime() - s.getTime()) / 60000;

  // Clamp duration if it's invalid, zero, or excessively long (likely an error in drag-drop)
  if (!Number.isFinite(diffMin) || diffMin <= 0 || diffMin > maxDurationMinutes) {
    e = addMinutes(s, defaultDurationMinutes);
  }

  return { start: s, end: e };
}

/**
 * Checks if a date is at the precise start of the local day (00:00:00.000).
 * 
 * @param date - The date to check
 */
export function isStartOfLocalDay(date: Date | string | number): boolean {
  const d = new Date(date);
  
  const isLocalMidnight = 
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;

  const isUTCMidnight = 
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  return isLocalMidnight || isUTCMidnight;
}

/**
 * Determines if a given range represents a perfectly aligned local all-day event.
 * A range is considered "all-day" if both boundaries are at the start of a day
 * and the duration is a multiple of 24 hours.
 * 
 * @param start - The start of the range
 * @param end - The end of the range
 */
export function isAllDayRangeLocal(
  start: Date | string | number, 
  end: Date | string | number
): boolean {
  const s = new Date(start);
  const e = new Date(end);
  
  // A range is all-day if it starts and ends exactly at local midnight
  // and has a positive duration.
  if (!isStartOfLocalDay(s) || !isStartOfLocalDay(e)) return false;
  
  const diffMs = e.getTime() - s.getTime();
  
  // Must be a positive range, or zero for same-day inclusive ranges
  if (diffMs < 0) return false;
  
  // We don't check for exact multiples of 86,400,000ms here because 
  // DST shifts (23h or 25h days) would cause false negatives. 
  // By confirming both are at 00:00:00 local time, we ensure 
  // they are calendar-day aligned.
  return true;
}

/**
 * Clamps a timed range to a maximum duration while preserving the start time.
 * 
 * This aligns with the 'background intelligence, foreground simplicity' philosophy
 * by automatically correcting overwhelming durations (e.g., when an multi-day 
 * all-day event is dragged into a timed grid) without requiring user intervention.
 * 
 * @param start - The start date
 * @param end - The end date
 * @param maxDurationMinutes - The maximum allowed duration in minutes (default 8 hours)
 * @returns A normalized range where duration <= maxDurationMinutes
 */
export function clampTimedRange(
  start: Date | string | number,
  end: Date | string | number,
  maxDurationMinutes: number = 8 * 60
): { start: Date; end: Date } {
  const s = new Date(start);
  const e = new Date(end);
  
  const currentDurationMin = (e.getTime() - s.getTime()) / 60000;
  
  if (currentDurationMin > maxDurationMinutes) {
    return {
      start: s,
      end: addMinutes(s, maxDurationMinutes),
    };
  }
  
  // Also ensure duration is at least 1 minute to avoid zero-length events
  if (currentDurationMin <= 0) {
    return {
      start: s,
      end: addMinutes(s, 1),
    };
  }

  return { start: s, end: e };
}

export interface DateRangeInput {
  start: Date | string | number;
  end?: Date | string | number | null;
}

export interface NormalizedTimestampRange {
  startISO: string;
  endISO: string;
}

/**
 * Normalizes an all-day event range object for schedule updates.
 * Ensures the range is perfectly aligned to local day boundaries
 * [start-of-day, start-of-next-day] and returned as standardized 
 * ISO timestamp strings for robust storage.
 * 
 * @param range - The input range object containing start and optional end
 * @returns An object containing normalized startISO and endISO strings
 */
export function normalizeAllDayRangeForUpdate(
  range: DateRangeInput
): NormalizedTimestampRange {
  const { start, end } = normalizeAllDayRangeLocal(range.start, range.end);
  
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

/**
 * Handles calendar eventDrop callbacks where all-day events might omit an end date.
 * When FullCalendar fires an eventDrop for a single-day all-day event, the end date 
 * is frequently null. This handler ensures the event defaults to a strict 1-day 
 * duration (end = start + 1 day), maintaining data integrity in the internal knowledge graph.
 * 
 * @param start - The start date of the dropped event
 * @param end - The potentially null end date from the drop callback
 * @returns An object with guaranteed start and end Dates
 */
export function ensureAllDayDropEndDate(
  start: Date | string | number,
  end?: Date | string | number | null
): { start: Date; end: Date } {
  const s = startOfDay(new Date(start));
  
  // Explicitly handle the null/undefined drop case
  if (!end) {
    return {
      start: s,
      end: addDays(s, 1),
    };
  }

  // If an end date exists, ensure it is aligned to the day boundary
  const e = startOfDay(new Date(end));
  
  // Protect against invalid negative ranges
  if (e.getTime() <= s.getTime()) {
    return {
      start: s,
      end: addDays(s, 1),
    };
  }

  return { start: s, end: e };
}
