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

  s2_1: {
    title: '얼음 다리의 파수꾼', region: 2,
    lines: [
      { who: 'narration', text: '서리 고개. 협곡 위에 걸린 얼음 다리 두 개만이 대종으로 가는 길이었다.' },
      { who: 'kara', mood: 'worried', text: '으, 추워…! 언니, 다리 위에 누가 있어.' },
      { who: 'sio', mood: 'normal', text: '멈춰. 더 오면 쏜다.' },
      { who: 'sera', mood: 'normal', text: '저희는 솔빛 마을에서 왔어요. 안개의 근원을 찾아 대종으로 가는 길이에요.' },
      { who: 'sio', mood: 'normal', text: '…대종. 안개는 거기서 온다.' },
      { who: 'narration', text: '그때 협곡 아래에서 하얀 늑대 떼가 몰려왔다. 털끝이 모두 고드름이었다.' },
      { who: 'sio', mood: 'worried', text: '서리 늑대. 빠르다. 얼음은 잘 안 먹힌다.' },
      { who: 'kara', mood: 'happy', text: '그럼 불이지! 그리고 이 종으로 느리게 만들면 돼!' },
      { who: 'sio', mood: 'normal', text: '…같이 막는다. 이름은 시오.' },
    ],
  },

  s2_5: {
    title: '보이지 않는 그림자', region: 2,
    lines: [
      { who: 'narration', text: '수정 동굴 안은 푸른빛으로 반짝였지만, 그림자가 소리 없이 지나갔다.' },
      { who: 'sera', mood: 'worried', text: '지금… 뭔가 지나가지 않았어요?' },
      { who: 'sio', mood: 'normal', text: '서리 망령. 눈에 안 보인다. 등불 빛이 닿아야 보인다.' },
      { who: 'sera', mood: 'normal', text: '성소의 빛이나 제 등불이 닿으면 모습을 드러낼 거예요. 폭발이나 파동 같은 공격은 보이지 않아도 맞고요.' },
      { who: 'sio', mood: 'worried', text: '…동생도 이런 눈보라 속에서 사라졌다. 이름은 하루. 열두 살.' },
      { who: 'sera', mood: 'worried', text: '시오 씨…' },
      { who: 'sio', mood: 'normal', text: '안개 속 어딘가에 있다. 그렇게 믿는다. 그러니까 멈출 수 없다.' },
      { who: 'sera', mood: 'happy', text: '대종을 고치면 안개에 삼켜진 것들도 돌아올지 몰라요. 같이 찾아요.' },
    ],
  },

  s2_end: {
    title: '녹기 시작한 산', region: 2,
    lines: [
      { who: 'narration', text: '흰뿔이 쓰러지자, 꽁꽁 얼어 있던 정상에 처음으로 물방울이 떨어졌다.' },
      { who: 'sio', mood: 'worried', text: '흰뿔은 이 산의 주인이었다. 아버지 같은… 산이었다.' },
      { who: 'kara', mood: 'normal', text: '안개가 울림을 빼앗아서 그렇게 된 거잖아. 흰뿔 잘못이 아니야.' },
      { who: 'sera', mood: 'happy', text: '봐요, 얼음이 녹고 있어요. 울림이 돌아오고 있는 거예요.' },
      { who: 'sio', mood: 'normal', text: '…하루를 찾을 때까지. 그때까지 같이 간다.' },
      { who: 'kara', mood: 'happy', text: '좋아! 수호대가 셋이 됐다!' },
      { who: 'narration', text: '고개 너머로 붉은 협곡이 보였다. 바람에 실려 모래와 불씨가 날아왔다.' },
    ],
  },

  s3_1: {
    title: '협곡의 발명가', region: 3,
    lines: [
      { who: 'narration', text: '붉은 협곡. 뜨거운 모래바람 속에서 누군가 소리쳤다.' },
      { who: 'zena', mood: 'worried', text: '거기 누구 있어요?! 약탈자들이 제 장치를 다 빼앗아 갔어요! 저는 덤으로 묶어 놨고요!' },
      { who: 'kara', mood: 'normal', text: '기다려, 지금 풀어 줄게!' },
      { who: 'zena', mood: 'happy', text: '살았다! 저는 제나, 떠돌이 발명가예요. 공명석으로 움직이는 번개 장치를 만들죠. 아, 이건 번개 드론 3호!' },
      { who: 'sio', mood: 'normal', text: '…말이 많다.' },
      { who: 'zena', mood: 'happy', text: '선배는 말이 적네요! 균형이 딱 맞아요!' },
      { who: 'narration', text: '모래 너머에서 불도마뱀과 열풍 독수리가 몰려왔다.' },
      { who: 'zena', mood: 'normal', text: '저 도마뱀들은 불이 전혀 안 통해요. 얼음이나 번개로! 하늘의 독수리는 바람 포탑이면 두 배로 아플 거예요.' },
      { who: 'sera', mood: 'happy', text: '같이 가요, 제나 씨. 대종을 고치려면 발명가가 꼭 필요할 거예요.' },
    ],
  },

  s3_end: {
    title: '울림의 빈자리', region: 3,
    lines: [
      { who: 'narration', text: '용암 벌레왕이 협곡 깊은 곳으로 잠들자, 끓어오르던 땅이 조용해졌다.' },
      { who: 'zena', mood: 'normal', text: '안개 표본을 분석해 봤어요. 놀라운 결과가 나왔어요.' },
      { who: 'zena', mood: 'worried', text: '안개는 뭔가가 "있는" 게 아니에요. 울림이 "없는" 거예요. 소리의 반대, 빈자리 그 자체.' },
      { who: 'sera', mood: 'worried', text: '빈자리… 그래서 등불을 향해 오는 거군요. 채워지고 싶어서.' },
      { who: 'zena', mood: 'happy', text: '그러니까 대종의 금을 메우면 돼요! 여섯 울림을 하나로 이어 줄 이음쇠를 만들면!' },
      { who: 'sio', mood: 'normal', text: '여섯… 우리는 아직 넷이다.' },
      { who: 'kara', mood: 'happy', text: '그럼 더 모으면 되지! 다음은 바다 쪽이야!' },
    ],
  },
};
