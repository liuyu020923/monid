import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { z } from "zod";
import { zBody } from "./schema/inputs.ts";

export default defineEndpoint({
    endpoint: "/amazon/category",
    meta: {
        displayName: "Amazon Category Products",
        summary: "List products in an Amazon browse category.",
        description:
            "Read ASINs, prices, ratings and pagination for one browse-node page. Pass the native content fragment, for example 172282 or 172282?page=2, with a marketplace as site. Costs 1 point per page. Inspect nextPage before requesting another page.",
        docsUrl:
            "https://docs.pangolinfo.com/en-api-reference/amazonApi/introduction",
        categories: ["amazon"],
    },
    request: { method: "POST", path: "/api/v1/scrape" },
    input: {
        schema: {
            body: zBody.extend({
                parserName: z.literal("amzProductOfCategory").default(
                    "amzProductOfCategory",
                ),
                format: z.literal("json").default("json"),
                timeout: zBody.shape.timeout.unwrap().default(60000),
            }),
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.PAGE,
            consumes: { credit: "default", amount: 1 },
            label: "page",
        },
        estimate: () => ({ counts: { PAGE: 1 } }),
    },
});
