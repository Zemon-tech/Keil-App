import { describe, it, expect } from "vitest";
import { 
    isAllowedUri, 
    sanitizeUrl, 
    formatShortcutKey, 
    parseShortcutKeys 
} from "../tiptap-utils";

describe("tiptap-utils Unit Tests", () => {
    // ── URI & Protocol Validation (isAllowedUri) ────────────────────────────────
    describe("isAllowedUri (Protocol Whitelist)", () => {
        it("should allow safe URIs (http, https, mailto, tel, sms)", () => {
            expect(isAllowedUri("http://keilhq.in")).toBeTruthy();
            expect(isAllowedUri("https://google.com/search?q=test")).toBeTruthy();
            expect(isAllowedUri("mailto:support@keilhq.com")).toBeTruthy();
            expect(isAllowedUri("tel:+1234567890")).toBeTruthy();
            expect(isAllowedUri("sms:+1234567890")).toBeTruthy();
        });

        it("should block unsafe URIs (javascript, data, vbscript)", () => {
            // isAllowedUri returns null/falsy matches for invalid schemas
            const unsafeJS = isAllowedUri("javascript:alert('hacked')");
            expect(unsafeJS).toBeFalsy();

            const unsafeData = isAllowedUri("data:text/html,<script>alert(1)</script>");
            expect(unsafeData).toBeFalsy();

            const unsafeVBS = isAllowedUri("vbscript:msgbox('hello')");
            expect(unsafeVBS).toBeFalsy();
        });
    });

    // ── URL Sanitization (sanitizeUrl) ──────────────────────────────────────────
    describe("sanitizeUrl (Safe fallback)", () => {
        it("should return the absolute URL when it is safe and valid", () => {
            const result = sanitizeUrl("https://keilhq.in/features", "https://keilhq.in");
            expect(result).toBe("https://keilhq.in/features");
        });

        it("should fallback to '#' when input URL is invalid or unsafe", () => {
            const result1 = sanitizeUrl("javascript:alert(1)", "https://keilhq.in");
            expect(result1).toBe("#");

            const result2 = sanitizeUrl("vbscript:alert(1)", "https://keilhq.in");
            expect(result2).toBe("#");
        });
    });

    // ── Shortcut Key Formatting ────────────────────────────────────────────
    describe("formatShortcutKey & parseShortcutKeys (Mac vs non-Mac)", () => {
        it("should format modifier keys using Mac symbols on macOS", () => {
            expect(formatShortcutKey("mod", true)).toBe("⌘");
            expect(formatShortcutKey("meta", true)).toBe("⌘");
            expect(formatShortcutKey("ctrl", true)).toBe("⌃");
            expect(formatShortcutKey("alt", true)).toBe("⌥");
            expect(formatShortcutKey("option", true)).toBe("⌥");
            expect(formatShortcutKey("shift", true)).toBe("⇧");
            expect(formatShortcutKey("enter", true)).toBe("⏎");
        });

        it("should format modifier keys using capitalized words on non-Mac platforms", () => {
            expect(formatShortcutKey("mod", false)).toBe("Mod");
            expect(formatShortcutKey("ctrl", false)).toBe("Ctrl");
            expect(formatShortcutKey("alt", false)).toBe("Alt");
            expect(formatShortcutKey("shift", false)).toBe("Shift");
            expect(formatShortcutKey("enter", false)).toBe("Enter");
        });

        it("should parse and format key chains correctly", () => {
            // Non-Mac parse (explicit separator "+")
            const parsedNonMac = parseShortcutKeys({
                shortcutKeys: "ctrl+shift+p",
                delimiter: "+",
                capitalize: true
            });
            // Since isMac() is executed inside parseShortcutKeys, we verify the structure.
            // (The default implementation uses isMac() dynamically, so it will match the running platform)
            expect(parsedNonMac.length).toBe(3);
            expect(parsedNonMac[2]).toBe("P");
        });
    });
});
