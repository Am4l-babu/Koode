import { z } from "zod";
import { districtSchema, publicText, trimmed, uuidSchema } from "./common";

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "NORMAL"] as const;
export const DELIVERY_METHODS = ["PLATFORM_PICKUP", "PARTNER_DROPOFF", "DELIVERY"] as const;
export const DONATION_TYPES = ["ITEM", "MONETARY", "SPONSOR"] as const;
export const RECURRENCES = ["NONE", "WEEKLY", "MONTHLY", "QUARTERLY"] as const;

export const requestItemInputSchema = z.object({
  name: publicText(2, 60, "Item name"),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(10_000, "Quantity must be 10,000 or fewer."),
  unit: trimmed(1, 16, "Unit").default("pcs"),
  estimatedUnitValue: z.coerce.number().int().min(0).max(1_000_000).optional(),
  attributes: z.record(z.unknown()).default({}),
});

export const createRequestSchema = z
  .object({
    categoryId: uuidSchema,
    title: publicText(8, 90, "Title"),
    description: publicText(30, 1200, "Description"),
    urgency: z.enum(PRIORITIES).default("NORMAL"),
    neededBy: z.coerce
      .date({ invalid_type_error: "Choose a valid date." })
      .optional()
      .refine((d) => !d || d.getTime() > Date.now() - 86_400_000, "The required date cannot be in the past."),
    peopleAffected: z.coerce.number().int().min(1).max(100_000).optional(),
    district: districtSchema,
    city: publicText(2, 60, "City / town").optional(),
    items: z
      .array(requestItemInputSchema)
      .min(1, "Add at least one item.")
      .max(10, "A request can have up to 10 items."),
    donationTypes: z.array(z.enum(DONATION_TYPES)).min(1).default(["ITEM"]),
    deliveryMethods: z.array(z.enum(DELIVERY_METHODS)).min(1, "Choose at least one delivery method.").default([...DELIVERY_METHODS]),
    recurrence: z.enum(RECURRENCES).default("NONE"),
    submit: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const names = value.items.map((i) => i.name.toLowerCase());
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: `"${dup}" is listed twice — combine the quantities instead.` });
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const recipientRequestStatusSchema = z.object({
  action: z.enum(["close", "resubmit"]),
});

export const confirmReceiptSchema = z.object({
  donationId: z.string().min(4).max(20),
});
