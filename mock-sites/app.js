const slowToggle = document.getElementById('slowToggle');
const slowPanel = document.getElementById('slowPanel');
let slowOn = false;

const originalTitles = new Map();
const blindStories = {
  '붉은 도시의 게임': '벼랑 끝에 몰린 사람들이 목숨을 건 선택 앞에 선다.',
  '연인의 계절': '서로를 이해하지 못했던 두 사람이 마지막 계절을 함께 보낸다.',
  '학교의 그림자': '닫힌 교실 안에서 오래 묻힌 비밀이 다시 말을 걸어온다.',
  '마지막 생존자': '끝났다고 믿은 세계에서 한 사람이 조용히 불빛을 찾는다.',
  '비밀의 집': '문이 잠길 때마다 가족의 기억은 조금씩 다른 이야기가 된다.',
  '새벽의 버스': '매일 같은 정류장에 멈추는 버스는 사라진 사람의 목소리를 싣고 온다.',
  '작은 극장의 밤': '관객 세 명뿐인 밤, 무대 위 배우는 평생 숨긴 고백을 시작한다.',
  '물가의 노래': '흐르는 물가에서 오래 잊힌 노래가 누군가의 이름을 부른다.',
  '유리 정원': '깨지기 쉬운 공간 안에서 두 사람은 서로를 다치게 하지 않는 법을 배운다.',
  '흰 방': '아무것도 없는 방에 갇힌 사람은 기억 하나로 하루를 버틴다.',
  '종이달': '접힌 종이 위에 그려진 달은 누구에게도 도착하지 못한 편지를 비춘다.',
  '푸른 골목': '좁은 골목 끝에서 오래된 도시의 가장 작은 기적이 열린다.',
  '달빛 창고': '버려진 창고 안에서 한밤의 물건들이 주인을 기다린다.',
  '긴 침묵': '말하지 못한 시간이 길어질수록, 두 사람의 침묵은 더 크게 들린다.',
  '낡은 테이프': '재생 버튼을 누르는 순간, 잊힌 목소리가 현재를 다시 흔든다.'
};

function saveOriginalTitles() {
  document.querySelectorAll('.card').forEach(card => {
    const title = card.dataset.title;
    const h3 = card.querySelector('h3');
    if (title && h3) originalTitles.set(card, h3.textContent);
  });
}

function shuffleAllCards() {
  const allRows = [...document.querySelectorAll('.row:not(.top-row) .cards')];
  const allCards = allRows.flatMap(row => [...row.querySelectorAll('.card')]);
  const shuffled = [...allCards].sort(() => Math.random() - 0.5);

  allRows.forEach(row => row.innerHTML = '');
  shuffled.forEach((card, index) => {
    const targetRow = allRows[index % allRows.length];
    targetRow.appendChild(card);
  });
}

function restoreOriginalOrder() {
  window.location.reload();
}

function activateBlindMode() {
  document.querySelectorAll('.card').forEach(card => {
    const title = card.dataset.title;
    const h3 = card.querySelector('h3');
    if (h3) h3.textContent = blindStories[title] || '아직 발견되지 않은 이야기가 조용히 기다리고 있다.';
  });
}

function activateSlowBro() {
  slowOn = true;
  document.body.classList.add('slow-on');
  slowToggle.textContent = 'SlowBro ON';
  slowPanel.classList.remove('hidden');
  shuffleAllCards();
  activateBlindMode();
}

function deactivateSlowBro() {
  restoreOriginalOrder();
}

saveOriginalTitles();

slowToggle.addEventListener('click', () => {
  if (!slowOn) activateSlowBro();
  else deactivateSlowBro();
});
