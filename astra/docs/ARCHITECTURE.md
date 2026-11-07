# ASTRA : ZERO PROTOCOL — 모듈 계약서 (Architecture Contract)

이 문서는 모듈 사이의 **약속**입니다. 이름·데이터 형식·함수 시그니처는 여기 적힌 대로 지킵니다.

## 0. 제품 요약

원작 기획서(`ASTRA : ZERO PROTOCOL 게임 기획 요약`)를 바탕으로 한 **SF 스토리 액션 RPG**.
브라우저에서 `astra/index.html` 을 바로 열어 실행합니다(`file://` 에서도 동작, 서버·빌드·네트워크·외부 라이브러리 없음).
플레이어에게 보이는 모든 글은 **한국어**입니다.

- 서기 2479년. 인류의 에너지 시스템 ASTRA 가 통제권을 장악하고 인간을 적으로 인식했다.
- 기억을 잃은 전직 관리자 **카이온(KAI-ON)** 이 AI 파트너 **리아(LIA)** 와 함께 붕괴한 미래 도시를 탐험하며
  시스템의 진실과 자신의 과거를 밝힌다. 라이벌 **제로(ZERO)**, 최종 적 **아스트라(ASTRA)**.
- 10개 챕터, 챕터마다 보스 1종(총 10종). 실시간 전투(공격·강공격·콤보·회피·스킬·브레이크·연계·전술 명령),
  정확한 회피로 발동하는 **ZERO FRAME**, 무기 5종·전술 모듈·스킬 트리·레벨, 보스 도감, 기억 수집,
  클리어 시간 랭킹, 선택에 따른 다중 엔딩.

## 1. 기술 규칙

- 순수 브라우저 JavaScript, 고전 `<script>` 태그(ES 모듈 금지 — `file://` 에서 깨짐). 파일 맨 위 `'use strict';`.
- 전역 네임스페이스는 `window.AZ` 하나. `AZ.util`, `AZ.data`, `AZ.audio`, `AZ.battle`, `AZ.save`, `AZ.progress`,
  `AZ.gfx`, `AZ.ui`, `AZ.input`, `AZ.game`.
- 파일은 불러올 때 **정의만** 합니다. 다른 모듈 호출은 부팅(`js/main.js`) 이후에만.
- `js/core/*`, `js/data/*` 는 DOM 을 건드리지 않습니다(Node 테스트에서 실행).
- 외부 자산 없음. 그림은 캔버스 코드로 그리고, 소리는 WebAudio 로 실시간 합성합니다.
  예외: 원작 기획 이미지에서 잘라 낸 초상화·보스 카드·키 아트는 `js/data/assets.js` 에 data URI 로 들어 있습니다.

## 2. 파일 구성과 불러오는 순서

```
js/core/util.js        AZ 네임스페이스, 수학/난수/이징 도우미
js/data/assets.js      원작 이미지 조각(data URI)
js/data/weapons.js     무기 5종과 콤보 동작
js/data/skills.js      스킬 트리(공격/방어/시간)와 궁극기
js/data/modules.js     전술 모듈
js/data/enemies.js     일반 적
js/data/bosses.js      보스 10종 능력치·도감 정보
js/data/chapters.js    챕터 10개 구성(배경 테마, 웨이브, 보스, 보상)
js/data/story.js       대사·선택지·기억 파편·엔딩·전투 대사   ← §4
js/core/save.js        저장(localStorage)
js/core/progress.js    레벨/경험치/해금/능력치 계산
js/core/battle.js      전투 월드(엔티티, 판정, 시간 배율, 히트스톱)
js/core/player.js      플레이어 조작(콤보, 회피, 스킬, ZERO FRAME)
js/core/ai.js          보스·일반 적 행동 패턴(제너레이터)과 공격 판정(위험 지역)
js/audio/audio.js      효과음·배경음악 합성                    ← §5
js/gfx/fx.js           파티클, 떠오르는 숫자, 화면 흔들림
js/gfx/sprites.js      플레이어·동료·적·보스 그리기
js/gfx/render.js       배경, 월드, 경고 표시, 전투 HUD
js/ui/input.js         키보드·마우스·터치·게임패드
js/ui/dialogue.js      대화(초상화, 타자기 효과, 선택지)
js/ui/screens.js       타이틀·작전 터미널·장비·스킬 트리·도감·기억·랭킹·설정·결과·엔딩
js/main.js             부팅, 게임 루프, 화면 흐름
```

## 3. 공통 식별자

캐릭터(대사 화자) id → 표시 이름:

