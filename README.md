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

`packages/core` est ce que consommerait un futur `apps/api`, d'où le monorepo.

## Démarrer

Prérequis : Node ≥ 20.19, pnpm, Docker.

```bash
pnpm install
pnpm db:start                       # base locale, imprime l'URL et la clé anon
cp apps/web/.env.example apps/web/.env.local   # y coller les valeurs affichées
pnpm dev
```

Studio sur http://127.0.0.1:54323, attrape-mails sur http://127.0.0.1:54324.

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
`apps/web/src/lib/format.ts` et `countries.ts`).

## Mise en ligne

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

Les migrations sont la source de vérité, partagée entre le local et l'hébergé.
Seules les variables d'environnement changent.
