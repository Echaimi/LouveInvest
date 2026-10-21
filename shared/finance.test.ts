import { expect, test } from "vitest";
import { calculateBudgetCents, calculateYieldPercent } from "./finance.js";
import type { FeeSchedule } from "./types.js";

const fees: FeeSchedule = { commissionBps: 480, registrationBps: 500, sourceUrl: "https://example.com/fees" };

test("calcule le rendement à partir du prix hors frais avec commission et droits", () => {
  expect(calculateYieldPercent(500, 10000, fees)).toBeCloseTo(4.553734, 6);
  expect(calculateYieldPercent(456, 3188, fees)).toBeCloseTo(13.0269933, 7);
});

test("calcule le budget et arrondit une seule fois au centime sur le total", () => {
  expect(calculateBudgetCents(10000, 10, fees)).toBe(109800);
  expect(calculateBudgetCents(1, 10, fees)).toBe(11);
  expect(calculateBudgetCents(1250, 1, fees)).toBe(1373);
});

test("refuse les prix et quantités invalides et les montants non représentables", () => {
  for (const price of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => calculateYieldPercent(500, price, fees)).toThrow(RangeError);
    expect(() => calculateBudgetCents(price, 1, fees)).toThrow(RangeError);
  }
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => calculateBudgetCents(10000, quantity, fees)).toThrow(RangeError);
  }
  expect(() => calculateBudgetCents(Number.MAX_SAFE_INTEGER, 2, fees)).toThrow(RangeError);
});

test("accepte un dividende nul et refuse un dividende invalide", () => {
  expect(calculateYieldPercent(0, 10000, fees)).toBe(0);
  for (const dividend of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => calculateYieldPercent(dividend, 10000, fees)).toThrow(RangeError);
  }
});

test("accepte des frais nuls et refuse les taux invalides", () => {
  const noFees = { ...fees, commissionBps: 0, registrationBps: 0 };
  expect(calculateYieldPercent(500, 10000, noFees)).toBe(5);
  expect(calculateBudgetCents(10000, 10, noFees)).toBe(100000);
  for (const field of ["commissionBps", "registrationBps"] as const) {
    for (const rate of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const invalidFees = { ...fees, [field]: rate };
      expect(() => calculateYieldPercent(500, 10000, invalidFees)).toThrow(RangeError);
      expect(() => calculateBudgetCents(10000, 1, invalidFees)).toThrow(RangeError);
    }
  }
});
