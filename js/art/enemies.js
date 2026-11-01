'use strict';

/* =========================================================
 * 아트 — 적 & 주인공 (viewBox 0 0 200 200, 발은 아래쪽 ~188)
 * 적은 왼쪽(주인공 쪽)을 바라봅니다.
 * ========================================================= */
(() => {
  const { uid, OL, S, S2, lg, rg, glow } = CB.art._h;
  const S4 = `stroke="${OL}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

  const eyeGlow = (cx, cy, r, color, f) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" filter="url(#${f})"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(1)}" fill="#fff"/>`;
  const bone = (x1, y1, x2, y2, w = 7, color = '#ece3cc') => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${OL}" stroke-width="${w + 5}" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  const limb = (d, color, w) => `<path d="${d}" stroke="${OL}" stroke-width="${w + 6}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  function wrap(id, defs, body, shadow = 52, extraClass = '') {
    return `<svg class="enemy-art enemy-art-${id} ${extraClass}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>${defs}</defs>
      <ellipse class="art-shadow" cx="100" cy="190" rx="${shadow}" ry="7" fill="rgba(0,0,0,.45)"/>
      <g class="art-body">${body}</g>
    </svg>`;
  }

  const ART = {
    /* ================= 1막 ================= */
    slime(g) {
      return wrap('slime', `${lg(g.a, [[0, '#b6ff8a'], [0.55, '#45c25c'], [1, '#1d6e44']])}${glow(g.f, 2)}`, `
        <path d="M36 186 C22 168 32 120 62 104 C82 92 120 90 142 104 C170 122 178 168 164 186 Z" fill="url(#${g.a})" ${S}/>
        <path d="M56 122 C64 108 80 102 94 103" stroke="#efffe0" stroke-width="7" fill="none" stroke-linecap="round" opacity=".55"/>
        <circle cx="60" cy="156" r="6" fill="#d9ffc4" opacity=".35"/><circle cx="142" cy="140" r="4" fill="#d9ffc4" opacity=".35"/><circle cx="130" cy="166" r="7" fill="#d9ffc4" opacity=".25"/>
        <ellipse cx="80" cy="142" rx="8" ry="11" fill="${OL}"/><ellipse cx="116" cy="142" rx="8" ry="11" fill="${OL}"/>
        <circle cx="82" cy="138" r="3" fill="#fff"/><circle cx="118" cy="138" r="3" fill="#fff"/>
        <path d="M70 126 L88 132 M126 126 L108 132" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>
        <path d="M86 164 Q98 174 110 164" stroke="${OL}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M146 186 C148 192 154 192 156 186" fill="#45c25c" ${S2}/>`, 60);
    },
    sporeling(g) {
      return wrap('sporeling', `${lg(g.a, [[0, '#ff8ad8'], [0.6, '#b2389a'], [1, '#5a1650']])}${lg(g.b, [[0, '#fff4e0'], [1, '#d8bf98']])}${glow(g.f, 2)}`, `
        <path d="M72 186 C66 162 70 136 78 122 L122 122 C130 136 134 162 128 186 Z" fill="url(#${g.b})" ${S}/>
        <path d="M70 160 C58 158 52 150 54 142 M130 160 C142 158 148 150 146 142" stroke="${OL}" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M70 160 C58 158 52 150 54 142 M130 160 C142 158 148 150 146 142" stroke="#e8d5b4" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M28 126 C30 72 66 46 100 46 C134 46 170 72 172 126 C150 136 50 136 28 126 Z" fill="url(#${g.a})" ${S}/>
        <path d="M40 128 Q100 144 160 128" stroke="#f0b4e0" stroke-width="3" fill="none" opacity=".6"/>
        <circle cx="68" cy="84" r="10" fill="#ffe6f8" opacity=".9"/><circle cx="108" cy="66" r="8" fill="#ffe6f8" opacity=".9"/><circle cx="142" cy="96" r="9" fill="#ffe6f8" opacity=".9"/><circle cx="96" cy="104" r="6" fill="#ffe6f8" opacity=".8"/><circle cx="50" cy="110" r="5" fill="#ffe6f8" opacity=".8"/>
        <path d="M60 64 C70 56 84 52 96 52" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".5"/>
        <ellipse cx="88" cy="152" rx="5" ry="7" fill="${OL}"/><ellipse cx="112" cy="152" rx="5" ry="7" fill="${OL}"/>
        <path d="M80 142 L94 146 M120 142 L106 146" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>
        <path d="M94 168 L100 164 L106 168" stroke="${OL}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g class="spores">${[[30, 60], [170, 50], [20, 100], [180, 110], [60, 30], [146, 26]].map(([x, y], i) => `<circle class="spore s${i}" cx="${x}" cy="${y}" r="3.5" fill="#d6ff8a" filter="url(#${g.f})" opacity=".85"/>`).join('')}</g>`, 44);
    },
    wolf(g) {
      return wrap('wolf', `${lg(g.a, [[0, '#a9b0c2'], [0.6, '#666d82'], [1, '#3a3f52']])}${lg(g.b, [[0, '#e8e8ef'], [1, '#a8aabb']])}${glow(g.f, 2.5)}`, `
        <path d="M150 150 C176 140 190 116 182 92 C176 112 164 124 146 130 Z" fill="url(#${g.a})" ${S}/>
        <path d="M54 186 C48 150 60 118 100 110 C140 118 152 150 146 186 Z" fill="url(#${g.a})" ${S}/>
        <path d="M70 150 L68 186 L88 186 L88 150 Z M112 150 L112 186 L132 186 L130 150 Z" fill="url(#${g.a})" ${S}/>
        <path d="M66 186 L90 186 M110 186 L134 186" stroke="${OL}" stroke-width="3"/>
        <path d="M74 182 L74 186 M80 182 L80 186 M118 182 L118 186 M124 182 L124 186" stroke="${OL}" stroke-width="2"/>
        <path d="M56 116 L68 128 L74 114 L86 128 L100 112 L114 128 L126 114 L132 128 L144 116 L138 144 L62 144 Z" fill="url(#${g.b})" ${S}/>
        <path d="M60 70 L50 26 L82 50 C92 46 108 46 118 50 L150 26 L140 70 C146 88 140 106 126 116 L112 126 C106 134 94 134 88 126 L74 116 C60 106 54 88 60 70 Z" fill="url(#${g.a})" ${S}/>
        <path d="M58 38 L76 52 L64 60 Z M142 38 L124 52 L136 60 Z" fill="#d68a9a"/>
        <path d="M84 96 C88 90 112 90 116 96 L112 120 C108 128 92 128 88 120 Z" fill="url(#${g.b})" ${S2}/>
        <ellipse cx="100" cy="104" rx="8" ry="5.5" fill="${OL}"/>
        <path d="M66 80 L88 86 L80 94 Z" fill="#ffd23f" filter="url(#${g.f})"/><path d="M134 80 L112 86 L120 94 Z" fill="#ffd23f" filter="url(#${g.f})"/>
        <circle cx="82" cy="88" r="2" fill="${OL}"/><circle cx="118" cy="88" r="2" fill="${OL}"/>
        <path d="M64 74 L90 82 M136 74 L110 82" stroke="${OL}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M92 120 L95 131 L98 121 Z M102 121 L105 131 L108 120 Z" fill="#fff" ${S2}/>`, 58);
    },
    bandit(g) {
      return wrap('bandit', `${lg(g.a, [[0, '#5d6e4a'], [1, '#2a3322']])}${lg(g.b, [[0, '#4a5a3a'], [1, '#1f281a']])}${lg(g.s, [[0, '#ffffff'], [0.5, '#c4ccd8'], [1, '#6a7484']])}${glow(g.f, 2)}`, `
        <path d="M48 186 C50 140 62 110 100 102 C138 110 150 140 152 186 Z" fill="url(#${g.a})" ${S}/>
        <path d="M100 104 L92 186 M100 104 L110 186" stroke="${OL}" stroke-width="2" opacity=".35"/>
        <rect x="56" y="146" width="88" height="10" rx="3" fill="#5a3a22" ${S2}/>
        <rect x="94" y="144" width="14" height="14" rx="2" fill="#c9a24a" ${S2}/>
        <path d="M128 152 C140 152 144 166 132 172 C122 174 118 160 128 152 Z" fill="#8a5a2a" ${S2}/>
        ${limb('M66 118 C52 128 46 138 50 150', '#4a5a3a', 12)}
        <path d="M50 150 L18 118 L22 112 L56 142 Z" fill="url(#${g.s})" ${S2}/>
        <path d="M44 144 L58 156" stroke="#5a3a22" stroke-width="7" stroke-linecap="round"/>
        <circle cx="50" cy="150" r="7" fill="#d9b48a" ${S2}/>
        <path d="M64 102 C58 60 80 34 100 32 C120 34 142 60 136 102 C130 114 70 114 64 102 Z" fill="url(#${g.b})" ${S}/>
        <ellipse cx="100" cy="82" rx="25" ry="23" fill="#100c14"/>
        <path d="M76 90 C90 100 110 100 124 90 L122 108 C108 116 92 116 78 108 Z" fill="#8a2f2f" ${S2}/>
        <path d="M84 76 L96 80 L84 84 Z M116 76 L104 80 L116 84 Z" fill="#ffcf4a" filter="url(#${g.f})"/>`, 56);
    },
    beetle(g) {
      return wrap('beetle', `${lg(g.a, [[0, '#6ef0d8'], [0.45, '#2a8a9a'], [1, '#1a2a5a']], 0, 0, 1, 1)}${glow(g.f, 2)}`, `
        ${[[60, 156, 44, 186], [96, 160, 90, 188], [132, 156, 146, 186]].map(([x1, y1, x2, y2]) => limb(`M${x1} ${y1} L${(x1 + x2) / 2 - 6} ${y1 + 12} L${x2} ${y2}`, '#3a2a40', 6)).join('')}
        <path d="M40 152 C40 104 70 80 106 80 C142 80 170 104 170 152 C170 168 40 168 40 152 Z" fill="url(#${g.a})" ${S}/>
        <path d="M106 82 L104 160" stroke="${OL}" stroke-width="3"/>
        <path d="M62 104 C74 92 90 88 100 88" stroke="#d8fff6" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/>
        ${[[72, 86], [96, 78], [120, 78], [144, 88], [160, 106]].map(([x, y]) => `<path d="M${x - 6} ${y + 6} L${x} ${y - 10} L${x + 6} ${y + 6} Z" fill="#e8d9b0" ${S2}/>`).join('')}
        <path d="M26 152 C16 132 30 116 50 118 C60 128 60 152 52 162 C42 166 30 162 26 152 Z" fill="#2b2338" ${S}/>
        <path d="M30 128 C12 108 10 88 22 74 C26 94 36 108 46 118 Z" fill="#f0e2b8" ${S}/>
        <circle cx="38" cy="140" r="5" fill="#ff5a3a" filter="url(#${g.f})"/>
        <path d="M26 156 L14 162 M30 162 L22 172" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`, 64);
    },
    ogre(g) {
      return wrap('ogre', `${lg(g.a, [[0, '#a8b86a'], [0.6, '#6b7a3a'], [1, '#3e4a22']])}${lg(g.w, [[0, '#b07a4a'], [1, '#5a3a1e']])}${glow(g.f, 2)}`, `
        <path d="M68 160 L62 188 L92 188 L94 160 Z M110 160 L112 188 L142 188 L134 160 Z" fill="url(#${g.a})" ${S}/>
        <path d="M44 168 C24 128 40 80 100 74 C160 80 176 128 156 168 C142 184 58 184 44 168 Z" fill="url(#${g.a})" ${S}/>
        <ellipse cx="100" cy="140" rx="38" ry="30" fill="#c4cf8a" opacity=".55"/>
        <path d="M54 156 L146 156 L138 180 L62 180 Z" fill="#6b4a2a" ${S}/>
        <path d="M70 160 L74 178 M100 160 L100 180 M128 160 L124 178" stroke="${OL}" stroke-width="2" opacity=".5"/>
        ${limb('M150 96 C170 110 172 134 164 154', '#6b7a3a', 18)}
        <circle cx="164" cy="158" r="12" fill="#6b7a3a" ${S}/>
        ${limb('M54 96 C38 106 32 124 34 140', '#6b7a3a', 18)}
        <path d="M24 152 L4 64 C2 52 18 44 28 54 L48 146 Z" fill="url(#${g.w})" ${S}/>
        ${[[12, 70], [22, 96], [8, 92], [28, 120]].map(([x, y]) => `<path d="M${x} ${y} L${x - 10} ${y - 4} L${x - 2} ${y + 6} Z" fill="#d8d0c0" ${S2}/>`).join('')}
        <circle cx="34" cy="146" r="13" fill="#6b7a3a" ${S}/>
        <path d="M76 80 C68 52 82 34 100 34 C118 34 132 52 124 80 Z" fill="url(#${g.a})" ${S}/>
        <path d="M78 54 L94 60 M122 54 L106 60" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="88" cy="63" r="4" fill="#ff4a3a" filter="url(#${g.f})"/><circle cx="112" cy="63" r="4" fill="#ff4a3a" filter="url(#${g.f})"/>
        <path d="M84 76 C94 70 106 70 116 76" stroke="${OL}" stroke-width="3" fill="none"/>
        <path d="M86 77 L84 64 L92 74 Z M114 77 L116 64 L108 74 Z" fill="#f6eed4" ${S2}/>
        <path d="M100 64 L96 72 L104 72 Z" fill="#4e5a2a"/>`, 72);
    },
    treant(g) {
      return wrap('treant', `${lg(g.a, [[0, '#8a6a4a'], [1, '#4a3220']])}${rg(g.l, [[0, '#7ad66a'], [0.7, '#2f8a4a'], [1, '#1a4a2e']], 0.4, 0.35, 0.7)}${glow(g.f, 3)}`, `
        <path d="M60 186 C40 186 30 178 22 184 M140 186 C160 184 172 176 180 184 M86 186 C80 192 70 192 64 190" stroke="${OL}" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M60 186 C40 186 30 178 22 184 M140 186 C160 184 172 176 180 184" stroke="#5a3e28" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M62 188 C66 150 58 110 70 66 L132 66 C142 110 134 150 140 188 Z" fill="url(#${g.a})" ${S}/>
        <path d="M80 80 C78 110 84 140 80 180 M118 84 C122 120 116 150 122 182 M98 150 C100 166 98 176 100 186" stroke="#2e1f12" stroke-width="3" fill="none" opacity=".6"/>
        ${limb('M68 100 C48 104 36 116 26 136', '#5a3e28', 12)}
        <path d="M26 136 L12 132 M26 136 L18 150 M26 136 L32 152" stroke="#5a3e28" stroke-width="5" stroke-linecap="round"/>
        ${limb('M134 98 C154 100 166 112 176 128', '#5a3e28', 12)}
        <path d="M176 128 L190 122 M176 128 L188 140 M176 128 L172 144" stroke="#5a3e28" stroke-width="5" stroke-linecap="round"/>
        <circle cx="64" cy="58" r="32" fill="url(#${g.l})" ${S}/><circle cx="136" cy="56" r="32" fill="url(#${g.l})" ${S}/>
        <circle cx="100" cy="38" r="38" fill="url(#${g.l})" ${S}/>
        <circle cx="84" cy="30" r="5" fill="#ff7a8a"/><circle cx="130" cy="44" r="4" fill="#ff7a8a"/><circle cx="56" cy="60" r="4" fill="#ffd25a"/>
        <path d="M76 98 C80 92 92 92 94 100 C90 106 80 106 76 98 Z M106 100 C108 92 120 92 124 98 C120 106 110 106 106 100 Z" fill="#1a0f08"/>
        <circle cx="86" cy="99" r="3.5" fill="#d6ff6a" filter="url(#${g.f})"/><circle cx="115" cy="99" r="3.5" fill="#d6ff6a" filter="url(#${g.f})"/>
        <path d="M82 128 L88 122 L94 130 L100 122 L106 130 L112 122 L118 128 C110 140 90 140 82 128 Z" fill="#1a0f08"/>
        <path d="M70 150 C76 146 82 150 84 156 M120 112 C126 110 130 114 130 120" stroke="#5aa04a" stroke-width="5" fill="none" stroke-linecap="round"/>`, 76);
    },
    golem(g) {
      return wrap('golem', `${lg(g.a, [[0, '#a8a296'], [0.55, '#6e685e'], [1, '#3a362f']])}${rg(g.c, [[0, '#ffffff'], [0.35, '#7ff0ff'], [1, '#1a6a8a', 0]])}${glow(g.f, 3.5)}`, `
        <path d="M62 148 L52 188 L90 188 L94 148 Z M108 148 L110 188 L148 188 L140 148 Z" fill="url(#${g.a})" ${S}/>
        <path d="M36 70 L100 50 L164 70 L172 132 L134 154 L66 154 L28 132 Z" fill="url(#${g.a})" ${S}/>
        <path d="M60 80 L76 108 L64 132 M144 84 L128 104 L140 128 M100 54 L96 70" stroke="#2a2620" stroke-width="3" fill="none"/>
        <path d="M60 80 L76 108 L64 132 M144 84 L128 104 L140 128" stroke="#7ff0ff" stroke-width="1.5" fill="none" opacity=".8" filter="url(#${g.f})"/>
        <circle cx="100" cy="104" r="22" fill="url(#${g.c})" filter="url(#${g.f})"/>
        <path d="M100 90 L108 104 L100 118 L92 104 Z" fill="#e8ffff" ${S2}/>
        <path d="M78 26 L122 26 L130 62 L70 62 Z" fill="url(#${g.a})" ${S}/>
        <path d="M80 42 L120 42 L118 50 L82 50 Z" fill="#7ff0ff" filter="url(#${g.f})"/>
        <path d="M36 56 C44 52 52 54 56 62" stroke="#5a8a4a" stroke-width="6" fill="none" stroke-linecap="round"/>
        <circle cx="34" cy="80" r="24" fill="url(#${g.a})" ${S}/>
        <path d="M22 100 L14 140 L40 146 L48 104 Z" fill="url(#${g.a})" ${S}/>
        <path d="M2 140 L48 136 L52 172 L8 178 Z" fill="url(#${g.a})" ${S}/>
        <circle cx="166" cy="80" r="24" fill="url(#${g.a})" ${S}/>
        <path d="M152 104 L160 140 L186 136 L178 100 Z" fill="url(#${g.a})" ${S}/>
        <path d="M152 136 L198 140 L192 178 L148 172 Z" fill="url(#${g.a})" ${S}/>
        ${[[20, 156], [174, 156], [46, 68], [160, 68]].map(([x, y]) => `<path d="M${x - 5} ${y} L${x} ${y - 7} L${x + 5} ${y} L${x} ${y + 7} Z" fill="#7ff0ff" filter="url(#${g.f})"/>`).join('')}`, 84);
    },

    /* ================= 2막 ================= */
    skeleton(g) {
      return wrap('skeleton', `${lg(g.s, [[0, '#d0c0a0'], [0.5, '#9a8a6a'], [1, '#5a4a3a']])}${lg(g.w, [[0, '#8a6a4a'], [1, '#4a3222']])}${glow(g.f, 2.2)}`, `
        ${bone(86, 140, 78, 186)}${bone(114, 140, 122, 186)}
        <path d="M84 140 C84 132 116 132 116 140 L112 150 L88 150 Z" fill="#ece3cc" ${S2}/>
        ${bone(100, 84, 100, 140, 6)}
        ${[96, 106, 116].map((y, i) => `<path d="M${80 + i * 2} ${y} C${88} ${y + 6} ${112} ${y + 6} ${120 - i * 2} ${y}" stroke="${OL}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M${80 + i * 2} ${y} C${88} ${y + 6} ${112} ${y + 6} ${120 - i * 2} ${y}" stroke="#ece3cc" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
        ${bone(82, 90, 64, 118)}${bone(64, 118, 46, 108)}
        <path d="M44 112 L14 50 L20 46 L52 106 Z" fill="url(#${g.s})" ${S2}/>
        <path d="M38 112 L56 102" stroke="#6b4a2a" stroke-width="6" stroke-linecap="round"/>
        ${bone(118, 90, 136, 116)}
        <ellipse cx="146" cy="122" rx="24" ry="28" fill="url(#${g.w})" ${S}/>
        <ellipse cx="146" cy="122" rx="16" ry="20" fill="none" stroke="#8a8a96" stroke-width="4"/>
        <circle cx="146" cy="122" r="5" fill="#8a8a96" ${S2}/>
        <path d="M78 54 C78 30 122 30 122 54 C124 66 118 72 114 76 L114 86 L86 86 L86 76 C82 72 76 66 78 54 Z" fill="#ece3cc" ${S}/>
        <ellipse cx="90" cy="58" rx="7" ry="8" fill="${OL}"/><ellipse cx="110" cy="58" rx="7" ry="8" fill="${OL}"/>
        <circle cx="90" cy="59" r="3" fill="#ff4a4a" filter="url(#${g.f})"/><circle cx="110" cy="59" r="3" fill="#ff4a4a" filter="url(#${g.f})"/>
        <path d="M100 64 L96 72 L104 72 Z" fill="${OL}"/>
        <path d="M90 80 L90 86 M96 80 L96 86 M104 80 L104 86 M110 80 L110 86" stroke="${OL}" stroke-width="2"/>
        <path d="M84 40 C90 36 96 36 100 38" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/>`, 54);
    },
    wraith(g) {
      return wrap('wraith', `${lg(g.a, [[0, '#9ad8ff', 0.95], [0.6, '#5a6ad8', 0.75], [1, '#2a1a6a', 0.1]])}${glow(g.f, 3)}`, `
        <path d="M58 56 C58 22 142 22 142 56 L152 140 C144 156 138 140 130 164 C122 148 112 176 100 158 C88 176 78 148 70 164 C62 140 56 156 48 140 Z" fill="url(#${g.a})" ${S}/>
        <path d="M70 60 C72 40 84 32 98 30" stroke="#e8f8ff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".5"/>
        <path d="M70 84 C60 100 40 108 22 104 C32 98 36 92 40 86" fill="url(#${g.a})" ${S}/>
        <path d="M22 104 L12 100 M24 106 L14 112 M28 106 L22 116" stroke="#cfeaff" stroke-width="3" stroke-linecap="round"/>
        <path d="M130 84 C140 96 154 100 170 96 C160 90 156 84 152 78" fill="url(#${g.a})" ${S}/>
        <ellipse cx="100" cy="64" rx="26" ry="24" fill="#0a0820"/>
        <path d="M84 60 L96 64 L86 70 Z M116 60 L104 64 L114 70 Z" fill="#8ffcff" filter="url(#${g.f})"/>
        <path d="M88 78 C94 84 106 84 112 78" stroke="#8ffcff" stroke-width="2" fill="none" opacity=".8"/>
        <path d="M76 110 C70 124 72 136 80 146" stroke="#4a4a5a" stroke-width="4" fill="none" stroke-dasharray="6 4"/>`, 44, 'floating');
    },
    zealot(g) {
      return wrap('zealot', `${lg(g.a, [[0, '#5a3a7a'], [1, '#22123a']])}${rg(g.c, [[0, '#ffb0ff'], [1, '#c43aff', 0]])}${glow(g.f, 3)}`, `
        <path d="M54 186 L70 96 C78 84 122 84 130 96 L146 186 Z" fill="url(#${g.a})" ${S}/>
        <path d="M58 176 L142 176 M100 96 L100 186" stroke="#c9a24a" stroke-width="3" opacity=".9"/>
        <circle cx="100" cy="128" r="18" fill="url(#${g.c})" filter="url(#${g.f})"/>
        <path d="M88 128 C94 120 106 120 112 128 C106 136 94 136 88 128 Z" fill="#ffe6ff" ${S2}/>
        <circle cx="100" cy="128" r="3" fill="${OL}"/>
        ${limb('M72 106 C56 96 50 80 54 66', '#3a2252', 11)}
        <circle cx="54" cy="62" r="7" fill="#c8a4b8" ${S2}/>
        <path d="M54 58 L48 20 L56 22 L58 58 Z" fill="#d8dce8" ${S2}/>
        <path d="M50 30 L54 50" stroke="#c43aff" stroke-width="2" filter="url(#${g.f})"/>
        ${limb('M128 108 C140 116 146 128 144 140', '#3a2252', 11)}
        <rect x="132" y="138" width="24" height="18" rx="2" fill="#4a2a1a" ${S2}/>
        <path d="M134 142 L154 142" stroke="#c9a24a" stroke-width="2"/>
        <path d="M74 100 C70 70 84 40 100 28 C116 40 130 70 126 100 Z" fill="url(#${g.a})" ${S}/>
        <ellipse cx="100" cy="80" rx="17" ry="19" fill="#0e0816"/>
        <circle cx="93" cy="78" r="3" fill="#ff6aff" filter="url(#${g.f})"/><circle cx="107" cy="78" r="3" fill="#ff6aff" filter="url(#${g.f})"/>
        ${[[30, 110], [170, 96], [162, 150]].map(([x, y]) => `<path d="M${x} ${y - 6} L${x + 5} ${y} L${x} ${y + 6} L${x - 5} ${y} Z" fill="#e08aff" filter="url(#${g.f})" class="rune"/>`).join('')}`, 52);
    },
    gargoyle(g) {
      return wrap('gargoyle', `${lg(g.a, [[0, '#9a9aa8'], [0.6, '#5e5e6c'], [1, '#33333e']])}${lg(g.w, [[0, '#7a7a8a'], [1, '#3a3a48']])}${glow(g.f, 2.5)}`, `
        <path class="wing-l" d="M84 96 C60 60 32 40 6 40 C16 54 18 66 12 78 C24 76 30 82 30 92 C40 88 48 92 50 102 C62 98 72 102 80 112 Z" fill="url(#${g.w})" ${S}/>
        <path class="wing-r" d="M116 96 C140 60 168 40 194 40 C184 54 182 66 188 78 C176 76 170 82 170 92 C160 88 152 92 150 102 C138 98 128 102 120 112 Z" fill="url(#${g.w})" ${S}/>
        <path d="M30 60 L80 104 M170 60 L120 104" stroke="${OL}" stroke-width="2" opacity=".4"/>
        <path d="M64 188 C56 150 68 110 100 104 C132 110 144 150 136 188 Z" fill="url(#${g.a})" ${S}/>
        <path d="M70 170 L58 188 L86 188 Z M130 170 L142 188 L114 188 Z" fill="url(#${g.a})" ${S}/>
        <path d="M60 188 L56 194 M66 188 L64 195 M140 188 L144 194 M134 188 L136 195" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>
        <path d="M88 126 L96 140 L90 156 M112 130 L106 146" stroke="#2a2a32" stroke-width="2.5" fill="none"/>
        <path d="M76 70 C70 48 82 36 100 36 C118 36 130 48 124 70 C126 86 116 100 100 102 C84 100 74 86 76 70 Z" fill="url(#${g.a})" ${S}/>
        <path d="M80 44 C70 30 70 18 78 8 C82 22 88 30 94 38 Z M120 44 C130 30 130 18 122 8 C118 22 112 30 106 38 Z" fill="#c8c0b0" ${S2}/>
        <path d="M82 64 L96 68 L86 74 Z M118 64 L104 68 L114 74 Z" fill="#ff9a2a" filter="url(#${g.f})"/>
        <path d="M88 88 C94 94 106 94 112 88" stroke="${OL}" stroke-width="3" fill="none"/>
        <path d="M90 90 L92 98 L95 91 M110 90 L108 98 L105 91" fill="#fff" ${S2}/>`, 56);
    },
    bat(g) {
      return wrap('bat', `${lg(g.a, [[0, '#7a5a8a'], [1, '#2e1e3a']])}${lg(g.w, [[0, '#5a3a6a'], [1, '#22142e']])}${glow(g.f, 2)}`, `
        <path class="wing-l" d="M96 104 C78 74 48 64 10 74 C20 84 22 94 18 104 C30 102 38 108 40 118 C50 112 60 114 68 124 C76 114 86 112 96 116 Z" fill="url(#${g.w})" ${S}/>
        <path class="wing-r" d="M104 104 C122 74 152 64 190 74 C180 84 178 94 182 104 C170 102 162 108 160 118 C150 112 140 114 132 124 C124 114 114 112 104 116 Z" fill="url(#${g.w})" ${S}/>
        <path d="M20 80 L90 108 M180 80 L110 108 M40 112 L88 112 M160 112 L112 112" stroke="${OL}" stroke-width="2" opacity=".35"/>
        <ellipse cx="100" cy="116" rx="20" ry="26" fill="url(#${g.a})" ${S}/>
        <path d="M84 84 L80 62 L94 78 Z M116 84 L120 62 L106 78 Z" fill="url(#${g.a})" ${S2}/>
        <circle cx="100" cy="92" r="17" fill="url(#${g.a})" ${S}/>
        <circle cx="93" cy="90" r="4" fill="#ff3a4a" filter="url(#${g.f})"/><circle cx="107" cy="90" r="4" fill="#ff3a4a" filter="url(#${g.f})"/>
        <path d="M94 101 L96 108 L98 101 M102 101 L104 108 L106 101" fill="#fff" ${S2}/>
        <path d="M92 140 L90 148 M108 140 L110 148" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`, 30, 'floating flapping');
    },
    fallenKnight(g) {
      return wrap('fallenKnight', `${lg(g.a, [[0, '#8a90a8'], [0.5, '#4a4e62'], [1, '#22242e']])}${lg(g.c, [[0, '#7a1a2a'], [1, '#2a0812']])}${lg(g.s, [[0, '#e8ecf6'], [0.5, '#8a92a8'], [1, '#3a4054']])}${glow(g.f, 3)}`, `
        <path d="M60 80 C40 120 36 160 44 188 L80 176 L100 188 L120 176 L156 188 C164 160 160 120 140 80 Z" fill="url(#${g.c})" ${S}/>
        <path d="M70 150 L64 188 L96 188 L96 150 Z M104 150 L104 188 L136 188 L130 150 Z" fill="url(#${g.a})" ${S}/>
        <path d="M60 92 C60 76 140 76 140 92 L134 152 L66 152 Z" fill="url(#${g.a})" ${S}/>
        <path d="M100 86 L100 150 M70 116 C86 124 114 124 130 116" stroke="${OL}" stroke-width="2.5" fill="none" opacity=".6"/>
        <path d="M82 100 L94 118 L86 132" stroke="#c46bff" stroke-width="2.5" fill="none" filter="url(#${g.f})"/>
        <path d="M44 84 C44 70 66 66 74 80 L70 104 C58 104 46 98 44 84 Z M156 84 C156 70 134 66 126 80 L130 104 C142 104 154 98 156 84 Z" fill="url(#${g.a})" ${S}/>
        ${limb('M56 100 C44 112 40 124 44 136', '#4a4e62', 13)}
        <path d="M40 140 L22 24 L32 20 L52 136 Z" fill="url(#${g.s})" ${S}/>
        <path d="M28 132 L58 126" stroke="#8a6a2a" stroke-width="7" stroke-linecap="round"/>
        <path d="M30 40 L44 128" stroke="#c46bff" stroke-width="1.5" opacity=".8" filter="url(#${g.f})"/>
        <circle cx="46" cy="138" r="8" fill="#4a4e62" ${S2}/>
        <path d="M76 70 C74 38 126 38 124 70 L122 84 L78 84 Z" fill="url(#${g.a})" ${S}/>
        <path d="M80 58 L120 58 L118 64 L82 64 Z" fill="#0c0a12"/>
        <path d="M86 61 L96 61 M104 61 L114 61" stroke="#d47aff" stroke-width="3" stroke-linecap="round" filter="url(#${g.f})"/>
        <path d="M100 40 L100 84" stroke="${OL}" stroke-width="2" opacity=".5"/>
        <path d="M104 38 C116 24 132 26 140 18 C136 32 124 40 110 42" fill="#5a1a2a" ${S2}/>`, 64);
    },
    bogWitch(g) {
      return wrap('bogWitch', `${lg(g.a, [[0, '#4a5a3a'], [1, '#1e2618']])}${lg(g.k, [[0, '#a8c87a'], [1, '#5a7a3a']])}${rg(g.o, [[0, '#eaffa0'], [0.5, '#7aff4a'], [1, '#2a8a1a', 0]])}${glow(g.f, 3)}`, `
        <path d="M54 186 C52 150 64 116 98 108 C134 112 148 150 150 186 L134 180 L120 188 L104 180 L88 188 L72 180 Z" fill="url(#${g.a})" ${S}/>
        <path d="M70 140 L80 150 M120 130 L130 142" stroke="#6a7a4a" stroke-width="3" opacity=".6"/>
        <path d="M30 186 L46 44" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
        <path d="M30 186 L46 44" stroke="#6b4a2a" stroke-width="6" stroke-linecap="round"/>
        <circle cx="47" cy="38" r="14" fill="url(#${g.o})" filter="url(#${g.f})"/>
        <path d="M38 30 C40 20 54 20 56 30 C58 38 52 42 47 42 C42 42 36 38 38 30 Z" fill="#ece3cc" ${S2}/>
        <circle cx="43" cy="31" r="2.5" fill="${OL}"/><circle cx="51" cy="31" r="2.5" fill="${OL}"/>
        ${limb('M74 128 C60 124 52 118 46 110', '#a8c87a', 8)}
        ${limb('M128 126 C140 132 146 142 148 150', '#a8c87a', 8)}
        <path d="M140 150 L156 150 L158 168 C158 174 138 174 138 168 Z" fill="#5a2a7a" ${S2}/>
        <path d="M142 150 C144 144 152 144 154 150" fill="#b46bff" filter="url(#${g.f})"/>
        <path d="M70 86 C66 112 72 126 80 132 M128 84 C134 110 128 124 120 130" stroke="#2a3a1a" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M74 84 C72 62 84 52 100 52 C116 52 128 62 126 84 C126 102 114 112 100 112 C86 112 74 102 74 84 Z" fill="url(#${g.k})" ${S}/>
        <path d="M84 88 C74 96 66 104 58 108 C70 108 82 100 90 94 Z" fill="url(#${g.k})" ${S2}/>
        <circle cx="70" cy="102" r="2.5" fill="#5a7a3a"/>
        <circle cx="92" cy="78" r="4.5" fill="#ffe14d" filter="url(#${g.f})"/><circle cx="114" cy="78" r="4.5" fill="#ffe14d" filter="url(#${g.f})"/>
        <path d="M94 100 C100 106 110 106 116 98" stroke="${OL}" stroke-width="3" fill="none"/>
        <path d="M100 103 L102 108 L105 104" fill="#f6eed4" ${S2}/>
        <path d="M58 58 C80 48 122 48 144 58 C130 62 70 62 58 58 Z" fill="#2a1a3a" ${S}/>
        <path d="M78 56 C82 30 96 18 120 4 C114 22 116 40 122 56 Z" fill="#2a1a3a" ${S}/>
        <path d="M80 50 L120 50 L121 56 L79 56 Z" fill="#7a3a8a"/>
        <rect x="94" y="48" width="10" height="10" rx="1" fill="#c9a24a" ${S2}/>`, 56);
    },
    lichKing(g) {
      return wrap('lichKing', `${lg(g.a, [[0, '#3a2a5a'], [1, '#120a20']])}${rg(g.au, [[0, '#7ae8ff', 0.55], [1, '#3a2a8a', 0]])}${lg(g.cr, [[0, '#fff2b0'], [1, '#c48a1a']])}${rg(g.o, [[0, '#ffffff'], [0.4, '#8af6ff'], [1, '#1a6a9a', 0]])}${glow(g.f, 3.5)}`, `
        <circle cx="100" cy="90" r="96" fill="url(#${g.au})"/>
        <path d="M40 188 C40 130 56 96 100 90 C144 96 160 130 160 188 L146 178 L132 190 L116 178 L100 192 L84 178 L68 190 L54 178 Z" fill="url(#${g.a})" ${S}/>
        <path d="M100 92 L100 188 M70 120 L84 186 M130 120 L116 186" stroke="#c9a24a" stroke-width="2.5" opacity=".8"/>
        <path d="M50 98 C50 80 80 76 86 92 L80 112 C66 114 52 110 50 98 Z M150 98 C150 80 120 76 114 92 L120 112 C134 114 148 110 150 98 Z" fill="#2a1e40" ${S}/>
        <path d="M58 92 C60 86 70 84 74 88 M142 92 C140 86 130 84 126 88" stroke="#c9a24a" stroke-width="3" fill="none"/>
        ${bone(56, 108, 40, 136, 5)}${bone(40, 136, 28, 128, 4)}
        <path d="M24 192 L34 20" stroke="${OL}" stroke-width="9" stroke-linecap="round"/><path d="M24 192 L34 20" stroke="#4a3a5a" stroke-width="5" stroke-linecap="round"/>
        <circle cx="35" cy="18" r="15" fill="url(#${g.o})" filter="url(#${g.f})"/>
        <path d="M35 6 L42 18 L35 30 L28 18 Z" fill="#e8ffff" ${S2}/>
        ${bone(144, 108, 160, 128, 5)}${bone(160, 128, 172, 112, 4)}
        <circle cx="174" cy="106" r="11" fill="#7ae8ff" filter="url(#${g.f})" opacity=".85"/>
        <path d="M80 62 C80 40 120 40 120 62 C122 74 116 80 112 82 L112 92 L88 92 L88 82 C84 80 78 74 80 62 Z" fill="#e6dcc4" ${S}/>
        <ellipse cx="91" cy="64" rx="6" ry="7" fill="${OL}"/><ellipse cx="109" cy="64" rx="6" ry="7" fill="${OL}"/>
        <circle cx="91" cy="65" r="3" fill="#8af6ff" filter="url(#${g.f})"/><circle cx="109" cy="65" r="3" fill="#8af6ff" filter="url(#${g.f})"/>
        <path d="M100 70 L97 77 L103 77 Z" fill="${OL}"/>
        <path d="M92 86 L92 92 M100 86 L100 92 M108 86 L108 92" stroke="${OL}" stroke-width="2"/>
        <path d="M76 48 L80 22 L90 38 L100 14 L110 38 L120 22 L124 48 Z" fill="url(#${g.cr})" ${S}/>
        <circle cx="100" cy="36" r="4" fill="#ff3a6a" ${S2}/><circle cx="84" cy="40" r="2.5" fill="#3ad6ff"/><circle cx="116" cy="40" r="2.5" fill="#3ad6ff"/>`, 70);
    },

    /* ================= 3막 ================= */
    imp(g) {
      return wrap('imp', `${lg(g.a, [[0, '#ff7a5a'], [0.6, '#c4302a'], [1, '#6a1214']])}${rg(g.fb, [[0, '#fffbd0'], [0.4, '#ffb030'], [1, '#e8401c', 0]])}${glow(g.f, 3)}`, `
        <path class="wing-l" d="M78 112 C64 94 46 90 30 96 C38 102 40 108 38 116 C48 114 56 118 60 126 Z" fill="#7a1a20" ${S}/>
        <path class="wing-r" d="M122 112 C136 94 154 90 170 96 C162 102 160 108 162 116 C152 114 144 118 140 126 Z" fill="#7a1a20" ${S}/>
        <path d="M128 160 C150 168 160 156 166 140 L172 146 L168 132 L156 136 L162 138 C156 150 146 156 130 150" fill="#c4302a" ${S2}/>
        <path d="M82 160 L76 188 L92 188 L94 164 Z M106 164 L108 188 L124 188 L118 160 Z" fill="url(#${g.a})" ${S}/>
        <ellipse cx="100" cy="146" rx="28" ry="24" fill="url(#${g.a})" ${S}/>
        <ellipse cx="100" cy="152" rx="16" ry="12" fill="#ffb09a" opacity=".5"/>
        ${limb('M76 136 C62 132 54 122 52 112', '#c4302a', 8)}
        <circle cx="48" cy="102" r="18" fill="url(#${g.fb})" filter="url(#${g.f})" class="flicker"/>
        ${limb('M124 136 C134 140 138 148 138 156', '#c4302a', 8)}
        <circle cx="100" cy="98" r="30" fill="url(#${g.a})" ${S}/>
        <path d="M76 82 C66 68 66 54 74 44 C76 58 82 68 90 74 Z M124 82 C134 68 134 54 126 44 C124 58 118 68 110 74 Z" fill="#3a1212" ${S2}/>
        <path d="M70 96 L58 88 L72 104 Z M130 96 L142 88 L128 104 Z" fill="url(#${g.a})" ${S2}/>
        <path d="M84 94 C86 88 96 88 96 96 C92 100 86 100 84 94 Z M104 96 C104 88 114 88 116 94 C114 100 108 100 104 96 Z" fill="#ffe14d" filter="url(#${g.f})"/>
        <circle cx="90" cy="95" r="2" fill="${OL}"/><circle cx="110" cy="95" r="2" fill="${OL}"/>
        <path d="M84 110 C92 120 108 120 116 110 C108 114 92 114 84 110 Z" fill="${OL}"/>
        <path d="M88 112 L90 117 L93 113 M112 112 L110 117 L107 113" fill="#fff"/>`, 40);
    },
    salamander(g) {
      return wrap('salamander', `${lg(g.a, [[0, '#4a3a3a'], [1, '#1e1414']])}${lg(g.l, [[0, '#fff0a0'], [0.4, '#ff8a1a'], [1, '#d4300c']])}${glow(g.f, 3)}`, `
        <path d="M150 150 C176 150 192 132 194 110 C200 128 196 150 182 162 C170 172 152 172 140 166 Z" fill="url(#${g.a})" ${S}/>
        <path d="M40 150 C40 126 70 116 104 118 C140 120 160 134 158 156 C156 172 52 174 40 150 Z" fill="url(#${g.a})" ${S}/>
        ${[[60, 162, 48, 188], [86, 166, 82, 190], [124, 166, 130, 190], [148, 160, 160, 186]].map(([x1, y1, x2, y2]) => limb(`M${x1} ${y1} L${x2} ${y2}`, '#3a2a2a', 9) + `<path d="M${x2 - 8} ${y2 + 1} L${x2 + 8} ${y2 + 1}" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>`).join('')}
        <path d="M60 130 L72 142 L84 128 L98 144 L112 126 L124 142 L140 130" stroke="url(#${g.l})" stroke-width="3.5" fill="none" filter="url(#${g.f})"/>
        <path d="M70 156 L90 150 L110 158 M120 150 L140 154" stroke="url(#${g.l})" stroke-width="2.5" fill="none" filter="url(#${g.f})"/>
        ${[[70, 118], [90, 112], [110, 112], [130, 118], [148, 126]].map(([x, y], i) => `<path class="flicker f${i}" d="M${x - 7} ${y + 4} C${x - 6} ${y - 8} ${x} ${y - 14} ${x} ${y - 20} C${x + 4} ${y - 12} ${x + 8} ${y - 6} ${x + 7} ${y + 4} Z" fill="url(#${g.l})" filter="url(#${g.f})"/>`).join('')}
        <path d="M48 132 C34 118 12 120 6 134 C4 146 18 156 36 156 C46 156 54 150 56 142 Z" fill="url(#${g.a})" ${S}/>
        <path d="M8 140 C20 144 32 144 44 140" stroke="${OL}" stroke-width="2.5" fill="none"/>
        <circle cx="30" cy="128" r="6" fill="#ffd23f" filter="url(#${g.f})"/><path d="M30 123 L30 133" stroke="${OL}" stroke-width="2.5"/>
        <path d="M12 136 L14 132" stroke="#ff8a1a" stroke-width="2"/>`, 76);
    },
    shade(g) {
      return wrap('shade', `${rg(g.a, [[0, '#4a2a6a'], [0.7, '#1a0e2a'], [1, '#08040e']], 0.5, 0.4, 0.6)}${glow(g.f, 3)}`, `
        <path d="M40 176 C30 140 34 92 56 66 C76 42 124 42 144 66 C166 92 170 140 160 176 C150 166 146 184 136 176 C128 188 118 172 110 186 C102 172 94 190 86 176 C78 188 70 170 62 182 C54 170 48 184 40 176 Z" fill="url(#${g.a})" ${S}/>
        <path d="M60 80 C70 62 88 54 104 54" stroke="#a46aff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>
        <path d="M40 140 C24 136 14 120 16 104 M160 140 C176 136 186 120 184 104" stroke="#1a0e2a" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M40 140 C24 136 14 120 16 104 M160 140 C176 136 186 120 184 104" stroke="#a46aff" stroke-width="2" fill="none" opacity=".5"/>
        ${eyeGlow(78, 96, 7, '#ff3a8a', g.f)}${eyeGlow(122, 96, 7, '#ff3a8a', g.f)}${eyeGlow(100, 78, 5, '#ff6aaa', g.f)}${eyeGlow(62, 120, 3.5, '#ff6aaa', g.f)}${eyeGlow(140, 118, 3.5, '#ff6aaa', g.f)}
        <path d="M70 132 L80 142 L90 132 L100 144 L110 132 L120 142 L130 132 C120 156 80 156 70 132 Z" fill="#0a0410" ${S2}/>
        <path d="M80 142 L84 136 M100 144 L100 136 M120 142 L116 136" stroke="#e8d0ff" stroke-width="2"/>`, 60, 'floating');
    },
    sentinel(g) {
      return wrap('sentinel', `${lg(g.a, [[0, '#4a4a6a'], [0.5, '#1e1e30'], [1, '#08080e']], 0, 0, 1, 1)}${rg(g.e, [[0, '#ffffff'], [0.3, '#ff8a3a'], [1, '#c4200c', 0]])}${glow(g.f, 3.5)}`, `
        <ellipse cx="100" cy="178" rx="40" ry="8" fill="#ff6a2a" opacity=".35" filter="url(#${g.f})"/>
        <path d="M100 14 L148 60 L140 150 L100 172 L60 150 L52 60 Z" fill="url(#${g.a})" ${S}/>
        <path d="M100 14 L100 172 M52 60 L100 90 L148 60 M60 150 L100 128 L140 150" stroke="#8a7aff" stroke-width="1.5" fill="none" opacity=".6"/>
        <path d="M100 14 L52 60 L60 150" stroke="#c4b4ff" stroke-width="2" fill="none" opacity=".45"/>
        <circle cx="100" cy="92" r="24" fill="url(#${g.e})" filter="url(#${g.f})" class="pulse"/>
        <ellipse cx="100" cy="92" rx="16" ry="11" fill="#fff4e0" ${S2}/>
        <circle cx="100" cy="92" r="7" fill="#c4200c"/><circle cx="100" cy="92" r="3" fill="${OL}"/>
        ${[[26, 70, -20], [174, 74, 18], [30, 136, 12], [170, 132, -14]].map(([x, y, r], i) => `<path class="shard sh${i}" d="M${x} ${y - 16} L${x + 9} ${y} L${x} ${y + 16} L${x - 9} ${y} Z" fill="url(#${g.a})" ${S2} transform="rotate(${r} ${x} ${y})"/>`).join('')}`, 46, 'floating');
    },
    abyssDemon(g) {
      return wrap('abyssDemon', `${lg(g.a, [[0, '#c43a3a'], [0.55, '#6a1418'], [1, '#2a0608']])}${lg(g.w, [[0, '#4a0e12'], [1, '#14040a']])}${lg(g.h, [[0, '#f0e2c0'], [1, '#7a6a4a']])}${rg(g.fi, [[0, '#fff2a0'], [0.4, '#ff6a1a'], [1, '#a4100c', 0]])}${glow(g.f, 3.5)}`, `
        <path class="wing-l" d="M80 90 C56 40 24 20 0 24 C10 40 12 58 4 72 C18 70 26 78 26 92 C38 86 48 92 50 104 C60 98 72 100 78 112 Z" fill="url(#${g.w})" ${S}/>
        <path class="wing-r" d="M120 90 C144 40 176 20 200 24 C190 40 188 58 196 72 C182 70 174 78 174 92 C162 86 152 92 150 104 C140 98 128 100 122 112 Z" fill="url(#${g.w})" ${S}/>
        <ellipse cx="100" cy="182" rx="70" ry="14" fill="url(#${g.fi})" filter="url(#${g.f})" class="flicker"/>
        <path d="M66 150 L56 188 L92 188 L94 150 Z M106 150 L108 188 L144 188 L134 150 Z" fill="url(#${g.a})" ${S}/>
        <path d="M52 96 C52 76 148 76 148 96 L140 154 L60 154 Z" fill="url(#${g.a})" ${S}/>
        <path d="M100 96 L100 150 M84 112 L84 140 M116 112 L116 140 M74 100 C86 106 114 106 126 100" stroke="#2a0608" stroke-width="2.5" fill="none" opacity=".6"/>
        ${limb('M56 100 C38 112 30 128 32 146', '#8a1a1e', 15)}
        <path d="M24 146 L22 160 M32 150 L32 164 M40 146 L44 158" stroke="#f0e2c0" stroke-width="4" stroke-linecap="round"/>
        ${limb('M144 100 C162 106 172 116 176 128', '#8a1a1e', 15)}
        <circle cx="180" cy="124" r="16" fill="url(#${g.fi})" filter="url(#${g.f})" class="flicker"/>
        <path d="M74 70 C70 46 84 34 100 34 C116 34 130 46 126 70 C126 86 114 96 100 96 C86 96 74 86 74 70 Z" fill="url(#${g.a})" ${S}/>
        <path d="M78 52 C60 40 52 20 58 2 C68 20 80 32 92 40 Z M122 52 C140 40 148 20 142 2 C132 20 120 32 108 40 Z" fill="url(#${g.h})" ${S}/>
        <path d="M82 64 L96 68 L86 74 Z M118 64 L104 68 L114 74 Z" fill="#ffe14d" filter="url(#${g.f})"/>
        <path d="M84 82 C92 90 108 90 116 82 C108 86 92 86 84 82 Z" fill="${OL}" ${S2}/>
        <path d="M88 84 L90 91 L93 85 M112 84 L110 91 L107 85 M98 86 L100 92 L102 86" fill="#fff"/>`, 80);
    },
    elderDragon(g) {
      return wrap('elderDragon', `${lg(g.a, [[0, '#d4703a'], [0.5, '#8a2a1a'], [1, '#3a0e0a']])}${lg(g.w, [[0, '#6a1a14'], [1, '#22060a']])}${lg(g.b, [[0, '#f8d890'], [1, '#c48a3a']])}${lg(g.h, [[0, '#f4ead0'], [1, '#8a7a5a']])}${rg(g.fi, [[0, '#fffbd0'], [0.4, '#ffb030'], [1, '#e8401c', 0]])}${glow(g.f, 3.5)}`, `
        <path class="wing-r" d="M120 96 C130 40 170 6 200 0 C192 22 196 40 200 56 C188 54 180 62 180 76 C170 70 160 76 158 88 C148 82 138 88 134 100 Z" fill="url(#${g.w})" ${S}/>
        <path d="M200 0 L150 80 M196 40 L156 86 M172 20 L140 92" stroke="#2a0608" stroke-width="2" opacity=".6"/>
        <path d="M150 188 C190 186 200 160 196 132 C204 150 204 178 186 192 C176 198 156 196 146 190 Z" fill="url(#${g.a})" ${S}/>
        <path d="M70 188 C60 150 76 110 116 104 C156 108 170 150 160 188 Z" fill="url(#${g.a})" ${S}/>
        <path d="M98 118 C90 140 92 164 100 188 L132 188 C138 164 136 138 128 118 Z" fill="url(#${g.b})" ${S2}/>
        ${[130, 144, 158, 172].map((y) => `<path d="M${96 + (y - 118) * 0.05} ${y} L${134 - (y - 118) * 0.04} ${y}" stroke="#8a5a2a" stroke-width="2"/>`).join('')}
        <path d="M76 170 L60 188 L92 188 Z" fill="url(#${g.a})" ${S}/>
        <path d="M56 188 L52 196 M64 188 L62 197 M72 188 L72 196" stroke="#f4ead0" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M96 116 C80 96 70 76 66 56 C64 46 74 40 84 46 C92 66 104 86 120 104 Z" fill="url(#${g.a})" ${S}/>
        ${[[78, 84], [72, 66], [86, 98]].map(([x, y]) => `<path d="M${x} ${y} L${x - 9} ${y - 3} L${x - 2} ${y + 6} Z" fill="url(#${g.h})" ${S2}/>`).join('')}
        <path class="wing-l" d="M84 94 C60 50 28 30 4 34 C14 50 14 66 6 80 C20 78 28 86 28 100 C40 94 50 100 52 112 C62 106 74 108 80 118 Z" fill="url(#${g.w})" ${S}/>
        <path d="M4 34 L66 100 M6 80 L60 108" stroke="#2a0608" stroke-width="2" opacity=".6"/>
        <path d="M40 56 C34 40 46 26 64 24 C80 22 92 32 96 44 C100 56 92 66 80 68 L40 72 C28 72 20 66 22 58 Z" fill="url(#${g.a})" ${S}/>
        <path d="M22 58 C30 62 40 64 52 62 L50 72 L40 72 C28 72 20 66 22 58 Z" fill="url(#${g.b})" ${S2}/>
        <path d="M28 64 L30 70 L33 65 M38 66 L40 72 L43 66 M48 64 L50 70 L52 64" fill="#fff"/>
        <path d="M66 28 C70 12 84 4 98 6 C88 12 82 22 80 32 Z M80 36 C92 26 106 26 116 32 C104 34 96 40 90 46 Z" fill="url(#${g.h})" ${S}/>
        <path d="M54 40 L70 44 L58 50 Z" fill="#ffe14d" filter="url(#${g.f})"/><path d="M60 42 L60 48" stroke="${OL}" stroke-width="2"/>
        <circle cx="26" cy="54" r="2.5" fill="${OL}"/>
        <circle cx="14" cy="66" r="12" fill="url(#${g.fi})" filter="url(#${g.f})" class="flicker"/>`, 88);
    },
  };

  /* ================= 주인공 ================= */
  function hero() {
    const g = { a: uid('ha'), c: uid('hc'), s: uid('hs'), k: uid('hk'), f: uid('hf') };
    return `<svg class="hero-art" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>${lg(g.a, [[0, '#4a7ac8'], [1, '#1e3466']])}${lg(g.c, [[0, '#3a3a6a'], [1, '#14142a']])}${lg(g.s, [[0, '#ffffff'], [0.5, '#c9d3e0'], [1, '#6a7688']])}${lg(g.k, [[0, '#ffd8b4'], [1, '#d8a07a']])}${glow(g.f, 2.5)}</defs>
      <ellipse class="art-shadow" cx="100" cy="190" rx="44" ry="7" fill="rgba(0,0,0,.45)"/>
      <g class="art-body">
        <path class="cape" d="M86 74 C64 90 50 130 40 176 C58 168 70 176 84 168 C90 140 96 110 104 86 Z" fill="url(#${g.c})" ${S}/>
        <path d="M84 140 L76 186 L94 186 L98 142 Z M104 142 L110 186 L128 186 L118 140 Z" fill="#3a2a22" ${S}/>
        <path d="M72 186 L96 186 M108 186 L132 186" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
        <path d="M78 88 C78 80 122 80 122 88 L126 146 L76 146 Z" fill="url(#${g.a})" ${S}/>
        <path d="M100 84 L100 146" stroke="#14203a" stroke-width="2" opacity=".5"/>
        <rect x="74" y="128" width="54" height="9" rx="3" fill="#6b4a2a" ${S2}/>
        <rect x="94" y="126" width="12" height="13" rx="2" fill="#c9a24a" ${S2}/>
        <path d="M82 76 C90 86 110 86 118 76 L120 90 C106 96 94 96 80 90 Z" fill="#c43a3a" ${S2}/>
        <path class="scarf" d="M84 84 C70 88 60 98 52 104 C62 104 72 100 82 94 Z" fill="#c43a3a" ${S2}/>
        ${limb('M86 96 C78 112 80 124 90 132', '#3a64aa', 11)}
        <circle cx="92" cy="134" r="7" fill="url(#${g.k})" ${S2}/>
        ${limb('M118 96 C130 104 136 112 140 118', '#3a64aa', 11)}
        <circle cx="142" cy="120" r="7" fill="url(#${g.k})" ${S2}/>
        <g class="hero-sword">
          <path d="M146 116 L190 52 L196 50 L194 56 L150 120 Z" fill="url(#${g.s})" ${S2}/>
          <path d="M150 114 L190 54" stroke="#fff" stroke-width="1.5" opacity=".8"/>
          <path d="M134 110 L156 128" stroke="#c9a24a" stroke-width="7" stroke-linecap="round"/>
          <path d="M134 110 L156 128" stroke="${OL}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
          <path d="M140 124 L132 134" stroke="#6b4a2a" stroke-width="7" stroke-linecap="round"/>
        </g>
        <path d="M80 60 C80 38 120 38 120 60 C120 76 112 84 100 84 C88 84 80 76 80 60 Z" fill="url(#${g.k})" ${S}/>
        <path d="M76 58 C74 36 92 26 108 30 C120 32 128 42 126 56 C118 50 112 44 104 42 C98 50 88 54 76 58 Z" fill="#2a1e1a" ${S}/>
        <path d="M78 52 C70 56 64 64 62 72 C70 68 76 64 80 60 Z" fill="#2a1e1a" ${S2}/>
        <ellipse cx="110" cy="62" rx="3" ry="4" fill="${OL}"/><circle cx="111" cy="60.5" r="1.2" fill="#fff"/>
        <path d="M104 54 L116 54" stroke="${OL}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M108 74 C112 76 116 74 118 72" stroke="${OL}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M120 64 C122 66 122 68 120 70" stroke="#c48a6a" stroke-width="2" fill="none"/>
      </g>
    </svg>`;
  }

  function fallback(id) {
    const g = { a: uid('fa'), f: uid('ff') };
    return wrap(id, `${lg(g.a, [[0, '#6a6a7a'], [1, '#2a2a36']])}${glow(g.f, 2)}`, `
      <path d="M50 186 C44 130 60 70 100 66 C140 70 156 130 150 186 Z" fill="url(#${g.a})" ${S}/>
      <circle cx="86" cy="110" r="6" fill="#ff5a5a" filter="url(#${g.f})"/><circle cx="114" cy="110" r="6" fill="#ff5a5a" filter="url(#${g.f})"/>`);
  }

  CB.art.enemy = (id) => {
    const fn = ART[id];
    if (!fn) return fallback(id);
    const g = new Proxy({}, { get: (t, k) => { if (!(k in t)) t[k] = uid(`${id.slice(0, 3)}${String(k)}`); return t[k]; } });
    try {
      return fn(g);
    } catch (e) {
      console.warn('아트 생성 실패:', id, e);
      return fallback(id);
    }
  };
  CB.art.hero = hero;
  CB.art.ENEMY_IDS = Object.keys(ART);
})();
