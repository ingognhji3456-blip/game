# 카드 원정대 (Card Expedition) — Architecture Contract

This document is the **binding contract** between modules. Several people build modules in
parallel; everything fits together only if every module follows the names, shapes and
signatures here exactly. If something is ambiguous, pick the most reasonable reading,
implement it defensively, and note it in your report — do **not** invent a different API.

## 0. Product summary

An original single-player roguelike deck-building card battler that runs by opening
`index.html` directly in a browser (works from `file://`, no server, no build step, no
network, no external libraries/CDNs/fonts). All player-facing text is **Korean**.

The player (a lone wanderer, "방랑 검사") climbs through **3 acts**. Each act has a branching
node map (combat, elite, event, shop, rest, treasure → boss). Battles are turn-based:
energy, a hand of cards drawn from a deck, enemies that telegraph intents, status effects.
Between battles the deck grows (card rewards), improves (upgrades, removal), and the player
collects relics (passive items), potions (single-use), and gold. Beat the act-3 boss to win.

All content (names, cards, enemies, relics, events, art, music) must be **original** — do
not copy names, text or designs from any existing game.

## 1. Technical rules (everyone)

- Plain browser JavaScript, classic `<script>` tags (no ES modules — they break on `file://`),
  `'use strict';` at the top of each file. No `fetch` of local files. No external assets:
  art is inline SVG generated in JS, sound is synthesized with WebAudio.
- Everything hangs off the global namespace `window.CB` (created by `js/util.js`):
  `CB.util`, `CB.data`, `CB.art`, `CB.audio`, `CB.fx`, `CB.combat`, `CB.run`, `CB.save`, `CB.ui`.
- Files must only **define** things at load time. Never call into another module at the top
  level of a file (load order is fixed, but keep it robust). Boot happens in `js/main.js` on
  `DOMContentLoaded`.
- Engine/data code (`js/util.js`, `js/data/*`, `js/core/*`) must not touch the DOM so it can run
  in Node for tests (`tests/sim.js`). Guard any `window`/`localStorage` use in `js/core/save.js`.
- Target browsers: current Chrome/Edge/Firefox/Safari, desktop first (≥1024×640), usable on
  touch devices and narrow screens.
- Do not run git commands that change repository state (commit, checkout, stash, reset…).
- Only create/modify the files you own (§2). If you need something from another module, code
  against this contract.

## 2. Files and ownership

| Owner | Files |
|---|---|
| (shared, done) | `js/util.js`, `docs/ARCHITECTURE.md` |
| (tests) | `tests/load.js` loads the browser scripts into a Node `vm` for `tests/*.js` |
| **Engine** | `js/core/combat.js`, `js/core/run.js`, `js/core/save.js`, `tests/sim.js` (+ any `tests/*`) |
| **Content** | `js/data/keywords.js`, `js/data/cards.js`, `js/data/enemies.js`, `js/data/relics.js`, `js/data/potions.js`, `js/data/events.js` |
| **Art** | `js/art/icons.js`, `js/art/enemies.js`, `css/art.css` |
| **FX/Audio** | `js/fx/audio.js`, `js/fx/fx.js`, `css/fx.css` |
| **Battle UI** | `js/ui/battle.js`, `css/battle.css` |
| **Shell UI** | `index.html`, `css/base.css`, `css/cards.css`, `css/screens.css`, `js/ui/common.js`, `js/ui/map.js`, `js/ui/screens.js`, `js/main.js` |
| **Integration** | everything; deletes the old prototype (`js/cards.js`, `js/game.js`, `style.css`), writes `README.md` |

`index.html` load order (Shell UI writes it exactly like this):

```html
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/cards.css">
<link rel="stylesheet" href="css/screens.css">
<link rel="stylesheet" href="css/battle.css">
<link rel="stylesheet" href="css/fx.css">
<link rel="stylesheet" href="css/art.css">
...
<script src="js/util.js"></script>
<script src="js/data/keywords.js"></script>
<script src="js/data/cards.js"></script>
<script src="js/data/enemies.js"></script>
<script src="js/data/relics.js"></script>
<script src="js/data/potions.js"></script>
<script src="js/data/events.js"></script>
<script src="js/art/icons.js"></script>
<script src="js/art/enemies.js"></script>
<script src="js/fx/audio.js"></script>
<script src="js/fx/fx.js"></script>
<script src="js/core/combat.js"></script>
<script src="js/core/run.js"></script>
<script src="js/core/save.js"></script>
<script src="js/ui/common.js"></script>
<script src="js/ui/map.js"></script>
<script src="js/ui/screens.js"></script>
<script src="js/ui/battle.js"></script>
<script src="js/main.js"></script>
```

## 3. Shared utilities (`CB.util`, already implemented in `js/util.js`)

`makeRng(seed)` → `rng()` in [0,1) with `rng.int(min,max)` (inclusive), `rng.pick(arr)`,
`rng.chance(p)`, `rng.shuffle(arr)` (in place), `rng.weighted({k:w}|[[item,w]])`,
`rng.sample(arr,n)`, `rng.getState()`, `rng.setState(u32)`.
Also `randomSeed()`, `clamp`, `sleep(ms)`, `josa(word,'이','가')` → particle only,
`withJosa(word,'이/가')` → word+particle, `escapeHtml`, `el(tag, attrs, children)`,
`deepClone`, `nextId(prefix)`, `bumpIdCounter(prefix, n)`.

