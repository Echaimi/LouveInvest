import { useEffect, useState } from "react";
import type { ScpiSnapshot } from "../shared/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MarketOverview } from "./MarketOverview";
import { PurchaseDraft } from "./PurchaseDraft";

type MarketState =
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; message: string };

export default function App() {
  const [market, setMarket] = useState<MarketState>({ status: "loading" });
  const [snapshot, setSnapshot] = useState<ScpiSnapshot | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    setMarket({ status: "loading" });
    async function loadMarket() {
      let message = "Les données Primopierre ne peuvent pas être chargées. Vérifiez votre connexion puis réessayez.";
      try {
        const response = await fetch("/api/scpi/primopierre", { signal, cache: "no-store" });
        if (!response.ok) {
          const error = await response.json();
          if (typeof error.message === "string") message = error.message;
          throw new Error(message);
        }
        const snapshot: ScpiSnapshot = await response.json();
        if (!controller.signal.aborted) {
          setSnapshot(snapshot);
          setMarket({ status: "loaded" });
        }
      } catch {
        if (!controller.signal.aborted) setMarket({
          status: "error", message: signal.aborted ? "Le chargement dépasse le délai de 15 secondes. Vous pouvez réessayer." : message,
        });
      }
    }
    void loadMarket();
    return () => controller.abort();
  }, [refresh]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#market-content" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-white focus:p-4">Aller au contenu</a>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <a href="/" aria-label="LouveInvest, accueil" className="rounded-sm text-2xl tracking-tight">
            <span className="font-bold text-primary">louve</span><span className="font-light">invest</span>
          </a>
          <span className="text-sm text-muted-foreground">Marché secondaire des SCPI</span>
        </div>
      </header>

      <main id="market-content" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Praemia REIM France · Pleine propriété</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Primopierre</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Consultez le marché publié, son rendement historique et une estimation de la prochaine confrontation.</p>
          </div>
          <Button type="button" variant="outline" disabled={market.status === "loading"} onClick={() => setRefresh((value) => value + 1)}>
            {market.status === "loading" ? "Chargement…" : market.status === "error" ? "Réessayer" : "Actualiser les données"}
          </Button>
        </div>

        <div aria-busy={market.status === "loading"}>
          {market.status === "loading" && <p role="status" className="rounded-xl border border-border bg-card p-8 text-sm">Chargement du marché Primopierre depuis la source officielle…</p>}
          {market.status === "error" && <Alert variant="destructive"><AlertTitle>Chargement impossible</AlertTitle><AlertDescription>{market.message}</AlertDescription></Alert>}
          {market.status === "loaded" && snapshot && <MarketOverview snapshot={snapshot} />}
        </div>
        {snapshot && <PurchaseDraft fees={snapshot.fees} />}
        {market.status !== "loaded" && <p className="mt-6 text-xs leading-5 text-muted-foreground">Les SCPI comportent un risque de perte en capital. Les revenus et la liquidité ne sont pas garantis.</p>}
      </main>
    </div>
  );
}
