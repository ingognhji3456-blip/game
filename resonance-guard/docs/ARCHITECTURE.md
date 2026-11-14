# 공명 수호대 — 기술 구조 (Architecture Contract)

이 문서는 모듈 사이의 **약속**입니다. 이름·모양·함수 형식은 이 문서와 정확히 같아야 합니다.
애매하면 가장 합리적인 해석으로 방어적으로 구현하고, 진행 기록(PROGRESS.md)에 남깁니다.

## 0. 기술 규칙

- 순수 브라우저 JavaScript, `<script>` 태그(ES 모듈 금지 — `file://`에서 깨짐). 파일마다 `'use strict';`.
- 외부 라이브러리·CDN·글꼴·그림·소리 파일 없음. 그림은 JS가 만든 SVG, 소리는 WebAudio 합성.
- 전역 이름공간 `window.RG` (`js/util.js`가 만듦): `RG.util`, `RG.data`, `RG.art`, `RG.audio`, `RG.fx`, `RG.grid`, `RG.sim`, `RG.progress`, `RG.save`, `RG.render`, `RG.ui`.
- 파일은 불러올 때 **정의만** 합니다. 다른 모듈을 최상위에서 호출하지 않습니다. 시작은 `js/main.js`의 `DOMContentLoaded`.
- `js/util.js`, `js/data/*`, `js/core/*`는 **DOM에 손대지 않습니다** (Node 테스트·봇에서 돌아야 함).
- 시뮬레이션(`js/core/sim.js`)은 **결정적**이어야 합니다: `Math.random`·`Date` 금지, 시드 난수만 사용, 객체 키 순회 순서에 기대지 않기(배열 사용).
- 대상 브라우저: 최신 Chrome/Edge/Firefox/Safari. 데스크톱(≥1024×640)과 휴대폰(≥360×640, 가로·세로 모두).
- 모든 화면 글자는 한국어.

## 1. 파일 구성

```
resonance-guard/
  index.html                 진입점 (스크립트 순서 중요)
  css/base.css               공통 바탕, 버튼, 패널, 모달, 툴팁
  css/screens.css            타이틀·월드 지도·준비·결과·도감·기술 나무·이야기
  css/game.css               전투 화면 HUD·패널
  js/util.js                 RG.util
  js/data/elements.js        RG.data.elements, RG.data.resonance, RG.data.traits, RG.data.statuses
  js/data/towers.js          RG.data.towers
  js/data/enemies.js         RG.data.enemies
  js/data/heroes.js          RG.data.heroes
  js/data/maps.js            RG.data.regions, RG.data.maps, RG.data.endless
  js/data/story.js           RG.data.story
  js/data/meta.js            RG.data.skills, RG.data.challengeTypes
  js/core/grid.js            RG.grid   — 맵 해석, 흐름장, 길막 검사, 영웅 길찾기
  js/core/stats.js           RG.stats  — 탑 능력치 계산(단계·지원·공명·기술 나무)
  js/core/sim.js             RG.sim    — 한 판의 시뮬레이션
  js/core/bosses.js          RG.bosses — 보스 패턴
  js/core/progress.js        RG.progress — 별, 해금, 기술 나무
  js/core/save.js            RG.save   — localStorage (없으면 메모리)
  js/art/helpers.js          RG.art._h — SVG 공용 도우미(그라데이션, 외곽선 등)
  js/art/towers.js           RG.art.tower(), RG.art.lantern(), RG.art.TOWER_MUZZLE
  js/art/enemies.js          RG.art.enemy()
  js/art/heroes.js           RG.art.hero(), RG.art.portrait(), RG.art.unit()
  js/art/terrain.js          RG.art.mapBackground(), RG.art.regionBanner()
  js/art/icons.js            RG.art.icon()
  js/art/sprites.js          RG.art.sprites — SVG를 이미지로 바꿔 보관(브라우저 전용)
  js/render/renderer.js      RG.render — 캔버스 그리기
  js/fx/fx.js                RG.fx     — 파티클·투사체 꼬리·떠오르는 숫자(캔버스)
  js/fx/audio.js             RG.audio  — 효과음·음악 합성
  js/ui/common.js            RG.ui 공용(모달, 토스트, 툴팁, 화면 전환)
  js/ui/screens.js           타이틀·월드 지도·준비·결과·설정
  js/ui/codex.js             도감·수호대·기술 나무
  js/ui/story.js             이야기 장면
  js/ui/game.js              전투 화면(입력, HUD, 패널)
  js/main.js                 시작
  tools/build.js             dist/resonance-guard.html (한 파일)
  tools/gen-docs.js          설계서 AUTO 표 생성
  tools/art-review.js        모든 그림을 개별 PNG로 찍기 (검수용)
  tools/balance.js           봇으로 전체 맵 밸런스 보고서
  tests/load.js              Node vm으로 util/data/core 불러오기
  tests/*.test.js            규칙·데이터·설계 일치 테스트
  tests/bots.js              봇(무작위·그리디·탐색)
  tests/e2e/*.js             Playwright 화면 검사
  docs/                      설계 문서
```

