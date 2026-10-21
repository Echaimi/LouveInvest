import { expect, test } from "vitest";
import { buildPurchaseEmail, parsePriceCents, validatePurchaseDraft, type PurchaseDraftInput } from "./email";

const draft: PurchaseDraftInput = {
  firstName: "Élodie", lastName: "D'Arcy-Martin", isAssociate: false,
  quantity: 10, maxPriceExcludingFeesCents: 3188,
};

test("prépare un projet Primopierre avec l'identité, les parts et le prix maximum hors frais", () => {
  const email = buildPurchaseEmail(draft);
  expect(email.subject).toBe("Projet d'achat de parts Primopierre");
  expect(email.body.replace(/\s/g, " ")).toContain("Prénom : Élodie");
  expect(email.body).toContain("Nom : D'Arcy-Martin");
  expect(email.body).toContain("Nombre de parts souhaité : 10");
  expect(email.body.replace(/\s/g, " ")).toContain("Prix maximum proposé par part (hors frais) : 31,88 €");
  expect(email.body).toContain("Praemia REIM France");
  expect(email.body).toContain("pleine propriété");
  expect(email.body).toContain("ne constitue pas un ordre");
  expect(email.body).not.toContain("Numéro d'associé");
});

test("convertit le prix français en centimes exacts sans accepter une saisie ambiguë", () => {
  for (const [text, cents] of [["31,88", 3188], ["31.88", 3188], ["0,29", 29], ["100", 10000], [" 20,5 ", 2050], ["0,01", 1]] as const) {
    expect(parsePriceCents(text)).toBe(cents);
  }
  for (const text of ["", "0", "-1", "1,234", "1.234,56", "1 000", "1e2", "Infinity", "12 euros", "1,", "900719925474099,99"]) {
    expect(parsePriceCents(text)).toBeNull();
  }
});

test("conserve le centime dans l'email même pour un prix très élevé accepté", () => {
  const email = buildPurchaseEmail({ ...draft, quantity: 1, maxPriceExcludingFeesCents: 8000000000000001 });
  expect(email.body).toContain("80\u202f000\u202f000\u202f000\u202f000,01\u00a0€");
});

test("inclut le numéro de l'associé sans perdre ses zéros initiaux et l'omet pour un nouvel investisseur", () => {
  expect(buildPurchaseEmail({ ...draft, isAssociate: true, associateNumber: " 001234 " }).body).toContain("Numéro d'associé : 001234");
  expect(buildPurchaseEmail({ ...draft, associateNumber: "001234" }).body).not.toContain("001234");
});

test("refuse une identité vide, les retours ligne, un nombre de parts ou un prix invalide et un associé sans numéro", () => {
  expect(validatePurchaseDraft(draft)).toEqual({});
  for (const change of [
    { firstName: " " }, { lastName: "" }, { firstName: "Élodie\nObjet : autre" },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(quantity => ({ quantity })),
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(maxPriceExcludingFeesCents => ({ maxPriceExcludingFeesCents })),
    { isAssociate: true, associateNumber: " " }, { isAssociate: true, associateNumber: "01\n02" },
  ]) {
    expect(Object.keys(validatePurchaseDraft({ ...draft, ...change })).length).toBeGreaterThan(0);
    expect(() => buildPurchaseEmail({ ...draft, ...change })).toThrow();
  }
});
