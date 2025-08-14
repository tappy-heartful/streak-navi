import * as utils from '../common/functions.js';

$(document).ready(async function () {
  await utils.initDisplay();
  await setUpPage();
  utils.hideSpinner();
});

async function setUpPage() {
  const $list = $('#vote-list').empty();

  // セクション作成
  const $pendingSection = $('<div class="vote-section"></div>').append(
    '<h2 class="section-title">📌未投票</h2>'
  );
  const $votedSection = $('<div class="vote-section"></div>').append(
    '<h2 class="section-title">✅投票済</h2>'
  );
  const $closedSection = $('<div class="vote-section"></div>').append(
    '<h2 class="section-title">⏳期間外</h2>'
  );

  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  if (votesSnap.empty) {
    showEmptyMessage($list);
    return;
  }

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    const voteId = voteDoc.id;
    const $item = makeVoteItem(voteId, voteData.name);

    if (voteData.isActive === false) {
      $closedSection.append($item);
    } else {
      const answerId = `${voteId}_${utils.getSession('uid')}`;
      const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
      const answerSnap = await utils.getDoc(answerDocRef);

      if (answerSnap.exists()) {
        $votedSection.append($item);
      } else {
        $pendingSection.append($item);
      }
    }
  }

  // 各セクションが空でなければ追加
  if ($pendingSection.find('li').length) $list.append($pendingSection);
  if ($votedSection.find('li').length) $list.append($votedSection);
  if ($closedSection.find('li').length) $list.append($closedSection);

  utils.getSession('voteAdminFlg') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();
}

function makeVoteItem(voteId, name) {
  return $(`
    <li>
      <a href="../vote-confirm/vote-confirm.html?voteId=${voteId}" class="vote-link">
        📝${name}
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="vote-link empty">
        該当の投票はありません🍀
      </div>
    </li>
  `);
}
