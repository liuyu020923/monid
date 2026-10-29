import { z } from "zod";
import { zScrapeBody, zSite } from "../../../schema/common.ts";

export const zBody = zScrapeBody.omit({ url: true }).extend({
    site: zSite,
    content: z.string().regex(/^[A-Za-z0-9]+(?:\?page=[1-9]\d*)?$/).describe(
        "Seller ID, optionally followed by ?page=N for a single page.",
    ),
    pageCount: z.number().int().min(1).max(3).optional(),
    categoryId: z.string().regex(/^\d+(?:,\d+)*$/).optional(),
});
