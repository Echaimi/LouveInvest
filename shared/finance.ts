import type { FeeSchedule } from "./types.js";

function requireInteger(value: number, minimum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} : entier sûr supérieur ou égal à ${minimum} attendu.`);
  }
}

function acquisitionBps(fees: FeeSchedule): bigint {
  requireInteger(fees.commissionBps, 0, "Commission en points de base");
  requireInteger(fees.registrationBps, 0, "Droits en points de base");
  return 10000n + BigInt(fees.commissionBps) + BigInt(fees.registrationBps);
}

/** Prix d'exécution hors frais ; ratio non arrondi, hors frais fixes. */
export function calculateYieldPercent(dividendCents: number, executionPriceCents: number, fees: FeeSchedule): number {
  requireInteger(dividendCents, 0, "Dividende en centimes");
  requireInteger(executionPriceCents, 1, "Prix hors frais en centimes");
  return 100 * dividendCents / (executionPriceCents * Number(acquisitionBps(fees)) / 10000);
}

export function calculateBudgetCents(priceCents: number, quantity: number, fees: FeeSchedule): number {
  requireInteger(priceCents, 1, "Prix hors frais en centimes");
  requireInteger(quantity, 1, "Nombre de parts");
  const total = BigInt(priceCents) * BigInt(quantity) * acquisitionBps(fees);
  // Arrondi au centime du total, demi-centime vers le haut, sans arrondi unitaire.
  const rounded = Number((total + 5000n) / 10000n);
  requireInteger(rounded, 1, "Budget en centimes");
  return rounded;
}
