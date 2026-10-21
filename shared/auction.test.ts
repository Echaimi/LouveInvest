import { expect, test } from "vitest";
import { estimateAuction } from "./auction.js";
import type { OrderBook } from "./types.js";

test("retient le prix qui maximise le nombre de parts échangeables", () => {
  const book: OrderBook = {
    buys: [{ priceCents: 10000, quantity: 10 }, { priceCents: 9000, quantity: 10 }],
    sells: [{ priceCents: 8000, quantity: 5 }, { priceCents: 9000, quantity: 20 }],
  };
  expect(estimateAuction(book, null)).toMatchObject({
    status: "estimated", priceCents: 9000, matchedShares: 20,
  });
});

test("n'annonce aucun prix quand les limites d'achat et de vente ne se croisent pas", () => {
  expect(estimateAuction({
    buys: [{ priceCents: 8000, quantity: 10 }],
    sells: [{ priceCents: 9000, quantity: 10 }],
  }, 8500)).toMatchObject({ status: "no-crossing", priceCents: null, matchedShares: 0 });
});

test("signale des données insuffisantes si un côté du carnet est vide", () => {
  const levels = [{ priceCents: 9000, quantity: 10 }];
  for (const book of [{ buys: [], sells: levels }, { buys: levels, sells: [] }, { buys: [], sells: [] }]) {
    expect(estimateAuction(book, null)).toMatchObject({
      status: "insufficient-data", priceCents: null, matchedShares: 0,
      assumptions: expect.arrayContaining([expect.stringMatching(/vide/)]),
    });
  }
});

test("échange les parts dont les limites sont exactement égales", () => {
  expect(estimateAuction({
    buys: [{ priceCents: 9000, quantity: 12 }],
    sells: [{ priceCents: 9000, quantity: 10 }],
  }, null)).toMatchObject({ status: "estimated", priceCents: 9000, matchedShares: 10 });
});

test("départage les volumes égaux par le déséquilibre avant la proximité du dernier prix", () => {
  expect(estimateAuction({
    buys: [{ priceCents: 10000, quantity: 10 }, { priceCents: 8500, quantity: 10 }],
    sells: [{ priceCents: 8000, quantity: 10 }],
  }, 8000)).toMatchObject({ status: "estimated", priceCents: 8501, matchedShares: 10 });
});

test("retient le prix le plus proche du dernier prix, y compris à l'intérieur d'un plateau", () => {
  const book: OrderBook = {
    buys: [{ priceCents: 10000, quantity: 10 }],
    sells: [{ priceCents: 8000, quantity: 10 }],
  };
  expect(estimateAuction(book, 9500)).toMatchObject({ priceCents: 9500, matchedShares: 10 });
  expect(estimateAuction(book, 11000)).toMatchObject({ priceCents: 10000, matchedShares: 10 });
});

test("retient le prix le plus bas sans dernier prix et annonce cette convention", () => {
  expect(estimateAuction({
    buys: [{ priceCents: 10000, quantity: 10 }],
    sells: [{ priceCents: 8000, quantity: 10 }],
  }, null)).toMatchObject({
    priceCents: 8000, matchedShares: 10,
    assumptions: expect.arrayContaining([expect.stringMatching(/plus bas.*convention/)]),
  });
});

test("refuse les prix, quantités et dernier prix malformés sans annoncer d'estimation", () => {
  const valid = { priceCents: 9000, quantity: 10 };
  const invalidLevels = [
    ...[0, -1, 9000.5, NaN, Infinity].map((priceCents) => ({ ...valid, priceCents })),
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((quantity) => ({ ...valid, quantity })),
  ];
  for (const level of invalidLevels) {
    for (const book of [{ buys: [level], sells: [valid] }, { buys: [valid], sells: [level] }]) {
      expect(estimateAuction(book, null)).toMatchObject({
        status: "insufficient-data", priceCents: null, matchedShares: 0,
      });
    }
  }
  for (const lastPrice of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(estimateAuction({ buys: [valid], sells: [valid] }, lastPrice).status).toBe("insufficient-data");
  }
});

test("refuse une somme de parts qui dépasse les entiers sûrs", () => {
  const excessive = [
    { priceCents: 9000, quantity: Number.MAX_SAFE_INTEGER },
    { priceCents: 9000, quantity: 1 },
  ];
  const valid = [{ priceCents: 9000, quantity: 10 }];
  for (const book of [{ buys: excessive, sells: valid }, { buys: valid, sells: excessive }]) {
    expect(estimateAuction(book, null)).toMatchObject({
      status: "insufficient-data", priceCents: null, matchedShares: 0,
    });
  }
});

test("accepte 100 000 prix candidats mais refuse une amplitude supérieure", () => {
  const book = {
    buys: [{ priceCents: 100000, quantity: 10 }],
    sells: [{ priceCents: 1, quantity: 10 }],
  };
  expect(estimateAuction(book, 50000)).toMatchObject({ priceCents: 50000, matchedShares: 10 });
  expect(estimateAuction({ ...book, buys: [{ priceCents: 100001, quantity: 10 }] }, null)).toMatchObject({
    status: "insufficient-data", priceCents: null, matchedShares: 0,
    assumptions: expect.arrayContaining([expect.stringMatching(/100 000/)]),
  });
});

test("agrège les niveaux sans modifier le carnet et explicite les hypothèses", () => {
  const book: OrderBook = {
    buys: [{ priceCents: 9000, quantity: 6 }, { priceCents: 10000, quantity: 10 }, { priceCents: 9000, quantity: 4 }],
    sells: [{ priceCents: 9000, quantity: 20 }, { priceCents: 8000, quantity: 5 }],
  };
  const before = structuredClone(book);
  for (const side of [book.buys, book.sells]) {
    side.forEach(Object.freeze);
    Object.freeze(side);
  }
  Object.freeze(book);
  const result = estimateAuction(book, null);
  expect(result).toMatchObject({ status: "estimated", priceCents: 9000, matchedShares: 20 });
  expect(book).toEqual(before);
  expect(result.assumptions).toEqual(expect.arrayContaining([
    expect.stringMatching(/partiel/), expect.stringMatching(/instantané/),
    expect.stringMatching(/agrég/), expect.stringMatching(/partielles/), expect.stringMatching(/chronologique/),
  ]));
});
