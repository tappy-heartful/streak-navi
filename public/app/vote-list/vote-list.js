import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([{ title: '投票一覧' }]);
    await setUpPage();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

async function setUpPage() {
  utils.getSession('isVoteAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();

  const $list = $('#vote-list').empty();

  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  if (votesSnap.empty) {
    showEmptyMessage($list);
    return;
  }

  // 各ステータスごとの配列に振り分け
  const pendingItems = [];
  const votedItems = [];
  const closedItems = [];

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    const voteId = voteDoc.id;

    let status = '';
    let statusClass = '';

    const isActive = utils.isInTerm(
      voteData.acceptStartDate,
      voteData.acceptEndDate
    );

    if (isActive === false) {
      status = '期間外';
      statusClass = 'closed';
      closedItems.push(
        makeVoteItem(voteId, voteData.name, status, statusClass)
      );
    } else {
      const answerId = `${voteId}_${utils.getSession('uid')}`;
      const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
      const answerSnap = await utils.getDoc(answerDocRef);

      if (answerSnap.exists()) {
        status = '回答済';
        statusClass = 'answered';
        votedItems.push(
          makeVoteItem(voteId, voteData.name, status, statusClass)
        );
      } else {
        status = '未回答';
        statusClass = 'pending';
        pendingItems.push(
          makeVoteItem(voteId, voteData.name, status, statusClass)
        );
      }
    }
  }

  // 表示順: 未回答 → 回答済 → 終了
  pendingItems.forEach((item) => $list.append(item));
  votedItems.forEach((item) => $list.append(item));
  closedItems.forEach((item) => $list.append(item));
}

function makeVoteItem(voteId, name, status, statusClass) {
  return $(`
    <li>
      <a href="../vote-confirm/vote-confirm.html?voteId=${voteId}" class="vote-link">
        📝 ${name}
        <span class="answer-status ${statusClass}">${status}</span>
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
