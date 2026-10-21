import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, test } from "vitest";
import { PurchaseDraft } from "./PurchaseDraft";

test("présente un formulaire local nommé, un prix hors frais et aucun envoi", () => {
  const $ = load(renderToStaticMarkup(<PurchaseDraft fees={{ commissionBps: 480, registrationBps: 500, sourceUrl: "https://example.com/fees" }} />));
  for (const name of ["firstName", "lastName", "quantity", "maxPriceExcludingFeesCents"]) {
    expect($(`label[for="${name}"]`).text()).not.toBe("");
    expect($(`input[id="${name}"]`)).toHaveLength(1);
  }
  expect($("form").attr("action")).toBeUndefined();
  expect($("form").attr("novalidate")).toBeDefined();
  expect($.text()).toContain("Prix maximum par part hors frais");
  expect($.text()).toContain("Aucun email ni ordre n'est envoyé");
  expect($("textarea")).toHaveLength(0);
});
