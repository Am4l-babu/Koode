import { CITY_TO_DISTRICT, KERALA_DISTRICTS, type KeralaDistrict } from "./geo";

/**
 * Natural-language search parser for Browse Needs.
 *
 *   "school bags for children"          → text [school, bag]
 *   "shirts size 30"                     → text [shirt], size "30"
 *   "food requirements near Thrissur"   → category food, district Thrissur
 *   "toys for 5 year old children"      → category children, age 5
 */
export interface ParsedQuery {
  terms: string[];
  categorySlug?: string;
  district?: KeralaDistrict;
  size?: string;
  age?: number;
}

const CATEGORY_WORDS: Record<string, string> = {
  food: "food",
  foods: "food",
  clothing: "clothing",
  clothes: "clothing",
  education: "education",
  stationery: "education",
  toy: "children",
  toys: "children",
  elderly: "elder-care",
  elder: "elder-care",
  seniors: "elder-care",
  medical: "medical-support",
  medicine: "medical-support",
  household: "household",
  sports: "sports",
  sport: "sports",
};

const STOPWORDS = new Set([
  "a", "an", "the", "for", "near", "in", "at", "of", "to", "with", "and", "or", "on", "from", "around",
  "requirement", "requirements", "need", "needs", "needed", "request", "requests", "item", "items",
  "year", "years", "yr", "yrs", "old", "age", "aged", "size", "sized", "district", "city", "kerala",
  "children", "child", "kids", "kid", "boys", "girls", "people", "some", "any",
]);

export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("ches") || word.endsWith("shes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const DISTRICT_LOOKUP = new Map<string, KeralaDistrict>([
  ...KERALA_DISTRICTS.map((d) => [d.toLowerCase(), d] as [string, KeralaDistrict]),
  ...Object.entries(CITY_TO_DISTRICT),
]);

export function parseSearchQuery(raw: string): ParsedQuery {
  const result: ParsedQuery = { terms: [] };
  let q = ` ${raw.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s–-]/gu, " ")} `.slice(0, 200);

  const size = q.match(/\bsize\s*([0-9]{1,3}|xxl|xl|xs|s|m|l)\b/);
  if (size) {
    result.size = size[1]!.toUpperCase();
    q = q.replace(size[0], " ");
  }

  const age =
    q.match(/\b(\d{1,2})\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*(?:year|yr)s?(?:\s*old)?\b/) || q.match(/\bage(?:d)?\s*(\d{1,2})\b/);
  if (age) {
    result.age = Number(age[1]);
    q = q.replace(age[0], " ");
  }

  for (const [needle, district] of DISTRICT_LOOKUP) {
    const re = new RegExp(`\\b${needle}\\b`);
    if (re.test(q)) {
      result.district = district;
      q = q.replace(re, " ");
      break;
    }
  }

  for (const word of q.split(/\s+/).filter(Boolean)) {
    if (!result.categorySlug && CATEGORY_WORDS[word]) {
      result.categorySlug = CATEGORY_WORDS[word];
      continue;
    }
    if (STOPWORDS.has(word) || CATEGORY_WORDS[word]) continue;
    if (word.length < 2) continue;
    const term = singularize(word);
    if (!result.terms.includes(term)) result.terms.push(term);
  }
  result.terms = result.terms.slice(0, 6);
  return result;
}
