# 하늘 사냥꾼 — 픽셀 그림 안내

게임은 **225×400 픽셀 버퍼**(논리 좌표 450×800 의 절반)에 그린 뒤 번짐 없이 크게 늘립니다.
그림은 모두 **가운데를 기준**으로 그려집니다. 논리 좌표의 반지름 `r` 은 화면에서 `r/2` 픽셀입니다.
그림 파일은 없고, `shooter/js/sprites/*.js` 에서 코드로 등록합니다 (`js/pix.js` 참고).

```js
// 글자 그림 — '.' 과 ' ' 은 투명, 모든 프레임은 같은 크기
SH.pix.sprite('gem', { palette: { k: '#1b1230', c: '#8fd4ff' }, frames: [[ '..k..', '.kck.', /* ... */ ]] });

// 코드 그림 — 픽셀 단위 붓 (번짐 없음)
SH.pix.paint('turret', 30, 30, 9, (P, f) => { P.circle(15, 14, 8.6, '#5e6e8c'); P.outline('#0e1220'); });
// P: set get clear rect circle ellipse line poly stamp outline replace mirror dither shadeY
```

미리보기 (PNG 로 저장해서 확인):

```bash
node tools/sprite-sheet.js out.png --files=shooter/js/sprites/mech.js
node tools/sprite-sheet.js out.png --only=titan,turret,orb_*
```

## 그림 규칙

- 16비트 시절 오락실 슈팅 느낌. 굵은 실루엣, 1px 어두운 테두리, **빛은 왼쪽 위**에서.
- 반투명 픽셀은 쓰지 않습니다. 그러데이션은 바둑판 디더링으로.
- 적 탄이 화면에서 가장 잘 보여야 합니다 (밝은 가운데 + 진한 테두리). 배경 소품은 대비를 낮게.
- 하늘색(`#5aa8f0`)과 어두운 배경 모두에서 또렷해야 합니다 (미리보기가 둘 다 보여 줍니다).

## 그림 목록 (렌더러가 이름으로 찾음)

| 파일 | 그림 |
|---|---|
| `player.js` | `player`(3: 왼쪽 기울기·수평·오른쪽) `flame` `shield` `shot_spread`(3) `shot_homing` `shot_laser`(5: 파워 단계) `missile`(8 방향) `item_spread` `item_laser` `item_homing` `item_bomb` `item_life` `item_shield` `gem` `bigGem` `spark` `orb_<색>` `big_<색>` (색: pink red orange yellow green blue purple white) |
| `mech.js` | `titan` 156×96 (8 = 모습 4 × 깜빡임 2: 장갑 · 코어 열림 · 부서짐 · 폭주), `turret`(9: 포신 방향), `turretWreck`, `emissile`(8 방향) |
| `effects.js` | `boom` `boomBig` `hitSpark` `pop` `puff`, 배경 `cloud0`~`cloud3` `island` `rock` |
| `interface.js` | `logo`(하늘 사냥꾼 제목 글자) `icon_life` `icon_bomb` `btn_pause` `btn_bomb` `frame`(9분할 창 틀) `cursor` `star` |

`titan` 의 포탑 자리는 그림 가운데에서 (±48, +13) 픽셀, 코어는 (0, +4) 픽셀입니다 (`js/data.js` 의 좌표 ÷ 2).
