import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, test } from "vitest";
import { parsePrimopierreHtml } from "../server/primopierre";
import { primopierreConfig } from "../server/scpi-config";
import type { ScpiSnapshot } from "../shared/types";
import { MarketOverview } from "./MarketOverview";

const snapshot: ScpiSnapshot = {
  ...primopierreConfig,
  ...parsePrimopierreHtml(readFileSync(new URL("../server/fixtures/primopierre.html", import.meta.url), "utf8")),
  fetchedAt: "2026-10-21T15:30:00Z",
};

test("présente les prix distincts, le rendement, le carnet et l'estimation avec leurs sources", () => {
  const $ = load(renderToStaticMarkup(<MarketOverview snapshot={snapshot} />));
  const text = $.text().replace(/\s/g, " ");
  expect(text).toContain("31,88 €");
  expect(text).toContain("35,00 €");
  expect(text).toContain("13,03 %");
  expect(text).toContain("Dividende brut 2025");
  expect(text).toContain("20,00 €");
  expect(text).toContain("752 parts");
  expect(text).toContain("29 oct. 2026");
  expect(text).toContain("17:30");
  expect(text).toContain("17:09");
  expect($("a").map((_i, link) => $(link).attr("href")).get()).toEqual(expect.arrayContaining([
    snapshot.sourceUrl, snapshot.fees.sourceUrl, snapshot.dividend.sourceUrl,
  ]));
  expect($("table")).toHaveLength(3);
  expect($('[role="region"][tabindex="0"]')).toHaveLength(3);
  expect(text).toContain("Prix acquéreur frais inclus publié");
  expect(text).not.toMatch(/NaN|Infinity/);
});

test("signale les données manquantes et conserve l'année et l'avertissement du dividende", () => {
  const partial: ScpiSnapshot = {
    ...snapshot, lastExecution: null, orderBook: null, history: null,
    nextAuctionAt: null, orderDeadlineAt: null, sourceUpdatedAt: null,
    warnings: ["Dividende brut 2025 : année attendue 2026."],
  };
  const $ = load(renderToStaticMarkup(<MarketOverview snapshot={partial} />));
  const text = $.text().replace(/\s/g, " ");
  expect(text.match(/Indisponible/g)).toHaveLength(3);
  expect(text).toContain("Carnet indisponible");
  expect(text).toContain("Historique indisponible");
  expect(text).toContain("Estimation indisponible");
  expect(text).toContain("Dividende brut 2025 : année attendue 2026");
  expect(text).not.toMatch(/NaN|Infinity|0,00|752 parts/);
  expect($("table")).toHaveLength(0);
});

test("distingue un carnet vide d'un carnet sans croisement", () => {
  const empty = renderToStaticMarkup(<MarketOverview snapshot={{ ...snapshot, orderBook: { buys: [], sells: [] } }} />);
  expect(load(empty).text()).toContain("Estimation indisponible");
  expect(load(empty).text().match(/Aucun ordre publié/g)).toHaveLength(2);
  const noCrossing = renderToStaticMarkup(<MarketOverview snapshot={{ ...snapshot, orderBook: {
    buys: [{ priceCents: 1000, quantity: 10 }], sells: [{ priceCents: 2000, quantity: 10 }],
  } }} />);
  expect(load(noCrossing).text()).toContain("Aucun croisement");
  expect(load(noCrossing).text()).not.toContain("0 parts");
});

test("présente chaque confrontation en fiche avec tous ses libellés et les données manquantes", () => {
  const $ = load(renderToStaticMarkup(<MarketOverview snapshot={{ ...snapshot, history: [
    { date: "2026-09-24", priceCents: 3188, buyerPriceCents: 3500, matchedShares: 364 },
    { date: null, priceCents: 3600, buyerPriceCents: null, matchedShares: 1747 },
  ] }} />));
  const records = $('ol[aria-label="Historique des confrontations"] > li');
  expect(records).toHaveLength(2);
  const first = records.eq(0).text().replace(/\s/g, " ");
  expect(first).toContain("24 sept. 2026");
  expect(first).toContain("Prix hors frais31,88 €");
  expect(first).toContain("Prix acquéreur frais inclus publié35,00 €");
  expect(first).toContain("Parts échangées364");
  expect(records.eq(1).text()).toContain("Non communiquée");
  expect(records.eq(1).text()).toContain("Non communiqué");
});
