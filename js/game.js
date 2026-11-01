'use strict';

/* =========================================================
 * 카드 배틀 - 게임 엔진
 * 카드/적 데이터는 js/cards.js 에 있습니다.
 * ========================================================= */

const CONFIG = {
  playerMaxHp: 60,
  maxEnergy: 3,
  handSize: 5, // 턴마다 뽑는 카드 수
  maxHandSize: 10, // 손패 한도 (넘치면 버린 카드로)
  healAfterBattle: 15,
  rewardChoices: 3,
};

const TYPE_LABEL = { attack: '공격', skill: '스킬', power: '파워' };

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let state = null;
let nextUid = 1;

/* ---------------- 유틸 ---------------- */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 받침 유무에 따라 조사 선택: josa('슬라임', '이', '가') → '이'
function josa(word, withFinal, withoutFinal) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return withoutFinal;
  return code % 28 !== 0 ? withFinal : withoutFinal;
}

function makeCard(id) {
  const def = CARD_LIBRARY[id];
  if (!def) throw new Error(`알 수 없는 카드: ${id}`);
  return { uid: nextUid++, id, ...def };
}

function makeUnit(name, maxHp) {
  return { name, hp: maxHp, maxHp, block: 0, strength: 0, weak: 0, poison: 0 };
}

/* ---------------- 게임 흐름 ---------------- */

function newGame() {
  state = {
    player: makeUnit('플레이어', CONFIG.playerMaxHp),
    energy: 0,
    deckList: STARTER_DECK.map(makeCard), // 소유한 카드 전체 (전투 사이에도 유지)
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    stage: 0,
    enemy: null,
    turn: 0,
    busy: false,
    over: false,
  };
  closeModal();
  startBattle();
}

function startBattle() {
  const def = ENEMY_LIBRARY[state.stage];
  state.enemy = {
    ...makeUnit(def.name, def.maxHp),
    emoji: def.emoji,
    boss: !!def.boss,
    intents: def.intents,
    intentIndex: 0,
  };
  // 전투마다 초기화되는 상태 (체력은 유지)
  Object.assign(state.player, { block: 0, strength: 0, weak: 0, poison: 0 });
  state.drawPile = shuffle([...state.deckList]);
  state.hand = [];
  state.discardPile = [];
  state.exhaustPile = [];
  state.turn = 0;

  $('log').innerHTML = '';
  log(`⚔️ ${def.name}${josa(def.name, '이', '가')} 나타났다!`);
  startPlayerTurn();
}

function startPlayerTurn() {
  const p = state.player;
  state.turn++;
  p.block = 0;
  if (tickPoison(p)) {
    render();
    loseGame();
    return;
  }
  state.energy = CONFIG.maxEnergy;
  drawCards(CONFIG.handSize);
  state.busy = false;
  render();
}

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) return;
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [];
      log('🔄 버린 카드를 섞어 덱으로 되돌렸다.');
    }
    const card = state.drawPile.pop();
    if (state.hand.length >= CONFIG.maxHandSize) {
      state.discardPile.push(card);
      log(`손패가 가득 차서 ${card.name}${josa(card.name, '을', '를')} 버렸다.`);
    } else {
      card.justDrawn = true; // 손패에 들어오는 애니메이션용
      state.hand.push(card);
    }
  }
}

function canPlay(card) {
  return !state.busy && !state.over && card.cost <= state.energy;
}

function playCard(index) {
  if (state.busy || state.over || isModalOpen()) return;
  const card = state.hand[index];
  if (!card) return;
  if (card.cost > state.energy) {
    log('⚡ 에너지가 부족하다!');
    bump($('energy'));
    return;
  }

  state.energy -= card.cost;
  state.hand.splice(index, 1);
  log(`🃏 ${card.name}`);

  const { player, enemy } = state;
  for (const effect of card.effects) {
    applyEffect(effect, player, enemy);
    if (enemy.hp <= 0 || player.hp <= 0) break;
  }
  (card.exhaust ? state.exhaustPile : state.discardPile).push(card);
  render();

  if (player.hp <= 0) loseGame();
  else if (enemy.hp <= 0) winBattle();
}