## 2. 좌표와 시간

- **칸 좌표**: 칸 (c, r)의 중심은 월드 좌표 (c + 0.5, r + 0.5). 거리는 칸 단위.
- **틱**: 시뮬레이션은 고정 간격 `DT = 1/30`초로 진행합니다. 배속은 프레임당 틱 수로 처리합니다.
- 렌더러는 엔티티의 `px, py`(직전 틱 위치)와 `x, y`(현재 위치)를 보간해 그립니다.

## 3. 데이터 형식 (`RG.data`)

모든 데이터 파일은 함수 없는 순수 객체를 `RG.data.*`에 넣습니다. (예외: `maps.js`의 웨이브 문자열 해석은 `RG.grid.parseWaves`가 담당)

### 3.1 원소·공명·특성 — `elements.js`

```js
RG.data.elements = {
  fire:  { name: '불',  color: '#ff6b3d', dark: '#a8331a', light: '#ffc29e', shape: 'flame' },
  frost: { name: '얼음', color: '#5fd4ff', dark: '#1f7fa8', light: '#c8f2ff', shape: 'crystal' },
  storm: { name: '번개', color: '#9b8cff', dark: '#4b3fb0', light: '#d8d2ff', shape: 'bolt' },
  earth: { name: '대지', color: '#8fcf5a', dark: '#4a7a26', light: '#d4f0b8', shape: 'mountain' },
  light: { name: '빛',  color: '#ffe48a', dark: '#b8902a', light: '#fff8dc', shape: 'star' },
  dark:  { name: '어둠', color: '#d14fc0', dark: '#6e1f66', light: '#f2b8ea', shape: 'moon' },
};
RG.data.elementOrder = ['fire', 'frost', 'storm', 'earth', 'light', 'dark'];

// 공명: 키는 elementOrder 순서로 정렬된 'a+b' (같은 원소는 'pure')
RG.data.resonance = {
  pure:          { name: '순수 공명', desc: '피해 +12%', mods: { damagePct: 0.12 } },
  'fire+frost':  { id: 'steam', name: '증기 폭발', desc: '...', mods: { steam: { chance: 0.25, radius: 0.8, pct: 0.4 } } },
  ...
};
```

공명 `mods`가 쓰는 키(엔진이 구현): `damagePct`, `speedPct`, `rangePct`, `steam{chance,radius,pct}`, `shredOnHit{pct,max,dur}`, `burnOnHit{pct,dur}`, `bonusVsSlowed`, `slowOnHit{pct,dur}`, `bonusVsFlying`, `stillness{dur, shieldBonus}`, `stunOnHit{chance,dur}`, `chainExtra{radius,pct}`, `bountyPct`, `bonusVsGround`, `armorIgnore`, `bonusVsElite`.

```js
RG.data.traits = { flying: { name: '비행', icon: 'flying', desc: '...' }, ... };   // DESIGN §8 목록 전부
RG.data.statuses = { slow: { name: '감속', icon: 'slow', desc: '...' }, ... };    // DESIGN §7.1 목록 전부
```

### 3.2 탑 — `towers.js`

