'use strict';

/*
 * 개입과 갈라진 역사: 개입 목록으로 우주의 팽창을 다시 풀고,
 * 그 우주의 끝(빅 립·빅 크런치)에 맞춰 새 사건을 만들고, 끝 뒤의 사건은 "일어나지 않음"으로 표시합니다.
 */
(function () {
  const UC = (window.UC = window.UC || {});
  const U = UC.util;
  const C = UC.cosmo;
  const D = UC.data;
  const N = C.T_NOW;

  const TOOLS = {
    rip: {
      icon: '🌪️',
      name: '빅 립',
      label: '암흑 에너지 키우기',
      text: '팽창할수록 오히려 강해지는 암흑 에너지(w = −1.5, "유령 에너지")로 바꿉니다. 팽창이 끝없이 빨라져 언젠가 은하, 별, 원자까지 모두 찢어집니다.',
    },
    crunch: {
      icon: '🧲',
      name: '빅 크런치',
      label: '암흑 에너지 뒤집기',
      text: '암흑 에너지가 밀어내는 대신 끌어당기게 합니다. 팽창이 멈추고, 우주가 다시 뜨거운 한 점으로 쪼그라듭니다.',
    },
    restore: {
      icon: '♻️',
      name: '원래대로',
      label: '지금의 암흑 에너지로',
      text: '암흑 에너지를 지금 우주와 같은 우주 상수로 되돌립니다.',
    },
  };

  const MIN_T = 1e8; // 이보다 이른 우주에는 암흑 에너지가 거의 영향을 주지 않으므로 개입을 받지 않습니다

  function fateEvents(run) {
    const out = [];
    if (run.endType === 'rip') {
      const tEnd = run.tEnd;
      out.push({
        id: 'rip_galaxy', t: tEnd - C.ripLead(2.5e8), kind: 'end', icon: '🌀', view: 'galaxy', fate: true,
        title: '은하가 찢어짐',
        text: '끝나기 약 7천만 년 전, 별들을 붙잡고 있던 은하의 중력이 공간의 팽창을 이기지 못합니다. 별들이 하나둘 흩어져 어둠 속으로 날아갑니다.',
      });
      out.push({
        id: 'rip_solar', t: tEnd - C.ripLead(1), kind: 'end', icon: '🪐', view: 'solar', fate: true,
        title: '태양계가 풀림',
        text: '끝나기 약 3개월 전, 행성들이 궤도를 벗어나 흩어집니다. 30분 전에는 지구 같은 행성이 터져 나가고, 10⁻¹⁹초 전에는 원자마저 찢어집니다.',
      });
      out.push({
        id: 'rip_end', t: tEnd, kind: 'end', icon: '💥', major: true, view: 'web', fate: true,
        title: '빅 립',
        text: '공간이 끝없이 빠르게 늘어나 모든 것이 찢어지고, 우주의 시간이 끝납니다. 2003년 로버트 콜드웰 등이 제안한 우주의 끝 가운데 하나입니다.',
      });
    }
    if (run.endType === 'crunch') {
      if (run.tTurn) {
        out.push({
          id: 'crunch_turn', t: run.tTurn, kind: 'end', icon: '⏸️', view: 'web', fate: true,
          title: '팽창이 멈춤',
          text: '우주가 가장 커진 순간입니다. 이제부터 은하들이 서로 다가오고, 먼 은하의 빛은 붉게(적색이동) 보이던 것이 푸르게(청색이동) 바뀝니다.',
        });
      }
      const tHot = hotAgain(run);
      if (tHot) {
        out.push({
          id: 'crunch_hot', t: tHot, kind: 'end', icon: '🔥', view: 'web', fate: true,
          title: '우주가 다시 불투명해짐',
          text: '쪼그라든 우주의 배경 복사가 3,000도를 넘어 별의 표면보다 뜨거워집니다. 별들은 바깥에서부터 녹아내리고, 원자는 다시 전자와 원자핵으로 흩어집니다.',
        });
      }
      out.push({
        id: 'crunch_end', t: run.tEnd, kind: 'end', icon: '⚫', major: true, view: 'web', fate: true,
        title: '빅 크런치',
        text: '모든 물질과 공간이 한 점으로 무너지며 시간이 끝납니다. 어떤 이들은 이것이 새로운 빅뱅으로 이어질지 모른다고 상상합니다(빅 바운스).',
      });
    }
    return out;
  }

  /* 쪼그라드는 우주가 다시 3,000도가 되는 때 */
  function hotAgain(run) {
    if (!run.tTurn) return null;
    const xHot = Math.log(C.T_CMB0 / 3000);
    for (let i = 1; i < run.tau.length; i++) {
      if (run.tau[i] < run.tTurn) continue;
      if (run.x[i - 1] > xHot && run.x[i] <= xHot) return run.tau[i];
    }
    return null;
  }

  function describe(iv, run, prevRun) {
    const items = [];
    const at = iv.t;
    if (run.endType === 'rip') {
      items.push(`지금부터 <b>${U.formatSpan(run.tEnd - at)}</b> 뒤(빅뱅 후 ${U.formatSpan(run.tEnd)}) 우주가 찢어집니다.`);
      items.push('은하는 끝나기 약 7천만 년 전, 태양계는 3개월 전, 원자는 10⁻¹⁹초 전에 찢어집니다.');
    } else if (run.endType === 'crunch') {
      if (run.tTurn && run.tTurn > at) items.push(`<b>${U.formatSpan(run.tTurn - at)}</b> 뒤 팽창이 멈추고 쪼그라들기 시작합니다.`);
      else items.push('우주는 이미 쪼그라들고 있어 되돌릴 수 없습니다.');
      items.push(`빅뱅 후 <b>${U.formatSpan(run.tEnd)}</b>에 우주가 한 점으로 무너집니다(빅 크런치).`);
    } else {
      items.push('우주는 영원히 팽창하며 점점 차갑고 어두워집니다(열죽음).');
      if (prevRun && prevRun.endType) items.push(`${prevRun.endType === 'rip' ? '빅 립' : '빅 크런치'}이 사라졌습니다.`);
    }
    const lost = D.EVENTS.filter((e) => e.t > at && e.t > run.tEnd && e.major).slice(0, 3);
    if (lost.length) items.push(`일어나지 않게 된 일: ${lost.map((e) => e.title).join(', ')}`);
    return items;
  }

  /* interventions → 우주 한 판 */
  function build(interventions) {
    const ivs = (interventions || []).slice().sort((a, b) => a.t - b.t);
    const run = C.integrate(ivs);
    const scale = UC.time.makeScale(run.tEnd);
    const events = [];
    for (const e of D.EVENTS) events.push(Object.assign({}, e, { prevented: e.t > run.tEnd }));
    for (const e of fateEvents(run)) events.push(e);
    let prevRun = C.BASE;
    const ivEvents = [];
    for (let i = 0; i < ivs.length; i++) {
      const iv = ivs[i];
      const partial = C.integrate(ivs.slice(0, i + 1));
      const tool = TOOLS[iv.type];
      ivEvents.push({
        id: `iv_${iv.id}`, t: iv.t, kind: 'intervention', icon: tool.icon, major: true, view: 'web',
        title: `당신의 개입 · ${tool.name}`, text: tool.text, iv, conseq: describe(iv, partial, prevRun),
        prevented: iv.t > run.tEnd,
      });
      prevRun = partial;
    }
    for (const e of ivEvents) events.push(e);
    events.sort((a, b) => a.t - b.t);
    return { run, scale, events, interventions: ivs };
  }

  function canIntervene(t, run) {
    if (t < MIN_T) return { ok: false, why: '빅뱅 후 1억 년보다 이른 우주에서는 암흑 에너지가 거의 힘을 쓰지 못해요. 더 뒤로 가서 개입해 보세요.' };
    if (t >= run.tEnd) return { ok: false, why: '우주가 이미 끝났어요.' };
    return { ok: true };
  }

  UC.history = { TOOLS, build, canIntervene, fateEvents, MIN_T };
})();
