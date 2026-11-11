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
  dohan: { name: '도한' }, narae: { name: '나래' }, tori: { name: '토리' }, byeori: { name: '별이' }, mujin: { name: '무진' },
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

  s4_1: {
    title: '일어선 절벽', region: 4,
    lines: [
      { who: 'narration', text: '폭풍 해안. 난파선 사이로 파도가 부서지고, 하늘에서는 물보라 요정이 떼 지어 날았다.' },
      { who: 'zena', mood: 'worried', text: '으앗, 하늘에서도 와요! 바위게는 단단하고… 어디 숨을 데 없나요?!' },
      { who: 'narration', text: '그때, 해안 절벽 하나가 천천히 몸을 일으켰다. 이끼와 작은 꽃이 핀 거대한 돌이었다.' },
      { who: 'bawi', mood: 'normal', text: '허허… 오래 잤구려. 등불 냄새에 눈을 떴소.' },
      { who: 'kara', mood: 'worried', text: '바위가… 말을 해?!' },
      { who: 'bawi', mood: 'happy', text: '나는 바위요. 대종이 처음 울리던 날 태어났지. 그 울림이 그리워 바다를 지키며 잠들어 있었소.' },
      { who: 'sera', mood: 'normal', text: '대종에 금이 가서 안개가 흘러나와요. 저희는 그걸 고치러 가는 길이에요.' },
      { who: 'bawi', mood: 'normal', text: '…그랬구려. 그렇다면 이 늙은 돌도 함께 가겠소. 앞은 내가 막으리다.' },
    ],
  },

  s4_end: {
    title: '대종과 종지기', region: 4,
    lines: [
      { who: 'narration', text: '폭풍 고래가 하늘 너머로 사라지자 먹구름이 걷히고, 바다 건너 땅의 심장이 보였다.' },
      { who: 'bawi', mood: 'normal', text: '저기가 대종이 있는 곳이오. 옛날엔 백 년에 한 번, 온 땅이 함께 울렸지.' },
      { who: 'bawi', mood: 'worried', text: '대종을 지키는 종지기 가문이 있었소. 마지막 종지기는… 내 오랜 친구였지.' },
      { who: 'sera', mood: 'worried', text: '그분은 지금 어디에 계세요?' },
      { who: 'bawi', mood: 'worried', text: '종에 금이 간 날, 자기가 지키지 못했다며 몹시 슬퍼했다고 들었소. 그 뒤로는 소식이 없소.' },
      { who: 'zena', mood: 'normal', text: '이음쇠 설계는 거의 끝났어요. 이제 대종 앞까지만 가면 돼요.' },
      { who: 'kara', mood: 'normal', text: '가자. 마지막 지역이야.' },
    ],
  },

  s5_1: {
    title: '그림자의 배신자', region: 5,
    lines: [
      { who: 'narration', text: '회색 평원. 얼굴 없는 회색 군단이 발맞춰 행진하고 있었다.' },
      { who: 'yaro', mood: 'normal', text: '거기 등불 든 녀석들. 그대로 가면 군단 한가운데로 들어간다.' },
      { who: 'kara', mood: 'worried', text: '누구야! 잿빛 교단이지?' },
      { who: 'yaro', mood: 'normal', text: '…였지. 오늘부로 그만뒀어. 침묵이 평화라니, 웃기는 소리야.' },
      { who: 'sio', mood: 'normal', text: '믿을 수 없다.' },
      { who: 'yaro', mood: 'happy', text: '안 믿어도 돼. 대신 하나 알려 주지. 저 수도사들 근처의 탑은 침묵에 빠져. 멀리서 잡아.' },
      { who: 'sera', mood: 'normal', text: '…왜 도와주시는 거예요?' },
      { who: 'yaro', mood: 'worried', text: '그림자는 등불 옆에 있어야 생기는 거니까. 흥, 빨리 끝내자.' },
    ],
  },

  s5_5: {
    title: '스승과 제자', region: 5,
    lines: [
      { who: 'narration', text: '종지기의 문. 거대한 종을 등에 진 회색 인물이 길을 막고 서 있었다.' },
      { who: 'yaro', mood: 'worried', text: '…스승님.' },
      { who: 'bawi', mood: 'worried', text: '저 종 모양 가면… 틀림없소. 마지막 종지기요.' },
      { who: 'bellkeeper', mood: 'normal', text: '돌아왔느냐, 야로. 등불 따위를 들고서.' },
      { who: 'bellkeeper', mood: 'normal', text: '종은 깨졌노라. 울림은 다툼과 슬픔을 낳을 뿐. 이제 모두 고요해지면 되느니라.' },
      { who: 'yaro', mood: 'normal', text: '아니야. 스승님은 그냥… 종을 지키지 못한 게 너무 아팠던 거야.' },
      { who: 'kara', mood: 'normal', text: '야로, 같이 가자. 네 스승님은 우리가 같이 멈춰 줄게.' },
      { who: 'yaro', mood: 'normal', text: '…고마워. 그리고 조심해. 스승님은 순간이동을 해.' },
    ],
  },

  s5_5_end: {
    title: '깨진 가면', region: 5,
    lines: [
      { who: 'narration', text: '종지기가 무릎을 꿇었다. 종 모양 가면에 금이 가더니, 조용히 둘로 갈라졌다.' },
      { who: 'bellkeeper', mood: 'worried', text: '…미안하다. 지키지 못한 종 앞에서, 나는 울림을 놓아 버렸느니라.' },
      { who: 'yaro', mood: 'worried', text: '이제 됐어요. 남은 건 우리가 할게요.' },
      { who: 'bellkeeper', mood: 'happy', text: '야로… 등불 곁의 그림자라. 좋은 이름을 얻었구나.' },
      { who: 'bawi', mood: 'normal', text: '쉬게, 친구여. 종은 이 아이들이 다시 울릴 거요.' },
      { who: 'narration', text: '야로는 깨진 가면을 품에 넣었다. 문 너머에서 대종의 심장이 낮게 울렁였다.' },
    ],
  },

  s5_6: {
    title: '여섯 개의 울림', region: 5,
    lines: [
      { who: 'narration', text: '대종의 심장. 금 간 틈에서 잿빛 형체가 천천히 일어섰다. 얼굴 대신 깨진 종의 입구가 있었다.' },
      { who: 'zena', mood: 'worried', text: '측정이 안 돼요… 저건 무언가가 아니라, 울림이 완전히 없는 자리예요.' },
      { who: 'sera', mood: 'normal', text: '침묵. 안개의 근원이에요.' },
      { who: 'sio', mood: 'normal', text: '불, 얼음, 폭풍, 대지, 빛, 어둠. 여섯이 다 있다.' },
      { who: 'bawi', mood: 'normal', text: '한 가지 울림만으로는 저것을 채울 수 없소. 모두 함께 울려야 하오.' },
      { who: 'yaro', mood: 'happy', text: '흥, 한 원소에만 기대면 그때마다 막힌다는 거지. 알겠어.' },
      { who: 'kara', mood: 'happy', text: '좋아! 공명 수호대, 마지막 전투다!' },
    ],
  },

  /* ===================== 6막 · 별울림 첨탑 (확장) ===================== */
  s6_1: {
    title: '구름 위의 대답', region: 6,
    lines: [
      { who: 'narration', text: '대종이 다시 울린 지 사흘째 밤. 종소리가 하늘로 올라가더니, 구름 위에서 대답하듯 맑은 소리가 돌아왔다.' },
      { who: 'zena', mood: 'happy', text: '들었어요? 저건 메아리가 아니에요. 다른 종이에요! 대종이랑 음이 똑같은 쌍둥이 종!' },
      { who: 'elder', mood: 'worried', text: '옛이야기에 하늘에 걸린 별종이 있다고 했지. 그런데… 저기 별이 하나 꺼졌구나.' },
      { who: 'sio', mood: 'worried', text: '땅에서 쫓겨난 안개가 사라진 게 아니었다. 하늘로 올라갔다.' },
      { who: 'haru', mood: 'happy', text: '형! 나도 갈래! 구름 위는 눈이 제일 먼저 오는 데잖아. 나 눈사람 진짜 잘 만들어!' },
      { who: 'sio', mood: 'normal', text: '…위험하다. 그래도 너는 말려도 따라오겠지. 내 옆에서 떨어지지 마라.' },
      { who: 'kara', mood: 'happy', text: '좋아! 하루도 오늘부터 공명 수호대야. 구름 나루로 가자!' },
    ],
  },
  s6_2: {
    title: '하늘 다리의 닻', region: 6,
    lines: [
      { who: 'narration', text: '구름과 구름 사이에는 별빛으로 엮은 다리가 놓여 있었다. 다리는 숨 쉬듯 번갈아 사라졌다 나타났다.' },
      { who: 'dohan', mood: 'normal', text: '다리 닻이 녹슬었군. 별빛은 쇠에 걸어야 오래 버티는 법이다.' },
      { who: 'kara', mood: 'worried', text: '아빠?! 여긴 어떻게 왔어? 대장간은?' },
      { who: 'dohan', mood: 'normal', text: '망치 소리가 하늘까지 들렸다. 네가 두드리는 소리가 아직 서툴러서 말이다.' },
      { who: 'dohan', mood: 'happy', text: '닻은 내가 벼린다. 너희는 다리가 바뀌는 때를 잘 봐라. 깜박이면 곧 닫힌다.' },
      { who: 'kara', mood: 'happy', text: '…응! 아빠 망치 소리, 오랜만이다.' },
    ],
  },
  s6_3: {
    title: '바람새 기수', region: 6,
    lines: [
      { who: 'narration', text: '바람 정원. 구름이 끝나는 곳에서 커다란 하늘색 새가 날아와 내려앉았다.' },
      { who: 'narae', mood: 'happy', text: '안녕! 하늘 나루의 나래야. 얘는 솔개! 너희가 땅에서 종을 울린 애들이구나?' },
      { who: 'narae', mood: 'worried', text: '요즘 바람이 이상해. 성운 해파리들이 별빛을 먹고 떼로 몰려다녀. 죽이면 셋으로 갈라지고.' },
      { who: 'zena', mood: 'happy', text: '분열하는 공중 개체라니! 범위 공격으로 한 번에… 아, 연구는 나중에.' },
      { who: 'narae', mood: 'happy', text: '하늘길은 나한테 맡겨. 막힌 데도 솔개는 곧장 날아가거든!' },
    ],
  },
  s6_4: {
    title: '이끼 숲의 작은 정령', region: 6,
    lines: [
      { who: 'narration', text: '유성 폭포. 떨어진 별똥별이 바위가 되어 쌓이고, 그 틈에 오래된 이끼 숲이 자라 있었다.' },
      { who: 'tori', mood: 'worried', text: '…누구야아. 숲을 밟으면, 아파.' },
      { who: 'bawi', mood: 'happy', text: '오, 이끼 정령이로군. 나와 같은 돌과 이끼의 아이요. 무서워하지 마시오.' },
      { who: 'tori', mood: 'normal', text: '…바위 할아버지 냄새 나. 그럼, 좋은 사람.' },
      { who: 'tori', mood: 'worried', text: '불타는 돌이 숲을 태워. 망령도… 갑자기 앞으로 뛰어.' },
      { who: 'tori', mood: 'happy', text: '…같이 가도 돼? 화나면, 나 숲만큼 커져.' },
    ],
  },
  s6_5: {
    title: '별지기의 기록', region: 6,
    lines: [
      { who: 'narration', text: '별지기의 탑. 계단마다 별의 길을 적은 두루마리가 쌓여 있었다. 꼭대기에서 커다란 안경을 쓴 아이가 망원경을 들여다보고 있었다.' },
      { who: 'byeori', mood: 'worried', text: '아, 안녕하세요… 별이예요. 별이 하나씩 꺼지는 걸 백 일째 기록하고 있어요.' },
      { who: 'byeori', mood: 'normal', text: '계산해 보면… 별종이 멈추는 날, 마지막 별이 꺼져요. 남은 건 엿새.' },
      { who: 'sera', mood: 'normal', text: '스승님 일지에도 하늘의 등불 이야기가 있었어요. 별종이 하늘의 울림등이었구나.' },
      { who: 'byeori', mood: 'happy', text: '그림자 별지기들이 꼭대기 길을 막고 있어요. 그리고 일식 사제들이 그들을 지켜요. 사제부터예요!' },
    ],
  },
  s6_6: {
    title: '별종의 방', region: 6,
    lines: [
      { who: 'narration', text: '첨탑 꼭대기, 별종의 방. 별종 앞에 회보라 두루마기를 입은 노인이 홀로 서서 종메를 쥐고 있었다.' },
      { who: 'yaro', mood: 'worried', text: '…무진 스승님?' },
      { who: 'mujin', mood: 'normal', text: '야로로구나. 대종이 다시 울리는 소리를 들었네. 그래서 나는 여기로 왔지. 이번에는… 지키려고.' },
      { who: 'mujin', mood: 'worried', text: '별빛을 삼킨 것이 오네. 그믐달 군주. 별종이 멈추면 밤하늘이 영영 꺼지네.' },
      { who: 'byeori', mood: 'worried', text: '군주는 가장 많이 맞은 원소를 배워서 막아요! 여러 원소로… 고르게요!' },
      { who: 'kara', mood: 'happy', text: '열두 울림이 다 모였어. 땅의 종도, 하늘의 종도 우리가 지킨다!' },
    ],
  },
  ending2: {
    title: '두 종의 울림', region: 6,
    lines: [
      { who: 'narration', text: '그믐달이 깨지고, 삼켰던 별빛이 쏟아져 나왔다. 무진이 종메를 들어 별종을 두드렸다.' },
      { who: 'narration', text: '하늘의 별종과 땅의 대종이 함께 울렸다. 꺼졌던 별이 하나씩 다시 켜졌다.' },
      { who: 'mujin', mood: 'happy', text: '좋은 울림이었네. 이것은 내 것이 아니라, 모두의 것이지.' },
      { who: 'byeori', mood: 'happy', text: '기록 마지막 줄… "별은 꺼지지 않았다. 열두 울림이 함께 켰다."' },
      { who: 'narae', mood: 'happy', text: '솔개야, 다 같이 태우고 땅까지 내려가자! 축제 해야지!' },
      { who: 'dohan', mood: 'happy', text: '돌아가면 대장간 불부터 지피마. 너희 이름을 종에 새겨 주지.' },
      { who: 'tori', mood: 'happy', text: '…다 같이 해서, 좋아아.' },
      { who: 'haru', mood: 'happy', text: '형! 구름 위에 눈사람 세워 놓고 왔어! 별이 지켜 줄 거야!' },
      { who: 'kara', mood: 'happy', text: '하늘과 땅이 이어졌어. 이제 진짜, 모두 함께야!' },
    ],
  },

  ending: {
    title: '다시 울리는 종', region: 5,
    lines: [
      { who: 'narration', text: '여섯 울림이 하나로 모였다. 카라가 벼린 종메가 제나의 이음쇠를 두드리자, 대종이 다시 울렸다.' },
      { who: 'narration', text: '종소리는 땅끝까지 퍼졌다. 안개가 걷히고, 잿빛 것들은 하나둘 원래 모습으로 돌아갔다.' },
      { who: 'haru', mood: 'happy', text: '형! 시오 형!' },
      { who: 'sio', mood: 'happy', text: '…하루. 늦어서 미안하다. 정말… 다행이다.' },
      { who: 'bawi', mood: 'happy', text: '나는 여기 남겠소. 대종 곁에서 이제 좀 쉬겠소. 백 년 뒤에 또 울려 주시오.' },
      { who: 'yaro', mood: 'normal', text: '교단에 남은 아이들은 내가 데려갈게. 솔빛 마을이면… 등불이 따뜻하니까.' },
      { who: 'zena', mood: 'happy', text: '가설 입증 완료! 여섯 울림은 함께일 때 가장 세다!' },
      { who: 'elder', mood: 'happy', text: '어서들 오려무나. 보아라, 너희가 심고 간 새싹이 이렇게 자랐단다.' },
      { who: 'kara', mood: 'happy', text: '우와… 진짜 나무가 됐어!' },
      { who: 'sera', mood: 'happy', text: '스승님의 일지 마지막 장에 이렇게 적을게요. "등불은 꺼지지 않았다. 여섯 울림이 함께 지켰다."' },
    ],
  },
};