## 4. Data formats (`CB.data`, owned by Content, consumed by Engine/UI)

All data files assign plain objects (no functions) to `CB.data.*`.

### 4.1 Keywords & statuses — `CB.data.keywords`

```js
CB.data.keywords = {
  vulnerable: { name: '취약', icon: '💔', kind: 'debuff', desc: '받는 공격 피해가 50% 증가합니다. 턴이 끝날 때마다 1 감소.' },
  exhaust:    { name: '소멸', icon: '🔥', kind: 'keyword', desc: '사용하면 이번 전투에서 제외됩니다.' },
  ...
}
```

`kind` ∈ `'buff' | 'debuff' | 'keyword'`. Must contain an entry for **every status id** below
and for these card keywords: `exhaust`(소멸), `ethereal`(휘발), `retain`(보존), `innate`(선천),
`unplayable`(사용 불가), `block`(방어도).

**Status ids (fixed list — the Engine implements exactly these behaviors):**

| id | kind | behavior ("owner" = unit that has the status) |
|---|---|---|
| `strength` | buff | +N damage per attack hit dealt (may be negative = debuff) |
| `dexterity` | buff | +N block from card/move `block` effects |
| `weak` | debuff | owner deals 25% less attack damage. −1 at end of owner's turn |
| `vulnerable` | debuff | owner takes 50% more attack damage. −1 at end of owner's turn |
| `frail` | debuff | owner gains 25% less block from card/move `block`. −1 at end of owner's turn |
| `poison` | debuff | start of owner's turn: lose N HP (ignores block), then N −1 |
| `regen` | buff | end of owner's turn: heal N, then N −1 |
| `thorns` | buff | when owner is hit by an attack, attacker loses N HP (per hit) |
| `plating` | buff | end of owner's turn: gain N block |
| `fervor` | buff | end of owner's turn: gain N strength |
| `fortress` | buff | owner's block is not removed at the start of its turn (N irrelevant, >0 = on) |
| `ward` | buff | negates the next N debuffs applied to owner (consumes 1 per negation) |
| `insight` | buff | (player) draw N extra cards at start of each turn |
| `surge` | buff | (player) gain N extra energy at start of each turn |
| `toxicAura` | buff | start of owner's turn: apply N poison to every opponent |
| `enrage` | buff | (enemy) whenever the player plays a skill card, gain N strength |
| `nextTurnBlock` | buff | start of owner's next turn: gain N block, then remove |
| `nextTurnEnergy` | buff | (player) start of next turn: gain N energy, then remove |
| `nextTurnDraw` | buff | (player) start of next turn: draw N more cards, then remove |

"Debuff" for `ward` purposes = `weak`, `vulnerable`, `frail`, `poison`, or a negative `strength`/`dexterity`.

### 4.2 Effects (combat DSL)

An effect is `{ type, ...params }`. Lists of effects run in order. `target` is **relative to the
source** of the effect:

- `'self'` — the source itself
- `'enemy'` — the single chosen opponent (for the player: the targeted enemy; for an enemy: the player)
- `'allEnemies'` — every living opponent of the source (for an enemy: just the player)
- `'randomEnemy'` — a random living opponent (each hit re-rolls if `times` > 1)
- `'allAllies'` — the source and all its living allies (for the player: just the player)

