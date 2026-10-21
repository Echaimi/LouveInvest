import { useEffect, useState, type FormEvent } from "react";
import type { FeeSchedule } from "../shared/types";
import { calculateBudgetCents } from "../shared/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPurchaseEmail, formatPurchaseMoney, parsePriceCents, validatePurchaseDraft } from "./email";

const initialFields = { firstName: "", lastName: "", associateNumber: "", quantity: "", maxPriceExcludingFeesCents: "" };

export function PurchaseDraft({ fees }: { fees: FeeSchedule }) {
  const [fields, setFields] = useState(initialFields);
  const [isAssociate, setIsAssociate] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ text: string; quantity: number; priceCents: number; budgetCents: number } | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setPreview(null);
    setFeedback("");
  }, [fees.commissionBps, fees.registrationBps]);

  function clearPreview() {
    setPreview(null);
    setFeedback("");
    setErrors({});
  }

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      ...fields, isAssociate,
      quantity: /^\d+$/.test(fields.quantity.trim()) ? Number(fields.quantity) : NaN,
      maxPriceExcludingFeesCents: parsePriceCents(fields.maxPriceExcludingFeesCents) ?? NaN,
    };
    const nextErrors = validatePurchaseDraft(input);
    let budgetCents = 0;
    if (Object.keys(nextErrors).length === 0) {
      try {
        budgetCents = calculateBudgetCents(input.maxPriceExcludingFeesCents, input.quantity, fees);
      } catch {
        nextErrors.quantity = "Le budget dépasse la précision de calcul. Réduisez le nombre de parts ou le prix.";
      }
    }
    setErrors(nextErrors);
    setFeedback("");
    if (Object.keys(nextErrors).length > 0) {
      setPreview(null);
      event.currentTarget.querySelector<HTMLInputElement>(`#${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    const email = buildPurchaseEmail(input);
    setPreview({ text: `Objet : ${email.subject}\n\n${email.body}`, quantity: input.quantity, priceCents: input.maxPriceExcludingFeesCents, budgetCents });
  }

  async function copyEmail() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.text);
      setFeedback("Email copié.");
    } catch {
      setFeedback("Copie impossible. Sélectionnez le texte de l'aperçu pour le copier manuellement, ou téléchargez-le.");
    }
  }

  function downloadEmail() {
    if (!preview) return;
    try {
      const url = URL.createObjectURL(new Blob([preview.text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "projet-achat-primopierre.txt";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("Fichier texte préparé pour le téléchargement.");
    } catch {
      setFeedback("Téléchargement impossible. Vous pouvez copier le texte de l'aperçu.");
    }
  }

  const inputs = [
    { name: "firstName", label: "Prénom", autoComplete: "given-name" },
    { name: "lastName", label: "Nom", autoComplete: "family-name" },
    ...(isAssociate ? [{ name: "associateNumber", label: "Numéro d'associé", autoComplete: "off" }] : []),
    { name: "quantity", label: "Nombre de parts souhaité", inputMode: "numeric" as const },
    { name: "maxPriceExcludingFeesCents", label: "Prix maximum par part hors frais (€)", inputMode: "decimal" as const },
  ];

  return (
    <section aria-labelledby="purchase-heading" className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle><h2 id="purchase-heading" className="text-xl">Préparer mon projet d'achat</h2></CardTitle>
          <CardDescription>Destinataire : Praemia REIM France · Primopierre · Particulier en pleine propriété.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm leading-6 text-muted-foreground">Vos informations restent dans cette page, sans stockage ni transmission au serveur. Aucun email ni ordre n'est envoyé.</p>
          <form noValidate onSubmit={prepare} className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Êtes-vous déjà associé de Primopierre ?</legend>
              <div className="flex gap-6">
                {[false, true].map(value => <Label key={String(value)} className="flex items-center gap-2 leading-6">
                  <input type="radio" name="isAssociate" checked={isAssociate === value} onChange={() => { setIsAssociate(value); clearPreview(); }} />{value ? "Oui" : "Non"}
                </Label>)}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              {inputs.map(({ name, label, ...props }) => <div key={name} className="space-y-2">
                <Label htmlFor={name}>{label}</Label>
                <Input id={name} name={name} required {...props} value={fields[name as keyof typeof fields]} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : name === "maxPriceExcludingFeesCents" ? "price-help" : undefined}
                  onChange={event => { setFields({ ...fields, [name]: event.target.value }); clearPreview(); }} />
                {errors[name] && <p id={`${name}-error`} className="text-sm text-destructive">{errors[name]}</p>}
              </div>)}
            </div>
            <p id="price-help" className="text-sm text-muted-foreground">Tous les champs affichés sont obligatoires. Prix en euros, avec au plus deux décimales (exemple : 31,88), sans séparateur de milliers. Ce prix maximum exclut les frais acquéreur.</p>
            {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-destructive">Le projet n'a pas été préparé. Corrigez les champs indiqués.</p>}
            <Button type="submit">Préparer l'email</Button>
          </form>

          {preview && <div className="space-y-5 border-t pt-6">
            <dl className="grid gap-4 rounded-lg bg-secondary p-5 text-sm sm:grid-cols-3">
              <div><dt>Nombre de parts</dt><dd className="mt-1 font-semibold">{preview.quantity}</dd></div>
              <div><dt>Prix maximum par part hors frais</dt><dd className="mt-1 font-semibold">{formatPurchaseMoney(preview.priceCents)}</dd></div>
              <div><dt>Budget indicatif frais proportionnels inclus</dt><dd className="mt-1 font-semibold">{formatPurchaseMoney(preview.budgetCents)}</dd></div>
            </dl>
            <p className="text-sm leading-6 text-muted-foreground">Budget calculé au prix maximum, commission et droits inclus, hors frais fixes. <a className="source-link" href={fees.sourceUrl}>Source des frais</a>. Le projet ne modifie pas l'estimation du carnet et ne garantit aucune exécution.</p>
            <Label htmlFor="email-preview">Aperçu de l'email : objet et corps</Label>
            <textarea id="email-preview" readOnly value={preview.text} rows={19} className="block w-full rounded-md border bg-background p-4 text-sm leading-6" />
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void copyEmail()}>Copier l'email</Button>
              <Button type="button" variant="outline" onClick={downloadEmail}>Télécharger en .txt</Button>
            </div>
          </div>}
          <p role="status" className="text-sm leading-6">{feedback}</p>
        </CardContent>
      </Card>
    </section>
  );
}
