import type { ScpiConfig } from "../shared/types.js";

export const primopierreConfig: ScpiConfig = {
  id: "primopierre",
  name: "Primopierre",
  sourceUrl: "https://www.praemiareim.fr/fr/scpi-primopierre",
  // Mandat d'achat personne physique, août 2026, page 3/6. Verified 2026-10-21.
  fees: {
    commissionBps: 480,
    registrationBps: 500,
    sourceUrl:
      "https://www.praemiareim.fr/documents/14836074/1099398036/PRIMOPIERRE%20-%20Mandat%20d%27achat%20-%20Personne%20Physique/dc631e45-bbdd-40fa-23b6-9d52b2160104",
  },
  // Rapport annuel 2025, page 6: gross dividend, not the €4.40 distribution.
  dividend: {
    year: 2025,
    grossPerShareCents: 456,
    sourceUrl:
      "https://www.praemiareim.fr/documents/14836074/14836290/Primopierre%2BRapport%2BAnnuel%2B2025.pdf/32234cef-d9b6-60b3-9ad5-08bfa8420b37?t=1780564491137",
  },
};
