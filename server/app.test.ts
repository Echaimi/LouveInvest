import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "./app.js";

let server: Server | undefined;
const httpFetch = globalThis.fetch;
const sourceUrl = "https://www.praemiareim.fr/fr/scpi-primopierre";
const marketHtml = readFileSync(new URL("./fixtures/primopierre.html", import.meta.url), "utf8");

afterEach(async () => {
  vi.restoreAllMocks();
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  }
});

test("renvoie les données scrapées de Primopierre en JSON", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options) =>
    String(url) === sourceUrl ? Promise.resolve(new Response(marketHtml)) : httpFetch(url, options));
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  const response = await httpFetch(`http://127.0.0.1:${port}/api/scpi/primopierre`);

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const snapshot = await response.json();
  expect(snapshot).toMatchObject({
    id: "primopierre", lastExecution: { priceCents: 3188 },
    sourceUrl,
    fees: { commissionBps: 480, registrationBps: 500 },
    dividend: { year: 2025, grossPerShareCents: 456 },
    orderBook: { buys: [{ priceCents: 3188, quantity: 18 }, { priceCents: 2000, quantity: 1000 }, { priceCents: 1000, quantity: 10 }] },
  });
  expect(Number.isFinite(Date.parse(snapshot.fetchedAt))).toBe(true);
});

test.each([
  { kind: "http", cause: "renvoie une erreur HTTP", status: 502, code: "SOURCE_HTTP_ERROR" },
  { kind: "format", cause: "change de format", status: 502, code: "SOURCE_INVALID_FORMAT" },
  { kind: "timeout", cause: "ne répond pas à temps", status: 504, code: "SOURCE_TIMEOUT" },
])("remonte une erreur JSON quand la source $cause", async ({ kind, status, code }) => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  if (kind === "timeout") vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(5));
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
    if (String(url) !== sourceUrl) return httpFetch(url, options);
    if (kind === "timeout") return new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), { once: true });
    });
    return Promise.resolve(kind === "http" ? new Response(marketHtml, { status: 503 }) : new Response("Maintenance"));
  });
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  const response = await httpFetch(`http://127.0.0.1:${port}/api/scpi/primopierre`);

  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toMatchObject({ code, message: expect.any(String) });
});

test("répond OK sur la route de health check", async () => {
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("renvoie une 404 en JSON sur une route API inconnue", async () => {
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${port}/api/unknown`);

  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
});
