import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { type Json, type RunInput } from "@shared/core";
import { directTransport, Engine } from "@monid/connector-engine";
import {
    estimateEndpoint,
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixtureDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const product = "pangolinfo#amazon/product";
const reviews = "pangolinfo#amazon/reviews";
const seller = "pangolinfo#amazon/seller";
const rufus = "pangolinfo#amazon/rufus";
const maps = "pangolinfo#maps/local";
const productInput = { body: { site: "amz_us", content: "B0B4NLGCH5" } };
const reviewInput = {
    body: {
        url: "https://www.amazon.com",
        bizContext: { asin: "B0B4NLGCH5", pageCount: 3 },
    },
};

async function replay(
    id: string,
    name: string,
    input: RunInput = productInput,
) {
    return await runEndpoint({
        unit: await testSealedUnit(id),
        input,
        mode: "replay",
        fixture: await loadFixture(`${fixtureDir}synthetic-${name}.json`),
    });
}

// Verify actual wire bodies AND auth through the compiled lifecycle. The shared
// replay harness checks URL/method; this test additionally checks every field.
const standard = { format: "json", timeout: 60000 };
const cases = [
    {
        id: product,
        body: productInput.body,
        wire: {
            ...productInput.body,
            ...standard,
            parserName: "amzProductDetail",
        },
        path: "/api/v1/scrape",
    },
    {
        id: "pangolinfo#amazon/search",
        body: {
            url: "https://www.amazon.de/s?k=coffee&page=2",
            bizContext: { zipcode: "10115" },
        },
        wire: {
            url: "https://www.amazon.de/s?k=coffee&page=2",
            bizContext: { zipcode: "10115" },
            ...standard,
            parserName: "amzKeyword",
        },
        path: "/api/v1/scrape",
    },
    ...[
        ["bestsellers", "amzBestSellers", "electronics"],
        ["new-releases", "amzNewReleases", "electronics"],
        ["category", "amzProductOfCategory", "172282?page=2"],
    ].map(([id, parserName, content]) => ({
        id: `pangolinfo#amazon/${id}`,
        body: { site: "amz_jp", content },
        wire: { site: "amz_jp", content, ...standard, parserName },
        path: "/api/v1/scrape",
    })),
    {
        id: seller,
        body: {
            site: "amz_us",
            content: "ATVPDKIKX0DER",
            pageCount: 3,
            categoryId: "172282",
        },
        wire: {
            site: "amz_us",
            content: "ATVPDKIKX0DER",
            pageCount: 3,
            categoryId: "172282",
            ...standard,
            parserName: "amzProductOfSeller",
        },
        path: "/api/v1/scrape",
    },
    {
        id: "pangolinfo#amazon/offers",
        body: productInput.body,
        wire: { ...productInput.body, timeout: 90000 },
        path: "/api/v1/scrape/follow-seller",
    },
    {
        id: reviews,
        body: reviewInput.body,
        wire: {
            url: "https://www.amazon.com",
            bizContext: {
                ...reviewInput.body.bizContext,
                bizKey: "review",
                filterByStar: "all_stars",
                sortBy: "recent",
            },
            format: "json",
            formatType: "all_formats",
            parserName: "amzReviewV2",
            mediaType: "all_contents",
        },
        path: "/api/v1/scrape",
    },
    {
        id: rufus,
        body: { param: ["A travel book?"], site: "jp" },
        wire: {
            param: ["A travel book?"],
            site: "jp",
            parserName: "amazonAlexa",
            screenshot: false,
            timeout: 240000,
        },
        path: "/api/v2/scrape",
    },
    {
        id: maps,
        body: { q: "coffee", ll: "37.7822,-122.4642,13z", num: 10 },
        wire: {
            q: "coffee",
            ll: "37.7822,-122.4642,13z",
            num: 10,
            hl: "en",
            start: 0,
            timeout: 25000,
        },
        path: "/api/v3/extract/search/maps/local",
    },
];

for (const entry of cases) {
    Deno.test(`${entry.id}: exact wire request, bearer auth and one call`, async () => {
        const unit = await testSealedUnit(entry.id);
        let calls = 0;
        const engine = new Engine({
            transport: directTransport({
                params: () => Promise.resolve({ apiKey: "test-key" }),
                fetch: (input, init) => {
                    calls++;
                    assertEquals(
                        String(input),
                        `https://scrapeapi.pangolinfo.com${entry.path}`,
                    );
                    assertEquals(init?.method, "POST");
                    assertEquals(
                        new Headers(init?.headers).get("authorization"),
                        "Bearer test-key",
                    );
                    assertEquals(JSON.parse(String(init?.body)), entry.wire);
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({
                                code: 0,
                                pointCost: 0,
                                data: { json: [] },
                            }),
                            {
                                status: 200,
                                headers: { "content-type": "application/json" },
                            },
                        ),
                    );
                },
            }),
        });
        const runnable = await engine.load(unit);
        const result = await runnable.run({ body: entry.body as Json });
        assertEquals(calls, 1);
        assertEquals(result.isProviderError, false);
        assertEquals(result.usage.credits, {});
    });
}