```js
RG.data.towers = {
  ember_archer: {
    name: '불씨 궁수탑', element: 'fire', role: 'attack',   // attack | support | barracks | economy
    targets: 'both',                                       // both | ground | air | null(공격 없음)
    kind: 'arrow',                                         // 공격 방식 (§3.2.1)
    unlock: '1-1',
    desc: '한 줄 정체성',
    levels: [ { ...spec }, { ...spec }, { ...spec } ],      // Lv1~3. spec.cost = 그 단계로 가는 비용
    branches: {
      A: { id: 'ember_sniper', name: '화염 저격대', desc: '...', ...spec },
      B: { id: 'ember_volley', name: '연사 궁수대', desc: '...', ...spec },
    },
  },
  ...
};
```

`spec` 필드 (단계마다 전체 값을 적음 — 상속 없음):

| 필드 | 뜻 |
|---|---|
| `cost` | 이 단계로 가는 비용 |
| `range`, `minRange` | 사거리(칸) |
| `interval` | 공격 간격(초) |
| `damage` | 1회 피해 |
| `multishot` | 한 번에 공격하는 서로 다른 대상 수 |
| `crit` | `{ chance, mult }` |
| `projSpeed` | 유도 투사체 속도(칸/초) |
| `flight` | 곡사 비행 시간(초) |
| `splash` | 착탄 폭발 반경 |
| `chain` | `{ count, falloff, radius }` 연쇄 |
| `pierce` | true면 사거리 끝까지 직선 관통 |
| `zone` | `{ kind, radius, dur, dps, slowPct }` 착탄 장판 (kind: fire·void·thorn) |
| `zones` | 분열 장판 수 (공허 4B) |
| `beam` | `{ rampTime, maxMult, beams }` 집중 광선 |
| `snare` | `{ maxTraps, root, damage, bleed, extraTargets }` 덫 |
| `cyclone` | `{ every, dist, lift }` 회오리 |
| `onHit` | `{ burn{dps,dur}, slow{pct,dur}, freezeEvery{n,dur}, curse{pct,dur}, shred{pct,max,dur}, stun{chance,dur}, knockback, blind, purify, execute, spreadCurse{radius,damage}, bonusVsSlowed, flyingMult, zap{every,damage} }` |
| `aura` | 지원: `{ damagePct, speedPct, rangePct, critChance, burnOnHit{pct,dur}, zapEvery{n,damage} }` |
| `detect` | 탐지 반경 |
| `heal` | `{ hps, radius }` 영웅·병사 회복 |
| `respawnMul` | 병사 재소환 시간 배율(범위 안) |
| `income` | 웨이브 시작 수입 |
| `perLinkIncome` | 공명 효과 하나당 추가 수입 |
| `bountyAura` | `{ radius, pct }` 주변 처치 현상금 증가 |
| `soldiers` | `{ count, hp, damage, interval, armor, respawn, block, crit, taunt }` |
| `rallyRange` | 집결지 지정 사거리 |
| `discharge` | `{ every, damage, radius }` 방전(축전기 4B) |

#### 3.2.1 공격 방식 `kind`

| kind | 탑 | 동작 |
|---|---|---|
| `arrow` | 궁수탑 | 유도 투사체 |
| `mortar` | 박격포 | 곡사, 쏠 때 위치에 착탄, `splash` + `zone` |
| `bolt` | 결정탑·저주 첨탑 | 유도 투사체(마법) |
| `ballista` | 빙창 | 직선 관통 |
| `pulse` | 겨울 종·광휘 탑·대지 망치 | 범위 안 전체에 즉시 |
| `chain` | 번개 막대 | 즉발 연쇄 |
| `gust` | 바람 포탑 | 유도 투사체 + 밀쳐내기 |
| `beam` | 햇살 렌즈 | 지속 광선 |
| `orb` | 공허 구체 | 느린 투사체 → 장판 |
| `snare` | 그림자 덫 | 길 칸에 덫 설치 |
| `none` | 지원·경제·병영 | 공격 없음 |

### 3.3 적 — `enemies.js`

