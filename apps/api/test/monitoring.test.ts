import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ORIGIN, createTestContext } from "./helpers";

const DSN = "https://publickey@o123.ingest.sentry.io/4567";
const envelope = (dsn: string) =>
  `${JSON.stringify({ dsn, sent_at: new Date().toISOString() })}\n{"type":"event"}\n{"message":"boom"}`;

describe("error tracking switched off (default)", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it("tells the browser there is nothing to set up, and has no tunnel", async () => {
    expect((await ctx.app.inject("/api/client-config")).json()).toMatchObject({ sentryDsn: null });
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/monitoring",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      payload: envelope(DSN),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("error tracking switched on", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  beforeAll(async () => {
    ctx = await createTestContext({ SENTRY_DSN: DSN, SENTRY_RELEASE: "1.4.0" });
  });
  afterAll(() => ctx.close());
  afterEach(() => vi.restoreAllMocks());

  const post = (payload: string) =>
    ctx.app.inject({
      method: "POST",
      url: "/api/monitoring",
      headers: { origin: ORIGIN, "content-type": "text/plain;charset=UTF-8" },
      payload,
    });

  it("gives the browser the DSN and release", async () => {
    expect((await ctx.app.inject("/api/client-config")).json()).toEqual({
      sentryDsn: DSN,
      environment: "production",
      release: "1.4.0",
    });
  });

  it("forwards our own project's reports to Sentry", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const report = envelope(DSN);
    const res = await post(report);
    expect(res.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://o123.ingest.sentry.io/api/4567/envelope/",
      expect.objectContaining({ method: "POST", body: report }),
    );
  });

  it("refuses to relay to any other project or host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect((await post(envelope("https://k@o123.ingest.sentry.io/9999"))).statusCode).toBe(403);
    expect((await post(envelope("https://k@evil.example/4567"))).statusCode).toBe(403);
    expect((await post("not an envelope")).statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
