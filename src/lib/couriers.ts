import { z } from "zod";
import { detectPii } from "./pii-guard";

/**
 * Courier services commonly used in Kerala, with their official tracking pages.
 * `trackingLink` puts the number straight into the courier's URL where the
 * site supports it; otherwise donors and recipients open the tracking page and
 * paste the number (the UI always offers a copy button).
 */
export interface Courier {
  id: string;
  name: string;
  trackingPage?: string;
  trackingLink?: (trackingNumber: string) => string;
  /** Known format, checked when the number is saved. */
  pattern?: RegExp;
  example?: string;
}

export const COURIERS = [
  { id: "INDIA_POST", name: "India Post (Speed Post / Registered)", trackingPage: "https://www.indiapost.gov.in/", pattern: /^[A-Z]{2}\d{9}IN$/, example: "EE123456789IN" },
  { id: "DTDC", name: "DTDC", trackingPage: "https://www.dtdc.com/track-your-shipment/" },
  { id: "PROFESSIONAL", name: "The Professional Couriers", trackingPage: "https://www.tpcindia.com/" },
  { id: "BLUE_DART", name: "Blue Dart", trackingPage: "https://www.bluedart.com/tracking", trackingLink: (n) => `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(n)}` },
  { id: "DELHIVERY", name: "Delhivery", trackingPage: "https://www.delhivery.com/tracking", trackingLink: (n) => `https://www.delhivery.com/track-v2/package/${encodeURIComponent(n)}` },
  { id: "EKART", name: "Ekart", trackingPage: "https://ekartlogistics.com/", trackingLink: (n) => `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(n)}` },
  { id: "XPRESSBEES", name: "XpressBees", trackingPage: "https://www.xpressbees.com/", trackingLink: (n) => `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(n)}` },
  { id: "ST_COURIER", name: "ST Courier", trackingPage: "https://stcourier.com/track/shipment" },
  { id: "TRACKON", name: "Trackon", trackingPage: "https://trackon.in/data/SingleShipment/" },
  { id: "SHREE_MARUTI", name: "Shree Maruti Courier", trackingPage: "https://www.shreemaruti.com/" },
  { id: "FRANCH", name: "Franch Express", trackingPage: "https://franchexpress.com/" },
  { id: "SHADOWFAX", name: "Shadowfax", trackingPage: "https://www.shadowfax.in/" },
  { id: "GATI", name: "Gati (Allcargo)", trackingPage: "https://www.allcargologistics.com/" },
  { id: "KSRTC", name: "KSRTC Courier & Logistics" },
] as const satisfies readonly Courier[];

export const OTHER_COURIER = "OTHER";
export const COURIER_IDS: [string, ...string[]] = [OTHER_COURIER, ...COURIERS.map((c) => c.id)];

export function findCourier(id: string | null | undefined): Courier | undefined {
  return (COURIERS as readonly Courier[]).find((c) => c.id === id);
}

export interface TrackingInfo {
  courierId: string;
  courierName: string;
  trackingNumber: string;
  /** Where to follow the parcel: a direct link when the courier supports one, otherwise its tracking page. */
  url: string | null;
  /** True when `url` already includes the tracking number. */
  direct: boolean;
  addedAt: string | null;
}

/** Display-ready tracking for a delivery, or null when none was added. */
export function trackingInfo(row: { courier: string | null; courierName: string | null; trackingNumber: string | null; trackingAddedAt?: Date | null }): TrackingInfo | null {
  if (!row.courier || !row.trackingNumber) return null;
  const courier = findCourier(row.courier);
  return {
    courierId: row.courier,
    courierName: courier?.name ?? row.courierName ?? "Courier",
    trackingNumber: row.trackingNumber,
    url: courier?.trackingLink?.(row.trackingNumber) ?? courier?.trackingPage ?? null,
    direct: !!courier?.trackingLink,
    addedAt: row.trackingAddedAt?.toISOString() ?? null,
  };
}

export const courierTrackingSchema = z
  .object({
    courier: z.enum(COURIER_IDS, { errorMap: () => ({ message: "Choose the courier service." }) }),
    /** Only for "Other": the courier's name. */
    courierName: z.string().trim().max(40, "Courier name must be 40 characters or fewer.").optional(),
    trackingNumber: z
      .string({ required_error: "Enter the tracking number." })
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{6,30}$/, "Tracking numbers are 6–30 letters and digits, as printed on the receipt.")),
  })
  .superRefine((value, ctx) => {
    if (value.courier === OTHER_COURIER) {
      if (!value.courierName || value.courierName.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["courierName"], message: "Enter the courier's name." });
      else if (detectPii(value.courierName).length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["courierName"], message: "Enter just the courier's name, without contact details." });
    }
    const courier = findCourier(value.courier);
    if (courier?.pattern && !courier.pattern.test(value.trackingNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trackingNumber"], message: `${courier.name} numbers look like ${courier.example}.` });
    }
  });

export type CourierTrackingInput = z.infer<typeof courierTrackingSchema>;
