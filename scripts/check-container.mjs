import assert from "node:assert/strict";

const baseUrl = `http://127.0.0.1:${process.env.APP_PORT ?? 3000}`;

async function request(path) {
  const response = await fetch(new URL(path, baseUrl), {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200, `${path} must return HTTP 200`);
  return response;
}

const health = await request("/api/health");
assert.deepEqual(await health.json(), { status: "ok" });

const page = await request("/");
assert.match(page.headers.get("content-type") ?? "", /text\/html/);
const html = await page.text();
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
assert.ok(assets.length >= 2, "The built page must include JavaScript and CSS");
for (const [, assetPath] of assets) {
  await request(assetPath);
}

console.log(`Container verified: API, built page and assets at ${baseUrl}`);
