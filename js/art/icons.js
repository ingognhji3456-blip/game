'use strict';

/* =========================================================
 * 아트 — 카드 아이콘, 의도, 지도 칸, 물약, 이벤트 장면, 배경, 로고
 * 모든 함수는 SVG 문자열을 반환합니다.
 * ========================================================= */
CB.art = CB.art || {};

(() => {
  let seq = 0;
  const uid = (p) => `${p}${++seq}`;
  const OL = '#15101f';
  const S = `stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const S2 = `stroke="${OL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

  const stops = (list) => list.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const lg = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
  const rg = (id, list, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
  const glow = (id, std = 2.5) => `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${std}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

  // 공용 도우미 (enemies.js 에서도 사용)
  CB.art._h = { uid, OL, S, S2, lg, rg, glow, stops };

  /* =========================================================
   * 카드 아이콘
   * ========================================================= */
  const TYPE_TINT = {
    attack: ['#ff7a5c', '#7a1d1d', '#2a0c10'],
    skill: ['#6fc2ff', '#1d4a7a', '#0a1a2c'],
    power: ['#d49cff', '#55247e', '#1c0b2c'],
    status: ['#b7b7c4', '#4a4a58', '#17171e'],
    curse: ['#b36bff', '#3a1650', '#0f0616'],
  };

  // 각 아이콘: (g) => 엠블럼 SVG (120×72 기준, 중심 60,36)
  const steel = (g) => `url(#${g.steel})`;
  const ICONS = {
    slash: (g) => `
      <path d="M22 60 Q55 52 98 10" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9" filter="url(#${g.glow})"/>
      <path d="M28 62 Q60 54 102 16" stroke="${g.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M38 50 L84 18 L90 22 L46 56 Z" fill="${steel(g)}" ${S2}/>
      <path d="M34 54 L44 62 M30 58 L38 64" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/>`,
    doubleSlash: (g) => `
      <path d="M24 62 Q58 50 96 8" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" filter="url(#${g.glow})"/>
      <path d="M24 10 Q62 22 96 64" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" filter="url(#${g.glow})"/>
      <path d="M24 62 Q58 50 96 8 M24 10 Q62 22 96 64" stroke="${g.accent}" stroke-width="2.5" fill="none"/>`,
    heavyBlow: (g) => `
      <path d="M30 66 L90 66" stroke="${g.accent}" stroke-width="3" opacity=".7"/>
      <path d="M40 66 L32 56 M80 66 L88 56 M60 66 L60 54" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <rect x="57" y="10" width="6" height="34" rx="2" fill="#7a5230" ${S2}/>
      <path d="M36 40 L84 40 L80 58 L40 58 Z" fill="${steel(g)}" ${S}/>
      <path d="M44 46 L76 46" stroke="#fff" stroke-width="2" opacity=".6"/>`,
    whirlwind: (g) => `
      <circle cx="60" cy="36" r="24" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="26 12" filter="url(#${g.glow})"/>
      <circle cx="60" cy="36" r="14" fill="none" stroke="${g.accent}" stroke-width="3" stroke-dasharray="16 8"/>
      <path d="M60 12 L66 4 L70 14 Z M84 36 L94 40 L84 46 Z M36 36 L26 32 L36 26 Z M60 60 L54 68 L50 58 Z" fill="${steel(g)}" ${S2}/>`,
    thrust: (g) => `
      <path d="M14 30 L44 30 M10 40 L40 40 M18 50 L42 50" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>
      <path d="M40 34 L104 34 L112 36 L104 38 L40 38 Z" fill="${steel(g)}" ${S2}/>
      <path d="M36 24 L40 24 L40 48 L36 48 Z" fill="#c9a24a" ${S2}/>
      <rect x="22" y="33" width="14" height="6" rx="2" fill="#6b4a2a" ${S2}/>`,
    dagger: (g) => `
      <path d="M60 6 L68 40 L52 40 Z" fill="${steel(g)}" ${S}/>
      <path d="M60 10 L60 38" stroke="#fff" stroke-width="1.5" opacity=".7"/>
      <rect x="44" y="40" width="32" height="6" rx="3" fill="#c9a24a" ${S2}/>
      <rect x="56" y="46" width="8" height="16" rx="3" fill="#6b4a2a" ${S2}/>
      <circle cx="60" cy="65" r="4" fill="#c9a24a" ${S2}/>`,
    axe: (g) => `
      <rect x="57" y="8" width="7" height="58" rx="3" fill="#7a5230" ${S2}/>
      <path d="M62 12 C80 6 96 14 98 30 C96 44 82 50 62 44 Z" fill="${steel(g)}" ${S}/>
      <path d="M90 18 C94 26 94 34 90 40" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`,
    shield: (g) => `
      <path d="M60 6 L88 14 C88 40 80 56 60 66 C40 56 32 40 32 14 Z" fill="url(#${g.main})" ${S}/>
      <path d="M60 12 L82 18 C82 38 76 50 60 58 C44 50 38 38 38 18 Z" fill="none" stroke="#fff" stroke-width="2" opacity=".55"/>
      <path d="M60 18 L60 54 M46 30 L74 30" stroke="${g.accent}" stroke-width="4" stroke-linecap="round"/>`,
    tower: (g) => `
      <rect x="38" y="8" width="44" height="58" rx="4" fill="url(#${g.main})" ${S}/>
      <path d="M38 22 L82 22 M38 38 L82 38 M38 54 L82 54 M60 8 L60 22 M50 22 L50 38 M70 22 L70 38 M60 38 L60 54 M50 54 L50 66 M70 54 L70 66" stroke="${OL}" stroke-width="2" opacity=".5"/>
      <path d="M42 12 L78 12" stroke="#fff" stroke-width="2" opacity=".5"/>`,
    shieldBash: (g) => `
      <path d="M86 18 L102 10 M90 36 L110 36 M86 54 L102 62" stroke="#fff" stroke-width="3" stroke-linecap="round" filter="url(#${g.glow})"/>
      <path d="M50 8 L76 16 C76 40 70 54 50 64 C30 54 24 40 24 16 Z" fill="url(#${g.main})" ${S}/>
      <circle cx="50" cy="34" r="8" fill="${g.accent}" ${S2}/>`,
    armor: (g) => `
      <path d="M36 12 L50 8 Q60 16 70 8 L84 12 L90 26 L80 30 L80 62 L40 62 L40 30 L30 26 Z" fill="url(#${g.main})" ${S}/>
      <path d="M60 18 L60 60 M46 36 Q60 42 74 36 M46 48 Q60 54 74 48" stroke="${OL}" stroke-width="2" fill="none" opacity=".5"/>
      <path d="M44 16 L48 26" stroke="#fff" stroke-width="2" opacity=".6"/>`,
    fist: (g) => `
      <path d="M40 30 C40 20 48 18 54 22 C56 14 66 14 68 22 C72 16 80 18 80 26 C86 24 90 30 88 38 L86 52 C84 60 76 64 66 64 L52 64 C44 64 38 58 38 50 Z" fill="#f0c49a" ${S}/>
      <path d="M54 24 L54 38 M68 24 L68 38 M80 28 L80 40" stroke="${OL}" stroke-width="2" opacity=".5"/>
      <path d="M24 26 L34 30 M22 40 L34 40 M24 54 L34 50" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
    fire: (g) => `
      <path d="M60 4 C72 20 86 26 84 46 C82 60 72 68 60 68 C46 68 36 58 36 46 C36 34 46 30 48 18 C54 26 54 32 60 34 C62 24 60 14 60 4 Z" fill="url(#${g.fire})" ${S} filter="url(#${g.glow})"/>
      <path d="M60 40 C66 46 70 50 68 58 C66 64 54 64 52 58 C50 52 56 48 60 40 Z" fill="#fff6c2"/>`,
    poison: (g) => `
      <path d="M52 8 L68 8 L68 24 C80 30 86 40 84 50 C82 62 72 68 60 68 C48 68 38 62 36 50 C34 40 40 30 52 24 Z" fill="#2c4a2a" ${S}/>
      <path d="M40 46 C48 42 72 42 80 46 C80 60 72 64 60 64 C48 64 40 60 40 46 Z" fill="#7cdd45" filter="url(#${g.glow})"/>
      <circle cx="54" cy="52" r="3" fill="#d9ffb0"/><circle cx="66" cy="56" r="2" fill="#d9ffb0"/>
      <rect x="50" y="4" width="20" height="6" rx="2" fill="#8a6a40" ${S2}/>`,
    venomBlade: (g) => `
      <path d="M30 60 L88 12 L94 16 L38 66 Z" fill="${steel(g)}" ${S2}/>
      <path d="M50 46 C52 52 50 56 48 58 C46 56 46 52 50 46 Z M70 30 C72 36 70 40 68 42 C66 40 66 36 70 30 Z" fill="#7cdd45" filter="url(#${g.glow})"/>
      <path d="M26 56 L36 64" stroke="#6b4a2a" stroke-width="6" stroke-linecap="round"/>
      <circle cx="44" cy="66" r="3" fill="#7cdd45"/>`,
    skull: () => `
      <path d="M40 34 C40 16 80 16 80 34 C82 44 78 50 74 52 L74 62 L46 62 L46 52 C42 50 38 44 40 34 Z" fill="#ece3cc" ${S}/>
      <ellipse cx="52" cy="38" rx="6" ry="7" fill="${OL}"/><ellipse cx="68" cy="38" rx="6" ry="7" fill="${OL}"/>
      <path d="M60 44 L56 52 L64 52 Z" fill="${OL}"/>
      <path d="M52 56 L52 62 M60 56 L60 62 M68 56 L68 62" stroke="${OL}" stroke-width="2"/>
      <circle cx="52" cy="38" r="2" fill="#9cff6a"/><circle cx="68" cy="38" r="2" fill="#9cff6a"/>`,
    heart: (g) => `
      <path d="M60 66 C40 52 28 42 28 28 C28 16 38 10 46 10 C52 10 58 14 60 20 C62 14 68 10 74 10 C82 10 92 16 92 28 C92 42 80 52 60 66 Z" fill="url(#${g.heart})" ${S} filter="url(#${g.glow})"/>
      <path d="M40 22 C42 18 46 16 50 17" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
    bolt: (g) => `
      <path d="M66 4 L36 40 L56 40 L48 68 L84 28 L62 28 Z" fill="#ffe14d" ${S} filter="url(#${g.glow})"/>
      <path d="M62 14 L46 34" stroke="#fff" stroke-width="2" opacity=".7"/>`,
    eye: (g) => `
      <path d="M18 36 C34 14 86 14 102 36 C86 58 34 58 18 36 Z" fill="#f4efe4" ${S}/>
      <circle cx="60" cy="36" r="14" fill="url(#${g.main})" ${S2}/>
      <circle cx="60" cy="36" r="6" fill="${OL}"/><circle cx="56" cy="32" r="3" fill="#fff"/>
      <path d="M20 22 L28 28 M100 22 L92 28 M60 6 L60 14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`,
    muscle: () => `
      <path d="M30 62 C26 50 30 40 40 36 L52 30 C50 22 54 12 62 12 C70 12 74 20 72 28 C82 26 92 34 90 46 C88 58 76 64 62 64 Z" fill="#f0c49a" ${S}/>
      <path d="M58 36 C64 32 72 34 76 40" stroke="${OL}" stroke-width="2" fill="none" opacity=".5"/>
      <path d="M92 12 L98 6 M96 22 L104 20 M86 6 L88 0" stroke="#ffe14d" stroke-width="3" stroke-linecap="round"/>`,
    feather: (g) => `
      <path d="M90 6 C60 10 38 30 30 64 C54 58 80 40 90 6 Z" fill="url(#${g.main})" ${S}/>
      <path d="M30 64 L82 14" stroke="#fff" stroke-width="2" opacity=".8"/>
      <path d="M44 48 L56 46 M52 38 L66 36 M60 30 L72 28" stroke="${OL}" stroke-width="1.5" opacity=".4"/>`,
    thorns: (g) => `
      <path d="M14 50 C34 30 54 54 74 34 C86 22 98 26 106 20" stroke="#5a8a3a" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M14 50 C34 30 54 54 74 34 C86 22 98 26 106 20" stroke="${OL}" stroke-width="1.5" fill="none" opacity=".4"/>
      <path d="M26 42 L22 30 L32 38 Z M44 44 L46 58 L38 48 Z M62 42 L64 28 L70 38 Z M84 26 L80 14 L90 22 Z M96 22 L102 34 L92 28 Z" fill="${g.accent}" ${S2}/>`,
    spiral: (g) => `
      <path d="M60 36 m0 0 c4 0 6 4 4 8 c-3 6 -12 6 -15 0 c-5 -9 2 -18 12 -18 c12 0 20 12 16 24 c-5 14 -24 18 -34 8 c-12 -12 -8 -34 8 -40" stroke="url(#${g.main})" stroke-width="6" fill="none" stroke-linecap="round" filter="url(#${g.glow})"/>`,
    crack: (g) => `
      <path d="M60 4 L52 24 L64 32 L48 48 L58 54 L46 70" stroke="#fff" stroke-width="5" fill="none" stroke-linejoin="round" filter="url(#${g.glow})"/>
      <path d="M52 24 L36 20 M64 32 L84 28 M48 48 L30 52 M58 54 L78 60" stroke="${g.accent}" stroke-width="3" stroke-linecap="round"/>`,
    blood: (g) => `
      <path d="M60 4 C70 22 84 34 84 48 C84 60 74 68 60 68 C46 68 36 60 36 48 C36 34 50 22 60 4 Z" fill="url(#${g.blood})" ${S} filter="url(#${g.glow})"/>
      <path d="M48 46 C48 40 52 36 56 34" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`,
    star: (g) => `
      <path d="M60 4 L68 28 L94 28 L73 43 L81 68 L60 53 L39 68 L47 43 L26 28 L52 28 Z" fill="#ffe680" ${S} filter="url(#${g.glow})"/>
      <circle cx="60" cy="38" r="7" fill="#fff"/>`,
    moon: (g) => `
      <path d="M70 6 C48 8 34 24 34 40 C34 56 48 68 66 68 C76 68 84 64 90 58 C66 60 52 44 54 28 C56 18 62 10 70 6 Z" fill="#f2f0ff" ${S} filter="url(#${g.glow})"/>
      <path d="M20 54 Q56 30 100 18" stroke="${g.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    wind: (g) => `
      <path d="M14 26 L72 26 C84 26 86 12 76 10 C70 9 66 14 68 18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#${g.glow})"/>
      <path d="M20 40 L92 40 C104 40 106 56 96 58 C90 59 86 54 88 50" stroke="${g.accent}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M26 54 L64 54" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    curse: (g) => `
      <circle cx="60" cy="36" r="26" fill="none" stroke="#9b4dff" stroke-width="2" stroke-dasharray="4 4"/>
      <path d="M26 36 C40 20 80 20 94 36 C80 52 40 52 26 36 Z" fill="#1b0b29" ${S}/>
      <circle cx="60" cy="36" r="9" fill="#c46bff" filter="url(#${g.glow})"/>
      <path d="M60 28 L60 44" stroke="${OL}" stroke-width="3"/>`,
    wound: () => `
      <path d="M30 18 L88 54 M38 10 L94 44 M26 30 L80 62" stroke="#b3192a" stroke-width="6" stroke-linecap="round"/>
      <path d="M30 18 L88 54 M38 10 L94 44 M26 30 L80 62" stroke="#ff8080" stroke-width="2" stroke-linecap="round"/>`,
  };

  CB.art.cardIcon = (icon, type = 'attack') => {
    const tint = TYPE_TINT[type] || TYPE_TINT.attack;
    const g = {
      bg: uid('cb'), main: uid('cm'), steel: uid('cs'), glow: uid('cg'), fire: uid('cf'), heart: uid('ch'), blood: uid('cd'),
      accent: tint[0],
    };
    const draw = ICONS[icon] || ICONS.star;
    return `<svg class="card-icon" viewBox="0 0 120 72" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${rg(g.bg, [[0, tint[1]], [0.75, tint[2]], [1, '#05040a']], 0.5, 0.45, 0.75)}
        ${lg(g.main, [[0, tint[0]], [1, tint[1]]])}
        ${lg(g.steel, [[0, '#ffffff'], [0.45, '#c9d3e0'], [1, '#6a7688']])}
        ${lg(g.fire, [[0, '#fff3a0'], [0.4, '#ffb030'], [1, '#e8401c']])}
        ${lg(g.heart, [[0, '#ff8aa0'], [1, '#c4163a']])}
        ${lg(g.blood, [[0, '#ff6070'], [1, '#7a0a18']])}
        ${glow(g.glow, 2.2)}
      </defs>
      <rect width="120" height="72" fill="url(#${g.bg})"/>
      <g opacity=".18" stroke="${tint[0]}" stroke-width="1">
        <path d="M0 60 L120 12 M0 72 L120 24 M0 48 L120 0"/>
      </g>
      <g>${draw(g)}</g>
    </svg>`;
  };
  CB.art.CARD_ICONS = Object.keys(ICONS);

  /* =========================================================
   * 적 의도 아이콘 (32×32)
   * ========================================================= */
  const INTENTS = {
    attack: () => `<path d="M6 26 L22 10 L26 6 L24 12 L8 28 Z" fill="#e8eef8" ${S2}/><path d="M5 21 L11 27 M3 27 L5 29" stroke="${OL}" stroke-width="3" stroke-linecap="round"/><path d="M6 22 L10 26" stroke="#c9a24a" stroke-width="3"/>`,
    defend: () => `<path d="M16 3 L27 7 C27 18 23 25 16 29 C9 25 5 18 5 7 Z" fill="#4f8fe0" ${S2}/><path d="M16 8 L22 10 C22 17 20 21 16 24" stroke="#cfe6ff" stroke-width="2" fill="none"/>`,
    buff: () => `<path d="M16 3 L27 15 L20 15 L20 28 L12 28 L12 15 L5 15 Z" fill="#ffc94a" ${S2}/>`,
    debuff: () => `<path d="M16 29 L27 17 L20 17 L20 4 L12 4 L12 17 L5 17 Z" fill="#b06bff" ${S2}/>`,
    summon: () => `<path d="M8 14 C8 6 24 6 24 14 C25 18 23 20 21 21 L21 26 L11 26 L11 21 C9 20 7 18 8 14 Z" fill="#ece3cc" ${S2}/><circle cx="12.5" cy="15" r="2.5" fill="${OL}"/><circle cx="19.5" cy="15" r="2.5" fill="${OL}"/><path d="M26 2 L26 10 M22 6 L30 6" stroke="#9cff6a" stroke-width="3" stroke-linecap="round"/>`,
    heal: () => `<path d="M16 28 C8 22 3 17 3 11 C3 6 7 3 11 3 C13 3 15 5 16 7 C17 5 19 3 21 3 C25 3 29 6 29 11 C29 17 24 22 16 28 Z" fill="#45c46b" ${S2}/><path d="M16 9 L16 19 M11 14 L21 14" stroke="#eaffea" stroke-width="3" stroke-linecap="round"/>`,
    unknown: () => `<circle cx="16" cy="16" r="13" fill="#5a5a6e" ${S2}/><text x="16" y="22" text-anchor="middle" font-size="17" font-weight="900" fill="#fff" font-family="sans-serif">?</text>`,
  };
  CB.art.intent = (kind) => `<svg class="intent-icon intent-${kind}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${(INTENTS[kind] || INTENTS.unknown)()}</svg>`;

  /* =========================================================
   * 지도 칸 아이콘 (40×40)
   * ========================================================= */
  const NODES = {
    combat: () => `
      <path d="M8 32 L28 8 L32 6 L30 10 L10 34 Z" fill="#e8eef8" ${S2}/>
      <path d="M32 32 L12 8 L8 6 L10 10 L30 34 Z" fill="#e8eef8" ${S2}/>
      <path d="M6 28 L12 34 M34 28 L28 34" stroke="#8a5a2a" stroke-width="4" stroke-linecap="round"/>`,
    elite: () => `
      <path d="M8 6 C10 14 14 16 16 16 M32 6 C30 14 26 16 24 16" stroke="#f0d9a0" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M10 22 C10 10 30 10 30 22 C31 27 28 30 26 31 L26 36 L14 36 L14 31 C12 30 9 27 10 22 Z" fill="#e05a4a" ${S2}/>
      <circle cx="15.5" cy="23" r="3" fill="#ffe14d"/><circle cx="24.5" cy="23" r="3" fill="#ffe14d"/>`,
    rest: () => `
      <path d="M8 34 L32 28 M8 28 L32 34" stroke="#7a5230" stroke-width="4" stroke-linecap="round"/>
      <path d="M20 4 C26 12 30 16 29 23 C28 29 24 31 20 31 C15 31 11 28 11 23 C11 18 15 16 16 11 C18 15 19 17 20 18 C21 13 21 9 20 4 Z" fill="#ff9a2e" ${S2}/>
      <path d="M20 20 C23 23 24 25 23 28 C21 30 18 30 17 28 C16 25 18 23 20 20 Z" fill="#fff3a0"/>`,
    shop: () => `
      <path d="M12 14 C10 8 30 8 28 14 L32 32 C32 36 8 36 8 32 Z" fill="#c9a24a" ${S2}/>
      <path d="M12 14 L28 14" stroke="${OL}" stroke-width="2"/>
      <text x="20" y="30" text-anchor="middle" font-size="13" font-weight="900" fill="${OL}" font-family="sans-serif">G</text>`,
    event: () => `
      <circle cx="20" cy="20" r="15" fill="#3b9e8f" ${S2}/>
      <text x="20" y="27" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" font-family="sans-serif">?</text>`,
    treasure: () => `
      <path d="M6 18 C6 10 34 10 34 18 Z" fill="#a8652a" ${S2}/>
      <rect x="6" y="18" width="28" height="16" rx="2" fill="#8a4f1e" ${S2}/>
      <path d="M6 18 L34 18 M20 14 L20 34" stroke="#ffd25a" stroke-width="3"/>
      <rect x="17" y="20" width="6" height="6" rx="1" fill="#ffd25a" ${S2}/>`,
    boss: () => `
      <path d="M8 14 L12 4 L16 10 L20 2 L24 10 L28 4 L32 14 Z" fill="#ffd25a" ${S2}/>
      <path d="M8 22 C8 12 32 12 32 22 C33 28 30 31 27 32 L27 38 L13 38 L13 32 C10 31 7 28 8 22 Z" fill="#7d2a8a" ${S2}/>
      <circle cx="15" cy="24" r="3.5" fill="#ff4d4d"/><circle cx="25" cy="24" r="3.5" fill="#ff4d4d"/>`,
  };
  CB.art.mapNode = (type) => `<svg class="map-node-icon node-${type}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${(NODES[type] || NODES.event)()}</svg>`;

  /* =========================================================
   * 물약 (40×40)
   * ========================================================= */
  CB.art.potion = (color = '#e8553f', shape = 'round') => {
    const g = uid('pt');
    const hi = uid('ph');
    let bottle;
    let liquid;
    if (shape === 'flask') {
      bottle = 'M16 6 L24 6 L24 14 L33 32 C34 35 32 37 29 37 L11 37 C8 37 6 35 7 32 L16 14 Z';
      liquid = 'M12 24 L28 24 L32 32 C33 34 31 35 29 35 L11 35 C9 35 7 34 8 32 Z';
    } else if (shape === 'vial') {
      bottle = 'M15 5 L25 5 L25 9 L24 9 L24 33 C24 36 22 37 20 37 C18 37 16 36 16 33 L16 9 L15 9 Z';
      liquid = 'M17 18 L23 18 L23 33 C23 35 21 36 20 36 C19 36 17 35 17 33 Z';
    } else {
      bottle = 'M16 5 L24 5 L24 12 C30 14 34 19 34 25 C34 32 28 37 20 37 C12 37 6 32 6 25 C6 19 10 14 16 12 Z';
      liquid = 'M8 24 C14 21 26 21 32 24 C32 31 27 35 20 35 C13 35 8 31 8 24 Z';
    }
    return `<svg class="potion-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>${lg(g, [[0, '#ffffff', 0.5], [0.25, color], [1, color]])}${lg(hi, [[0, '#ffffff', 0.7], [1, '#ffffff', 0]], 0, 0, 1, 1)}</defs>
      <path d="${bottle}" fill="rgba(200,220,255,.18)" ${S2}/>
      <path d="${liquid}" fill="url(#${g})"/>
      <path d="${bottle}" fill="none" stroke="url(#${hi})" stroke-width="1.5" transform="translate(-1.5,-1)" opacity=".8"/>
      <rect x="15" y="2" width="10" height="5" rx="1.5" fill="#9a6b3a" ${S2}/>
    </svg>`;
  };

  /* =========================================================
   * 이벤트 장면 (320×180)
   * ========================================================= */
  const sceneBase = (g, top, bottom) => `${lg(g.sky, [[0, top], [1, bottom]])}${glow(g.glow, 4)}`;
  const SCENES = {
    shrine: (g) => ({
      defs: `${sceneBase(g, '#0d2a2a', '#123c2f')}${rg(g.light, [[0, '#9dffcb', 0.9], [1, '#9dffcb', 0]])}`,
      body: `
        <path d="M0 120 C60 100 100 130 160 112 C220 96 260 120 320 106 L320 180 L0 180 Z" fill="#0a1f18"/>
        ${[20, 60, 250, 296].map((x, i) => `<path d="M${x} 180 L${x} ${70 + i * 6} M${x - 22} ${110 + i * 4} L${x} ${60 + i * 6} L${x + 22} ${110 + i * 4} Z" fill="#071611" stroke="#071611" stroke-width="6"/>`).join('')}
        <circle cx="160" cy="92" r="70" fill="url(#${g.light})"/>
        <path d="M120 150 L130 104 L190 104 L200 150 Z" fill="#5c6b66" ${S}/>
        <rect x="112" y="148" width="96" height="14" rx="3" fill="#47524e" ${S}/>
        <path d="M128 112 L192 112" stroke="#7fd6a0" stroke-width="3" opacity=".6"/>
        <circle cx="160" cy="98" r="10" fill="#b8ffd8" filter="url(#${g.glow})"/>
        <path d="M134 120 C140 126 146 124 150 130 M170 126 C176 122 182 128 186 124" stroke="#3f8f5a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    }),
    forest: (g) => ({
      defs: `${sceneBase(g, '#0b1e2b', '#14382c')}`,
      body: `
        ${[30, 90, 150, 220, 285].map((x, i) => `<path d="M${x} 180 L${x - 6} 60 L${x + 6} 60 Z" fill="#1d2b22"/><circle cx="${x}" cy="${50 + (i % 2) * 14}" r="${34 + (i % 3) * 6}" fill="#13301f"/>`).join('')}
        <path d="M0 150 C80 136 220 160 320 144 L320 180 L0 180 Z" fill="#0e2418"/>
        <rect x="70" y="138" width="150" height="16" rx="8" fill="#4a3220" ${S}/>
        ${[[110, 128, 12, '#4fd6ff'], [140, 124, 16, '#7af0ff'], [176, 130, 10, '#4fd6ff'], [196, 134, 8, '#9cf7ff']].map(([x, y, r, c]) => `
          <rect x="${x - 3}" y="${y}" width="6" height="${150 - y}" fill="#d9e8e0" ${S2}/>
          <path d="M${x - r} ${y + 2} C${x - r} ${y - r} ${x + r} ${y - r} ${x + r} ${y + 2} Z" fill="${c}" ${S2} filter="url(#${g.glow})"/>`).join('')}
        ${[[60, 70], [250, 90], [200, 50], [100, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#b8fbff" filter="url(#${g.glow})"/>`).join('')}`,
    }),
    crypt: (g) => ({
      defs: `${sceneBase(g, '#140f24', '#231a36')}${rg(g.light, [[0, '#ffd27a', 0.7], [1, '#ffd27a', 0]])}`,
      body: `
        ${[0, 80, 160, 240].map((x) => `<path d="M${x + 10} 180 L${x + 10} 60 C${x + 10} 20 ${x + 70} 20 ${x + 70} 60 L${x + 70} 180" fill="#1a1428" stroke="#2f2645" stroke-width="6"/>`).join('')}
        ${[20, 240].map((x) => `<rect x="${x}" y="70" width="60" height="100" fill="#3a2a22" ${S}/>${[84, 108, 132, 156].map((y) => `<path d="M${x + 4} ${y} L${x + 56} ${y}" stroke="#1a120e" stroke-width="3"/>${[0, 1, 2, 3, 4].map((k) => `<rect x="${x + 6 + k * 10}" y="${y - 18}" width="8" height="16" fill="${['#7a3a3a', '#3a5a7a', '#6a5a2a', '#4a2a5a', '#2a5a4a'][k]}"/>`).join('')}`).join('')}`).join('')}
        <circle cx="160" cy="110" r="60" fill="url(#${g.light})"/>
        <rect x="128" y="120" width="64" height="44" fill="#4a3a2e" ${S}/>
        <path d="M134 120 L160 108 L186 120 L160 126 Z" fill="#efe2c0" ${S2}/>
        <path d="M160 108 L160 126" stroke="${OL}" stroke-width="2"/>
        <circle cx="160" cy="104" r="5" fill="#ffe8a0" filter="url(#${g.glow})"/>`,
    }),
    lava: (g) => ({
      defs: `${sceneBase(g, '#2a0a08', '#4a1406')}${lg(g.lava, [[0, '#ffe08a'], [0.5, '#ff7a1a'], [1, '#c4200c']])}`,
      body: `
        <path d="M0 90 L40 60 L80 86 L120 50 L170 84 L220 46 L270 80 L320 56 L320 180 L0 180 Z" fill="#1c0806"/>
        <path d="M0 150 C60 140 120 168 200 150 C250 140 290 150 320 146 L320 180 L0 180 Z" fill="url(#${g.lava})" filter="url(#${g.glow})"/>
        <path d="M110 140 L120 120 L200 120 L210 140 Z" fill="#2a2228" ${S}/>
        <path d="M100 110 L220 110 L210 122 L110 122 Z" fill="#4a4048" ${S}/>
        <path d="M140 96 L180 96 L172 110 L148 110 Z" fill="#ff8a2a" ${S} filter="url(#${g.glow})"/>
        <rect x="196" y="72" width="8" height="40" rx="3" fill="#6b4a2a" ${S2} transform="rotate(30 200 92)"/>
        <rect x="186" y="62" width="30" height="16" rx="3" fill="#5a5a68" ${S2} transform="rotate(30 200 92)"/>
        ${[[60, 120], [260, 110], [150, 70], [230, 130]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#ffb24a" filter="url(#${g.glow})"/>`).join('')}`,
    }),
    chest: (g) => ({
      defs: `${sceneBase(g, '#14182a', '#2a2a3a')}${rg(g.light, [[0, '#ffe08a', 0.8], [1, '#ffe08a', 0]])}`,
      body: `
        <path d="M0 140 C80 128 240 150 320 134 L320 180 L0 180 Z" fill="#191a24"/>
        ${[[30, 120], [280, 116]].map(([x, y]) => `<path d="M${x - 24} ${y + 30} L${x} ${y - 40} L${x + 24} ${y + 30} Z" fill="#232838" ${S2}/>`).join('')}
        <circle cx="160" cy="120" r="60" fill="url(#${g.light})"/>
        <path d="M118 120 C118 96 202 96 202 120 Z" fill="#a8652a" ${S}/>
        <rect x="118" y="120" width="84" height="40" rx="3" fill="#8a4f1e" ${S}/>
        <path d="M118 120 L202 120 M140 104 L140 160 M180 104 L180 160" stroke="#ffd25a" stroke-width="4"/>
        <rect x="152" y="122" width="16" height="16" rx="2" fill="#ffd25a" ${S2}/>
        <circle cx="160" cy="130" r="2.5" fill="${OL}"/>`,
    }),
    stranger: (g) => ({
      defs: `${sceneBase(g, '#101828', '#24304a')}${rg(g.light, [[0, '#ffcf6a', 0.9], [1, '#ffcf6a', 0]])}`,
      body: `
        <circle cx="260" cy="40" r="18" fill="#f4f0dc" opacity=".9"/>
        <path d="M0 146 C80 136 240 156 320 140 L320 180 L0 180 Z" fill="#141c2c"/>
        <path d="M140 166 L148 92 C150 74 182 74 184 92 L192 166 Z" fill="#3a3040" ${S}/>
        <path d="M146 96 C144 66 188 66 186 96 C182 104 150 104 146 96 Z" fill="#2a2232" ${S}/>
        <ellipse cx="166" cy="92" rx="12" ry="10" fill="#0c0a10"/>
        <circle cx="161" cy="92" r="2" fill="#ffd25a"/><circle cx="171" cy="92" r="2" fill="#ffd25a"/>
        <path d="M196 70 L196 166" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/>
        <circle cx="128" cy="120" r="30" fill="url(#${g.light})"/>
        <path d="M120 112 L136 112 L134 130 L122 130 Z" fill="#ffcf6a" ${S2} filter="url(#${g.glow})"/>
        <path d="M128 100 L128 112" stroke="${OL}" stroke-width="2"/>`,
    }),
    well: (g) => ({
      defs: `${sceneBase(g, '#1a0c14', '#2e1420')}${rg(g.light, [[0, '#ff4a5a', 0.8], [1, '#ff4a5a', 0]])}`,
      body: `
        ${[20, 270].map((x) => `<rect x="${x}" y="40" width="30" height="140" fill="#22141c" ${S2}/>`).join('')}
        <path d="M0 150 L320 150 L320 180 L0 180 Z" fill="#1a1016"/>
        <circle cx="160" cy="120" r="70" fill="url(#${g.light})"/>
        <ellipse cx="160" cy="118" rx="54" ry="14" fill="#ff3a4a" filter="url(#${g.glow})"/>
        <path d="M106 118 L106 160 C106 170 214 170 214 160 L214 118" fill="#4a3a40" ${S}/>
        <path d="M106 118 C106 108 214 108 214 118 C214 128 106 128 106 118 Z" fill="none" ${S}/>
        <path d="M116 132 L204 132 M112 146 L208 146" stroke="#2a2026" stroke-width="3"/>
        <path d="M120 112 L120 60 L200 60 L200 112" fill="none" stroke="#5a3a2a" stroke-width="6"/>
        <path d="M110 64 L160 40 L210 64 Z" fill="#3a2a22" ${S}/>`,
    }),
    altar: (g) => ({
      defs: `${sceneBase(g, '#0c0a18', '#1e1430')}${rg(g.light, [[0, '#b46bff', 0.8], [1, '#b46bff', 0]])}`,
      body: `
        <path d="M0 150 L320 150 L320 180 L0 180 Z" fill="#120c1c"/>
        <circle cx="160" cy="100" r="80" fill="url(#${g.light})"/>
        <path d="M110 150 L118 110 L202 110 L210 150 Z" fill="#241a30" ${S}/>
        <rect x="104" y="100" width="112" height="14" rx="2" fill="#342646" ${S}/>
        <path d="M160 40 L166 96 L154 96 Z" fill="#cfd6e8" ${S2}/>
        <rect x="150" y="94" width="20" height="5" fill="#8a5a2a" ${S2}/>
        ${[[96, 130], [224, 130], [126, 96], [194, 96]].map(([x, y]) => `<rect x="${x - 4}" y="${y}" width="8" height="${y > 100 ? 20 : 12}" fill="#e8e0cc" ${S2}/><path d="M${x} ${y - 10} C${x + 4} ${y - 4} ${x + 3} ${y} ${x} ${y} C${x - 3} ${y} ${x - 4} ${y - 4} ${x} ${y - 10} Z" fill="#ffb84a" filter="url(#${g.glow})"/>`).join('')}
        <path d="M130 124 L190 124 M140 136 L180 136" stroke="#b46bff" stroke-width="2" opacity=".7"/>`,
    }),
  };
  CB.art.eventScene = (scene) => {
    const g = { sky: uid('es'), glow: uid('eg'), light: uid('el'), lava: uid('ev') };
    const s = (SCENES[scene] || SCENES.forest)(g);
    return `<svg class="event-scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>${s.defs}</defs><rect width="320" height="180" fill="url(#${g.sky})"/>${s.body}</svg>`;
  };

  /* =========================================================
   * 배경 (CSS background 문자열)
   * ========================================================= */
  const dataUri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const svgDoc = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice">${body}</svg>`;

  function treeLine(color, baseY, h, count, seed) {
    let d = `M0 ${baseY}`;
    for (let i = 0; i <= count; i++) {
      const x = (i / count) * 1600;
      const th = h * (0.6 + ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * 0.6);
      d += ` L${x - 30} ${baseY} L${x} ${baseY - th} L${x + 30} ${baseY}`;
    }
    d += ` L1600 ${baseY} L1600 900 L0 900 Z`;
    return `<path d="${d}" fill="${color}"/>`;
  }
  function hills(color, baseY, amp, seed) {
    let d = `M0 ${baseY}`;
    for (let x = 0; x <= 1600; x += 100) d += ` Q${x + 50} ${baseY - amp * (0.5 + 0.5 * Math.sin(x / 170 + seed))} ${x + 100} ${baseY}`;
    return `<path d="${d} L1600 900 L0 900 Z" fill="${color}"/>`;
  }
  function spikes(color, baseY, h, count, seed) {
    let d = `M0 ${baseY}`;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * 1600;
      const th = h * (0.4 + Math.abs(Math.sin(i * 3.7 + seed)) * 0.8);
      d += ` L${x + 20} ${baseY - th} L${x + 50} ${baseY - th * 0.3} L${x + 70} ${baseY}`;
    }
    return `<path d="${d} L1600 ${baseY} L1600 900 L0 900 Z" fill="${color}"/>`;
  }
  function pillars(color, count) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const x = 60 + i * (1600 / count);
      s += `<rect x="${x}" y="180" width="70" height="720" fill="${color}"/><rect x="${x - 12}" y="170" width="94" height="24" fill="${color}"/>`;
      s += `<path d="M${x + 70} 300 C${x + 140} 200 ${x + 1600 / count - 80} 200 ${x + 1600 / count} 300" stroke="${color}" stroke-width="30" fill="none"/>`;
    }
    return s;
  }
  function stars(count, seed) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const x = (Math.abs(Math.sin(i * 91.7 + seed)) * 1600) | 0;
      const y = (Math.abs(Math.sin(i * 47.3 + seed * 2)) * 420) | 0;
      const r = 0.8 + Math.abs(Math.sin(i * 13.1)) * 1.6;
      s += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.3 + Math.abs(Math.sin(i)) * 0.6).toFixed(2)}"/>`;
    }
    return s;
  }

  const BG = {
    title: () => `${dataUri(svgDoc(1600, 900, stars(110, 3) + hills('#1b1f3a', 640, 120, 1) + treeLine('#121528', 760, 120, 40, 2) + treeLine('#0a0c18', 860, 90, 55, 5)))} center bottom / cover no-repeat, radial-gradient(ellipse at 50% 30%, #3a3f78 0%, #191b36 45%, #0a0b16 100%)`,
    map: () => `radial-gradient(ellipse at 50% 0%, rgba(255,214,140,.10), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,.6), transparent 60%), linear-gradient(180deg, #1b1a2c 0%, #14131f 100%)`,
    act1: () => `${dataUri(svgDoc(1600, 900, hills('#173a36', 560, 140, 2) + treeLine('#10302a', 640, 220, 30, 1) + treeLine('#0b241f', 720, 180, 42, 7) + `<rect y="720" width="1600" height="180" fill="#0a1d18"/>`))} center bottom / cover no-repeat, radial-gradient(ellipse at 60% 20%, #3f7d6a 0%, #1d3f3a 40%, #0c1a1a 100%)`,
    act2: () => `${dataUri(svgDoc(1600, 900, pillars('#1e1830', 6) + `<rect y="700" width="1600" height="200" fill="#151022"/>` + spikes('#120d1d', 760, 40, 50, 2)))} center bottom / cover no-repeat, radial-gradient(ellipse at 50% 25%, #5a3f7a 0%, #2a1f42 45%, #0f0b18 100%)`,
    act3: () => `${dataUri(svgDoc(1600, 900, spikes('#3a0f0a', 600, 260, 22, 4) + spikes('#260806', 700, 180, 30, 9) + `<rect y="720" width="1600" height="180" fill="#1a0504"/><path d="M0 760 C300 740 600 790 900 760 C1200 735 1400 770 1600 750 L1600 790 C1300 810 1000 780 700 800 C400 820 200 790 0 800 Z" fill="#ff6a1a" opacity=".55"/>`))} center bottom / cover no-repeat, radial-gradient(ellipse at 50% 15%, #a8401c 0%, #4a1408 45%, #160403 100%)`,
    shop: () => `radial-gradient(ellipse at 50% 30%, rgba(255,190,90,.22), transparent 60%), linear-gradient(180deg, #2a1d16 0%, #160f0b 100%)`,
    rest: () => `radial-gradient(ellipse at 50% 70%, rgba(255,140,40,.35), transparent 55%), radial-gradient(ellipse at 50% 20%, #1c2440 0%, #0b0d18 100%)`,
    event: () => `radial-gradient(ellipse at 50% 30%, rgba(120,200,190,.16), transparent 60%), linear-gradient(180deg, #16202a 0%, #0c1016 100%)`,
  };
  const bgCache = {};
  CB.art.background = (name) => {
    const key = BG[name] ? name : 'map';
    if (!bgCache[key]) bgCache[key] = BG[key]();
    return bgCache[key];
  };

  /* =========================================================
   * 로고
   * ========================================================= */
  CB.art.logo = () => {
    const g = uid('lg');
    const s = uid('ls');
    const gl = uid('lw');
    return `<svg class="logo-art" viewBox="0 -6 640 226" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${lg(g, [[0, '#fff6d0'], [0.45, '#ffd25a'], [1, '#c47a1a']])}
        ${lg(s, [[0, '#ffffff'], [0.5, '#c9d3e0'], [1, '#5a6678']])}
        ${glow(gl, 6)}
      </defs>
      <g transform="translate(320 76) scale(.78)">
        <g opacity=".95">
          <rect x="-150" y="-70" width="88" height="124" rx="10" fill="#2a1f42" stroke="#ffd25a" stroke-width="3" transform="rotate(-18)"/>
          <rect x="62" y="-70" width="88" height="124" rx="10" fill="#1f2f42" stroke="#ffd25a" stroke-width="3" transform="rotate(18)"/>
          <rect x="-44" y="-84" width="88" height="124" rx="10" fill="#421f24" stroke="#ffd25a" stroke-width="3"/>
        </g>
        <path d="M0 -96 L10 -10 L-10 -10 Z" fill="url(#${s})" stroke="${OL}" stroke-width="3" filter="url(#${gl})"/>
        <rect x="-26" y="-12" width="52" height="9" rx="4" fill="#ffd25a" stroke="${OL}" stroke-width="3"/>
        <rect x="-5" y="-4" width="10" height="26" rx="3" fill="#6b4a2a" stroke="${OL}" stroke-width="3"/>
      </g>
      <text x="320" y="172" text-anchor="middle" font-size="84" font-weight="900" letter-spacing="6"
        font-family="'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
        fill="url(#${g})" stroke="${OL}" stroke-width="10" paint-order="stroke" filter="url(#${gl})">카드 원정대</text>
      <text x="320" y="208" text-anchor="middle" font-size="18" font-weight="700" letter-spacing="10" fill="#cfc6a8" opacity=".85"
        font-family="'Pretendard','Noto Sans KR',sans-serif">DECK EXPEDITION</text>
    </svg>`;
  };
})();