```js
RG.data.enemies = {
  mist_rat: {
    name: '안개 쥐', region: 1, size: 0.5, hp: 22, speed: 1.35, armor: 0,
    bounty: 3, lives: 1,
    affinity: { },                         // { fire: 'weak'|'resist'|'immune'|'absorb', ... }
    melee: { damage: 2, interval: 1.0 },  // 저지됐을 때 공격
    traits: { },                           // { flying: true, regen: 0.02, split: { into, n }, ... }
    elite: false, boss: false,
    desc: '...'
  },
};
```

`traits` 값 형식: `flying: true` · `regen: 비율/초` · `split: { into, n }` · `stealth: true` · `shield: { amount(최대 체력 비율), delay, rate }` · `healer: { radius, pct, every }` · `shielder: { radius, pct, every }` · `burrow: { every, dur }` · `dash: { mult, dur }` · `undying: { pct }` · `deathburst: { radius, damage }` · `ranged: { range, damage, interval }` · `shock: { radius, dur }` · `silence: { radius }` · `adaptive: { per, max }` · `dampen: { radius }` · `unstoppable: true` · `shredResist: 0.5`.

보스는 `boss: { phases: [{ at: 0.5, ... }], ability: '패턴 id' }` 를 가지며 동작은 `js/core/bosses.js`가 구현합니다.

### 3.4 영웅 — `heroes.js`

```js
RG.data.heroes = {
  kara: {
    name: '카라', element: 'fire', title: '솔빛의 망치', color: '#ff6b3d', unlock: '1-1',
    hp: 300, damage: 14, interval: 1.0, range: 0.7, melee: true, block: 3, speed: 1.6, armor: 0.1,
    splash: 0.6, targets: 'ground',
    skill: { id: 'flame_slam', name: '불꽃 내려찍기', cooldown: 18, target: 'point', radius: 1.5, damage: 60, burn: {...}, desc },
    passive: { id: 'unyielding', name: '불굴', desc, ... },
    xp: [0, 60, 160, 320, 560],
    lines: { select: [...], move: [...], skill: [...], down: [...], revive: [...], win: [...] },
    bio: '...', personality: '...',
  },
};
```

### 3.5 맵 — `maps.js`

```js
RG.data.regions = [{ id: 1, name: '솔빛 들판', theme: 'meadow', ... }, ...];
RG.data.maps = [{
  id: '1-1', region: 1, name: '솔빛 마을 어귀', type: 'fixed',   // fixed | maze | mixed
  grid: [ '##########......', ... ],   // DESIGN §4.2 기호
  startGold: 220, lives: 20,
  waves: [ 'mist_rat*5/1.4', 'ash_boar*2/2.5 ; mist_rat*6/1@4', ... ],
  hard: { extra: { 4: 'ash_boar*2/2@3' } },     // 어려움에서 추가되는 무리
  challenge: { type: 'maxTowers', value: 4 },
  newTowers: ['ember_archer', 'stone_barracks'], newEnemies: [...], hero: 'kara',
  story: { before: 'prologue', after: null }, tips: [...],
}];
```

**웨이브 문자열**: 무리는 `;`로 구분. 무리 = `적id*수/간격@시작초>입구번호`. `/간격`·`@시작`·`>입구`는 생략 가능(기본: 간격 1초, 시작 0초, 입구 0). 비행 적은 하늘 입구가 있으면 그곳에서 나옵니다. 입구 번호는 격자에서 위→아래, 왼→오른 순서로 센 `S`의 순번.

## 4. 시뮬레이션 (`RG.sim`)

```js
const game = RG.sim.create({
  mapId: '1-1', mode: 'normal',        // normal | hard | challenge | endless
  heroId: 'kara',                      // null 가능
  skills: ['build1', ...],             // 기술 나무에서 찍은 칸 id 목록
  seed: 12345,
});
game.state          // 읽기 전용으로 다룰 것
game.step()         // DT만큼 진행
game.cmd(command)   // → { ok: true } | { ok: false, reason: '사람이 읽을 이유' }
game.canBuild(type, c, r)      // → { ok, reason }
game.previewLinks(type, c, r)  // → [{ c, r, towerId, resId }] 생길 공명
game.towerInfo(id)             // → 화면 표시용 계산값(능력치, 공명 효과 목록, 강화 비용)
game.log            // [[tick, command], ...] 성공한 명령 기록
game.hash()         // 상태 해시(결정성 검사용)
RG.sim.replay(opts, log, untilTick) // 기록으로 같은 상태 재현 (한 번에)
RG.sim.replayer(opts, log, untilTick) // 같은 재현을 나눠서: { step(ms) → 끝났으면 true, progress 0..1, game }
```