async function endTurn() {
  if (state.busy || state.over || isModalOpen()) return;
  const s = state;
  s.busy = true;
  s.discardPile.push(...s.hand);
  s.hand = [];
  if (s.player.weak > 0) s.player.weak--;
  render();

  await sleep(350);
  if (state !== s) return; // 그 사이 새 게임이 시작됨
  await enemyTurn(s);
}

async function enemyTurn(s) {
  const enemy = s.enemy;
  enemy.block = 0;
  if (tickPoison(enemy)) {
    render();
    await sleep(500);
    if (state !== s) return;
    winBattle();
    return;
  }

  log(`— ${enemy.name}의 차례 —`);
  bump($('enemy'), 'lunge');
  await sleep(250);
  if (state !== s) return;

  for (const effect of currentIntent(enemy)) {
    applyEffect(effect, enemy, s.player);
    if (s.player.hp <= 0) break;
  }
  enemy.intentIndex = (enemy.intentIndex + 1) % enemy.intents.length;
  if (enemy.weak > 0) enemy.weak--;
  render();

  await sleep(450);
  if (state !== s) return;
  if (s.player.hp <= 0) loseGame();
  else startPlayerTurn();
}

function currentIntent(enemy) {
  return enemy.intents[enemy.intentIndex];
}

function winBattle() {
  state.busy = true;
  const enemy = state.enemy;
  log(`🏆 ${enemy.name}${josa(enemy.name, '을', '를')} 쓰러뜨렸다!`);

  if (state.stage >= ENEMY_LIBRARY.length - 1) {
    state.over = true;
    render();
    showEndScreen(true);
    return;
  }
  const healed = heal(state.player, CONFIG.healAfterBattle, false);
  render();
  showRewardScreen(healed);
}

function nextStage() {
  state.stage++;
  closeModal();
  startBattle();
}

function loseGame() {
  state.busy = true;
  state.over = true;
  log('💀 쓰러졌다...');
  render();
  showEndScreen(false);
}

/* ---------------- 효과 처리 ---------------- */

// source: 효과를 쓰는 쪽, target: 상대
function applyEffect(e, source, target) {
  const isPlayer = source === state.player;
  switch (e.type) {
    case 'damage': {
      const times = e.times || 1;
      for (let i = 0; i < times && target.hp > 0; i++) {
        dealDamage(source, target, calcDamage(source, e.value));
      }
      break;
    }
    case 'damageFromBlock':
      dealDamage(source, target, calcDamage(source, source.block));
      break;
    case 'block':
      source.block += e.value;
      popText(source, `+${e.value}🛡️`, 'block');
      log(`${source.name}${josa(source.name, '이', '가')} 방어도 ${e.value} 획득`);
      break;
    case 'heal':
      heal(source, e.value);
      break;
    case 'loseHp':
      loseHp(source, e.value);
      break;
    case 'strength':
      source.strength += e.value;
      popText(source, `💪+${e.value}`, 'buff');
      log(`${source.name}의 힘이 ${e.value} 올랐다`);
      break;
    case 'weak':
      target.weak += e.value;
      popText(target, '🌀약화', 'debuff');
      log(`${target.name}${josa(target.name, '이', '가')} 약화되었다 (${e.value}턴)`);
      break;
    case 'poison':
      target.poison += e.value;
      popText(target, `☠️${e.value}`, 'poison');
      log(`${target.name}에게 독 ${e.value}`);
      break;
    case 'draw':
      if (isPlayer) drawCards(e.value);
      break;
    case 'energy':
      if (isPlayer) state.energy += e.value;
      break;
    default:
      console.warn('알 수 없는 효과:', e);
  }
}

function calcDamage(source, base) {
  let dmg = base + source.strength;
  if (source.weak > 0) dmg = Math.floor(dmg * 0.75);
  return Math.max(0, dmg);
}

