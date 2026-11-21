'use strict';

/* =========================================================
 * NEON RAID: ETERNAL OVERLORD — 색 · 보스 10명 · 기체 5종 · 강화 6종
 * Replit 원본(src/game/constants.ts)과 같은 수치입니다. 타입 표기를 빼고, 화면에 나오는 이름·설명을 한국어로 바꿨습니다.
 * ========================================================= */

const WIDTH = 540;
const HEIGHT = 960;

const C_BG       = '#03030A';
const C_CYAN     = '#00FFFF';
const C_MAGENTA  = '#FF00FF';
const C_WHITE    = '#FFFFFF';
const C_ORANGE   = '#FFA500';
const C_RED      = '#FF0032';
const C_YELLOW   = '#FFE600';
const C_GREEN    = '#00FF64';
const C_PURPLE   = '#B400FF';
const C_TEAL     = '#00C8C8';
const C_LIME     = '#B4FF00';
const C_GOLD     = '#FFD700';
const C_PINK     = '#FF64C8';
const C_INDIGO   = '#4B0082';
const C_SKY      = '#87CEFA';
const C_STEEL    = '#A0C8DC';
const C_CHROME   = '#C8DCF0';
const C_COIN     = '#FFC800';

/** 화면 글꼴: 영문·숫자는 원본처럼 Arial, 한글은 시스템 한글 글꼴 */
const FONT_STACK = "Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function colorWithAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function blendColor(c, li) {
  const [r, g, b] = hexToRgb(c);
  return rgbToHex(r * li, g * li, b * li);
}

const STAGE_INFO = {
  1:  { name: '강철 군주',    color: C_MAGENTA, icon: '◆',  hp: 30000,  desc: '회전하며 쓸어 가는 레이저와 원형 탄막' },
  2:  { name: '수정 망령',   color: C_PURPLE,  icon: '✦',  hp: 40000,  desc: '지뢰, 회전 광선, 청록색 에너지 방어막' },
  3:  { name: '네온 드래곤',       color: C_CYAN,    icon: '~',  hp: 60000,  desc: '꿈틀대는 몸의 마디마다 탄을 쏜다' },
  4:  { name: '공허 사마귀',       color: C_PURPLE,  icon: 'X',  hp: 80000,  desc: '예고 없이 순간이동한다. 낫날이 휘어 날아온다' },
  5:  { name: '오메가 머신',     color: C_STEEL,   icon: '*',  hp: 120000, desc: 'EMP 충격파, 격자 레이저, 팔 포탑' },
  6:  { name: '철의 수호자',     color: C_ORANGE,  icon: '█',  hp: 150000, desc: '정면 방어막이 공격을 막는다. 레이저를 쏠 때 코어가 드러난다.' },
  7:  { name: '쌍둥이 요격기', color: C_RED,     icon: '▼▼', hp: 180000, desc: '레이저로 이어진 두 전투기. 갈라지면 폭주한다.' },
  8:  { name: '환영 군주',      color: C_MAGENTA, icon: '⚛',  hp: 220000, desc: '중력장을 비틀고 착시로 시험한다.' },
  9:  { name: '심연의 포식자',  color: C_TEAL,    icon: 'Ψ',  hp: 260000, desc: '잠수해 숨는다. 소나 신호로 먼저 경고한다.' },
  10: { name: '종말의 정점',     color: C_GOLD,    icon: '☣',  hp: 380000, desc: '2장 마지막 보스. 단계마다 진화하고 블랙홀로 무너진다.' },
};

