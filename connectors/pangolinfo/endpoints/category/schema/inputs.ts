import { z } from "zod";
import { zAsin, zScrapeBody, zSite } from "../../../schema/common.ts";

export const zBody = zScrapeBody.omit({ url: true }).extend({
    site: zSite,
    content: z.string().regex(/^\d+(?:\?page=[1-9]\d*)?$/),
});
