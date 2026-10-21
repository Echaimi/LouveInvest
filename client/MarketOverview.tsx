import type { ReactNode } from "react";
import type { OrderLevel, ScpiSnapshot } from "../shared/types";
import { calculateBudgetCents, calculateYieldPercent } from "../shared/finance";
import { estimateAuction } from "../shared/auction";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const percentages = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantities = new Intl.NumberFormat("fr-FR");

function money(cents: number) {
  return euros.format(cents / 100);
}

function date(value: string | null, withTime = false) {
  if (value === null) return "Non communiquée";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium", ...(withTime ? { timeStyle: "short" as const } : {}), timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function Indicator({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle><h3 className="text-sm leading-5 text-muted-foreground">{label}</h3></CardTitle></CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

function OrderTable({ title, levels }: { title: string; levels: OrderLevel[] }) {
  return (
    <Card>
      <CardHeader><CardTitle><h3>{title}</h3></CardTitle><CardDescription>Limites par part hors frais acquéreur.</CardDescription></CardHeader>
      <CardContent>
        {levels.length === 0 ? <p className="text-sm text-muted-foreground">Aucun ordre publié de ce côté.</p> : (
          <Table aria-label={title}>
            <TableCaption>{title} : niveaux visibles uniquement.</TableCaption>
            <TableHeader><TableRow><TableHead scope="col">Prix hors frais</TableHead><TableHead scope="col" className="text-right">Parts</TableHead></TableRow></TableHeader>
            <TableBody>{levels.map((level, index) => (
              <TableRow key={`${level.priceCents}-${index}`}>
                <TableCell className="tabular-nums">{money(level.priceCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{quantities.format(level.quantity)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketOverview({ snapshot }: { snapshot: ScpiSnapshot }) {
  const { lastExecution, fees, dividend, orderBook } = snapshot;
  const estimate = orderBook === null ? null : estimateAuction(orderBook, lastExecution?.priceCents ?? null);
  const yieldPercent = lastExecution === null ? null : calculateYieldPercent(dividend.grossPerShareCents, lastExecution.priceCents, fees);

  return (
    <div className="space-y-8">
      {snapshot.warnings.length > 0 && (
        <Alert role="note" className="border-amber-300 bg-amber-50">
          <AlertTitle>À savoir sur les données</AlertTitle>
          <AlertDescription><ul className="list-disc space-y-1 pl-5">{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="observed-heading">
        <h2 id="observed-heading" className="mb-4 text-xl font-semibold">Dernière confrontation constatée</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Indicator label="Dernier prix d'exécution hors frais" value={lastExecution === null ? "Indisponible" : money(lastExecution.priceCents)}>
            <p>Prix net vendeur par part.</p><p>Date : {date(lastExecution?.date ?? null)}.</p>
          </Indicator>
          <Indicator label="Prix acquéreur frais inclus" value={lastExecution === null ? "Indisponible" : money(calculateBudgetCents(lastExecution.priceCents, 1, fees))}>
            <p>Commission {percentages.format(fees.commissionBps / 10000)} + droits {percentages.format(fees.registrationBps / 10000)}.</p><p>Par part, hors frais fixes.</p>
          </Indicator>
          <Indicator label="Rendement brut historique frais inclus" value={yieldPercent === null ? "Indisponible" : percentages.format(yieldPercent / 100)}>
            <p>Dividende brut {dividend.year} : {money(dividend.grossPerShareCents)} par part.</p><p>Hors frais fixes ; revenus futurs non garantis.</p>
          </Indicator>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sources : <a className="source-link" href={fees.sourceUrl}>commission et droits</a> · <a className="source-link" href={dividend.sourceUrl}>dividende annuel brut {dividend.year}</a>. Le rendement utilise le coût frais inclus avant arrondi d'affichage.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="text-xl">Estimation de la prochaine confrontation</h2></CardTitle>
          <CardDescription>Une approximation du carnet visible, sans garantie d'exécution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {estimate?.status === "estimated" && estimate.priceCents !== null ? (
            <div className="grid gap-5 rounded-lg bg-secondary p-5 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">Prix estimé hors frais par part</p><p className="mt-1 text-3xl font-semibold tabular-nums">{money(estimate.priceCents)}</p></div>
              <div><p className="text-sm text-muted-foreground">Volume potentiellement échangeable</p><p className="mt-1 text-3xl font-semibold tabular-nums">{quantities.format(estimate.matchedShares)} parts</p></div>
            </div>
          ) : <p className="rounded-lg bg-secondary p-4 text-sm">{estimate?.status === "no-crossing" ? "Aucun croisement : les limites d'achat et de vente visibles ne permettent aucun échange." : "Estimation indisponible : les données du carnet sont insuffisantes."}</p>}
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Prochaine confrontation</dt><dd className="mt-1 font-medium">{date(snapshot.nextAuctionAt, true)}</dd></div>
            <div><dt className="text-muted-foreground">Date limite de réception des ordres</dt><dd className="mt-1 font-medium">{date(snapshot.orderDeadlineAt, true)}</dd></div>
          </dl>
          {estimate !== null && <details className="text-sm leading-6"><summary className="cursor-pointer font-medium">Méthode et limites de l'estimation</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">{estimate.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></details>}
        </CardContent>
      </Card>

      <section aria-labelledby="book-heading">
        <h2 id="book-heading" className="mb-4 text-xl font-semibold">Carnet d'ordres publié</h2>
        {orderBook === null ? <p className="text-sm text-muted-foreground">Carnet indisponible.</p> : (
          <div className="grid gap-4 lg:grid-cols-2"><OrderTable title="Achats" levels={orderBook.buys} /><OrderTable title="Ventes" levels={orderBook.sells} /></div>
        )}
      </section>

      <Card>
        <CardHeader><CardTitle><h2 className="text-xl">Historique des confrontations</h2></CardTitle><CardDescription>Échanges constatés, distincts de l'estimation ci-dessus.</CardDescription></CardHeader>
        <CardContent>
          {!snapshot.history?.length ? <p className="text-sm text-muted-foreground">Historique indisponible.</p> : (
            <Table aria-label="Historique des confrontations">
              <TableCaption>Historique publié par Praemia REIM. Prix par part en euros.</TableCaption>
              <TableHeader><TableRow><TableHead scope="col">Date</TableHead><TableHead scope="col" className="text-right">Prix hors frais</TableHead><TableHead scope="col" className="text-right">Prix acquéreur frais inclus publié</TableHead><TableHead scope="col" className="text-right">Parts échangées</TableHead></TableRow></TableHeader>
              <TableBody>{snapshot.history.map((execution, index) => (
                <TableRow key={`${execution.date}-${index}`}>
                  <TableCell className="whitespace-nowrap">{date(execution.date)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{money(execution.priceCents)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{execution.buyerPriceCents === null ? "Non communiqué" : money(execution.buyerPriceCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{quantities.format(execution.matchedShares)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <footer className="space-y-2 text-sm leading-6 text-muted-foreground">
        <p><a className="source-link" href={snapshot.sourceUrl}>Source officielle : {snapshot.name} — Praemia REIM France</a></p>
        <p>Mise à jour source : {date(snapshot.sourceUpdatedAt, true)} · Collecte : {date(snapshot.fetchedAt, true)}. Horaires de Paris.</p>
        <p>Le carnet publié est partiel et peut changer. Les SCPI comportent un risque de perte en capital ; l'exécution, les revenus et la liquidité ne sont pas garantis.</p>
      </footer>
    </div>
  );
}