for (const entry of cases) {
    const name = entry.id === "pangolinfo#amazon/offers"
        ? "paid-empty"
        : entry.id === reviews
        ? "review-success"
        : entry.id === rufus
        ? "rufus-success"
        : entry.id === maps
        ? "maps-success"
        : "page-success";
    const charge = entry.id === reviews
        ? 5
        : entry.id === rufus
        ? 6
        : entry.id === maps
        ? 1.5
        : 1;
    Deno.test(`${entry.id}: replay recorded provider shape (${name})`, async () => {
        const fixture = await loadFixture(`${fixtureDir}${name}.json`);
        const result = await runEndpoint({
            unit: await testSealedUnit(entry.id),
            input: { body: entry.body as Json },
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 200);
        assertEquals(result.isProviderError, false);
        assertEquals(result.usage.credits, { default: charge });
        assertEquals(result.output, fixture.calls[0].res.body);
    });
}

Deno.test("Pangolinfo: nonzero paid semantic outcomes retain code, message and charge", async () => {
    for (const code of [9201, 9204, 9206]) {
        const fixture = await loadFixture(
            `${fixtureDir}synthetic-success.json`,
        );
        fixture.calls[0].res.body = {
            code,
            message: "Billed semantic outcome",
            pointCost: 1,
            data: null,
        };
        const result = await runEndpoint({
            unit: await testSealedUnit(product),
            input: productInput,
            mode: "replay",
            fixture,
        });
        assertEquals(result.isProviderError, false);
        assertEquals(result.usage.credits, { default: 1 });
        assertEquals(result.output, fixture.calls[0].res.body);
    }
});

Deno.test("Pangolinfo: business failures and malformed 200 envelopes settle at zero", async () => {
    for (
        const [body, status] of [
            [{ code: 4029, pointCost: 0 }, 429],
            [{ code: 1002 }, 400],
            [{ code: 1004 }, 401],
            [{ code: 2001 }, 402],
            [{ code: 4003 }, 403],
            [{ code: 9205 }, 503],
            [{ code: 9200, pointCost: 0 }, 502],
            [{ unexpected: "payload" }, 502],
            [null, 502],
        ] as [Json, number][]
    ) {
        const fixture = await loadFixture(
            `${fixtureDir}synthetic-success.json`,
        );
        fixture.calls[0].res.body = body;
        const result = await runEndpoint({
            unit: await testSealedUnit(product),
            input: productInput,
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, status);
        assertEquals(result.isProviderError, true);
        assertEquals(result.usage, { credits: {}, evidence: {} });
        assertEquals(result.output, body);
    }
});

Deno.test("Pangolinfo: transport errors remain errors even if their body claims a charge", async () => {
    const fixture = await loadFixture(`${fixtureDir}synthetic-success.json`);
    fixture.calls[0].res.status = 503;
    const result = await runEndpoint({
        unit: await testSealedUnit(product),
        input: productInput,
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 503);
    assertEquals(result.usage.credits, {});
});

Deno.test("Pangolinfo: actual fractional receipt wins and is preserved in output", async () => {
    const fixture = await loadFixture(`${fixtureDir}synthetic-success.json`);
    fixture.calls[0].res.body = {
        code: 0,
        pointCost: 0.75,
        data: { pointCost: 99 },
    };
    const result = await runEndpoint({
        unit: await testSealedUnit(product),
        input: productInput,
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage.credits, { default: 0.75 });
    assertEquals(result.output, fixture.calls[0].res.body);
});

Deno.test("Pangolinfo: explicit zero receipt cannot fall back to a nonzero derived charge", async () => {
    const result = await replay(product, "zero-cost");
    assertEquals(result.usage, { credits: {}, evidence: { PAGE: 0 } });
});

Deno.test("Pangolinfo reviews: caller caps three pages, partial delivery bills one", async () => {
    const unit = await testSealedUnit(reviews);
    assertEquals((await estimateEndpoint(unit, reviewInput)).credits, {
        default: 15,
    });
    const result = await replay(reviews, "review-partial", reviewInput);
    assertEquals(result.usage.credits, { default: 5 });
    assertEquals(result.usage.evidence, { PAGE: 1 });
});

Deno.test("Pangolinfo seller: actual receipt wins over requested page cap", async () => {
    const input = {
        body: { site: "amz_us", content: "ATVPDKIKX0DER", pageCount: 3 },
    };
    const unit = await testSealedUnit(seller);
    assertEquals((await estimateEndpoint(unit, input)).credits, { default: 3 });
    const result = await replay(seller, "success", input);
    assertEquals(result.usage.credits, { default: 1 });
});

Deno.test("Pangolinfo Rufus: only answered turns bill when no pointCost is reported", async () => {
    const input = {
        body: { param: ["Shopping question", "Refused question"] },
    };
    const unit = await testSealedUnit(rufus);
    assertEquals((await estimateEndpoint(unit, input)).credits, {
        default: 12,
    });
    const result = await replay(rufus, "alexa-partial", input);
    assertEquals(result.usage, {
        credits: { default: 6 },
        evidence: { RESULT: 1 },
    });
    const refusal = await replay(rufus, "alexa-refused", input);
    assertEquals(refusal.httpStatus, 422);
    assertEquals(refusal.usage.credits, {});
});

Deno.test("Pangolinfo Rufus: legacy no-status turns follow backend answer detection", async () => {
    const fixture = await loadFixture(
        `${fixtureDir}synthetic-alexa-partial.json`,
    );
    fixture.calls[0].res.body = {
        code: 0,
        data: {
            json: [
                { content: "  " },
                { products: [{ asin: "B0B4NLGCH5" }] },
                { follow_up_questions: ["Next?"] },
                { status: "refused", content: "Do not bill" },
            ],
        },
    };
    const result = await runEndpoint({
        unit: await testSealedUnit(rufus),
        input: { body: { param: ["One", "Two", "Three", "Four"] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage.credits, { default: 12 });
});

Deno.test("Pangolinfo Maps: native rate is 1.5 points per search", async () => {
    const unit = await testSealedUnit(maps);
    assertEquals(
        (await estimateEndpoint(unit, {
            body: { q: "coffee", ll: "37,-122,13z", num: 10 },
        })).credits,
        { default: 1.5 },
    );
});

Deno.test("Pangolinfo: reject invalid scope, parser override and callback before network", async () => {
    const bad: [string, RunInput][] = [
        [product, {
            body: { ...productInput.body, parserName: "amzReviewV2" },
        }],
        [product, { body: { ...productInput.body, format: "rawHtml" } }],
        [product, {
            body: {
                ...productInput.body,
                bizContext: { callbackUrl: "https://example.com" },
            },
        }],
        [product, { body: { ...productInput.body, site: "unknown" } }],
        [product, { body: { ...productInput.body, content: "bad-asin" } }],
        [reviews, {
            body: {
                url: "https://www.amazon.com",
                bizContext: { asin: "B0B4NLGCH5" },
            },
        }],
        [reviews, {
            body: {
                ...reviewInput.body,
                bizContext: { asin: "B0B4NLGCH5", pageCount: 11 },
            },
        }],
        [seller, { body: { site: "amz_us", content: "ATVPDKIKX0DER" } }],
        [maps, { body: { q: "coffee", ll: "37,-122,13z" } }],
        [maps, { body: { q: "coffee", ll: "invalid", num: 10 } }],
        [rufus, { body: { param: [] } }],
        ["pangolinfo#amazon/search", {
            body: { url: "https://www.amazon.com.evil.test/s?k=coffee" },
        }],
    ];
    for (const [id, input] of bad) {
        const unit = await testSealedUnit(id);
        await assertRejects(
            () => runEndpoint({ unit, input, mode: "replay" }),
            Error,
            "INVALID_INPUT",
        );
    }
});

Deno.test({
    name: "Pangolinfo product live (gated on PANGOLINFO_CREDENTIALS_API_KEY)",
    ignore: liveSkip("pangolinfo"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(product),
            input: productInput,
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assert((result.usage.credits.default ?? 0) > 0);
    },
});