const CHARACTERS
 = {
  0: { name: '뱅가드', color: C_CYAN,   desc: '균형 잡힌 전투기. 세 갈래로 쏜다.',         cost: 0,   fire_rate: 8,  bullet_count: 3, bullet_spread: 0.08, bullet_speed: 15, bullet_size: 6,  bullet_color: C_CYAN,   hp_bonus: 0,   speed_bonus: 0,  special: 'triple',  special_name: '세 갈래',   icon: '▲' },
  1: { name: '팬텀',  color: C_PURPLE, desc: '빠르고 날렵하다. 한 발씩 빠르게 쏜다.',        cost: 200, fire_rate: 4,  bullet_count: 1, bullet_spread: 0.0,  bullet_speed: 19, bullet_size: 4,  bullet_color: C_PURPLE, hp_bonus: -30, speed_bonus: 4,  special: 'rapid',   special_name: '속사',      icon: '◆' },
  2: { name: '타이탄',    color: C_ORANGE, desc: '무겁고 튼튼하다. 넓게 퍼지는 산탄.',       cost: 350, fire_rate: 15, bullet_count: 6, bullet_spread: 0.25, bullet_speed: 11, bullet_size: 8,  bullet_color: C_ORANGE, hp_bonus: 80,  speed_bonus: -2, special: 'scatter', special_name: '산탄',      icon: '■' },
  3: { name: '스펙터',  color: C_PINK,   desc: '보스를 쫓아가는 유도 미사일.',           cost: 500, fire_rate: 20, bullet_count: 2, bullet_spread: 0.0,  bullet_speed: 9,  bullet_size: 7,  bullet_color: C_PINK,   hp_bonus: 0,   speed_bonus: 1,  special: 'homing',  special_name: '유도',      icon: '✦' },
  4: { name: '노바',     color: C_GOLD,   desc: '사방으로 퍼지는 플라스마 고리.',         cost: 800, fire_rate: 30, bullet_count: 8, bullet_spread: Math.PI * 2 / 8, bullet_speed: 8, bullet_size: 9, bullet_color: C_GOLD,  hp_bonus: 20,  speed_bonus: 0,  special: 'ring',    special_name: '고리',      icon: '★' },
};

const UPGRADES = {
  speed:  { name: '이동 속도',  desc: '레벨마다 이동 속도 +2', max: 5, costs: [100,150,200,300,400], color: C_LIME,  icon: '⚡' },
  hp:     { name: '최대 체력',    desc: '레벨마다 최대 체력 +30',    max: 5, costs: [120,180,250,350,500], color: C_GREEN, icon: '♥' },
  damage: { name: '공격력',   desc: '레벨마다 공격력 +50%',   max: 5, costs: [150,220,300,450,600], color: C_RED,   icon: '⚔' },
  fire:   { name: '연사 속도',    desc: '레벨마다 발사 간격 -1',  max: 4, costs: [180,280,400,600],     color: C_ORANGE,icon: '🔥' },
  shield: { name: '자동 회복', desc: '레벨당 3초에 체력 1 회복',  max: 3, costs: [200,350,550],         color: C_TEAL,  icon: '🛡' },
  magnet: { name: '코인 자석',  desc: '레벨마다 코인 끌어오는 거리 +80',max: 3, costs: [80,150,250],          color: C_COIN,  icon: '🧲' },
};

const STAGE_COLORS = {
  1:  [C_MAGENTA, C_ORANGE, C_RED, C_WHITE],
  2:  [C_PURPLE,  C_TEAL,   C_GREEN, C_RED],
  3:  [C_CYAN,    C_GREEN,  C_YELLOW, C_RED],
  4:  [C_PURPLE,  C_INDIGO, C_MAGENTA, C_WHITE],
  5:  [C_STEEL,   C_CYAN,   C_ORANGE, C_RED],
  6:  [C_ORANGE,  C_YELLOW, C_RED, C_WHITE],
  7:  [C_RED,     C_ORANGE, C_PURPLE, C_WHITE],
  8:  [C_MAGENTA, C_PINK,   C_PURPLE, C_WHITE],
  9:  [C_TEAL,    C_SKY,    C_INDIGO, C_WHITE],
  10: [C_GOLD,    C_CHROME, C_ORANGE, C_RED],
};
