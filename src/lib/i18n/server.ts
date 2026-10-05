import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { dictionaryFor, isLocale, LOCALE_COOKIE, type Locale } from "./index";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
});

export const getDictionary = cache(async () => dictionaryFor(await getLocale()));
