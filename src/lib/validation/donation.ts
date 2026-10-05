import { z } from "zod";
import { publicIdSchema, publicText, trimmed, uuidSchema } from "./common";
import { DELIVERY_METHODS } from "./request";
import { INDIAN_PHONE_RE } from "../geo";

export const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD"] as const;
export const GROUP_TYPES = ["INDIVIDUAL", "COMMUNITY_GROUP", "COMPANY", "SCHOOL", "COLLEGE", "CLUB"] as const;

export const donationItemInputSchema = z.object({
  requestItemId: uuidSchema,
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "Quantity must be 1,000 or fewer per item."),
  /** Condition of this item; the donation's overall condition is the least-new of its items. */
  condition: z.enum(CONDITIONS).optional(),
  /** Details of what is given, checked against the item's product type on the server. */
  variant: z.record(z.union([z.string().max(80), z.number(), z.boolean()])).optional(),
});

export const createDonationSchema = z
  .object({
    requestId: publicIdSchema("NR"),
    items: z.array(donationItemInputSchema).min(1, "Choose at least one item.").max(10),
    condition: z.enum(CONDITIONS).default("NEW"),
    deliveryMethod: z.enum(DELIVERY_METHODS),
    groupType: z.enum(GROUP_TYPES).default("INDIVIDUAL"),
    description: publicText(1, 600, "Description").optional(),
    pickupAddress: trimmed(5, 240, "Pickup address").optional(),
    pickupPhone: z.string().trim().regex(INDIAN_PHONE_RE, "Enter a valid Indian mobile number.").optional(),
    anonymousAcknowledged: z.literal(true, {
      errorMap: () => ({ message: "Please confirm you understand the donation is anonymous." }),
    }),
  })
  .superRefine((value, ctx) => {
    const ids = value.items.map((i) => i.requestItemId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Each item can only be listed once." });
    }
    if (value.deliveryMethod === "PLATFORM_PICKUP" && !value.pickupAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupAddress"],
        message: "Add a pickup address so our team can collect the items. Only platform staff can see it.",
      });
    }
  });

export type CreateDonationInput = z.infer<typeof createDonationSchema>;

/** Status changes a donor may make on their own donation. */
export const donorDonationUpdateSchema = z.object({
  action: z.enum(["PREPARING", "HANDED_OVER", "CANCEL"]),
});
