import { expect, test } from "vitest";
import { buildYieldSeries } from "./YieldChart";

const dividend = { year: 2025, grossPerShareCents: 500, sourceUrl: "https://example.com/dividend" };
const fees = { commissionBps: 480, registrationBps: 500, sourceUrl: "https://example.com/fees" };

test("calcule la sensibilité au prix hors frais avec le dividende constant et les deux frais", () => {
  const series = buildYieldSeries(10000, dividend, fees);
  expect(series[0]).toEqual({ priceCents: 5000, yieldPercent: expect.closeTo(9.107468, 5) });
  expect(series.find(point => point.priceCents === 10000)?.yieldPercent).toBeCloseTo(4.553734, 5);
  expect(series.at(-1)).toEqual({ priceCents: 15000, yieldPercent: expect.closeTo(3.035823, 5) });
  expect(series.length).toBeLessThanOrEqual(52);
  expect(series.every((point, index) => index === 0 || point.priceCents > series[index - 1].priceCents && point.yieldPercent < series[index - 1].yieldPercent)).toBe(true);
});

test("garde des prix positifs sûrs et le prix de référence exact, même aux bornes", () => {
  for (const reference of [1, 3187, Number.MAX_SAFE_INTEGER]) {
    const series = buildYieldSeries(reference, dividend, fees);
    expect(series.some(point => point.priceCents === reference)).toBe(true);
    expect(series.every(point => Number.isSafeInteger(point.priceCents) && point.priceCents > 0 && Number.isFinite(point.yieldPercent))).toBe(true);
  }
  expect(buildYieldSeries(null, dividend, fees)).toEqual([]);
  expect(buildYieldSeries(0, dividend, fees)).toEqual([]);
});