function dealDamage(source, target, amount) {
  const blocked = Math.min(target.block, amount);
  const hpLoss = amount - blocked;
  target.block -= blocked;
  target.hp = Math.max(0, target.hp - hpLoss);

  popText(target, hpLoss > 0 ? `-${hpLoss}` : '막음!', hpLoss > 0 ? 'damage' : 'block');
  if (hpLoss > 0) bump(unitEl(target), 'shake');
  const blockedText = blocked > 0 ? ` (${blocked} 막음)` : '';
  log(`${source.name} → ${target.name}: ${hpLoss} 피해${blockedText}`);
}

function heal(unit, amount, show = true) {
  const healed = Math.min(amount, unit.maxHp - unit.hp);
  unit.hp += healed;
  if (show && healed > 0) {
    popText(unit, `+${healed}`, 'heal');
    log(`${unit.name}${josa(unit.name, '이', '가')} 체력 ${healed} 회복`);
  }
  return healed;
}

function loseHp(unit, amount) {
  unit.hp = Math.max(0, unit.hp - amount);
  popText(unit, `-${amount}`, 'damage');
  log(`${unit.name}${josa(unit.name, '이', '가')} 체력을 ${amount} 잃었다`);
}

// 독 피해 처리. 쓰러졌으면 true
function tickPoison(unit) {
  if (unit.poison <= 0) return false;
  const dmg = unit.poison;
  unit.hp = Math.max(0, unit.hp - dmg);
  unit.poison--;
  popText(unit, `☠️-${dmg}`, 'poison');
  log(`☠️ ${unit.name}${josa(unit.name, '이', '가')} 독으로 ${dmg} 피해`);
  return unit.hp <= 0;
}

/* ---------------- 카드/의도 설명 ---------------- */

// source 를 주면 힘·약화가 반영된 실제 수치를 보여줌
function valueHTML(actual, base) {
  if (actual > base) return `<b class="mod-up">${actual}</b>`;
  if (actual < base) return `<b class="mod-down">${actual}</b>`;
  return `<b>${actual}</b>`;
}

function describeEffect(e, source) {
  switch (e.type) {
    case 'damage': {
      const shown = source ? valueHTML(calcDamage(source, e.value), e.value) : `<b>${e.value}</b>`;
      return `피해 ${shown}${e.times > 1 ? ` × ${e.times}` : ''}`;
    }
    case 'damageFromBlock': {
      const extra = source ? ` (${calcDamage(source, source.block)})` : '';
      return `현재 방어도만큼 피해${extra}`;
    }
    case 'block': return `방어도 <b>${e.value}</b>`;
    case 'heal': return `체력 <b>${e.value}</b> 회복`;
    case 'loseHp': return `체력 <b>${e.value}</b> 잃음`;
    case 'strength': return `힘 <b>+${e.value}</b>`;
    case 'weak': return `약화 <b>${e.value}</b>턴`;
    case 'poison': return `독 <b>${e.value}</b>`;
    case 'draw': return `카드 <b>${e.value}</b>장 뽑기`;
    case 'energy': return `에너지 <b>+${e.value}</b>`;
    default: return e.type;
  }
}

function cardHTML(card, { index, source, playable = true, keyHint, dealDelay } = {}) {
  const classes = ['card', card.type];
  if (!playable) classes.push('unplayable');
  if (dealDelay !== undefined) classes.push('dealt');
  const style = dealDelay ? ` style="animation-delay:${dealDelay}ms"` : '';
  const desc = card.effects.map((e) => `<div>${describeEffect(e, source)}</div>`).join('');
  const tag = card.exhaust ? '<div class="card-tag" title="사용하면 이번 전투에서 제외됩니다">소멸</div>' : '';
  const key = keyHint ? `<div class="key">${keyHint}</div>` : '';
  const idx = index !== undefined ? ` data-index="${index}"` : '';
  return `
    <div class="${classes.join(' ')}"${idx}${style}>
      <div class="cost">${card.cost}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-type">${TYPE_LABEL[card.type] || card.type}</div>
      <div class="card-desc">${desc}</div>
      ${tag}${key}
    </div>`;
}

