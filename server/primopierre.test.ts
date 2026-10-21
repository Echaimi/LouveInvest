import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { afterEach, expect, test, vi } from "vitest";
import { fetchPrimopierre, parsePrimopierreHtml } from "./primopierre.js";

const html = readFileSync(new URL("./fixtures/primopierre.html", import.meta.url), "utf8");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("parse les prix hors frais, les parts, l'historique et les dates", () => {
  const market = parsePrimopierreHtml(html);
  expect(market.lastExecution).toEqual({ priceCents: 3188, date: "2026-09-24" });
  expect(market.history).toHaveLength(7);
  expect(market.history?.[0]).toEqual({
    priceCents: 3188, buyerPriceCents: 3500, matchedShares: 364, date: "2026-09-24",
  });
  expect(market.orderBook?.buys).toEqual([
    { priceCents: 3188, quantity: 18 },
    { priceCents: 2000, quantity: 1000 },
    { priceCents: 1000, quantity: 10 },
  ]);
  expect(market.orderBook?.sells).toHaveLength(5);
  expect(market.orderBook?.sells[0]).toEqual({ priceCents: 2000, quantity: 752 });
  expect(market.sourceUpdatedAt).toBe("2026-10-21T17:09:00+02:00");
  expect(market.nextAuctionAt).toBe("2026-10-29T16:00:00+01:00");
  expect(market.orderDeadlineAt).toBe("2026-10-27T16:00:00+01:00");
});

test("gère les nombres français avec des espaces et une virgule", () => {
  const market = parsePrimopierreHtml(html.replaceAll("31,88", "1\u202f234,56")
    .replace("<td>1000</td>", "<td>1&nbsp;000</td>"));
  expect(market.lastExecution?.priceCents).toBe(123456);
  expect(market.orderBook?.buys[1].quantity).toBe(1000);
});

test("remonte une erreur si le bloc marché ou le carnet a disparu", () => {
  expect(() => parsePrimopierreHtml("<html>Maintenance</html>")).toThrow();
  const $ = load(html);
  $("h3.fixed-capital-table-title").first().parent().find("table").remove();
  expect(() => parsePrimopierreHtml($.html())).toThrow();
});

test("ne confond pas un carnet vide avec un tableau cassé", () => {
  const $ = load(html);
  const sides = $("h3.fixed-capital-table-title").parent();
  sides.find("tbody").empty();
  expect(() => parsePrimopierreHtml($.html())).toThrow();
  sides.find("table").replaceWith("<p>Aucun ordre enregistré</p>");
  expect(parsePrimopierreHtml($.html()).orderBook).toEqual({ buys: [], sells: [] });
  sides.find("p").text("10 ordres enregistrés");
  expect(() => parsePrimopierreHtml($.html())).toThrow();
});

test.each(["1,5", "18€"])(
  "rejette une quantité de parts invalide : %s", (quantity) => {
    const $ = load(html);
    $("h3.fixed-capital-table-title").first().parent().find("tbody tr").first().find("td").eq(1).text(quantity);
    expect(() => parsePrimopierreHtml($.html())).toThrow();
  },
);

test("rejette un prix vendeur à zéro", () => {
  const $ = load(html);
  $("h3.fixed-capital-table-title").first().parent().find("tbody tr").first().find("td").eq(2).text("0,00€");
  expect(() => parsePrimopierreHtml($.html())).toThrow();
});

test("rejette les dates et les heures impossibles", () => {
  expect(() => parsePrimopierreHtml(html.replace("29/10/2026", "31/02/2026"))).toThrow();
  expect(() => parsePrimopierreHtml(html.replace("29/10/2026", "29/03/2026").replace("16:00", "02:30"))).toThrow();
});

test.each([
  ["29/03/2026 - 01:30", "2026-03-29T01:30:00+01:00"],
  ["25/10/2026 - 01:30", "2026-10-25T01:30:00+02:00"],
])("gère le changement d'heure à Paris : %s", (local, expected) => {
  expect(parsePrimopierreHtml(html.replace("21/10/2026 - 17:09", local)).sourceUpdatedAt).toBe(expected);
});

test("ne plante pas si des prix ou des horaires facultatifs manquent", () => {
  const $ = load(html);
  $(".key-item").first().remove();
  $(".key-date").empty();
  $("#historic-table tbody tr").first().find("td").eq(3).text("—");
  const market = parsePrimopierreHtml($.html());
  expect(market.lastExecution).toBeNull();
  expect(market.nextAuctionAt).toBeNull();
  expect(market.orderDeadlineAt).toBeNull();
  expect(market.history?.[0].buyerPriceCents).toBeNull();
  expect(market.orderBook?.buys[0]).toEqual({ priceCents: 3188, quantity: 18 });
  expect(market.warnings.length).toBeGreaterThanOrEqual(5);
});

test("met les données manquantes à null avec un warning", () => {
  const $ = load(html);
  $("#historic-table, .fixed-capital-subtitle").remove();
  $(".key-label").filter((_i, label) => $(label).text().includes("confrontation")).parent().remove();
  const market = parsePrimopierreHtml($.html());
  expect(market.history).toBeNull();
  expect(market.lastExecution).toEqual({ priceCents: 3188, date: null });
  expect(market.sourceUpdatedAt).toBeNull();
  expect(market.nextAuctionAt).toBeNull();
  expect(market.warnings.length).toBeGreaterThanOrEqual(4);
});

test("ne colle pas la date d'un vieil échange sur le dernier prix", () => {
  const market = parsePrimopierreHtml(html.replace("<td>31,88&nbsp; €</td>", "<td>30,00 €</td>")
    .replace("<td>36,00&nbsp; €</td>", "<td>31,88 €</td>"));
  expect(market.lastExecution?.date).toBeNull();
  expect(market.warnings.some((warning) => warning.includes("historique"))).toBe(true);
});

test("remonte la panne réseau sans fallback sur les données de test", async () => {
  vi.stubGlobal("fetch", async () => { throw new TypeError("Connexion impossible"); });
  await expect(fetchPrimopierre()).rejects.toMatchObject({ code: "SOURCE_UNAVAILABLE" });
});

test("refuse un prix source dont le coût frais inclus dépasse la précision des calculs", async () => {
  vi.stubGlobal("fetch", async () => new Response(html.replaceAll("31,88", "90000000000000,00")));
  await expect(fetchPrimopierre()).rejects.toMatchObject({ code: "SOURCE_INVALID_FORMAT" });
});

test("avertit quand le dividende ne correspond plus à l'année précédente à Paris", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubGlobal("fetch", async () => new Response(html));
  vi.setSystemTime(new Date("2026-12-31T22:59:59Z"));
  const current = await fetchPrimopierre();
  expect(current.warnings.some((warning) => warning.includes("Dividende"))).toBe(false);

  vi.setSystemTime(new Date("2026-12-31T23:00:00Z"));
  const stale = await fetchPrimopierre();
  expect(stale.dividend).toEqual(current.dividend);
  expect(stale.warnings).toEqual(expect.arrayContaining([
    expect.stringMatching(/Dividende.*2025.*2026/),
  ]));
  expect(stale.fetchedAt).toBe("2026-12-31T23:00:00.000Z");
});
