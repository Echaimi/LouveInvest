import { load } from "cheerio";
import type { ScpiSnapshot } from "../shared/types.js";
import { calculateBudgetCents } from "../shared/finance.js";
import { primopierreConfig } from "./scpi-config.js";

type MarketData = Pick<ScpiSnapshot,
  "sourceUpdatedAt" | "lastExecution" | "nextAuctionAt" | "orderDeadlineAt" |
  "orderBook" | "history" | "warnings"
>;

export class PrimopierreError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export async function fetchPrimopierre(): Promise<ScpiSnapshot> {
  const signal = AbortSignal.timeout(10_000);
  let html: string;
  try {
    const response = await fetch(primopierreConfig.sourceUrl, { signal });
    if (!response.ok) throw new PrimopierreError("SOURCE_HTTP_ERROR", "La source Primopierre retourne une erreur HTTP.");
    html = await response.text();
  } catch (error) {
    if (error instanceof PrimopierreError) throw error;
    if (signal.aborted) throw new PrimopierreError("SOURCE_TIMEOUT", "La source Primopierre ne répond pas dans le délai de 10 secondes.");
    throw new PrimopierreError("SOURCE_UNAVAILABLE", "La source Primopierre est momentanément inaccessible.");
  }
  try {
    const market = parsePrimopierreHtml(html);
    if (market.lastExecution !== null) calculateBudgetCents(market.lastExecution.priceCents, 1, primopierreConfig.fees);
    const fetchedAt = new Date();
    const previousYear = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", year: "numeric" }).format(fetchedAt)) - 1;
    if (primopierreConfig.dividend.year !== previousYear) {
      market.warnings.push(`Dividende brut ${primopierreConfig.dividend.year} : donnée à actualiser, année attendue ${previousYear}. Le rendement ne représente pas l'année civile précédente.`);
    }
    return { ...primopierreConfig, ...market, fetchedAt: fetchedAt.toISOString() };
  } catch {
    throw new PrimopierreError("SOURCE_INVALID_FORMAT", "Les données de marché Primopierre sont absentes ou leur format a changé.");
  }
}

function key(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function number(value: string, money = false) {
  const text = (money ? value.replace(/\s*€(?:\s*\/\s*Part)?\s*$/i, "") : value).trim();
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:,\d{1,2})?$/.test(text) ||
    (!money && text.includes(","))) throw new Error("Nombre source invalide.");
  const result = Math.round(Number(text.replace(/\s/g, "").replace(",", ".")) * (money ? 100 : 1));
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error("Nombre source invalide.");
  return result;
}

function missing(value: string) {
  return /^[\s—–-]*$/.test(value);
}

function day(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error("Date source invalide.");
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error("Date source invalide.");
  }
  return iso;
}

function parisTimestamp(date: string, time: string) {
  const isoDay = day(date);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Heure source invalide.");
  const local = `${isoDay}T${time}:00`;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "longOffset",
  });
  let instant = new Date(`${local}Z`);
  // Recheck the offset after shifting UTC to the actual Paris instant.
  for (let attempt = 0; attempt < 2; attempt++) {
    const offset = formatter.formatToParts(instant)
      .find((part) => part.type === "timeZoneName")!.value.replace("GMT", "");
    const result = `${local}${offset}`;
    instant = new Date(result);
    if (formatter.format(instant).startsWith(`${isoDay} ${time}:00`)) return result;
  }
  throw new Error("Heure source inexistante.");
}

function tableRows(html: string, columns: string[]) {
  const $ = load(html);
  const headers = $("thead th").map((_i, cell) => key($(cell).text())).get();
  const indices = columns.map((column) => headers.indexOf(column));
  if (indices.includes(-1) || new Set(headers).size !== headers.length) {
    throw new Error("Colonnes de marché absentes ou ambiguës.");
  }
  return $("tbody tr").toArray().map((row) => {
    const cells = $(row).find("td").map((_i, cell) => $(cell).text().trim()).get();
    if (cells.length !== headers.length) throw new Error("Ligne de marché incomplète.");
    return indices.map((index) => cells[index]);
  });
}