function intentHTML(effects, enemy) {
  return effects.map((e) => {
    switch (e.type) {
      case 'damage': {
        const times = e.times > 1 ? `×${e.times}` : '';
        return `<span class="intent-part attack" title="공격">⚔️ ${calcDamage(enemy, e.value)}${times}</span>`;
      }
      case 'block': return `<span class="intent-part" title="방어">🛡️ ${e.value}</span>`;
      case 'strength': return `<span class="intent-part" title="힘 증가">💪 +${e.value}</span>`;
      case 'weak': return `<span class="intent-part" title="약화 부여">🌀 약화</span>`;
      case 'poison': return `<span class="intent-part" title="독 부여">☠️ ${e.value}</span>`;
      case 'heal': return `<span class="intent-part" title="회복">💚 ${e.value}</span>`;
      default: return '<span class="intent-part">❓</span>';
    }
  }).join('');
}

function statusHTML(u) {
  const out = [];
  if (u.block > 0) out.push(`<span class="status block" title="방어도: 받는 피해를 먼저 막아줍니다">🛡️ ${u.block}</span>`);
  if (u.strength) out.push(`<span class="status" title="힘: 공격 피해 +${u.strength}">💪 ${u.strength}</span>`);
  if (u.weak) out.push(`<span class="status" title="약화: 주는 공격 피해 25% 감소 (${u.weak}턴 남음)">🌀 ${u.weak}</span>`);
  if (u.poison) out.push(`<span class="status" title="독: 턴 시작 시 ${u.poison} 피해 후 1 감소">☠️ ${u.poison}</span>`);
  return out.join('');
}

/* ---------------- 렌더링 ---------------- */

function unitEl(unit) {
  return unit === state.player ? $('player') : $('enemy');
}

function renderUnit(prefix, u) {
  $(`${prefix}-hpfill`).style.width = `${(u.hp / u.maxHp) * 100}%`;
  $(`${prefix}-hptext`).textContent = `${u.hp} / ${u.maxHp}`;
  $(`${prefix}-status`).innerHTML = statusHTML(u);
}

function render() {
  const { player, enemy } = state;

  $('stage-info').textContent = `스테이지 ${state.stage + 1} / ${ENEMY_LIBRARY.length} · ${state.turn}턴`;

  // 적
  $('enemy-portrait').textContent = enemy.emoji;
  $('enemy-name').innerHTML = enemy.boss ? `${enemy.name} <span class="boss">BOSS</span>` : enemy.name;
  $('enemy').classList.toggle('dead', enemy.hp <= 0);
  $('enemy-intent').innerHTML = enemy.hp > 0 && !state.over
    ? `<span class="intent-label">다음 행동</span>${intentHTML(currentIntent(enemy), enemy)}`
    : '';
  renderUnit('enemy', enemy);

  // 플레이어
  renderUnit('player', player);
  $('player').classList.toggle('dead', player.hp <= 0);
  $('energy').textContent = `${state.energy}/${CONFIG.maxEnergy}`;

  // 손패
  let newCount = 0;
  $('hand').innerHTML = state.hand.length
    ? state.hand.map((card, i) => {
      const dealDelay = card.justDrawn ? newCount++ * 70 : undefined;
      card.justDrawn = false;
      return cardHTML(card, {
        index: i,
        source: player,
        playable: canPlay(card),
        keyHint: i < 9 ? String(i + 1) : '',
        dealDelay,
      });
    }).join('')
    : `<div class="empty-hand">${state.busy ? '적의 차례...' : '손에 카드가 없습니다'}</div>`;

  // 카드 더미
  $('piles').innerHTML = `
    <span title="뽑을 카드">🂠 덱 ${state.drawPile.length}</span>
    <span title="버린 카드">🗑️ 버림 ${state.discardPile.length}</span>
    <span title="소멸한 카드">🔥 소멸 ${state.exhaustPile.length}</span>`;

  $('end-turn').disabled = state.busy || state.over;
}

function log(msg) {
  const box = $('log');
  const line = document.createElement('div');
  line.textContent = msg;
  box.appendChild(line);
  while (box.children.length > 60) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}

