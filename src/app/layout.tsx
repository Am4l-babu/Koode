import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/outfit";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Sahaya Bridge — Give what matters. Keep identities private.", template: "%s · Sahaya Bridge" },
  description:
    "A trusted community platform where verified needs meet generous people — without exposing personal identities. Donate exactly what verified organisations in Kerala need.",
  applicationName: "Sahaya Bridge",
  openGraph: { type: "website", siteName: "Sahaya Bridge", locale: "en_IN" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1413" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [store, t, locale] = await Promise.all([cookies(), getDictionary(), getLocale()]);
  const theme = store.get("sb_theme")?.value;
  return (
    <html lang={locale === "ml" ? "ml" : locale === "hi" ? "hi" : "en-IN"} data-theme={theme === "dark" || theme === "light" ? theme : undefined} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">
          {t.nav.skip}
        </a>
        <Navbar />
        <main id="main" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
