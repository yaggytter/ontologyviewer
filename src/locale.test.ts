import { describe, it, expect } from "vitest";
import { resolveLocale, getMessages } from "./locale";

describe("locale", () => {
  describe("resolveLocale", () => {
    it("returns 'en' for explicit 'en'", () => {
      expect(resolveLocale("en")).toBe("en");
    });
    it("returns 'ja' for explicit 'ja'", () => {
      expect(resolveLocale("ja")).toBe("ja");
    });
    it("defaults to 'en' for 'auto' in non-Japanese env", () => {
      // happy-dom doesn't set navigator.language to ja
      expect(resolveLocale("auto")).toBe("en");
    });
  });

  describe("getMessages", () => {
    it("returns English messages", () => {
      const msgs = getMessages("en");
      expect(msgs.schemaView).toBe("Schema");
      expect(msgs.triplesView).toBe("Triples");
    });
    it("returns Japanese messages", () => {
      const msgs = getMessages("ja");
      expect(msgs.schemaView).toBe("スキーマ");
      expect(msgs.triplesView).toBe("トリプル");
    });
    it("all keys are present in both locales", () => {
      const en = getMessages("en");
      const ja = getMessages("ja");
      for (const key of Object.keys(en)) {
        expect(ja).toHaveProperty(key);
        expect((ja as Record<string, string>)[key]).toBeTruthy();
      }
    });
  });
});