// 떠오르는 숫자 연출
function popText(unit, text, kind) {
  const host = unitEl(unit);
  const el = document.createElement('div');
  el.className = `float ${kind}`;
  el.textContent = text;
  el.style.left = `${35 + Math.random() * 30}%`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// CSS 애니메이션 재생
function bump(el, cls = 'shake') {
  el.classList.remove(cls);
  void el.offsetWidth; // 리플로우로 애니메이션 재시작
  el.classList.add(cls);
}

/* ---------------- 모달(보상/결과/덱 보기) ---------------- */

let modalDismissable = false; // Esc 로 닫을 수 있는 창인지 (덱 보기만 해당)

function openModal(html, onClick, dismissable = false) {
  $('modal').innerHTML = html;
  $('modal').onclick = onClick || null;
  modalDismissable = dismissable;
  $('overlay').classList.remove('hidden');
}

function closeModal() {
  modalDismissable = false;
  $('overlay').classList.add('hidden');
  $('modal').innerHTML = '';
  $('modal').onclick = null;
}

function isModalOpen() {
  return !$('overlay').classList.contains('hidden');
}

function showRewardScreen(healed) {
  const choices = shuffle([...REWARD_POOL]).slice(0, CONFIG.rewardChoices).map(makeCard);
  const healText = healed > 0 ? `체력을 ${healed} 회복했습니다. ` : '';
  openModal(`
    <h2>🏆 승리!</h2>
    <p>${healText}덱에 추가할 카드를 하나 고르세요.</p>
    <div class="card-row">${choices.map((c, i) => cardHTML(c, { index: i })).join('')}</div>
    <button data-action="skip" class="secondary">건너뛰기</button>
  `, (ev) => {
    const cardEl = ev.target.closest('.card');
    if (cardEl) {
      const card = choices[Number(cardEl.dataset.index)];
      state.deckList.push(card);
      log(`📥 ${card.name}${josa(card.name, '을', '를')} 덱에 추가했다.`);
      nextStage();
    } else if (ev.target.closest('[data-action="skip"]')) {
      nextStage();
    }
  });
}

function showEndScreen(victory) {
  const title = victory ? '🎉 클리어!' : '💀 패배...';
  const text = victory
    ? `모든 적을 물리쳤습니다! 남은 체력 ${state.player.hp} · 덱 ${state.deckList.length}장`
    : `스테이지 ${state.stage + 1}에서 쓰러졌습니다.`;
  openModal(`
    <h2>${title}</h2>
    <p>${text}</p>
    <button data-action="restart">다시 하기</button>
  `, (ev) => {
    if (ev.target.closest('[data-action="restart"]')) newGame();
  });
}

function showDeck() {
  if (isModalOpen()) return;
  const cards = [...state.deckList].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'ko'));
  openModal(`
    <h2>내 덱 (${cards.length}장)</h2>
    <div class="card-row small">${cards.map((c) => cardHTML(c)).join('')}</div>
    <button data-action="close">닫기</button>
  `, (ev) => {
    if (ev.target.closest('[data-action="close"]')) closeModal();
  }, true);
}

/* ---------------- 입력 ---------------- */

$('hand').addEventListener('click', (ev) => {
  const cardEl = ev.target.closest('.card');
  if (cardEl) playCard(Number(cardEl.dataset.index));
});
$('end-turn').addEventListener('click', endTurn);
$('deck-btn').addEventListener('click', showDeck);
$('restart-btn').addEventListener('click', () => {
  if (confirm('처음부터 다시 시작할까요?')) newGame();
});

// 단축키: 1~9 카드 사용, E 턴 종료 (한글 자판에서도 동작하도록 code 사용)
document.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  if (ev.code === 'Escape' && modalDismissable) {
    closeModal();
    return;
  }
  const digit = /^Digit([1-9])$/.exec(ev.code);
  if (digit) playCard(Number(digit[1]) - 1);
  else if (ev.code === 'KeyE') endTurn();
});

newGame();