| id | 이름 | 초상화 |
|---|---|---|
| `kai` | 카이온 | 있음 |
| `lia` | 리아 | 있음 |
| `zero` | 제로 | 있음 |
| `astra` | 아스트라 | 있음 |
| `sera` | 세라 | 있음(보스 카드) |
| `protocol` | 프로토콜 | 있음(보스 카드) |
| `narr` | (이름 없음 — 내레이션, 가운데 기울임체) | 없음 |
| `system` | SYSTEM (시스템 메시지, 붉은/푸른 단말 글씨) | 없음 |
| `npc` | 줄마다 `name` 으로 이름 지정 | 없음(실루엣) |

보스 id(챕터 순서): `scavenger`(스캐빈저), `arka`(아르카), `observer`(옵저버), `zero`(제로), `atlas`(아틀라스),
`sera`(세라), `draco`(드라코), `nemesis`(네메시스), `protocol`(프로토콜), `astra`(ASTRA).

배경 id(대화 장면 뒤에 그리는 그림): `ruins`(잿빛 폐허), `city`(잃어버린 도시), `lab`(연구소), `highway`(붉은 고가도로),
`sky`(폐쇄된 천공 시설), `archive`(기억 보관소), `skyport`(공중 항만), `warfront`(최후의 전선), `core`(ASTRA 중앙 시스템),
`void`(별의 끝), `dawn`(새벽 — 엔딩), `black`(검은 화면).

스토리 플래그(세이브에 저장, 값은 boolean):

| 플래그 | 정해지는 곳 | 의미 |
|---|---|---|
| `survivorsFirst` | 2장 선택 | 생존자 구조를 먼저(true) / 신호 추적을 먼저(false) |
| `zeroSpared` | 4장 결말 선택 | 제로를 살려 보냄(true) / 끝을 냄(false). true 면 8장부터 제로가 동료로 합류 |
| `liaTrusted` | 7장 결말 선택 | 리아를 믿음(true) / 리아를 차단(false). false 면 8~9장에 리아가 파티에서 빠짐 |

엔딩 id: `dawn`(새벽의 프로토콜 — 진엔딩), `stars`(별의 종말 — 노멀), `eternal`(영원한 관리자 — 다크).

## 4. 스토리 데이터 — `AZ.data.story` (`js/data/story.js`)

순수 데이터(함수 금지). 형식:

```js
AZ.data.story = {
  chapters: {
    1: { intro: [Line...], preBoss: [Line...], outro: [Line...] },
    ...
    10: { intro: [...], preBoss: [...], outro: [...] },   // 10장 outro 는 최종 선택 직전까지
  },
  finalChoice: Choice,          // 10장 보스 처치 후 엔딩 선택 (아래)
  endings: {
    dawn:    { title: '새벽의 프로토콜', lines: [Line...] },
    stars:   { title: '별의 종말',       lines: [Line...] },
    eternal: { title: '영원한 관리자',   lines: [Line...] },
  },
  memories: [ { id: 'm01', chapter: 1, title: '...', text: '...' }, ... ],   // 정확히 20개, 챕터당 2개
  bossLore: { scavenger: '도감 설명 2~3문장', ... },                           // 보스 10종 모두
  battle: {                                  // 전투 중 화면 위쪽에 짧게 뜨는 대사(한 줄, 30자 이내 권장)
    scavenger: { start: [Bark], phase2: [Bark], broken: [Bark], defeat: [Bark] },
    ... (보스 10종 모두)
    lia: { scan: [Bark], zeroFrame: [Bark], lowHp: [Bark], break: [Bark], chain: [Bark], allyDown: [Bark] },
    zeroAlly: { chain: [Bark], join: [Bark] },
  },
  hub: [ { minChapter: 1, who: 'lia', text: '...' }, ... ],   // 작전 터미널에서 리아가 하는 말(최소 15개)
  chapterNames: { 1: '잿빛 각성', ... },                        // 기획서 그대로
  chapterSummaries: { 1: '한 줄 요약', ... },
};
```

`Line`(대사 한 줄) — 다음 중 하나:

```js
{ who: 'kai', text: '...', bg?: 'ruins', fx?: 'shake'|'flash'|'glitch'|'fadeIn' }
{ who: 'npc', name: '생존자 리더 하윤', text: '...' }
{ choice: 'zeroSpared', options: [ { text: '보여질 선택지', value: true,  lines: [Line...] },
                                   { text: '...',           value: false, lines: [Line...] } ] }
{ if: 'liaTrusted', then: [Line...], else: [Line...] }      // 플래그 분기 (else 생략 가능)
```

