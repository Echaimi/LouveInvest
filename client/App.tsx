import { useEffect, useState } from "react";
import type { HealthResponse } from "../shared/types";
import { Button } from "@/components/ui/button";

type ConnectionStatus = "checking" | "available" | "unavailable";

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  async function checkConnection() {
    setStatus("checking");
    try {
      const response = await fetch("/api/health", {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Service indisponible");
      const data: HealthResponse = await response.json();
      setStatus(data.status === "ok" ? "available" : "unavailable");
    } catch {
      setStatus("unavailable");
    }
  }

  useEffect(() => {
    void checkConnection();
  }, []);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <a href="/" aria-label="LouveInvest, accueil" className="rounded-sm text-2xl tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <span className="font-bold text-primary">louve</span>
            <span className="font-light">invest</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Comprendre avant d'investir</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Le marché secondaire,<br />en clair.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">Un espace pour analyser les parts de SCPI et préparer votre projet d'achat.</p>

        <section aria-labelledby="primopierre-heading" className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Praemia REIM France</p>
              <h2 id="primopierre-heading" className="mt-2 text-2xl font-semibold">Primopierre</h2>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">En préparation</span>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">Les données de marché, le rendement et l'estimation de la prochaine confrontation seront disponibles dans les prochaines étapes.</p>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={`size-2 rounded-full ${status === "available" ? "bg-emerald-600" : status === "unavailable" ? "bg-red-600" : "bg-slate-400"}`} />
              {status === "checking" ? "Vérification du service…" : status === "available" ? "Service disponible" : "Service indisponible. Vous pouvez réessayer."}
            </p>
            <Button type="button" variant="outline" disabled={status === "checking"} onClick={() => void checkConnection()}>
              {status === "checking" ? "Vérification…" : "Vérifier la connexion"}
            </Button>
          </div>
        </section>

        <p className="mt-7 max-w-2xl text-xs leading-5 text-muted-foreground">Les SCPI comportent un risque de perte en capital. Les revenus et la liquidité ne sont pas garantis.</p>
      </main>
    </div>
  );
}
