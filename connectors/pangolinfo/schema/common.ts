import { z } from "zod";

// Native request fields. Endpoint bindings pin parsers and JSON output.
export const zSite = z.enum([
    "amz_us",
    "amz_uk",
    "amz_de",
    "amz_jp",
    "amz_fr",
    "amz_it",
    "amz_es",
    "amz_ca",
    "amz_au",
    "amz_sa",
    "amz_ae",
    "amz_br",
    "amz_mx",
]);
export const zAsin = z.string().regex(/^[A-Za-z0-9]{10}$/)
    .describe("Amazon ASIN: ten letters or digits.");
export const zAmazonUrl = z.string().url().regex(
    /^https:\/\/(?:www\.)?amazon\.(?:com|co\.uk|de|co\.jp|fr|it|es|ca|com\.au|sa|ae|com\.br|com\.mx|in|eg)(?:\/|$)/i,
).describe(
    "Full HTTPS Amazon URL; put pagination, filters and sorting in this URL.",
);
export const zZipContext = z.strictObject({
    zipcode: z.string().min(1).optional().describe(
        "Delivery ZIP code belonging to the marketplace country.",
    ),
});
export const zScrapeBody = z.strictObject({
    site: zSite.optional(),
    content: z.string().min(1).optional(),
    url: zAmazonUrl.optional(),
    parserName: z.string().optional(),
    format: z.enum(["json", "markdown", "rawHtml"]).optional(),
    timeout: z.number().int().min(30000).max(240000).optional(),
    bizContext: zZipContext.optional(),
});
