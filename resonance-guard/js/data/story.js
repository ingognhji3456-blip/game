'use strict';

/* =========================================================
 * 이야기 장면 — 설계: docs/design/story.md
 * who: 영웅 id | 'elder' | 'bellkeeper' | 'haru' | 'narration'
 * mood: normal | happy | worried
 * ========================================================= */

RG.data.speakers = {
  narration: { name: '' },
  kara: { name: '카라' }, sera: { name: '세라' }, sio: { name: '시오' }, zena: { name: '제나' }, bawi: { name: '바위' }, yaro: { name: '야로' },
  elder: { name: '모아 할머니' }, bellkeeper: { name: '종지기' }, haru: { name: '하루' },
};

RG.data.story = {
  prologue: {
    title: '등불 축제의 밤', region: 1,
    lines: [
      { who: 'narration', text: '솔빛 마을의 등불 축제. 일 년 중 가장 밝은 밤이었다.' },
      { who: 'kara', mood: 'happy', text: '세라 언니! 올해 장식은 내가 다 달았어. 이 정도면 대종까지 보이겠지?' },
      { who: 'sera', mood: 'happy', text: '응, 예쁘다. …카라, 그런데 저쪽 들판 좀 봐.' },
      { who: 'narration', text: '들판 끝에서 잿빛 안개가 소리 없이 밀려오고 있었다. 안개가 닿은 풀은 색을 잃었다.' },
      { who: 'elder', mood: 'worried', text: '저건… 옛이야기에 나오던 잿빛 안개로구나. 울림을 지워 버린다는.' },
      { who: 'kara', mood: 'worried', text: '안개 속에서 뭔가 움직여요! 쥐…? 멧돼지?' },
      { who: 'elder', mood: 'normal', text: '울림등을 지켜야 한다. 등불이 꺼지면 마을도 안개에 잠기려무나.' },
      { who: 'kara', mood: 'normal', text: '사냥꾼 아저씨들 망루가 마을 어귀에 있잖아요. 내가 고쳐서 다시 세울게요!' },
      { who: 'sera', mood: 'worried', text: '혼자 가면 안 돼. 나는 등불 곁에 있을게. 무슨 일 있으면 바로 불러.' },
      { who: 'kara', mood: 'happy', text: '걱정 마! 오늘부터 우리가 진짜 공명 수호대야!' },
    ],
  },

  s1_2: {
    title: '물레방아의 김', region: 1,
    lines: [
      { who: 'narration', text: '안개는 물레방아 언덕까지 번져 있었다.' },
      { who: 'sera', mood: 'normal', text: '스승님이 남긴 서리 결정을 가져왔어. 차가운 울림이 담겨 있대.' },
      { who: 'kara', mood: 'normal', text: '그럼 이걸 궁수탑 옆에 세워 볼까?' },
      { who: 'narration', text: '서리 결정탑을 궁수탑 옆에 세우자, 두 탑 사이로 하얀 김이 피어올랐다.' },
      { who: 'kara', mood: 'worried', text: '으앗, 김이 나! 망가진 거야?' },
      { who: 'sera', mood: 'happy', text: '아니야. 불과 얼음의 울림이 서로 맞물린 거야. 스승님 일지에 있던 "공명"이 이거구나.' },
      { who: 'sera', mood: 'normal', text: '다른 울림을 가진 탑끼리 붙여 세우면 서로 힘을 보태 줘. 어떤 짝이냐에 따라 효과가 달라.' },
      { who: 'kara', mood: 'happy', text: '좋아! 여러 가지를 섞어 보자. 하늘에서 오는 까마귀도 조심하고!' },
    ],
  },

  s1_4: {
    title: '스승의 일지', region: 1,
    lines: [
      { who: 'sera', mood: 'worried', text: '카라, 스승님 일지의 마지막 장을 찾았어.' },
      { who: 'sera', mood: 'normal', text: '"대종에 금이 가면 안개가 흐른다. 등불을 지키는 자는 대종으로 가라."' },
      { who: 'kara', mood: 'normal', text: '대종… 땅 한가운데 있다는 그 큰 종?' },
      { who: 'sera', mood: 'normal', text: '응. 그래서 나도 이제 등불 곁에만 있지 않을래. 수호대로 같이 갈게.' },
      { who: 'kara', mood: 'happy', text: '정말? 언니가 같이 가면 백 배는 든든하지!' },
      { who: 'narration', text: '반딧불 습지는 길이 사라질 만큼 안개가 짙었다. 넓은 공터만 남아 있었다.' },
      { who: 'sera', mood: 'normal', text: '길이 없으면 우리가 만들면 돼. 공터에 탑을 세우면 적은 그걸 피해 돌아가야 하니까.' },
      { who: 'kara', mood: 'happy', text: '돌아가는 동안 실컷 때려 주면 되겠네! 아, 수정 광산도 지어 두자. 골드가 필요해.' },
    ],
  },

  s1_6: {
    title: '속 빈 고목', region: 1,
    lines: [
      { who: 'narration', text: '고목의 숲. 솔빛 마을을 백 년 넘게 지켜 온 수호목이 서 있던 곳.' },
      { who: 'kara', mood: 'worried', text: '언니… 수호목이 움직여. 줄기 안이 텅 비었어.' },
      { who: 'sera', mood: 'worried', text: '안개가 울림을 다 빼앗아 간 거야. 이제는 등불을 향해 걸어오고 있어.' },
      { who: 'kara', mood: 'normal', text: '어릴 때 저 나무 아래서 맨날 놀았는데.' },
      { who: 'sera', mood: 'normal', text: '…그러니까 우리가 멈춰 줘야 해. 수호목도 마을을 해치고 싶진 않을 거야.' },
      { who: 'kara', mood: 'normal', text: '응. 불이 잘 들 거야. 덩굴 거머리를 불러내니까 그것도 같이 막자.' },
    ],
  },

  s1_end: {
    title: '작은 새싹', region: 1,
    lines: [
      { who: 'narration', text: '쓰러진 고목의 빈 줄기 속에서, 작은 초록 새싹 하나가 돋아 있었다.' },
      { who: 'sera', mood: 'happy', text: '울림이… 조금 남아 있었나 봐.' },
      { who: 'elder', mood: 'happy', text: '이 새싹은 마을에 심어 두마. 너희가 돌아올 때쯤이면 제법 자라 있겠지.' },
      { who: 'kara', mood: 'normal', text: '할머니, 우리 대종에 다녀올게요. 안개가 어디서 오는지 알아내서 막아야죠.' },
      { who: 'elder', mood: 'worried', text: '서리 고개를 넘어야 할 게다. 몸 조심하려무나.' },
      { who: 'sera', mood: 'normal', text: '이제 탑을 더 크게 키울 수 있어요. 한 탑을 두 갈래 중 하나로 다듬는 법을 스승님이 적어 두셨거든요.' },
      { who: 'kara', mood: 'happy', text: '분기 강화! 좋아, 출발이다!' },
    ],
  },
};
