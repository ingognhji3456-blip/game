'use strict';

/*
 * 판 키프레임 (시간: 현재 기준 백만 년, 음수 = 과거).
 * 형식은 js/sim/plates.js 맨 위 설명을 보세요.
 *
 * 약 5억 4천만 년 전 이후(곤드와나 → 판게아 → 현재)는 실제 복원 연구의 맞춤 회전(오일러 극)을 바탕으로 했습니다.
 * 그보다 오래된 초대륙(컬럼비아, 로디니아)과 미래의 초대륙은 정확한 모양을 아무도 모르기 때문에
 * 현재 대륙 조각을 빌려 "그럴듯하게" 모아 놓은 것입니다.
 */
(function () {
  const EC = (window.EC = window.EC || {});
  EC.data = EC.data || {};

  /* 맞춤 회전 (각 판의 현재 좌표 → 상대 판의 현재 좌표계) */
  const FIT = {
    SA_AF: { euler: [44.0, -30.6, 57.0] }, // Bullard 외 (1965): 남대서양이 열리기 전
    NA_AF: { euler: [66.95, -12.02, 75.55] }, // 중앙 대서양이 열리기 전
    EU_NA: { euler: [88.5, 27.7, -38.0] }, // 북대서양이 열리기 전
    AN_AF: { pos: [-45, 37, -20] }, // 곤드와나: 남극이 아프리카 남동쪽에
    IN_AF: { pos: [-27, 58, -100] }, // 곤드와나: 인도가 마다가스카르와 남극 사이에
    AU_AN: { euler: [-1.5, 37.5, -31.0] }, // 오스트레일리아-남극
    NA_AF_COL: { pos: [54, 0, 100] }, // 컬럼비아(가상)
    NA_AU_ROD: { pos: [-12, 172, -95] }, // 로디니아(가상): 로렌시아 서해안이 오스트레일리아·남극 쪽
    NA_EU_AMA: { pos: [58, -140, 30] }, // 아마시아(가상): 북아메리카가 북극을 건너 아시아에
    AF_EU_AMA: { pos: [8, 22, 0] },
    SA_NA_AMA: { pos: [-15, -60, 0] },
    AU_EU: { pos: [-5, 125, 15] },
    IN_EU: { pos: [22, 79, 0] },
    AN_AU_AMA: { euler: [-1.5, 37.5, 31.0] },
  };
  EC.data.plateFits = FIT;

  /* 곤드와나 조각(남아메리카·남극·인도·오스트레일리아)이 from~to 동안 붙어 있음 */
  const gond = (plate, from, to) => {
    const parent = plate === 'AU' ? 'AN' : 'AF';
    const rel = FIT[plate === 'AU' ? 'AU_AN' : plate + '_AF'];
    return [{ t: from, attach: parent, rel }, { t: to, attach: parent, rel }];
  };

  EC.data.plateKeys = {
    AF: [
      { t: -3300, pos: [0, 40, 0] },
      { t: -2700, pos: [-10, 30, 20] },
      { t: -2200, pos: [-25, -10, 40] },
      { t: -1900, pos: [-20, 0, 30] },
      { t: -1650, pos: [-10, 10, 40] },
      { t: -1400, pos: [-30, 30, 70] },
      { t: -1100, pos: [-40, 0, 100] },
      { t: -800, pos: [-35, 10, 130] },
      { t: -700, pos: [-40, 20, 150] },
      { t: -620, pos: [-45, 15, 160] },
      { t: -560, pos: [-48, 12, 170] },
      { t: -540, pos: [-50, 10, 175] },
      { t: -480, pos: [-60, 0, 165] },
      { t: -440, pos: [-62, 5, 150] },
      { t: -400, pos: [-55, 10, 125] },
      { t: -360, pos: [-45, 15, 85] },
      { t: -330, pos: [-30, 15, 60] },
      { t: -300, pos: [-19, 15, 30] },
      { t: -250, pos: [-13, 12, 15] },
      { t: -200, pos: [-9, 10, 8] },
      { t: -150, pos: [-6, 12, 5] },
      { t: -100, pos: [-3, 15, 3] },
      { t: -50, pos: [0, 18, 0] },
      { t: 0, present: true },
      { t: 50, pos: [12, 22, -5] },
      { t: 100, pos: [18, 26, -8] },
      { t: 175, pos: [22, 28, -12] },
      { t: 250, pos: [25, 30, -15] },
      { t: 400, pos: [5, 35, -30] },
      { t: 550, pos: [-10, 20, -40] },
      { t: 750, attach: 'EU', rel: FIT.AF_EU_AMA },
      { t: 7600, attach: 'EU', rel: FIT.AF_EU_AMA },
    ],
    SA: [
      { t: -3300, pos: [-30, -30, 40] },
      { t: -2700, pos: [-20, -60, 60] },
      { t: -2200, pos: [-5, -100, 90] },
      ...gond('SA', -1900, -1650),
      { t: -1400, pos: [-15, -60, 80] },
      ...gond('SA', -1100, -800),
      { t: -700, attach: 'AF', rel: { euler: [44.0, -30.6, 5.0] } },
      { t: -620, attach: 'AF', rel: { euler: [44.0, -30.6, 35.0] } },
      ...gond('SA', -560, -135),
      { t: -100, attach: 'AF', rel: { euler: [44.0, -30.6, 40.0] } },
      { t: -50, attach: 'AF', rel: { euler: [50.0, -33.0, 20.0] } },
      { t: 0, present: true },
      { t: 50, pos: [-15, -65, 0] },
      { t: 100, pos: [-15, -68, 0] },
      { t: 175, attach: 'AF', rel: { euler: [44.0, -30.6, 30.0] } },
      { t: 250, attach: 'AF', rel: { euler: [44.0, -30.6, 52.0] } },
      { t: 400, pos: [-35, -30, 40] },
      { t: 550, pos: [-20, -90, 60] },
      { t: 750, attach: 'NA', rel: FIT.SA_NA_AMA },
      { t: 7600, attach: 'NA', rel: FIT.SA_NA_AMA },
    ],
    NA: [
      { t: -3300, pos: [10, -120, 0] },
      { t: -2700, pos: [20, -90, 30] },
      { t: -2200, pos: [35, -50, 10] },
      { t: -1900, attach: 'AF', rel: FIT.NA_AF_COL },
      { t: -1650, attach: 'AF', rel: FIT.NA_AF_COL },
      { t: -1400, pos: [20, -100, 60] },
      { t: -1100, attach: 'AU', rel: FIT.NA_AU_ROD },
      { t: -800, attach: 'AU', rel: FIT.NA_AU_ROD },
      { t: -700, pos: [10, -100, 60] },
      { t: -620, pos: [10, -85, 75] },
      { t: -540, pos: [10, -80, 80] },
      { t: -480, pos: [10, -70, 70] },
      { t: -420, pos: [-14, -90, 8] },
      { t: -360, attach: 'AF', rel: { euler: [66.95, -12.02, 40.0] } },
      { t: -330, attach: 'AF', rel: { euler: [66.95, -12.02, 60.0] } },
      { t: -310, attach: 'AF', rel: FIT.NA_AF },
      { t: -195, attach: 'AF', rel: FIT.NA_AF },
      { t: -150, attach: 'AF', rel: { euler: [66.95, -12.02, 62.0] } },
      { t: -100, attach: 'AF', rel: { euler: [70.0, -15.0, 45.0] } },
      { t: -50, attach: 'AF', rel: { euler: [75.0, -10.0, 22.0] } },
      { t: 0, present: true },
      { t: 50, pos: [50, -110, 5] },
      { t: 100, pos: [50, -115, 10] },
      { t: 175, attach: 'AF', rel: { euler: [66.95, -12.02, 35.0] } },
      { t: 250, attach: 'AF', rel: { euler: [66.95, -12.02, 70.0] } },
      { t: 400, pos: [45, -60, 50] },
      { t: 550, pos: [50, -120, 100] },
      { t: 750, attach: 'EU', rel: FIT.NA_EU_AMA },
      { t: 7600, attach: 'EU', rel: FIT.NA_EU_AMA },
    ],
    EU: [
      { t: -3300, pos: [40, 100, 0] },
      { t: -2700, pos: [45, 60, 40] },
      { t: -2200, pos: [50, 60, 80] },
      { t: -1900, attach: 'NA', rel: FIT.EU_NA },
      { t: -1650, attach: 'NA', rel: FIT.EU_NA },
      { t: -1400, pos: [55, 60, 120] },
      { t: -1100, attach: 'NA', rel: FIT.EU_NA },
      { t: -800, attach: 'NA', rel: FIT.EU_NA },
      { t: -700, attach: 'NA', rel: FIT.EU_NA },
      { t: -55, attach: 'NA', rel: FIT.EU_NA },
      { t: 0, present: true },
      { t: 50, attach: 'AF', rel: { pos: [47, 85, 0] } },
      { t: 250, attach: 'AF', rel: { pos: [47, 85, 0] } },
      { t: 400, pos: [55, 100, 10] },
      { t: 550, pos: [50, 120, 20] },
      { t: 750, pos: [45, 130, 25] },
      { t: 1000, pos: [40, 140, 30] },
      { t: 1600, pos: [35, 150, 35] },
      { t: 7600, pos: [35, 150, 35] },
    ],
    AN: [
      { t: -3300, pos: [20, -30, 0] },
      { t: -2700, pos: [0, 0, 30] },
      { t: -2200, pos: [-20, 20, 50] },
      ...gond('AN', -1900, -1650),
      { t: -1400, pos: [-50, 80, 30] },
      ...gond('AN', -1100, -800),
      { t: -700, pos: [-20, 70, 140] },
      { t: -620, attach: 'AF', rel: { pos: [-52, 45, -20] } },
      ...gond('AN', -560, -180),
      { t: 0, present: true },
      { t: 100, pos: [-75, 30, 10] },
      { t: 250, pos: [-55, 65, 30] },
      { t: 400, pos: [-50, 100, 40] },
      { t: 550, pos: [-45, 140, 40] },
      { t: 750, attach: 'AU', rel: FIT.AN_AU_AMA },
      { t: 7600, attach: 'AU', rel: FIT.AN_AU_AMA },
    ],
    IN: [
      { t: -3300, pos: [-20, 150, 30] },
      { t: -2700, pos: [-30, 120, 0] },
      { t: -2200, pos: [-10, 80, 30] },
      ...gond('IN', -1900, -1650),
      { t: -1400, pos: [-5, 100, 40] },
      ...gond('IN', -1100, -800),
      { t: -700, pos: [10, 50, 80] },
      { t: -620, attach: 'AF', rel: { pos: [-22, 70, -100] } },
      ...gond('IN', -560, -160),
      { t: -90, pos: [-35, 65, -30] },
      { t: -50, pos: [0, 75, -5] },
      { t: 0, present: true },
      { t: 30, attach: 'EU', rel: FIT.IN_EU },
      { t: 7600, attach: 'EU', rel: FIT.IN_EU },
    ],
    AU: [
      { t: -3300, pos: [-50, 90, 0] },
      { t: -2700, pos: [-40, 150, 20] },
      { t: -2200, pos: [-10, 120, 60] },
      ...gond('AU', -1900, -1650),
      { t: -1400, pos: [-10, 150, 60] },
      ...gond('AU', -1100, -800),
      { t: -700, attach: 'AN', rel: { euler: [-1.5, 37.5, -12.0] } },
      { t: -620, attach: 'AN', rel: { euler: [-1.5, 37.5, -24.0] } },
      ...gond('AU', -560, -80),
      { t: 0, present: true },
      { t: 50, pos: [-12, 130, 10] },
      { t: 100, attach: 'EU', rel: FIT.AU_EU },
      { t: 7600, attach: 'EU', rel: FIT.AU_EU },
    ],
  };
})();
