import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  await utils.initDisplay();
  await loadVotes();
  setupEventHandlers();
  utils.hideSpinner();
});

async function loadVotes() {
  // votes を createdAt 順で取得
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  // タブごとのUL
  const pendingList = document.querySelector('[data-tab-content="pending"]');
  const votedList = document.querySelector('[data-tab-content="voted"]');
  const closedList = document.querySelector('[data-tab-content="closed"]');

  // 初期化
  pendingList.innerHTML = '';
  votedList.innerHTML = '';
  closedList.innerHTML = '';

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    const voteId = voteDoc.id;

    // isActive=false → 終了タブ
    if (voteData.isActive === false) {
      closedList.appendChild(makeVoteItem(voteId, voteData.name));
      continue;
    }

    // 投票済みか確認
    const answerId = `${utils.getSession('uid')}_${voteId}`;
    const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
    const answerSnap = await utils.getDoc(answerDocRef);

    if (answerSnap.exists()) {
      // 投票済み
      votedList.appendChild(makeVoteItem(voteId, voteData.name));
    } else {
      // 未投票
      pendingList.appendChild(makeVoteItem(voteId, voteData.name));
    }
  }
}

function makeVoteItem(voteId, name) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `../vote-confirm/vote-confirm.html?voteId=${voteId}`;
  a.className = 'vote-link';
  a.textContent = '📝' + name;
  li.appendChild(a);
  return li;
}

function setupEventHandlers() {
  // タブ切り替え処理
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      document
        .querySelectorAll('.tab')
        .forEach((b) => b.classList.remove('active'));
      document
        .querySelectorAll('[data-tab-content]')
        .forEach((c) => c.classList.add('hidden'));

      button.classList.add('active');
      const target = button.dataset.tab;
      document
        .querySelector(`[data-tab-content="${target}"]`)
        .classList.remove('hidden');
    });
  });
}
