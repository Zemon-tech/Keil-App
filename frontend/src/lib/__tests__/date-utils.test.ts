import { describe, it, expect } from "vitest";
import {
    normalizeAllDayRangeLocal,
    clampTimedRange,
    normalizeTimedRange,
    fromExclusiveRange
} from "../date-utils";

describe("date-utils Unit Tests", () => {
    // ── normalizeAllDayRangeLocal & ensureAllDayDropEndDate ─────────────────────
    describe("normalizeAllDayRangeLocal (End Date Defaults)", () => {
        it("should default end date to start + 1 day when end date is omitted", () => {
            const start = new Date("2024-05-15T00:00:00");
            const result = normalizeAllDayRangeLocal(start);

            expect(result.start.toISOString()).toBe(new Date("2024-05-15T00:00:00").toISOString());
            expect(result.end.toISOString()).toBe(new Date("2024-05-16T00:00:00").toISOString());
        });

        it("should correct invalid end dates (end <= start) to start + 1 day", () => {
            const start = new Date("2024-05-15T00:00:00");
            const invalidEnd = new Date("2024-05-14T00:00:00"); // before start
            const sameEnd = new Date("2024-05-15T00:00:00"); // same as start

            const result1 = normalizeAllDayRangeLocal(start, invalidEnd);
            expect(result1.end.toISOString()).toBe(new Date("2024-05-16T00:00:00").toISOString());

            const result2 = normalizeAllDayRangeLocal(start, sameEnd);
            expect(result2.end.toISOString()).toBe(new Date("2024-05-16T00:00:00").toISOString());
        });
    });

    // ── Duration Clamps & Timed Ranges ──────────────────────────────────────────
    describe("clampTimedRange (Boundary Clamping)", () => {
        it("should clamp excessively long timed ranges to maxDurationMinutes", () => {
            const start = new Date("2024-05-15T09:00:00");
            const longEnd = new Date("2024-05-15T23:00:00"); // 14 hours

            // Clamp to 8 hours (default)
            const result = clampTimedRange(start, longEnd);
            const durationMin = (result.end.getTime() - result.start.getTime()) / 60000;

            expect(durationMin).toBe(8 * 60); // exactly 8 hours
            expect(result.start.toISOString()).toBe(start.toISOString());
        });

        it("should clamp zero or negative timed ranges to at least 1 minute", () => {
            const start = new Date("2024-05-15T09:00:00");
            const invalidEnd = new Date("2024-05-15T08:00:00"); // negative duration

            const result = clampTimedRange(start, invalidEnd);
            const durationMin = (result.end.getTime() - result.start.getTime()) / 60000;

            expect(durationMin).toBe(1); // clamped to 1 minute minimum
        });
    });

    describe("normalizeTimedRange (Clamping & Defaults)", () => {
        it("should normalize invalid timed range to the default duration", () => {
            const start = new Date("2024-05-15T09:00:00");
            const invalidEnd = new Date("2024-05-15T08:00:00"); // before start

            const result = normalizeTimedRange(start, invalidEnd, { defaultDurationMinutes: 45 });
            const durationMin = (result.end.getTime() - result.start.getTime()) / 60000;

            expect(durationMin).toBe(45);
        });
    });

    // ── Exclusive Ranges ────────────────────────────────────────────────────────
    describe("fromExclusiveRange", () => {
        it("should convert exclusive end date back to inclusive end date", () => {
            const start = new Date("2024-05-01T00:00:00");
            const exclusiveEnd = new Date("2024-05-02T00:00:00");

            const result = fromExclusiveRange(start, exclusiveEnd);
            expect(result.end.toISOString()).toBe(new Date("2024-05-01T00:00:00").toISOString());
        });

        it("should clamp inclusive end date to start date if it falls before start", () => {
            const start = new Date("2024-05-01T00:00:00");
            const invalidExclusiveEnd = new Date("2024-05-01T00:00:00"); // Subtracting 1 day goes to 2024-04-30

            const result = fromExclusiveRange(start, invalidExclusiveEnd);
            expect(result.end.toISOString()).toBe(start.toISOString());
        });
    });
});
