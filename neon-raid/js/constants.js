'use strict';

/* =========================================================
 * NEON RAID: ETERNAL OVERLORD — 색 · 보스 10명 · 기체 5종 · 강화 6종
 * Replit 원본(src/game/constants.ts)과 같은 내용입니다. 타입 표기만 뺐습니다.
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
  1:  { name: 'STEEL OVERLORD',    color: C_MAGENTA, icon: '◆',  hp: 30000,  desc: 'Rotating sweep lasers & radial bullet curtains' },
  2:  { name: 'CRYSTAL PHANTOM',   color: C_PURPLE,  icon: '✦',  hp: 40000,  desc: 'Mines, rotating beams & teal energy shields' },
  3:  { name: 'NEON DRAGON',       color: C_CYAN,    icon: '~',  hp: 60000,  desc: 'Sinuous body segments fire from every joint' },
  4:  { name: 'VOID MANTIS',       color: C_PURPLE,  icon: 'X',  hp: 80000,  desc: 'Teleports without warning. Scythe blades curve' },
  5:  { name: 'OMEGA MACHINE',     color: C_STEEL,   icon: '*',  hp: 120000, desc: 'EMP shockwaves, grid lasers & arm turrets' },
  6:  { name: 'IRON GUARDIAN',     color: C_ORANGE,  icon: '█',  hp: 150000, desc: 'Frontal shield blocks all hits. Core exposed on laser strike.' },
  7:  { name: 'TWIN INTERCEPTORS', color: C_RED,     icon: '▼▼', hp: 180000, desc: 'Dual strike craft linked with laser. Enrages when split.' },
  8:  { name: 'PHANTOM LORD',      color: C_MAGENTA, icon: '⚛',  hp: 220000, desc: 'Distorts gravity field and tests with optical illusions.' },
  9:  { name: 'ABYSSAL PREDATOR',  color: C_TEAL,    icon: 'Ψ',  hp: 260000, desc: 'Submerges to hide. Warns with active sonar ping checks.' },
  10: { name: 'DOOMSDAY APEX',     color: C_GOLD,    icon: '☣',  hp: 380000, desc: 'Chapter 2 Finale. Evolutionary phases & blackhole collapse.' },
};

const CHARACTERS
 = {
  0: { name: 'VANGUARD', color: C_CYAN,   desc: 'Balanced fighter. Triple-shot burst.',         cost: 0,   fire_rate: 8,  bullet_count: 3, bullet_spread: 0.08, bullet_speed: 15, bullet_size: 6,  bullet_color: C_CYAN,   hp_bonus: 0,   speed_bonus: 0,  special: 'triple',  icon: '▲' },
  1: { name: 'PHANTOM',  color: C_PURPLE, desc: 'Fast & agile. Rapid-fire single shots.',        cost: 200, fire_rate: 4,  bullet_count: 1, bullet_spread: 0.0,  bullet_speed: 19, bullet_size: 4,  bullet_color: C_PURPLE, hp_bonus: -30, speed_bonus: 4,  special: 'rapid',   icon: '◆' },
  2: { name: 'TITAN',    color: C_ORANGE, desc: 'Heavy & tough. Explosive scatter shots.',       cost: 350, fire_rate: 15, bullet_count: 6, bullet_spread: 0.25, bullet_speed: 11, bullet_size: 8,  bullet_color: C_ORANGE, hp_bonus: 80,  speed_bonus: -2, special: 'scatter', icon: '■' },
  3: { name: 'SPECTER',  color: C_PINK,   desc: 'Homing missiles lock onto the boss.',           cost: 500, fire_rate: 20, bullet_count: 2, bullet_spread: 0.0,  bullet_speed: 9,  bullet_size: 7,  bullet_color: C_PINK,   hp_bonus: 0,   speed_bonus: 1,  special: 'homing',  icon: '✦' },
  4: { name: 'NOVA',     color: C_GOLD,   desc: 'Plasma rings deal massive AoE damage.',         cost: 800, fire_rate: 30, bullet_count: 8, bullet_spread: Math.PI * 2 / 8, bullet_speed: 8, bullet_size: 9, bullet_color: C_GOLD,  hp_bonus: 20,  speed_bonus: 0,  special: 'ring',    icon: '★' },
};

const UPGRADES = {
  speed:  { name: 'SPEED BOOST',  desc: '+2 move speed per level', max: 5, costs: [100,150,200,300,400], color: C_LIME,  icon: '⚡' },
  hp:     { name: 'MAX HP UP',    desc: '+30 max HP per level',    max: 5, costs: [120,180,250,350,500], color: C_GREEN, icon: '♥' },
  damage: { name: 'DAMAGE AMP',   desc: '+50% damage per level',   max: 5, costs: [150,220,300,450,600], color: C_RED,   icon: '⚔' },
  fire:   { name: 'FIRE RATE',    desc: '-1 fire interval/level',  max: 4, costs: [180,280,400,600],     color: C_ORANGE,icon: '🔥' },
  shield: { name: 'SHIELD REGEN', desc: 'Auto-heal 1 HP/3s/lvl',  max: 3, costs: [200,350,550],         color: C_TEAL,  icon: '🛡' },
  magnet: { name: 'COIN MAGNET',  desc: '+80 coin pickup radius/l',max: 3, costs: [80,150,250],          color: C_COIN,  icon: '🧲' },
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
