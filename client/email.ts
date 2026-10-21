export interface PurchaseDraftInput {
  firstName: string;
  lastName: string;
  isAssociate: boolean;
  associateNumber?: string;
  quantity: number;
  maxPriceExcludingFeesCents: number;
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatPurchaseMoney(cents: number): string {
  return euros.formatToParts(BigInt(cents) / 100n)
    .map(({ type, value }) => type === "fraction" ? String(cents % 100).padStart(2, "0") : value).join("");
}

export function parsePriceCents(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(text)) return null;
  const [euros, decimals = ""] = text.split(/[,.]/);
  const cents = Number(euros + decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function validatePurchaseDraft(input: PurchaseDraftInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const singleLine = (value: string) => value.trim().length > 0 && !/[\x00-\x1f\x7f\u2028\u2029]/.test(value);
  if (!singleLine(input.firstName)) errors.firstName = "Indiquez votre prénom sur une seule ligne.";
  if (!singleLine(input.lastName)) errors.lastName = "Indiquez votre nom sur une seule ligne.";
  if (input.isAssociate && !singleLine(input.associateNumber ?? "")) errors.associateNumber = "Indiquez votre numéro d'associé sur une seule ligne.";
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) errors.quantity = "Indiquez un nombre entier de parts strictement positif.";
  if (!Number.isSafeInteger(input.maxPriceExcludingFeesCents) || input.maxPriceExcludingFeesCents <= 0) errors.maxPriceExcludingFeesCents = "Indiquez un prix positif avec au plus deux décimales.";
  return errors;
}

export function buildPurchaseEmail(input: PurchaseDraftInput): { subject: string; body: string } {
  if (Object.keys(validatePurchaseDraft(input)).length > 0) throw new RangeError("Projet d'achat invalide.");
  const price = formatPurchaseMoney(input.maxPriceExcludingFeesCents);
  return {
    subject: "Projet d'achat de parts Primopierre",
    body: [
      "À l'attention de Praemia REIM France,", "", "Bonjour,", "",
      "Je souhaite préparer un projet d'achat de parts Primopierre en pleine propriété, en tant que particulier.", "",
      `Prénom : ${input.firstName.trim()}`,
      `Nom : ${input.lastName.trim()}`,
      ...(input.isAssociate ? [`Numéro d'associé : ${input.associateNumber!.trim()}`] : []),
      `Nombre de parts souhaité : ${input.quantity}`,
      `Prix maximum proposé par part (hors frais) : ${price}`, "",
      "Ce projet préparatoire ne constitue pas un ordre enregistré. Merci de m'indiquer les démarches et documents nécessaires.", "",
      "Cordialement,", `${input.firstName.trim()} ${input.lastName.trim()}`,
    ].join("\n"),
  };
}
