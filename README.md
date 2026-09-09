# Mynt

Gestion d'une collection de pièces euro de circulation. Le nom vient de *mynet*,
forme en vieil anglais de *mint*, l'atelier de frappe.

Ce que les outils existants ne font pas et que Mynt fait : dire **où chaque pièce
est physiquement rangée** — quel classeur, quelle page, quel trou.

## Structure

```
apps/web/        la PWA React
apps/backend/    l'API Express : authentification, lectures, écritures
packages/core/   types partagés, constantes métier, logique pure
db/migrations/   le schéma, en SQL, joué par dbmate
```

`packages/core` est ce que les deux consomment, d'où le monorepo.

## Démarrer

Prérequis : Node ≥ 20.19, pnpm, Docker.

```bash
pnpm install
cp .env.example .env                            # y mettre AUTH_SECRET
cp apps/web/.env.example apps/web/.env.local
pnpm db:up                                      # Postgres 18 + migrations
pnpm db:demo                                    # un compte et 62 pièces
pnpm dev                                        # l'API sur 3001, l'app sur 5173
```

`pnpm db:demo` imprime l'adresse et le mot de passe du compte de démonstration.

### Comptes et sessions

L'inscription ouvre directement une session : il n'y a pas encore de vérification
d'adresse, parce qu'il n'y a pas encore de quoi envoyer un email. Le mot de passe
oublié attend la même chose.

Le jeton d'accès vit quinze minutes, en mémoire et jamais dans `localStorage`. Ce
qui survit à un rechargement est le cookie de rafraîchissement, `httpOnly` et donc
hors de portée de tout script : au démarrage l'app l'échange contre un nouveau
jeton, ce qui est exactement ce que l'écran de chargement recouvre.

## Commandes

| | |
|---|---|
| `pnpm dev` | serveur de développement |
| `pnpm build` | build de production |
| `pnpm typecheck` | TypeScript sur tout le workspace |
| `pnpm lint` | oxlint |
| `pnpm test` | vitest |
| `pnpm db:up` | démarre la base et joue les migrations |
| `pnpm db:new <nom>` | crée une migration |
| `pnpm db:reset` | rejoue les migrations depuis zéro |
| `pnpm db:catalog` | étend le catalogue jusqu'à l'année courante |
| `pnpm db:demo` | remplit un compte de démonstration |

Les migrations SQL sont la source de vérité. `apps/backend/src/db/schema.ts` en est
une **vue typée** : drizzle-kit n'a jamais le droit d'écrire dans la base — ni
`push` ni `migrate`, seulement `pull` — parce qu'il ne gère que ce qu'il sait
exprimer et supprimerait les politiques, les triggers et les rôles qu'il ignore.

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

Pas encore faite. Le plan : un conteneur qui sert `/api` et l'app bâtie derrière
un seul domaine — donc CORS n'existe qu'en développement — déployé par Dokploy sur
un VPS, avec `dbmate up` au démarrage.
