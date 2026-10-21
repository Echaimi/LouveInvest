# LouveInvest Marché secondaire des SCPI

Une petite app pour consulter le marché de Primopierre et préparer un achat. Elle récupère les ordres d'achat et de vente chez Praemia REIM. Elle affiche le rendement frais inclus et estime le prix de la prochaine confrontation.

Le client peut ensuite préparer un email, le relire, le copier ou le télécharger. L'app n'envoie aucun email et ne transmet aucun ordre.

## Lancer en local

**Node.js 24.x et npm**, une connexion internet et les ports 5173/3001 libres :

```sh
npm ci
npm run dev
```

L'app est sur http://127.0.0.1:5173. Vite redirige les appels API vers le serveur sur le port 3001.

Pour tester et lancer le build, arrêter le dev puis :

```sh
npm test
npm run build
npm start
```

L'app tourne alors sur http://127.0.0.1:3001. Le build vérifie aussi les types.

Avec Docker Desktop en mode Linux :

```sh
docker compose up --build --detach --wait
npm run test:docker
```

Rendez-vous sur http://127.0.0.1:3000.

## Sous le capot

J'ai gardé une structure simple :

- `client/` : React/TypeScript, Tailwind et shadcn/ui. Les données du formulaire restent en mémoire dans la page. Elles ne sont ni envoyées au serveur ni sauvegardées. Recharger la page efface la saisie.
- `server/` : Node/TypeScript, Express, `fetch` natif et Cheerio pour récupérer et valider le HTML.
- `shared/` : types communs et fonctions de calcul. On peut tester les calculs sans lancer l'interface.

Pas besoin de base de données pour ce parcours. Pour ajouter une SCPI, on pourrait réutiliser les calculs et les types. Il faudrait adapter la lecture de sa page et vérifier ses frais et ses règles.

## Sources et calculs

Les données viennent de la [page Primopierre](https://www.praemiareim.fr/fr/scpi-primopierre). L'app affiche quand elles ont été récupérées et quand Praemia REIM les a mises à jour. Si la récupération échoue, une erreur permet de réessayer. Les données de test ne remplacent jamais les données réelles.

Les paramètres de `server/scpi-config.ts` viennent de deux documents :

- [Rapport annuel 2025, p. 6](https://www.praemiareim.fr/documents/14836074/14836290/Primopierre%2BRapport%2BAnnuel%2B2025.pdf/32234cef-d9b6-60b3-9ad5-08bfa8420b37?t=1780564491137) : **4,56 € de dividende brut par part**, à actualiser chaque année.
- [Mandat d'achat d'août 2026, p. 3–4](https://www.praemiareim.fr/documents/14836074/1099398036/PRIMOPIERRE%20-%20Mandat%20d%27achat%20-%20Personne%20Physique/dc631e45-bbdd-40fa-23b6-9d52b2160104) : **4,80 % de commission TTC + 5 % de droits**, sur la même base hors frais.

Avec P le prix hors frais, D le dividende annuel brut et Q le nombre de parts :

```text
Prix acquéreur = P × 1,098
Rendement (%) = 100 × D / (P × 1,098)
Budget = Q × P × 1,098
```

Les montants sont stockés en centimes entiers. Le budget est arrondi une seule fois, sur le total. Le rendement est arrondi uniquement à l'affichage.

Le prix maximum saisi dans le formulaire reste **hors frais**, y compris dans l'email. Le budget frais inclus est affiché à part. Le mandat officiel demande un prix frais inclus : l'email ne le remplace pas.

## Hypothèses et limites

L'estimation cherche le prix qui permet d'échanger le plus de parts. Si plusieurs prix conviennent, elle choisit dans cet ordre :

1. Le plus petit écart entre les quantités à acheter et à vendre.
2. Le prix le plus proche du dernier prix d'exécution.
3. Le prix le plus bas, par convention.

Le calcul suppose qu'un ordre peut être exécuté en partie. Il ne tient pas compte de l'ordre d'arrivée des ordres. Le projet du client n'est pas ajouté au carnet.

Le carnet ne montre que cinq niveaux de prix à l'achat et à la vente. Il peut changer avant la confrontation : l'estimation ne garantit donc aucun échange. Le calcul examine au maximum 100 000 prix différents.

Si la structure de la page source change, le scraping peut casser. Le rendement repose sur le dividende passé. Il ne garantit ni les revenus futurs ni la possibilité de revendre les parts.

**Bonus graphique fait** avec Recharts et Chart de shadcn. Il montre le rendement pour des prix entre 50 et 150 % du dernier prix constaté, en gardant le même dividende. **Bonus frais fixes non fait** : les formules ci-dessus ne les incluent pas.

## Ma façon de bosser

J'ai utilisé les skills de Matt Pocock comme guides pour l'IA : `domain-modeling` pour clarifier les termes métier, `codebase-design` pour garder des fonctions simples à utiliser et le `tdd` pour tester les résultats attendus. Par exemple, le glossaire distingue le prix hors frais du prix acquéreur frais inclus.

Pour le TDD, je pars d'un test qui échoue, puis j'ajoute le code nécessaire pour le faire passer. Un cas concret : un prix source énorme était accepté alors que son montant après frais dépassait la précision de calcul. Un test a reproduit le problème, puis le serveur a réutilisé `calculateBudgetCents` pour refuser ce prix.

J'ai refactoré les calculs pour regrouper les validations et les frais dans des fonctions communes. J'ai aussi réutilisé le calcul de rendement dans le graphique pour éviter de dupliquer la formule. Les tests vérifient que les résultats restent les mêmes.

## Vérifs et IA

La suite compte 51 tests sur la lecture du HTML, les erreurs, les calculs et l'email. Le build, les types et le lancement en local et avec Docker ont été vérifiés pendant le développement. Le parcours a aussi été vérifié sur mobile et ordinateur, avec une navigation au clavier. Pas de vérification avec un vrai lecteur d'écran ni sur tous les navigateurs.

L'IA a aidé à organiser le projet et à écrire du code et des tests.

**Exemple de proposition vérifiée :** l'IA a proposé d'additionner la commission de 4,80 % et les droits d'enregistrement de 5 % sur le prix hors frais. J'ai vérifié cette règle dans le mandat officiel de Primopierre, puis contrôlé le calcul avec un exemple : pour une part à 100 €, le prix acquéreur est de 109,80 €. Avec un dividende annuel brut de 5 €, le rendement est d'environ 4,55 %. Ces résultats sont couverts par les tests.

**Proposition écartée :** j'ai retirer un test proposé par l'IA qui vérifiait surtout les libellés du graphique. Il apportait peu de valeur. J'ai gardé les tests des calculs, des bornes et du cas où le graphique ne se charge pas. Les textes ont été vérifiés directement dans l'interface.

**Piste d'architecture écartée :** ajouter une base de données pour sauvegarder les projets d'achat aurait compliqué ce petit parcours et demandé de stocker des données. Le sujet demande seulement de préparer un email. J'ai donc gardé le formulaire en mémoire dans la page, sans stockage côté serveur.

**Piste fonctionnelle écartée :** ajouter le projet du client au carnet pour simuler son effet sur la confrontation. J'ai préféré garder une estimation basée uniquement sur le marché publié. Le formulaire prépare un email : il ne dépose pas d'ordre.

**Autre piste écartée :** afficher les anciennes données sans avertissement si le scraping échoue. Un carnet périmé pourrait donner une estimation trompeuse. J'ai préféré afficher une erreur avec un bouton pour réessayer.