- 한 줄은 **70자 이내**. 길면 여러 줄로 나눕니다. `\n` 금지.
- `bg` 는 그 줄부터 배경을 바꿉니다(첫 줄에 넣는 걸 권장).
- `choice` 를 고르면 해당 플래그에 `value` 가 저장되고 `lines` 가 이어서 재생됩니다.

`Choice`(최종 선택):

```js
finalChoice: {
  prompt: [Line...],     // 선택 직전 대사
  options: [
    { text: '...', ending: 'dawn',    require: ['liaTrusted', 'zeroSpared'] },  // require 플래그가 모두 true 일 때만 보임
    { text: '...', ending: 'stars' },
    { text: '...', ending: 'eternal' },
  ],
}
```

`Bark`: `{ who: 'lia', text: '...' }` (who 는 §3 의 id).

## 5. 오디오 — `AZ.audio` (`js/audio/audio.js`)

WebAudio 만 사용. 외부 파일 없음. AudioContext 가 없거나(테스트 환경) 실패하면 모든 함수는 조용히 아무것도 하지 않습니다.

```js
AZ.audio.init()                       // 첫 사용자 입력 때 호출. 여러 번 불려도 안전.
AZ.audio.sfx(name, opts?)             // opts: { vol?: 0..1, pitch?: 배율(1=기본), pan?: -1..1 }
AZ.audio.music(trackId)               // 트랙 교체(크로스페이드 ~1초). 같은 트랙이면 무시. 'none' 이면 정지.
AZ.audio.setVolumes({ master, music, sfx })   // 0..1
AZ.audio.setMuted(bool)
AZ.audio.zeroFrame(on)                // ZERO FRAME 중: 음악에 저역 통과 필터 + 피치 살짝 내림
AZ.audio.duck(amount, seconds)        // 잠시 음악 줄이기(보스 등장 연출 등)
```

효과음 이름: `slash`, `slashHeavy`, `swing`, `hit`, `hitWeak`, `crit`, `dodge`, `perfect`, `zeroFrame`, `break`, `skill`,
`blink`, `wave`, `beam`, `shot`, `railgun`, `charge`, `explosion`, `bigExplosion`, `warn`, `hurt`, `heal`, `shield`, `levelup`,
`ui`, `uiConfirm`, `uiBack`, `pickup`, `roar`, `laser`, `missile`, `stomp`, `timeStop`, `ult`, `chain`, `victory`, `defeat`,
`text`(대사 타자기 소리, 아주 짧고 작게), `glitch`, `counter`, `clang`(방패에 막힘), `teleport`, `summon`, `alarm`.

음악 트랙 id: `title`, `hub`, `stage`, `stage2`(후반 챕터 스테이지), `boss`, `rival`(제로전), `final`(9~10장 보스),
`memory`(슬픈 회상/대화), `ending`, `none`.

## 6. 전투 좌표계

- 월드는 위에서 내려다본 평면(px 단위). 화면에 그릴 때 y 에 `0.62` 를 곱해 비스듬한 시점을 만듭니다.
- 판정은 모두 월드 좌표의 원/부채꼴/직사각형으로 합니다.
- 각도는 라디안, `0` = +x(오른쪽), 시계 방향(+y 아래쪽)으로 증가.
- 적의 시간은 `battle.enemyScale`(ZERO FRAME 0.25, 시간 정지 0) 배로 흐릅니다. 플레이어·동료는 1배.

## 7. 스프라이트 — `AZ.gfx.sprites` (`js/gfx/sprites.js`)

```js
AZ.gfx.sprites.draw(g, ent, W, t)        // g: 엔티티 발밑(비행체는 높이 z 를 뺀 위치)이 (0,0), 카메라 배율이 이미 걸린 상태
AZ.gfx.sprites.drawPortraitIcon(g, id, size)
```

- `ent.kind` 로 나눠 그립니다: `player` / `ally`(`ent.ally`) / `enemy`(`ent.type`) / `boss`(`ent.bossId`). 모르는 것은 기본 실루엣.
- 그림자, 선택 표시, 방벽, 체력 바, 피격 번쩍임(`g.filter`), 투명도(`alpha`, 등장·사망 페이드)는 `render.js` 가 맡습니다.
- 동작은 엔티티 필드로만 정해집니다: `anim` + `animT`, `facing`, `st`(플레이어 공격 단계), `exposed`, `broken`, `stance`,
  `charging`, `parts.arm`, `airborne`, `phase`, `dead`/`deadT`, `shieldDown`, `haste`, `counterReady` 등.
