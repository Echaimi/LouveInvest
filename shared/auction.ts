import type { OrderBook } from "./types.js";

export interface AuctionEstimate {
  status: "estimated" | "no-crossing" | "insufficient-data";
  priceCents: number | null;
  matchedShares: number;
  assumptions: string[];
}

export function estimateAuction(book: OrderBook, lastExecutionPriceCents: number | null): AuctionEstimate {
  const assumptions = [
    "Estimation sur le carnet partiel publié ; aucune garantie sur la confrontation réelle.",
    "Le carnet est un instantané susceptible de changer avant la confrontation.",
    "Les quantités de parts sont agrégées par niveau de prix, pas les nombres d'ordres.",
    "Les exécutions partielles sont supposées possibles pour tous les niveaux.",
    "Aucune priorité chronologique individuelle ni allocation ordre par ordre n'est modélisée.",
    "Départage : volume maximal, déséquilibre minimal, puis proximité du dernier prix s'il est disponible.",
    "En ultime égalité, le prix le plus bas est retenu : convention de l'application.",
  ];
  const insufficientData = (reason: string): AuctionEstimate => ({
    status: "insufficient-data", priceCents: null, matchedShares: 0, assumptions: [...assumptions, reason],
  });
  if (!book.buys.length || !book.sells.length) {
    return insufficientData("Au moins un côté du carnet est vide ; estimation indisponible.");
  }
  const levels = [...book.buys, ...book.sells];
  if (levels.some(({ priceCents, quantity }) => !Number.isSafeInteger(priceCents) || priceCents <= 0 ||
    !Number.isSafeInteger(quantity) || quantity <= 0) ||
    (lastExecutionPriceCents !== null && (!Number.isSafeInteger(lastExecutionPriceCents) || lastExecutionPriceCents <= 0))) {
    return insufficientData("Prix hors frais ou quantité de parts invalide : un entier positif sûr est requis.");
  }
  if ([book.buys, book.sells].some((side) => !Number.isSafeInteger(side.reduce((total, level) => total + level.quantity, 0)))) {
    return insufficientData("La somme des parts dépasse les entiers sûrs ; estimation indisponible.");
  }
  const prices = levels.map((level) => level.priceCents);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  if (maximum - minimum + 1 > 100000) {
    return insufficientData("Amplitude supérieure à 100 000 prix candidats ; estimation indisponible.");
  }
  let priceCents: number | null = null;
  let matchedShares = 0;
  let smallestImbalance = Infinity;
  let nearestDistance = Infinity;
  for (let price = minimum; price <= maximum; price++) {
    const demand = book.buys.reduce((total, level) => total + (level.priceCents >= price ? level.quantity : 0), 0);
    const supply = book.sells.reduce((total, level) => total + (level.priceCents <= price ? level.quantity : 0), 0);
    const volume = Math.min(demand, supply);
    const imbalance = Math.abs(demand - supply);
    const distance = lastExecutionPriceCents === null ? 0 : Math.abs(price - lastExecutionPriceCents);
    if (volume > 0 && (volume > matchedShares ||
      (volume === matchedShares && (imbalance < smallestImbalance ||
        (imbalance === smallestImbalance && distance < nearestDistance))))) {
      priceCents = price;
      matchedShares = volume;
      smallestImbalance = imbalance;
      nearestDistance = distance;
    }
  }
  return { status: matchedShares > 0 ? "estimated" : "no-crossing", priceCents, matchedShares, assumptions };
}
