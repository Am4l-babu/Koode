/** Coarse geography only — exact addresses are never part of public data. */
export const KERALA_DISTRICTS = [
  "Thiruvananthapuram",
  "Kollam",
  "Pathanamthitta",
  "Alappuzha",
  "Kottayam",
  "Idukki",
  "Ernakulam",
  "Thrissur",
  "Palakkad",
  "Malappuram",
  "Kozhikode",
  "Wayanad",
  "Kannur",
  "Kasaragod",
] as const;

export type KeralaDistrict = (typeof KERALA_DISTRICTS)[number];

/** Well-known cities/towns mapped to their district (used by search + filters). */
export const CITY_TO_DISTRICT: Record<string, KeralaDistrict> = {
  kochi: "Ernakulam",
  cochin: "Ernakulam",
  aluva: "Ernakulam",
  muvattupuzha: "Ernakulam",
  chalakudy: "Thrissur",
  guruvayur: "Thrissur",
  irinjalakuda: "Thrissur",
  kodungallur: "Thrissur",
  trivandrum: "Thiruvananthapuram",
  calicut: "Kozhikode",
  vadakara: "Kozhikode",
  ottapalam: "Palakkad",
  tirur: "Malappuram",
  manjeri: "Malappuram",
  kalpetta: "Wayanad",
  thalassery: "Kannur",
  changanassery: "Kottayam",
  pala: "Kottayam",
  thodupuzha: "Idukki",
  munnar: "Idukki",
  adoor: "Pathanamthitta",
  thiruvalla: "Pathanamthitta",
  cherthala: "Alappuzha",
  kayamkulam: "Alappuzha",
  karunagappally: "Kollam",
  kanhangad: "Kasaragod",
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Jammu and Kashmir", "Ladakh",
] as const;

/**
 * Approximate tile positions for a Kerala tile-map (col,row), north → south.
 * Used for the privacy-preserving district-level distribution "map".
 */
export const DISTRICT_TILES: Record<KeralaDistrict, [number, number]> = {
  Kasaragod: [0, 0],
  Kannur: [0, 1],
  Wayanad: [1, 1],
  Kozhikode: [0, 2],
  Malappuram: [1, 2],
  Palakkad: [2, 3],
  Thrissur: [1, 3],
  Ernakulam: [1, 4],
  Idukki: [2, 4],
  Alappuzha: [1, 5],
  Kottayam: [2, 5],
  Pathanamthitta: [2, 6],
  Kollam: [1, 6],
  Thiruvananthapuram: [1, 7],
};

export const PIN_CODE_RE = /^[1-9][0-9]{5}$/;
/** Indian mobile: optional +91 / 0 prefix, 10 digits starting 6-9. */
export const INDIAN_PHONE_RE = /^(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;

export function normalizeIndianPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!INDIAN_PHONE_RE.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return `+91${digits.slice(-10)}`;
}

export function isKeralaDistrict(value: string): value is KeralaDistrict {
  return (KERALA_DISTRICTS as readonly string[]).includes(value);
}