| type | params (defaults) | notes |
|---|---|---|
| `damage` | `value`, `times=1`, `target='enemy'`, `lifesteal=false`, `bonusPer?` | attack damage. `bonusPer: { stat, value }` adds `value × stat` to the base, stat ∈ `'cardsPlayedThisTurn'` (including this card), `'block'` (source's current block), `'targetPoison'`, `'exhaustCount'` (cards in exhaust pile), `'handSize'` (cards in hand after this card left it). `lifesteal` heals source by HP actually lost by target |
| `damageFromBlock` | `target='enemy'` | attack with base = source's current block |
| `block` | `value`, `target='self'` | block gain (dexterity/frail apply when from a card or enemy move) |
| `heal` | `value`, `target='self'` | |
| `healPct` | `value` (0–1 of max HP), `target='self'` | |
| `loseHp` | `value`, `target='self'` | ignores block, not an attack |
| `applyStatus` | `status`, `value`, `target` (**required**) | adds `value` to the status (negative allowed) |
| `multiplyStatus` | `status`, `value`, `target` (required) | status × value (e.g. double poison) |
| `removeDebuffs` | `target='self'` | removes all debuffs |
| `multiplyBlock` | `value`, `target='self'` | block × value |
| `draw` | `value` | player only (ignored for enemies) |
| `energy` | `value` | player only |
| `addCard` | `card` (id), `count=1`, `to='discardPile'` \| `'hand'` \| `'drawPile'`, `upgraded=false` | always goes to the **player's** piles (enemies use it to add status cards). `drawPile` inserts at random positions. Hand overflow (>10) goes to discard |
| `upgradeHand` | — | player only: upgrade every card in hand for this battle |
| `summon` | `enemy` (id), `count=1` | enemy only; never more than 4 living enemies |
| `gainGold` | `value` | adds run gold (relics/potions/cards) |

Attack damage formula, per hit: `base (+ bonusPer)` → `+ attacker strength` → `× 0.75` if attacker
`weak` → `× 1.5` if target `vulnerable` → `floor`, min 0 → block absorbs first → rest is HP loss.
Then: thorns (attacker loses target's thorns), lifesteal. Block formula: `value + dexterity` →
`× 0.75` if `frail` → floor, min 0.

### 4.3 Cards — `CB.data.cards`

```js
CB.data.cards = {
  slash: {
    id: 'slash', name: '베기', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    art: 'slash',
    effects: [{ type: 'damage', value: 6 }],
    upgrade: { effects: [{ type: 'damage', value: 9 }] },
  },
  ...
}
```

- `type`: `'attack' | 'skill' | 'power' | 'status' | 'curse'`
- `rarity`: `'starter' | 'common' | 'uncommon' | 'rare' | 'status' | 'curse'`
- `cost`: integer ≥ 0. Unplayable cards set `unplayable: true` (cost ignored, show no cost orb).
- `target`: `'enemy'` (player must pick an enemy; auto-picked if only one alive), `'allEnemies'`, `'self'`, `'none'`.
- `art`: one of the **card icon ids** in §5.2.
- Optional flags: `exhaust`, `ethereal` (exhausted if still in hand at end of turn), `retain`
  (not discarded at end of turn), `innate` (always in the opening hand), `unplayable`.
- Optional `onTurnEndInHand: [effects]` — runs (source = player) if the card is in hand at end of turn (e.g. burn).
- `upgrade`: shallow override applied when upgraded (`cost`, `effects`, `target`, flags, `desc`).
  Upgraded display name is `name + '+'`. Every non-status/curse card must have an `upgrade`.
- Optional `desc`: Korean description used verbatim instead of the auto-generated one (avoid
  unless needed; auto-generated text reflects strength etc.).
- Power cards: effects usually `applyStatus` on `'self'`; once played they leave play for the
  rest of the battle (not discard, not exhaust).

`CB.data.starter = { hp: 70, gold: 99, maxEnergy: 3, handSize: 5, potionSlots: 3, deck: [card ids], relic: 'relicId' }`
(defined in `js/data/cards.js`). Status cards required (ids fixed, enemies use them):
`wound` (상처: unplayable status), `dazed` (현기증: unplayable, ethereal), `burn` (화상:
unplayable, `onTurnEndInHand` lose 2 HP), plus at least 3 curse cards for events.

Content target: ~50 cards for the hero: 3–4 starter, ~20 common, ~17 uncommon, ~10 rare, covering
archetypes: strength/heavy attacks, block/fortress, poison, multi-hit/"momentum"
(`cardsPlayedThisTurn`), exhaust synergies, card draw/energy.

### 4.4 Enemies & encounters — `CB.data.enemies`, `CB.data.encounters`

```js
CB.data.enemies = {
  slime: {
    id: 'slime', name: '숲 슬라임', art: 'slime', act: 1, rank: 'normal', hp: [26, 30], size: 'small',
    passives: [{ status: 'thorns', value: 1 }],          // optional, applied at battle start
    moves: {
      tackle: { name: '몸통 박치기', effects: [{ type: 'damage', value: 6 }] },
      harden: { name: '굳히기', effects: [{ type: 'block', value: 6 }] },
      spit:   { name: '산성 침', effects: [{ type: 'damage', value: 3 }, { type: 'applyStatus', status: 'weak', value: 1, target: 'enemy' }] },
    },
    pattern: { type: 'random', weights: { tackle: 50, harden: 25, spit: 25 }, maxRepeat: 2, opening: ['spit'] },
    // or:   { type: 'cycle', order: ['tackle', 'harden', 'spit'], opening: [...] }
    phase2: {                                             // optional (bosses/elites)
      hpPct: 0.5, text: '골렘의 눈이 붉게 타오른다!',
      onEnter: [{ type: 'applyStatus', status: 'strength', value: 3, target: 'self' }],
      pattern: { type: 'cycle', order: ['smash', 'quake'] },
    },
  },
}
```

- `rank`: `'normal' | 'elite' | 'boss' | 'minion'`; `size`: `'small' | 'medium' | 'large'` (UI scale).
- Move effects use the effect DSL with targets relative to the enemy (`'enemy'` = the player).
  Effects that target the player default to `'enemy'`; `block`/`heal` default to `'self'`.
- `art` must be one of the **enemy art ids** in §5.1 (same as the enemy id).

```js
CB.data.encounters = {
  1: { easy: [['slime'], ['wolf']], normal: [['slime', 'slime'], ['bandit', 'beetle']], elite: [['ogre']], boss: [['golem']] },
  2: { ... }, 3: { ... },
}
```

The first 3 combats of an act draw from `easy`, later ones from `normal`.

**Enemy roster (ids fixed; Art draws exactly these):**

- Act 1 (숲 / forest): normal `slime`, `sporeling`, `wolf`, `bandit`, `beetle`; elite `ogre`, `treant`; boss `golem`
- Act 2 (폐허 / crypt): normal `skeleton`, `wraith`, `zealot`, `gargoyle`, `bat`; elite `fallenKnight`, `bogWitch`; boss `lichKing`
- Act 3 (심연 / abyss): normal `imp`, `salamander`, `shade`, `sentinel`; elite `abyssDemon`; boss `elderDragon`
- Boss summons use roster ids with `rank` kept as defined (e.g. `lichKing` summons `skeleton`).

Rough difficulty: act-1 normal fights 15–45 total enemy HP; act-1 boss ~140 HP; act-2 boss ~220;
act-3 boss ~320. A starter deck should beat act-1 normals comfortably, but bosses demand a built deck.

### 4.5 Relics — `CB.data.relics`

```js
CB.data.relics = {
  emberCharm: {
    id: 'emberCharm', name: '잿불 부적', rarity: 'starter', icon: '🔥',
    desc: '전투 종료 시 체력을 6 회복합니다.',
    triggers: [{ on: 'battleEnd', effects: [{ type: 'heal', value: 6 }] }],
  },
  ...
}
```

- `rarity`: `'starter' | 'common' | 'uncommon' | 'rare' | 'boss' | 'shop' | 'event'`
- `icon`: a single emoji. `desc`: Korean, hand-written.
- `triggers[]`: `{ on, effects, cardType?, every?, scope?, turn?, hpBelowPct?, chance? }`
  - `on` ∈ `'battleStart' | 'turnStart' | 'turnEnd' | 'cardPlayed' | 'enemyKilled' | 'battleEnd' | 'playerHurt' | 'shuffle'`
  - `cardType` filters `cardPlayed`; `every: N` fires on every Nth matching trigger (counter per
    `scope` = `'battle'` (default) or `'turn'`); `turn: N` only on that turn number;
    `hpBelowPct: 0.5` only while player HP ≤ 50%; `chance: 0.25` random.
  - Effects use the combat DSL with the **player as source** (`'enemy'` = random living enemy).
- `modifiers` (summed across relics; read via `CB.run.modifier(run, key)`):
  `maxEnergy`, `handSize`, `restHealBonusPct`, `restHealDisabled` (bool), `shopDiscountPct`,
  `goldMultiplier` (e.g. 0.25 = +25%), `cardChoices`, `potionChanceBonus`, `potionSlots`.
- `onPickup`: list of **run effects** (§4.7).

Exactly one `starter` relic (named in `CB.data.starter.relic`). Target ~25 relics including
~4 boss relics (strong, often with a drawback such as `restHealDisabled`).

### 4.6 Potions — `CB.data.potions`

```js
CB.data.potions = {
  firePotion: { id: 'firePotion', name: '화염 물약', rarity: 'common', color: '#e8553f', shape: 'round',
    target: 'enemy', effects: [{ type: 'damage', value: 20 }], desc: '적 하나에게 피해를 20 줍니다.' },
}
```

`shape` ∈ `'round' | 'flask' | 'vial'`. `target` ∈ `'enemy' | 'allEnemies' | 'self' | 'none'`.
Usable only in combat. Potion damage is not modified by strength/weak (it is still reduced by
block and increased by vulnerable). ~12 potions.

### 4.7 Run effects & events — `CB.data.events`

Run effects (used by events and relic `onPickup`):
`gainGold{value}`, `loseGold{value}`, `heal{value}`, `healPct{value}`, `loseHp{value}`,
`gainMaxHp{value}`, `loseMaxHp{value}`, `addCard{card, upgraded?}`, `addRandomCard{rarity?, count?}`
(`rarity` ∈ common/uncommon/rare/any), `addCurse{card}`, `removeCard{count=1}` (player chooses),
`upgradeCard{count=1}` (player chooses), `upgradeRandom{count}`, `gainRelic{relic: id | 'random', rarity?}`,
`gainPotion{potion: id | 'random'}`, `maxEnergy{value}`, `potionSlots{value}`,
`combat{enemies: [ids], kind: 'normal'|'elite'}` (fight, then normal rewards for that kind).

```js
CB.data.events = {
  mossShrine: {
    id: 'mossShrine', name: '이끼 낀 제단', acts: [1, 2], scene: 'shrine',
    text: '숲 한가운데 ...',                                     // Korean, 2–4 sentences
    choices: [
      { label: '기도한다', preview: '최대 체력 +5', outcomes: [{ text: '...', effects: [{ type: 'gainMaxHp', value: 5 }] }] },
      { label: '제물을 바친다', preview: '골드 50 소모, 무작위 유물', require: { gold: 50 },
        outcomes: [{ effects: [{ type: 'loseGold', value: 50 }, { type: 'gainRelic', relic: 'random' }], text: '...' }] },
      { label: '도박', preview: '50%: 골드 +80 / 50%: 체력 -10',
        outcomes: [{ weight: 1, text: '...', effects: [{ type: 'gainGold', value: 80 }] },
                   { weight: 1, text: '...', effects: [{ type: 'loseHp', value: 10 }] }] },
      { label: '떠난다', preview: '아무 일도 없다', outcomes: [{ text: '...', effects: [] }] },
    ],
  },
}
```

`require` may contain `gold` and/or `hpAbove`. `scene` ∈ event scene ids in §5.2. ~10 events
spread across acts, at least 3 per act.

## 5. Art (`CB.art`, owned by Art)

All functions return **SVG markup strings** (inline-able via `innerHTML`). Original drawings,
coherent stylized dark-fantasy look (bold shapes, gradients, outlines, readable at small size).
Each SVG must use unique gradient/filter ids per call or per art id so multiple copies on a page
don't collide. Unknown ids must return a reasonable generic fallback, never throw.

### 5.1 Characters
- `CB.art.enemy(id)` → `<svg viewBox="0 0 200 200" class="enemy-art enemy-art-{id}">` with the
  main drawing inside `<g class="art-body">` (for idle animation). Feet near the bottom edge.
  Ids: `slime sporeling wolf bandit beetle ogre treant golem skeleton wraith zealot gargoyle bat
  fallenKnight bogWitch lichKing imp salamander shade sentinel abyssDemon elderDragon`.
  Bosses should look grand and detailed.
- `CB.art.hero()` → same format; the wanderer swordsman, facing right.

### 5.2 Icons & scenes
- `CB.art.cardIcon(icon, type)` → `viewBox="0 0 120 72"` illustration for the card art window;
  `type` (attack/skill/power/status/curse) tints the palette. Icon ids:
  `slash doubleSlash heavyBlow whirlwind thrust dagger axe shield tower shieldBash armor fist
  fire poison venomBlade skull heart bolt eye muscle feather thorns spiral crack blood star moon
  wind curse wound`.
- `CB.art.intent(kind)` → 32×32 icon. kinds: `attack defend buff debuff summon heal unknown`.
- `CB.art.mapNode(type)` → 40×40 icon. types: `combat elite rest shop event treasure boss`.
- `CB.art.potion(color, shape)` → 40×40 bottle.
- `CB.art.eventScene(scene)` → `viewBox="0 0 320 180"` illustration. scenes:
  `shrine forest crypt lava chest stranger well altar`.
- `CB.art.background(name)` → a CSS `background` value string (gradients and/or
  `url("data:image/svg+xml,...")`), names: `title map act1 act2 act3 shop rest event`.
- `CB.art.logo()` → SVG title logo for "카드 원정대".
- `css/art.css`: idle animations for `.enemy-art .art-body` (breathing/bobbing), `.hero-art`, etc.

## 6. FX & audio (owned by FX/Audio)

### 6.1 `CB.fx`
Coordinates are viewport pixels (from `getBoundingClientRect`). All animation durations are
divided by the current speed setting.

- `init()` — creates a full-screen, `pointer-events:none` canvas `#fx-canvas` and a DOM layer
  `#fx-layer` above the game (z-index 900; modals use 1000+). Idempotent.
- `setOptions({ shake: bool, speed: 1 | 2 })`
- `wait(ms)` → Promise (scaled by speed)
- `centerOf(el)` → `{ x, y }`
- `burst(x, y, kind, opts?)` — particles. kinds: `hit crit block heal poison fire buff debuff gold magic death shatter`.
- `floatText(x, y, text, kind)` — rising number/text. kinds: `damage crit block heal poison buff debuff gold info`.
- `slash(x, y, opts?)` — sword-slash streak (`opts.heavy`, `opts.angle`).
- `projectile(from, to, kind)` → Promise resolved on impact. kinds: `fire poison magic dark ice`.
- `shake(intensity = 1)` — shakes `#app` (respects option).
- `flash(el, color?)` — brief hit flash on an element.
- `screenFlash(color?)`
- `banner(text, { sub, kind })` → Promise resolved after it disappears (~1.1 s at speed 1).
  kinds: `player enemy boss victory defeat act info`.

### 6.2 `CB.audio`
- `init()` — create/resume the AudioContext; must be called from a user gesture; idempotent.
  Every other function is a safe no-op before `init()` or if WebAudio is unavailable.
- `play(name)` — names: `click hover cardDraw cardPlay attack heavyAttack block blockHit heal
  poison buff debuff energy enemyAttack death victory defeat gold relic potion shuffle turnStart
  error select mapStep shopBuy upgrade bossRoar exhaust`.
- `music(track)` — procedural looping background music. tracks: `title map battle elite boss
  shop rest event victory defeat none`. Crossfade between tracks; same track again = no-op.
- `setVolume({ master?, sfx?, music? })` (0–1), `setMuted(bool)`, `isMuted()`.

## 7. Engine (`CB.combat`, `CB.run`, `CB.save`, owned by Engine)

### 7.1 Card instances & units
- Card instance (in decks/piles): `{ uid: 'c12', id: 'slash', upgraded: false }`. Battle-only
  upgrades (`upgradeHand`) set `upgraded: true` on the battle copy only.
- Unit: `{ uid, side: 'player' | 'enemy', id, name, hp, maxHp, block, statuses: { [id]: n }, alive,
  rank, art, size }`. Player uid is `'player'`; enemy uids are unique per battle (`'e1'`, `'e2'`, …).

### 7.2 Battle object (created by `CB.combat.createBattle`)

```js
battle = {
  run,                      // reference to the run (relics, potions, gold, deck)
  kind,                     // 'normal' | 'elite' | 'boss' | 'event'
  turn,                     // player turn number, starts at 1
  phase,                    // 'player' | 'enemy' | 'won' | 'lost'
  player, enemies,          // units (enemies keeps dead ones with alive:false, in order)
  energy, maxEnergy,
  drawPile, hand, discardPile, exhaustPile,   // card instances (battle copies)
  counters: { cardsPlayedThisTurn, cardsPlayedThisBattle, attacksThisTurn, skillsThisTurn },
  intents: { [enemyUid]: moveId },
  stats: { damageDealt, damageTaken, cardsPlayed },
}
```

### 7.3 `CB.combat` API
Every state-changing function **mutates the battle synchronously and returns an array of
events** describing what happened, in order. The UI animates the events and re-renders from
state afterwards. Engine functions never throw on bad input from the UI; they return
`[{ type: 'error', text: '에너지가 부족합니다.' }]` instead.

- `createBattle(run, enemyIds, kind)` → battle (no events yet; intents chosen)
- `startBattle(battle)` → events (passives, `battleStart` relics, then the first `startPlayerTurn`)
- `canPlay(battle, handIndex)` → `{ ok, reason? }` (reason in Korean)
- `cardNeedsTarget(battle, handIndex)` → bool (true only if `target: 'enemy'` and >1 enemy alive)
- `playCard(battle, handIndex, targetUid?)` → events
- `potionNeedsTarget(battle, slot)` → bool
- `usePotion(battle, slot, targetUid?)` → events (removes potion from `run.potions`)
- `endTurn(battle)` → events: end of player turn, the **entire enemy turn**, then the next player
  turn start (unless the battle ended). The UI paces animations using the marker events.
- `result(battle)` → `null | 'won' | 'lost'`
- `finishBattle(battle)` → events (`battleEnd` relics, copies HP/potions back to the run, stats)
- `cardDef(idOrInst, upgraded?)` → merged card definition (upgrade applied)
- `cardView(inst, battle?, targetUid?)` → `{ uid, id, name, cost, baseCost, type, rarity, art,
  target, upgraded, unplayable, exhaust, ethereal, retain, innate, descHTML, keywords: [ids], playable }`.
  `descHTML` is Korean, auto-generated from effects (e.g. `피해를 <span class="num up">9</span> 줍니다.`);
  numbers that differ from the base use `<span class="num up|down">`; keywords/statuses are wrapped
  as `<span class="kw" data-kw="vulnerable">취약</span>`; flags appear as trailing keyword lines
  (`소멸.`). Without a battle, base values are shown.
- `intentView(battle, enemyUid)` → `{ kinds: ['attack', 'debuff'], damage: number|null, times,
  moveName, text }` — damage is the final per-hit number vs the player now (strength, weak,
  player vulnerable). kinds use the intent kinds of §5.2.
- `statusList(unit)` → `[{ id, value, name, icon, kind, desc }]` (non-zero statuses only, desc with numbers filled in)
- `getUnit(battle, uid)`, `livingEnemies(battle)`
- `debugKillAll(battle)` → events (testing helper: kills all enemies)

**Event types** (all have `type`; unit references are uids):

| type | fields |
|---|---|
| `turnStart` | `side: 'player'\|'enemy'`, `turn` |
| `draw` | `cardUid` |
| `shuffle` | `count` (discard → draw pile) |
| `cardPlayed` | `cardUid`, `cardId`, `targetUid?` |
| `discard` / `exhaust` | `cardUid` (from hand at end of turn or after play) |
| `powerPlayed` | `cardUid` |
| `cardAdded` | `cardUid`, `cardId`, `to` |
| `energy` | `value` (new energy total) |
| `damage` | `sourceUid`, `targetUid`, `amount` (final pre-block), `blocked`, `hpLoss`, `hp`, `block`, `isAttack`, `killed` |
| `block` | `targetUid`, `amount` (gained), `block` (new total) — also emitted with `amount:0, block:0, reset:true` when block is cleared |
| `heal` | `targetUid`, `amount`, `hp` |
| `hpLoss` | `targetUid`, `amount`, `hp`, `reason: 'poison'\|'thorns'\|'self'\|'burn'` |
| `status` | `targetUid`, `status`, `delta`, `value` (new), `negated?` (ward) |
| `enemyAct` | `uid`, `moveId`, `moveName` (emitted before that enemy's move effects) |
| `intent` | `uid`, `moveId` (new intent chosen) |
| `summon` | `uid` (new enemy unit, already in `battle.enemies`) |
| `phaseShift` | `uid`, `text` |
| `death` | `uid` |
| `relic` | `relicId` (a relic triggered) |
| `potion` | `slot`, `potionId` |
| `gold` | `amount`, `total` |
| `battleEnd` | `result: 'won'\|'lost'` |
| `upgradeHand` | `count` (cards upgraded by an `upgradeHand` effect) |
| `cardTrigger` | `cardUid` (a card's `onTurnEndInHand` effects are about to run) |
| `error` | `text` |

Turn order:
1. **Player turn start**: `turnStart`; clear player block (unless `fortress`); poison tick; `toxicAura`;
   `nextTurn*`; energy = maxEnergy + modifiers + `surge` + `nextTurnEnergy`; `turnStart` relics;
   draw handSize (+ modifiers, `insight`, `nextTurnDraw`; innate cards first on turn 1).
2. Player plays cards/potions.
3. **End turn**: `turnEnd` relics; `onTurnEndInHand` cards; player `plating`, `regen`, `fervor`;
   discard hand (retain stays, ethereal exhausts); player `weak/vulnerable/frail` −1.
4. **Enemy turn**: `turnStart{side:'enemy'}`; each living enemy: clear block (unless fortress),
   poison tick, toxicAura. Then each living enemy in order: `enemyAct`, its move's effects, its
   end-of-turn statuses (`plating`, `regen`, `fervor`, `weak/vulnerable/frail` −1), choose next
   move (`intent`). Stop immediately when the player dies.
5. Back to 1.

Rules: battle ends `won` the moment all enemies are dead (also mid-card / mid-enemy-turn) and
`lost` when the player hits 0 HP. Minions die when their summoner boss dies. Moves whose
`summon` cannot happen (4 alive) are skipped when choosing intents. `phase2` triggers once when
an enemy's HP first drops to ≤ `hpPct × maxHp` (emit `phaseShift`, run `onEnter`, switch pattern,
re-choose intent). Hand limit 10. Shuffle discard into draw pile when drawing from an empty pile.

### 7.4 Run object & `CB.run` API

```js
run = {
  version: 1, seed, rngState,
  act: 1, floor: 0,                   // floor = rows cleared in the current act
  map: { act, rows: [[node]], boss: node },   // node: { id, row, col, x, y, type, next: [nodeIds], visited }
  currentNodeId: null,
  current: null,                      // { nodeId, type, data, stage } while inside a node — used to resume after reload
  player: { hp, maxHp, gold, maxEnergy, handSize },
  deck: [cardInst], relics: [relicId], relicCounters: {}, potions: [potionId | null, ...],
  cardRemoveCost: 75, seenEvents: [], combatsThisAct: 0,
  stats: { floorsClimbed, enemiesKilled, elitesKilled, bossesKilled, goldEarned, cardsAdded, damageDealt, turns },
  over: false, victory: false,
}
```

The run is plain JSON (serializable). Node `x`/`y` are normalized 0–1 layout coordinates for the
map UI (y: 0 = bottom row). Map: 9 rows (0–8) + boss; up to 7 columns; 3–4 crossing-free paths;
row 0 = `combat`, row 4 = `treasure`, row 8 = `rest`; no `elite`/`rest` in rows 0–2; no two
`rest`/`shop` in a row along a path; approx. combat 45%, event 22%, elite 12%, rest 12%, shop 9%.

- `newRun({ seed? })` → run (starter deck/relic, map for act 1)
- `rng(run)` → rng object bound to `run.rngState` (state written back on every call)
- `availableNodes(run)` → nodes the player can enter now
- `enterNode(run, nodeId)` → descriptor, also stored in `run.current`:
  `{ type: 'combat'|'elite'|'boss', enemies: [ids], kind }` | `{ type: 'shop', shop }` |
  `{ type: 'rest' }` | `{ type: 'event', eventId }` | `{ type: 'treasure', relicId, gold }`
- `completeNode(run)` → `{ actComplete, victory }` (marks visited, floor++, clears `current`; after the
  boss: act++, new map, heal 75% of missing HP; after act 3 boss: `victory`)
- `rewards(run, kind)` → `{ gold, cards: [cardIds] (3 + cardChoices), potion: id|null, relic: id|null,
  relicChoices: [ids] (boss only: 3 boss relics) }`. Card rarity weights: normal 60/32/8,
  elite 45/40/15, boss rare only. Gold: normal 12–20, elite 28–38, boss 75–95 (× goldMultiplier).
  Potion chance 40% (+ bonus); elites always give a relic.
- `addGold(run, n)`, `addCard(run, cardId, upgraded?)` → inst, `removeCard(run, uid)`,
  `upgradeCard(run, uid)`, `canUpgrade(inst)`, `addRelic(run, relicId)` → `{ followUps }` (applies onPickup),
  `hasRelic(run, id)`, `addPotion(run, id)` → bool, `discardPotion(run, slot)`, `heal(run, n)` → healed,
  `modifier(run, key)` → summed number/bool
- `generateShop(run)` → `{ cards: [{ id, price, sold }] (5 class cards), relics: [{ id, price, sold }] (3),
  potions: [{ id, price, sold }] (3), removeCost, removeUsed }` — prices: common 45–55,
  uncommon 70–80, rare 135–160, relics 140–300, potions 45–90; `shopDiscountPct` applies.
- `buy(run, shop, section, index)` → `{ ok, reason? }`; `shopRemove(run, shop, uid)` → `{ ok, reason? }`
- `restOptions(run)` → `[{ id: 'heal', label, desc, disabled }, { id: 'upgrade', ... }]`;
  `restHeal(run)` → healed (30% max HP + bonus)
- `pickEvent(run)` (used by enterNode), `canChoose(run, eventId, idx)` → `{ ok, reason? }`,
  `resolveEvent(run, eventId, idx)` → `{ text, followUps: [{ type: 'removeCard'|'upgradeCard', count } |
  { type: 'combat', enemies, kind }] }` (non-interactive effects applied immediately)
- `applyRunEffects(run, effects)` → `{ followUps }`
- `randomCardIds(run, n, opts)`, `randomRelicId(run, rarity?)`, `randomPotionId(run)`
- `score(run)` → number; `summary(run)` → Korean stat lines for the end screen

### 7.5 `CB.save`
`saveRun(run)`, `loadRun()` → run | null (validates version), `clearRun()`, `hasRun()`,
`loadSettings()` → `{ master: 0.8, sfx: 0.8, music: 0.5, muted: false, shake: true, fast: false }`,
`saveSettings(s)`, `recordResult(run)` (keeps top 10 by score in history), `getHistory()`.
localStorage keys: `cardExpedition.run`, `cardExpedition.settings`, `cardExpedition.history`.
All functions are safe when localStorage is unavailable.

## 8. UI

### 8.1 Shell UI — `CB.ui` (common.js, map.js, screens.js, main.js)

`index.html` contains `<div id="app">` with `#hud` (top bar) and one `<section class="screen"
id="screen-{name}">` per screen: `title map battle reward shop rest event treasure gameover`.
Only one screen is visible at a time.

- `CB.ui.showScreen(name)` — switches screens with a short fade, sets body class `screen-{name}`,
  sets the background via `CB.art.background(...)`, and shows/hides the HUD (hidden on title/gameover).
- `CB.ui.renderCard(view, { size: 'sm'|'md'|'lg' } = {})` → HTMLElement `.card.card-{type}.rarity-{rarity}`
  with `data-uid`. Structure: cost orb (hidden if unplayable), name banner (upgraded = green + '+'),
  art window (`CB.art.cardIcon`), type line (공격/스킬/파워/상태이상/저주), description box
  (`view.descHTML`). Adds class `unplayable-now` if `view.playable === false`. Keyword tooltips on hover.
  Base size `md` ≈ 150×210 px; CSS var `--card-scale` may scale it.
- `CB.ui.tooltip.bind(el, htmlOrFn)` / `CB.ui.tooltip.hide()` — hover (desktop) and long-press (touch).
- `CB.ui.keywordHTML(ids)` → tooltip HTML describing keywords/statuses.
- `CB.ui.modal.open({ title, html | el, buttons: [{ label, kind: 'primary'|'secondary', onClick }], dismissable })`
  → `{ close() }`; `CB.ui.modal.close()`.
- `CB.ui.selectCards({ title, subtitle, cards: [inst], min = 1, max = 1, confirmLabel, cancellable, viewOnly })`
  → Promise<uid[] | null> (grid of cards; `viewOnly` just shows them).
- `CB.ui.hud.render(run)` — HP, gold, act/floor, relic tray (icons + tooltips + counters), potion
  slots (CB.art.potion), deck button, map peek, settings, mute. `CB.ui.hud.flashRelic(id)`.
  Potion click: if `CB.ui.battle.isActive()` → `CB.ui.battle.usePotionFlow(slot)`; otherwise a
  small popover with "버리기".
- `CB.ui.toast(text, kind?)`.
- `CB.ui.flow` — the game flow controller: title (새 게임 / 이어하기 / 설정 / 도움말 / 기록), map
  (clickable reachable nodes, path lines, current position, scroll; act intro banner), node
  dispatch (combat → `CB.ui.battle.start` → reward / gameover), reward screen (gold, potion,
  relic, card choice of 3 with skip; boss relic choice), shop, rest (heal / upgrade with
  before→after preview), event (scene art, text, choices, outcome text, follow-ups), treasure
  chest (open animation), act transition, victory / defeat screen (summary, score, history),
  settings modal (volumes, mute, screen shake, fast mode — persisted, applied to CB.audio/CB.fx),
  help modal (rules + keyword glossary from `CB.data.keywords`). Saves via `CB.save.saveRun` on
  every map visit and node completion; "이어하기" resumes `run.current` (re-enters the node; a
  combat restarts from its beginning).
- Music per screen via `CB.audio.music`; UI sounds (`click`, `hover`, `select`, …).
- `main.js`: on `DOMContentLoaded` → `CB.fx.init()`, load settings and apply them, first
  pointer/key event → `CB.audio.init()`, `CB.ui.flow.boot()`. If the URL contains `?debug`,
  expose `CB.debug = { win(), lose(), gold(n), relic(id), card(id, upgraded), potion(id),
  heal(), act(n), node(type) }` for testing (`win` uses `CB.ui.battle.debugWin()`).

### 8.2 Battle UI — `CB.ui.battle` (battle.js)

- `CB.ui.battle.start(run, { enemies, kind })` → `Promise<'won' | 'lost'>`. Shows the `battle`
  screen, builds the scene inside `#screen-battle`, runs the whole battle, calls
  `CB.combat.finishBattle` before resolving, plays the victory/defeat banner.
- `CB.ui.battle.isActive()`, `CB.ui.battle.current()` → battle | null,
  `CB.ui.battle.usePotionFlow(slot)`, `CB.ui.battle.debugWin()`, `CB.ui.battle.debugLose()`,
  `CB.ui.battle.abort()` (leave a battle without resolving, e.g. "save and quit").
- Layout: act background; hero on the left, 1–4 enemies on the right standing on a common ground
  line (size by `size`/`rank`); each unit has HP bar (animated, with block overlay), block badge,
  status icons with tooltips (`CB.combat.statusList`), enemy intent above head (`CB.art.intent` +
  number, tooltip with `intentView.text`). Bottom: energy orb (left), draw pile (left, click =
  view), fanned hand (center, arc layout, hover raises/enlarges, others spread), discard &
  exhaust piles (right, click = view), big "턴 종료" button (right). Turn counter.
- Card play: drag a card up into the play area to play it; targeted cards show a curved arrow
  from the card to the pointer and must be released over an enemy (enemy highlights). Click a
  card → it lifts, then click an enemy / click the play area. Right-click/Esc cancels. Unplayable
  cards shake with the `reason` toast. Keyboard: 1–9 select card, Tab/←→ cycle targets, Enter
  confirm, E end turn.
- Event animation player: consumes engine events sequentially with `CB.fx`/`CB.audio`: card fly
  to target then to discard/exhaust (burn-away for exhaust), draw animation from the draw pile,
  hero lunges on attack, slash/burst/float numbers/shake on damage (bigger for heavy hits),
  block shield shimmer, status pop, enemy lunge on its attack, enemy death dissolve, summon
  appear, phase-shift flash + text, relic flash in the HUD, turn banners ("내 턴" / "적의 턴"),
  boss intro banner with the boss name. Input is locked while animating. Fast mode halves delays.
- Re-render units/hand/piles from state after each event batch so the screen never desyncs.

## 9. Quality bar
This should feel like a polished indie game, not a demo: consistent art direction, juicy
feedback on every action, smooth 60fps CSS/canvas animation, readable typography, tooltips
everywhere a rule matters, no console errors, no dead ends (every screen has a way forward),
sensible balance (a decent player wins sometimes; a random player rarely does).