### 4.1 명령

| type | 필드 | 뜻 |
|---|---|---|
| `build` | `tower, c, r` | 짓기 |
| `upgrade` | `id` | Lv+1 (Lv3까지) |
| `branch` | `id, branch:'A'|'B'` | 분기 |
| `sell` | `id` | 판매 |
| `target` | `id, mode` | 표적: first·last·strong·weak·close |
| `rally` | `id, x, y` | 병영 집결지 |
| `heroMove` | `x, y` | 영웅 이동 |
| `heroSkill` | `x, y, targetId?` | 영웅 기술 |
| `callWave` | — | 다음 웨이브 호출 |
| `endRun` | — | 공명석 웨이브만: 여기서 끝내기 (지는 것과 같은 정산, `state.ended`) |

명령은 받는 즉시 적용되고, 성공하면 `[현재 틱, 명령]`이 `log`에 쌓입니다. `replay`는 각 틱을 진행하기 **전에** 그 틱의 명령을 적용합니다.
`replay`는 `replayer`를 끝까지 한 번에 돌린 것이라 둘의 결과는 같습니다 — 어디서 나누든 상태가 바이트까지 같음(`tests/replay.test.js`).

### 4.2 상태 모양

```js
state = {
  tick, time, speed, map,                  // map: RG.grid.parseMap 결과
  gold, lives, maxLives, result: null,     // 'win' | 'lose'
  wave: { index, total, countdown, active: [...], nextBonus, started: false },
  towers:   [{ id, type, level, branch, c, r, x, y, invested, targetMode, cd, calc, links, disabled, ... }],
  enemies:  [{ id, type, x, y, px, py, hp, maxHp, shield, maxShield, dir, flying, burrowed, revealed, status:{...}, ... }],
  units:    [{ id, kind, x, y, px, py, hp, maxHp, owner, blocking:[...], ... }],   // 영웅·병사·벽·드론
  hero:     { ... } | null,                // units 안의 영웅을 가리킴
  projectiles: [{ id, kind, element, x, y, px, py, tx, ty, ... }],
  zones:    [{ id, kind, x, y, radius, until, ... }],
  traps:    [{ id, owner, c, r, ... }],
  beams:    [{ owner, target, mult }],      // 그리기용
  events:   [],                              // 이번 틱 이벤트 (§4.3)
  stats:    { damageByTower: {id: n}, kills, leaked, goldEarned },
}
```

### 4.3 이벤트 (렌더러·효과·소리용)

매 틱 `state.events`가 비워지고 다시 채워집니다. 렌더러는 프레임마다 모든 틱의 이벤트를 모아 처리합니다.

| type | 필드 |
|---|---|
| `fire` | `towerId, kind, element, x, y, tx, ty` |
| `hit` | `x, y, element, amount, crit, targetId` |
| `splash` | `x, y, radius, element` |
| `chain` | `points:[[x,y],...], element` |
| `pulse` | `x, y, radius, element` |
| `kill` | `enemyId, type, x, y, bounty` |
| `leak` | `enemyId, lives` |
| `build`·`upgrade`·`sell` | `towerId, c, r` |
| `waveStart` | `index, bonus` |
| `spawn` | `enemyId, type` |
| `heroSkill` | `heroId, x, y` |
| `heroDown`·`heroRevive`·`heroLevel` | `heroId` |
| `bossPhase` | `enemyId, phase` |
| `bossAbility` | `enemyId, ability, x, y, targets` |
| `towerDisabled` | `towerId, dur, reason` |
| `shieldBreak` | `enemyId` |
| `gold` | `amount, x, y` |
| `win`·`lose` | — |

## 5. 그림 (`RG.art`) — SVG 문자열 규격

