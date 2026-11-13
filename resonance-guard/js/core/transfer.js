'use strict';

/* =========================================================
 * 진행 상황 옮기기 — 내 진행(별·탑·영웅·조각…)을 저장 코드/파일로 내보내고, 다른 기기·사람이 가져옴
 * 진행은 브라우저 저장 공간(localStorage)에만 있어 게임 파일을 보내도 따라가지 않으므로.
 *   코드 형식: "RG1z." + base64url(deflate-raw(JSON))  — 압축을 못 하는 브라우저는 "RG1." + base64url(JSON)
 *   JSON: { game: 'resonance-guard', kind: 'save', v: 1, at: ISO 시각, progress: {...} }
 * 설정(음량·글자 크기 등)은 기기마다 달라 옮기지 않음. 진행 중이던 판(이어하기)도 옮기지 않음.
 * ========================================================= */
RG.transfer = (() => {
  const GAME = 'resonance-guard';
  const PRE_Z = 'RG1z.';
  const PRE = 'RG1.';

  const toB64u = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64u = (str) => {
    const b = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b + '==='.slice((b.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const MAX_BYTES = 4e6; // 풀린 저장이 이보다 크면 저장이 아님 (압축 폭탄 막기)
  async function pipe(bytes, Stream) {
    const s = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
    const reader = s.getReader();
    const chunks = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > MAX_BYTES) { try { reader.cancel(); } catch (e) { /* 무시 */ } throw new Error('too big'); }
      chunks.push(value);
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  /** 이 브라우저가 deflate-raw를 풀 수 있나 (Chrome 103 전에는 못 함) */
  const canUnzip = () => { try { new DecompressionStream('deflate-raw'); return true; } catch (e) { return false; } };
  const canZip = () => { try { return typeof Blob !== 'undefined' && !!new CompressionStream('deflate-raw'); } catch (e) { return false; } };

  /** 지금 진행을 내보낼 묶음 */
  function bundle() {
    return { game: GAME, kind: 'save', v: 1, at: new Date().toISOString(), progress: JSON.parse(JSON.stringify(RG.progress.get())) };
  }

  /** 묶음 → 저장 코드 (압축할 수 있으면 압축) */
  async function encode(obj = bundle()) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (canZip()) {
      try { return PRE_Z + toB64u(await pipe(bytes, CompressionStream)); } catch (e) { /* 아래로 */ }
    }
    return PRE + toB64u(bytes);
  }

  /** 저장 코드(또는 저장 파일 내용, JSON 그대로도) → 묶음. 잘못되면 알아들을 수 있는 말로 Error */
  async function decode(text) {
    const raw = String(text || '').replace(/\s+/g, '');
    if (!raw) throw new Error('저장 코드가 비어 있습니다');
    let json;
    if (raw.length > MAX_BYTES) throw new Error('공명 수호대 저장 코드가 아닙니다 (너무 깁니다)');
    if (raw[0] === '{') json = String(text).trim();
    else if (raw.startsWith(PRE_Z)) {
      if (typeof DecompressionStream === 'undefined' || !canUnzip()) throw new Error('이 브라우저는 압축된 저장 코드를 풀 수 없습니다. 최신 브라우저에서 열어 주세요');
      try { json = new TextDecoder().decode(await pipe(fromB64u(raw.slice(PRE_Z.length)), DecompressionStream)); } catch (e) { throw new Error('저장 코드가 잘렸거나 바뀌었습니다. 처음부터 끝까지 그대로 복사했는지 확인해 주세요'); }
    } else if (raw.startsWith(PRE)) {
      try { json = new TextDecoder().decode(fromB64u(raw.slice(PRE.length))); } catch (e) { throw new Error('저장 코드가 잘렸거나 바뀌었습니다'); }
    } else throw new Error('공명 수호대 저장 코드가 아닙니다 (RG1로 시작해야 합니다)');
    let obj;
    try { obj = JSON.parse(json); } catch (e) { throw new Error('저장 코드가 잘렸거나 바뀌었습니다. 처음부터 끝까지 그대로 복사했는지 확인해 주세요'); }
    const bad = check(obj);
    if (bad) throw new Error(bad);
    return obj;
  }

  /** 묶음이 이 게임의 진행인지 (아니면 까닭) */
  function check(obj) {
    if (!obj || typeof obj !== 'object' || obj.game !== GAME || obj.kind !== 'save') return '공명 수호대 저장 코드가 아닙니다';
    if (obj.v !== 1) return '더 새로운 버전의 저장입니다. 게임 파일을 최신으로 받아 주세요';
    const p = obj.progress;
    if (!p || typeof p !== 'object' || p.v !== 1 || !p.maps || typeof p.maps !== 'object' || Array.isArray(p.maps)) return '진행 기록이 망가졌습니다';
    if (p.gacha != null && (typeof p.gacha !== 'object' || !p.gacha.owned || typeof p.gacha.owned !== 'object' || Array.isArray(p.gacha.owned))) return '진행 기록이 망가졌습니다';
    // 나머지 칸의 모양은 가져온 뒤 progress.load()가 바로잡음(틀린 칸은 비움)
    return null;
  }

  /** 미리 보기용 요약: 별·클리어한 맵·가진 탑·공명석·조각 강화한 탑 */
  function summary(obj) {
    const p = obj.progress;
    const D = RG.data;
    let stars = 0; let cleared = 0;
    for (const [id, r] of Object.entries(p.maps)) {
      if (!r || typeof r !== 'object') continue;
      if (!D.maps.some((m) => m.id === id)) continue;
      stars += Math.max(0, Math.min(3, Math.floor(+r.stars) || 0)) + (r.task ? 1 : 0) + (r.challenge ? 1 : 0);
      if (r.cleared) cleared += 1;
    }
    const owned = p.gacha && p.gacha.owned ? Object.keys(p.gacha.owned).filter((t) => D.towers[t]).length : 3;
    const shardTowers = p.shardLv && typeof p.shardLv === 'object' ? Object.values(p.shardLv).filter((v) => +v > 0).length : 0;
    const crystals = p.gacha ? Math.max(0, Math.floor(+p.gacha.crystals) || 0) : 0;
    return { stars, cleared, maps: D.maps.length, towers: owned, allTowers: D.towerOrder.length, crystals, shardTowers, at: typeof obj.at === 'string' ? obj.at : null };
  }

  /** 가져오기: 지금 진행을 묶음의 진행으로 바꿈 (이어하기 판은 지움 — 다른 진행의 판이므로) */
  function apply(obj) {
    const bad = check(obj);
    if (bad) return { ok: false, reason: bad };
    RG.save.set(RG.save.KEYS.progress, obj.progress);
    RG.save.remove(RG.save.KEYS.run);
    RG.progress.load(); // 예전 저장이면 load가 새 칸을 채움
    RG.progress.save();
    return { ok: true };
  }

  /** 파일 이름: resonance-guard-save-2026-11-13.txt (한글 이름은 일부 브라우저가 "download"로 바꿔 버려 영문) */
  function fileName(d = new Date()) {
    const z = (n) => String(n).padStart(2, '0');
    return `resonance-guard-save-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.txt`;
  }

  return { bundle, encode, decode, check, summary, apply, fileName };
})();
