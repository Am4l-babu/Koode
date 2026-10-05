import { z } from "zod";
import { KERALA_DISTRICTS } from "../geo";

const empty = (v: unknown) => (v === "" || v === null ? undefined : v);

export const browseQuerySchema = z.object({
  q: z.preprocess(empty, z.string().trim().max(200).optional()),
  category: z.preprocess(empty, z.string().regex(/^[a-z][a-z0-9-]{1,30}$/).optional()),
  district: z.preprocess(empty, z.enum(KERALA_DISTRICTS).optional()),
  near: z.preprocess(empty, z.enum(KERALA_DISTRICTS).optional()),
  urgency: z.preprocess(empty, z.enum(["CRITICAL", "HIGH", "MEDIUM", "NORMAL"]).optional()),
  stage: z.preprocess(empty, z.enum(["just_posted", "partial", "almost"]).optional()),
  donationType: z.preprocess(empty, z.enum(["ITEM", "MONETARY", "SPONSOR"]).optional()),
  sort: z.preprocess(empty, z.enum(["urgent", "recent", "closest", "most_needed", "almost", "popular"]).optional()),
  page: z.preprocess(empty, z.coerce.number().int().min(1).max(1000).optional()),
  pageSize: z.preprocess(empty, z.coerce.number().int().min(1).max(48).optional()),
});

export type BrowseQuery = z.infer<typeof browseQuerySchema>;

export function parseBrowseParams(params: URLSearchParams | Record<string, string | string[] | undefined>): BrowseQuery {
  const obj: Record<string, unknown> = {};
  if (params instanceof URLSearchParams) params.forEach((v, k) => (obj[k] = v));
  else for (const [k, v] of Object.entries(params)) obj[k] = Array.isArray(v) ? v[0] : v;
  const parsed = browseQuerySchema.safeParse(obj);
  return parsed.success ? parsed.data : {};
}
