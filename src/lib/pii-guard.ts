/**
 * Detects contact details in text that will be shown publicly (request
 * titles/descriptions). Recipients must not accidentally publish phone
 * numbers, emails, exact addresses or social handles.
 */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// 10+ digits possibly separated by spaces/dashes, or +91 prefix.
const PHONE_RE = /(?:\+?\d[\s-]?){10,}/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const SOCIAL_RE = /(?:^|\s)@[a-z0-9_.]{3,}\b|\b(?:instagram|facebook|whatsapp|telegram|twitter)\.(?:com|me)\b|\bwa\.me\b/i;
const PIN_RE = /\b(?:pin(?:code)?[:\s-]*)?6[7-9]\d{4}\b/i; // Kerala PIN ranges 67xxxx–69xxxx
const ADDRESS_RE = /\b(?:house\s*(?:no|number)|door\s*no|flat\s*no|h\.?\s*no\.?)\b/i;

export type PiiKind = "email" | "phone" | "link" | "social" | "pin_code" | "address";

export function detectPii(text: string): PiiKind[] {
  const found: PiiKind[] = [];
  if (EMAIL_RE.test(text)) found.push("email");
  if (PHONE_RE.test(text)) found.push("phone");
  if (URL_RE.test(text)) found.push("link");
  if (SOCIAL_RE.test(text)) found.push("social");
  if (PIN_RE.test(text)) found.push("pin_code");
  if (ADDRESS_RE.test(text)) found.push("address");
  return found;
}

const KIND_LABEL: Record<PiiKind, string> = {
  email: "an email address",
  phone: "a phone number",
  link: "a web link",
  social: "a social media handle",
  pin_code: "a PIN code",
  address: "a house/door number",
};

export function piiMessage(kinds: PiiKind[]): string {
  return `For everyone's privacy, please remove ${kinds.map((k) => KIND_LABEL[k]).join(", ")}. The platform coordinates all contact.`;
}