모든 그림 함수는 **SVG 문자열**을 돌려주고 DOM을 만들지 않습니다(Node에서도 돌 수 있게). 그림자는 그리지 않습니다(렌더러가 그림).

### 5.1 공통 스타일

- 굵은 외곽선: 색 `#1c1426`, 굵기는 viewBox 100 기준 2.5~3.5.
- 부드러운 선형·방사형 그라데이션, 위쪽 왼편에서 빛이 옴(하이라이트는 왼쪽 위).
- 시점: 살짝 위에서 내려다본 정면(3/4 탑다운). 바닥 받침은 납작한 타원.
- 그라데이션 id는 SVG마다 고유해야 함(한 화면에 여러 SVG가 섞임) → `RG.art._h.uid()` 사용.
- 원소 색은 `RG.data.elements`를 그대로 사용.

### 5.2 함수

| 함수 | viewBox | 기준점 | 설명 |
|---|---|---|---|
| `RG.art.tower(type, level, branch)` | `0 0 100 130` | 바닥 중심 (50, 112) | level 1~3, 분기는 level 4 + branch 'A'/'B'. 칸 하나 = 가로 100. 위로 최대 y=0까지 솟을 수 있음 |
| `RG.art.TOWER_MUZZLE[type]` | — | — | `[[dx,dy] × 5]` (Lv1,2,3,4A,4B) 투사체가 나가는 점, 바닥 중심 기준 칸 단위(dy는 음수=위) |
| `RG.art.lantern(ratio)` | `0 0 100 130` | (50, 112) | 울림등. ratio 0~1 남은 빛 |
| `RG.art.enemy(type, frame)` | `0 0 100 100` | 발 (50, 90) | frame 0·1(걷기). **오른쪽을 바라봄**. 비행 적도 같은 기준(렌더러가 띄움) |
| `RG.art.hero(id, pose)` | `0 0 100 100` | 발 (50, 90) | pose: idle·walk1·walk2·attack. 오른쪽을 바라봄 |
| `RG.art.portrait(id, mood)` | `0 0 200 200` | — | 가슴 위 초상화. mood: normal·happy·worried. 조연(`elder`, `bellkeeper`, `haru`)도 |
| `RG.art.unit(kind, pose)` | `0 0 100 100` | 발 (50, 90) | kind: stone_soldier·granite_guard·obsidian_blade·drone·rock_wall. pose: idle·attack |
| `RG.art.mapBackground(map)` | `0 0 cols*100 rows*100` | — | 맵 전체 바탕(땅·길·장애물·장식). map은 `RG.grid.parseMap` 결과 |
| `RG.art.regionBanner(regionId)` | `0 0 400 160` | — | 월드 지도·준비 화면용 지역 풍경 |
| `RG.art.icon(name)` | `0 0 64 64` | — | UI 아이콘(원소 6, 특성, 상태, 능력치, 버튼) |

### 5.3 크기와 읽힘

- 렌더러는 탑을 가로 1칸, 적을 `size`칸(소 0.5·중 0.7·대 0.9·보스 1.4~2.0), 영웅을 0.9칸으로 그립니다.
- 휴대폰에서 1칸은 약 22~40px입니다. **작게 줄여도 실루엣이 구별**되어야 하고, 1px 이하의 가는 선은 쓰지 않습니다.

## 6. 렌더러 (`RG.render`)

