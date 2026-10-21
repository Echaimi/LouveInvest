import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, test } from "vitest";
import { createApp } from "./app.js";

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  }
});

test("the client can check that the server is available", async () => {
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("an unknown API route returns a JSON error instead of an HTML page", async () => {
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${port}/api/unknown`);

  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
});
