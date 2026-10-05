import { en, type Dictionary } from "./dictionaries/en";
import { ml } from "./dictionaries/ml";
import { hi } from "./dictionaries/hi";

export const LOCALES = ["en", "ml", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", ml: "മലയാളം", hi: "हिन्दी" };
export const LOCALE_COOKIE = "sb_locale";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ml, hi };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dictionaryFor(locale: string | undefined | null): Dictionary {
  return DICTIONARIES[isLocale(locale) ? locale : "en"];
}

export type { Dictionary };