- 캔버스 하나에 맵을 그립니다. 바탕(`mapBackground`)은 맵을 열 때 한 번 오프스크린 캔버스로 그려 둡니다.
- 움직이지 않는 것은 미리 구워 둡니다: 바탕 + 탑·울림등 그림자(탑을 짓고·올리고·팔 때만), 빛 고르기 그라데이션(크기가 바뀔 때만), 공명 선(적이 공명을 끊거나 탑을 멈추게 해 선이 바뀔 때만 다시 합침)을 맵 바깥 바탕·테두리와 한 장(`baseFrame`)으로 만들어 매 프레임 한 번 찍습니다. 바뀜 확인은 탑 목록을 숫자 비교로만 훑습니다.
- 탑·적 그림, 드리운 그림자(기울인 모양), 발밑 그늘, 상태 아이콘, 장판 바닥, 각성 빛 고리는 표시 크기(화면 배율 포함)마다 한 번만 그려 두고 정수 화소 자리에 그대로 찍습니다(늘이기·기울이기·반 화소로 그리면 화소마다 샘플링하는 느린 길로 그려짐). 쏠 때 눌림·회전처럼 모양이 계속 바뀌는 것만 그때그때 변환해 그립니다.
- 그리기 순서: 바탕 → 장판·덫 → 사거리/미리보기 → 공명 선 → 그림자 → (y 순서로) 탑·적·유닛 → 투사체·광선 → 효과 → 체력 막대 → 떠오르는 숫자.
- `RG.render.attach(canvas, game)`, `RG.render.frame(alpha)`, `RG.render.screenToWorld(px, py)`, `RG.render.resize()`.

## 7. 저장 (`RG.save`)

| 키 | 내용 |
|---|---|
| `rg.progress.v1` | `{ stars: { '1-1': { normal: 3, hard: true, challenge: false } }, skills: [...], seen: { enemies: [...], story: [...] }, endless: { E1: 12 } }` |
| `rg.settings.v1` | 음량, 배속, 흔들림, 숫자, 큰 글씨 |
| `rg.run.v1` | 진행 중인 판: `{ opts, log, tick, mapId, wave }` — 이어하기는 0틱부터 재현 (아래) |

**이어하기** (`js/ui/game.js` `startResume`): 공명석 웨이브 끝 무렵이면 2만 틱 넘게 다시 돌려야 해 느린 휴대폰에서 수 초 걸림.
클릭 안에서는 진행률 화면만 그리고(`이어하는 중… 42%`, 25%마다 `aria-live` 알림, 취소 단추·Esc → 들어온 화면으로), 재현은 `RG.sim.replayer`로
약 10ms씩 나눠 한 뒤 보통 시작(`begin`)으로 이어 감. 재현하는 동안 `game`이 비어 있어 명령·루프·자동 저장이 돌지 않고 저장된 판은 그대로.
재현이 실패하면(망가진 저장) 알리고 들어온 화면으로 돌아감(저장은 지우지 않음).
판 그림(`RG.art.sprites.stagedForGame`)은 지금 보이는 것(`essentialForGame`: 등불·영웅·맵 위 탑·지금 웨이브의 적)만 먼저 준비하고 '그림 준비 중'을 걷음,
나머지는 판을 하면서 쉬는 틈에 한 장씩(`requestIdleCallback`). 예전 `prepareForGame`은 수백 장을 한꺼번에 만들어 클릭 뒤 오래 멈췄음.

**진행 옮기기** (`RG.transfer`, `js/core/transfer.js`): 진행은 브라우저 저장 공간에만 있으므로, 다른 기기·사람에게는 저장 코드/파일로 옮김.
코드 = `RG1z.` + base64url(deflate-raw(JSON)) (압축을 못 하는 브라우저는 `RG1.` + base64url(JSON)), JSON = `{ game: 'resonance-guard', kind: 'save', v: 1, at, progress }`.
가져오면 `rg.progress.v1`을 바꾸고 `rg.run.v1`(다른 진행의 판)은 지움 — `progress.load()`가 예전 형식의 빈 칸을 채움. 설정은 기기마다 달라 옮기지 않음.
화면: 타이틀 오른쪽 위 "진행 옮기기", 설정 → "내보내기 · 가져오기" (저장 파일 받기·코드 복사·휴대폰 공유 / 파일 열기·코드 붙여 넣기 → 요약 확인 → 가져오기).

## 8. 테스트

- `node tests/run.js` — 모든 `tests/*.test.js` 실행.
- `node tests/bots.js --map 1-1 --bot greedy --runs 20` — 봇 플레이.
- `node tools/balance.js` — 전체 맵 보고서(`docs/reports/balance.md`).
- `node tools/art-review.js` — 모든 그림을 `docs/reports/art/` 아래 개별 PNG로.
- `node tests/e2e/screens.js` — 모든 화면을 3가지 크기로 캡처, 콘솔 오류 검사.
