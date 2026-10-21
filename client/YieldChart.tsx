import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { AnnualDividend, FeeSchedule } from "../shared/types";
import { calculateYieldPercent } from "../shared/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const percentages = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const chartConfig = { yieldPercent: { label: "Rendement frais inclus", color: "var(--primary)" } } satisfies ChartConfig;

export function buildYieldSeries(referencePriceCents: number | null, dividend: AnnualDividend, fees: FeeSchedule) {
  if (referencePriceCents === null || !Number.isSafeInteger(referencePriceCents) || referencePriceCents <= 0) return [];
  const minimum = Math.max(1, Math.round(referencePriceCents / 2));
  const maximum = Math.min(Number.MAX_SAFE_INTEGER, Math.round(referencePriceCents * 1.5));
  const prices = new Set([referencePriceCents, ...Array.from({ length: 51 }, (_, index) => minimum + Math.round((maximum - minimum) * (index / 50)))]);
  return [...prices].sort((a, b) => a - b).map(priceCents => ({
    priceCents, yieldPercent: calculateYieldPercent(dividend.grossPerShareCents, priceCents, fees),
  }));
}

export function YieldChart({ referencePriceCents, dividend, fees }: {
  referencePriceCents: number | null; dividend: AnnualDividend; fees: FeeSchedule;
}) {
  const series = buildYieldSeries(referencePriceCents, dividend, fees);
  const examples = series.filter((point, index) => index === 0 || index === series.length - 1 || point.priceCents === referencePriceCents);
  return (
    <Card role="region" aria-labelledby="yield-chart-heading">
      <CardHeader>
        <CardTitle><h2 id="yield-chart-heading" className="text-xl">Rendement selon le prix</h2></CardTitle>
        <CardDescription>Dividende brut {dividend.year} constant · frais proportionnels inclus, hors frais fixes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {series.length === 0 ? <p className="text-sm text-muted-foreground">Graphique indisponible : dernier prix d'exécution non communiqué.</p> : <>
          <p className="text-sm text-muted-foreground">Rendement brut frais inclus (%)</p>
          <ChartContainer config={chartConfig} className="h-[280px] w-full" role="group" aria-label="Courbe du rendement selon le prix hors frais" aria-describedby="yield-chart-help">
            <LineChart accessibilityLayer data={series} margin={{ top: 10, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis type="number" dataKey="priceCents" domain={[series[0].priceCents, series[series.length - 1].priceCents]} ticks={examples.map(point => point.priceCents)}
                tickFormatter={value => euros.format(value / 100)} tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis width={48} domain={[0, "auto"]} tickFormatter={value => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`} tickLine={false} axisLine={false} />
              <ChartTooltip formatter={value => [percentages.format(Number(value) / 100), chartConfig.yieldPercent.label]}
                labelFormatter={value => `Prix hors frais : ${euros.format(Number(value) / 100)}`}
                contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 8 }} />
              <ReferenceLine x={referencePriceCents!} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="yieldPercent" stroke="var(--color-yieldPercent)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
          <p className="text-center text-sm text-muted-foreground">Prix d'exécution simulé par part hors frais (€)</p>
          <p id="yield-chart-help" className="text-sm leading-6 text-muted-foreground">Prix simulés entre 50 % et 150 % du dernier prix constaté, bornés aux centimes positifs représentables. Le trait pointillé repère ce dernier prix. Utilisez les flèches sur le graphique ou consultez les valeurs ci-dessous.</p>
          <dl aria-label="Valeurs de rendement selon le prix" className="grid gap-3 sm:grid-cols-3">
            {examples.map(point => <div key={point.priceCents} className="rounded-lg bg-secondary p-3 text-sm">
              <dt className="text-muted-foreground">{euros.format(point.priceCents / 100)} hors frais{point.priceCents === referencePriceCents ? " · dernier prix" : ""}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{percentages.format(point.yieldPercent / 100)}</dd>
            </div>)}
          </dl>
        </>}
        <p className="text-sm leading-6 text-muted-foreground">Simulation à dividende brut constant de {euros.format(dividend.grossPerShareCents / 100)} par part : aucune prévision de revenu ou garantie de rendement. <a className="source-link" href={dividend.sourceUrl}>Source du dividende {dividend.year}</a> · <a className="source-link" href={fees.sourceUrl}>Commission et droits</a>.</p>
      </CardContent>
    </Card>
  );
}
