import { describe, test, expect, afterEach } from "vitest";
import {
  t,
  setLocale,
  registerTranslation,
} from "../../lib/i18n/registry.svelte";

describe("i18n registry", () => {
  afterEach(() => {
    setLocale("en");
  });

  test("returns the English default for a known key", () => {
    expect(t("transcript.unavailable")).toBe("No transcript available.");
  });

  test("falls back to English for a locale with no registered translation", () => {
    setLocale("de");
    expect(t("transcript.unavailable")).toBe("No transcript available.");
  });

  test("registerTranslation + setLocale changes the lookup", () => {
    registerTranslation("fr", {
      "transcript.unavailable": "Aucune transcription disponible.",
    });
    setLocale("fr");
    expect(t("transcript.unavailable")).toBe(
      "Aucune transcription disponible.",
    );
  });

  test("a locale missing one key falls back to English for that key only", () => {
    registerTranslation("es", { "transcript.loading": "Cargando…" });
    setLocale("es");
    expect(t("transcript.loading")).toBe("Cargando…");
    expect(t("transcript.unavailable")).toBe("No transcript available.");
  });

  test("interpolates {params} into the template", () => {
    registerTranslation("fr", {
      "player.skipForward": "Avancer de {seconds} secondes",
    });
    setLocale("fr");
    expect(t("player.skipForward", { seconds: 10 })).toBe(
      "Avancer de 10 secondes",
    );
  });
});