export function parsePrimopierreHtml(html: string): MarketData {
  const $ = load(html);
  const market = $(".fixed-capital-web");
  if (market.length !== 1) throw new Error("Section de marché absente ou ambiguë.");
  const warnings = ["Carnet partiel : seuls les cinq meilleurs niveaux de chaque côté sont publiés, actualisés toutes les 30 minutes."];
  function optionalPrice(value: string, label: string) {
    if (!missing(value)) return number(value, true);
    warnings.push(`Prix indisponible : ${label}.`);
    return null;
  }
  function scheduledAt(labelText: string) {
    const item = market.find(".key-label").filter((_i, label) =>
      key($(label).text()).includes(labelText)).parent();
    if (item.length > 1) throw new Error("Date de marché ambiguë.");
    const date = item.find(".key-number").text().trim();
    const time = item.find(".key-date").text().trim();
    if (missing(date) || missing(time)) {
      warnings.push(`Date indisponible : ${labelText}.`);
      return null;
    }
    return parisTimestamp(date, time);
  }
  const update = /mise a jour le (\d{2}\/\d{2}\/\d{4}) - (\d{2}:\d{2})/.exec(
    key(market.find(".fixed-capital-subtitle").text()));
  if (!update) warnings.push("Date de mise à jour source indisponible.");
  const priceItem = market.find(".key-label").filter((_i, label) =>
    key($(label).text()).startsWith("dernier prix d execution")).parent();
  if (priceItem.length > 1) throw new Error("Dernier prix ambigu.");
  const priceCents = optionalPrice(priceItem.find(".key-number").text(), "dernier prix d'exécution");
  const historyTable = market.find("#historic-table table");
  if (historyTable.length > 1) throw new Error("Historique ambigu.");
  const history = historyTable.length === 0 ? null : tableRows(historyTable.toString(),
    ["date", "nombre de parts echangees", "prix vendeur", "prix acquereur"])
    .map(([date, quantity, price, buyerPrice]) => ({
      date: day(date), matchedShares: number(quantity), priceCents: number(price, true),
      buyerPriceCents: optionalPrice(buyerPrice, "prix acquéreur historique"),
    })).sort((a, b) => b.date.localeCompare(a.date));
  if (!history?.length) warnings.push("Historique indisponible ; date du dernier échange inconnue.");
  const executionDate = history?.[0]?.priceCents === priceCents ? history[0].date : null;
  if (priceCents !== null && history?.length && !executionDate) {
    warnings.push("Le dernier prix publié diffère du dernier historique ; sa date reste inconnue.");
  }
  function orders(side: "achat" | "vente") {
    const heading = market.find("h3").filter((_i, element) =>
      key($(element).text()).includes(side === "achat" ? "ordres d achat" : "ordres de vente"));
    if (heading.length !== 1) throw new Error("Côté du carnet absent ou ambigu.");
    const container = heading.parent();
    const table = container.find("table");
    if (table.length <= 1 && table.find("tbody tr").length === 0 &&
      /\baucun ordre\b|\baucune offre\b|\b0 ordres?\b/.test(key(container.text()))) return [];
    if (table.length !== 1 || table.find("tbody tr").length === 0) {
      throw new Error("Tableau du carnet absent ou vide sans explication.");
    }
    return tableRows(table.toString(), ["nombre de parts", "prix vendeur"])
      .map(([quantity, price]) => ({ quantity: number(quantity), priceCents: number(price, true) }));
  }
  return {
    lastExecution: priceCents === null ? null : { priceCents, date: executionDate },
    history, sourceUpdatedAt: update ? parisTimestamp(update[1], update[2]) : null,
    nextAuctionAt: scheduledAt("prochaine confrontation"),
    orderDeadlineAt: scheduledAt("date limite de reception des ordres"),
    orderBook: { buys: orders("achat"), sells: orders("vente") },
    warnings,
  };
}
