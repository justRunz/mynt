# Mynt

Gestion d'une collection de pièces euro de circulation. Le nom vient de *mynet*,
forme en vieil anglais de *mint*, l'atelier de frappe.

Ce que les outils existants ne font pas et que Mynt fait : dire **où chaque pièce
est physiquement rangée** — quel classeur, quelle page, quel trou.

## Structure

```
apps/web/        la PWA React
packages/core/   types générés depuis la base, constantes métier, logique pure
supabase/        migrations et configuration — infrastructure partagée
```

`packages/core` est ce que consommerait un futur `apps/backend`, d'où le monorepo.

## Démarrer

Prérequis : Node ≥ 20.19, pnpm, Docker.

```bash
pnpm install
pnpm db:start                       # base locale, imprime l'URL et la clé anon
cp apps/web/.env.example apps/web/.env.local   # y coller les valeurs affichées
pnpm dev
```

Studio sur http://127.0.0.1:54323.

### Emails en local

**Aucun email ne quitte la machine.** Confirmations et liens de réinitialisation sont
capturés par Mailpit sur **http://127.0.0.1:54324** — c'est là qu'il faut les lire,
pas dans une vraie boîte.

Les redirections d'authentification sont contraintes par `supabase/config.toml` :
`site_url` et `additional_redirect_urls` doivent couvrir l'URL de l'app, sinon le lien
de réinitialisation renvoie ailleurs. Les mêmes réglages existent côté hébergé, dans
Authentication puis URL Configuration, et sont à mettre à jour à la mise en ligne.

La confirmation d'email est désactivée en local (`enable_confirmations = false`),
donc l'inscription ouvre directement une session.

## Commandes

| | |
|---|---|
| `pnpm dev` | serveur de développement |
| `pnpm build` | build de production |
| `pnpm typecheck` | TypeScript sur tout le workspace |
| `pnpm lint` | oxlint |
| `pnpm test` | vitest |
| `pnpm db:reset` | rejoue les migrations et le seed depuis zéro |
| `pnpm db:types` | régénère `packages/core/src/database.types.ts` |
| `pnpm db:demo` | remplit un compte de démonstration |

`pnpm db:types` est à relancer après **toute** migration : le typage des grades
casse volontairement la compilation si l'enum de la base a bougé.

## Conventions

Le code est en anglais, y compris le schéma SQL. Seuls les textes affichés sont
en français, et ils passent par i18n — aucune chaîne en dur dans un composant.

Ce qui reste en français est de la donnée saisie par l'utilisateur (nom de
classeur, notes, pseudo). Les états de conservation sont stockés avec des codes
anglais (`VERY_FINE`…) et affichés en français (TB, TTB, SUP, FDC) : les échelles
de conservation sont nationales et ne sont pas des traductions les unes des autres.

Attention au français qui ne passe pas par des chaînes : les valeurs faciales,
les dates et le tri des noms de pays doivent passer par `Intl` (voir
`apps/web/src/app/lib/format.ts` et `countries.ts`).

## Hors ligne

Sans réseau, l'app est **consultable mais pas modifiable**. C'est un choix, pas
une limite technique : les pièces se saisissent au bureau, alors que vérifier si
on possède déjà une pièce se fait debout devant un stand.

Deux mécanismes distincts rendent la consultation possible.

La **coquille** est précachée par un service worker (`vite-plugin-pwa`), polices
comprises — d'où Inter auto-hébergée plutôt que servie par un CDN. Il ne s'active
que sur un build de production : `pnpm --filter @mynt/web preview`.

Les **données** vivent dans le cache TanStack Query persisté en IndexedDB, gardé
une semaine. Seules les lectures y sont écrites : `shouldDehydrateMutation` est
explicitement à `false`, et les mutations utilisent `networkMode: 'always'` pour
**échouer tout de suite** au lieu d'attendre en silence un retour de réseau qui
ne serait plus exploité.

Les commandes d'écriture sont donc désactivées hors ligne — grisées et non
masquées, avec une explication dans la barre du haut. Le glisser-déposer aussi,
via `useDraggable({ disabled })` : une pièce qui suit le curseur puis revient en
place sans explication est pire qu'une grille qui ne bouge pas.

L'état de la connexion vient de `useIsOnline` (`apps/web/src/app/hooks/`), qui
lit le gestionnaire de TanStack Query plutôt que `navigator.onLine` directement :
les écrans et la couche réseau ne peuvent ainsi jamais être en désaccord.

## Mise en ligne

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

Les migrations sont la source de vérité, partagée entre le local et l'hébergé.
Seules les variables d'environnement changent.
