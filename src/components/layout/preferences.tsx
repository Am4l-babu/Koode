"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Languages, Moon, Sun, SunMoon } from "lucide-react";
import { LOCALE_COOKIE, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n";

type Theme = "light" | "dark" | "system";
const THEME_COOKIE = "sb_theme";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    setCookie(THEME_COOKIE, theme);
  }, [theme]);
  const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={`Colour theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  return (
    <label className="relative flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:bg-surface-2">
      <Languages className="h-4.5 w-4.5" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) => {
          setCookie(LOCALE_COOKIE, e.target.value);
          router.refresh();
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-fg focus:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
