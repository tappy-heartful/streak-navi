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
  // 管理者ボタンは「受付中」コンテナの直下にあるため、表示/非表示のロジックは変更なし
  utils.getSession('isVoteAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();

  // 修正点: リストの参照を新しいIDに変更
  const $activeList = $('#active-list').empty(); // 受付中
  const $closedList = $('#closed-list').empty(); // 期間外

  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  // ステータスごとの配列に振り分け
  const activeItems = []; // 受付中 (未回答/回答済を含む)
  const closedItems = []; // 期間外

  const uid = utils.getSession('uid');

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
      // 期間外
      status = '期間外';
      statusClass = 'closed';
      closedItems.push(
        makeVoteItem(voteId, voteData.name, status, statusClass)
      );
    } else {
      // 受付中
      const answerId = `${voteId}_${uid}`;
      const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
      const answerSnap = await utils.getDoc(answerDocRef);

      if (answerSnap.exists()) {
        status = '回答済';
        statusClass = 'answered';
      } else {
        status = '未回答';
        statusClass = 'pending';
      }

      // 受付中のリストに追加
      activeItems.push(
        makeVoteItem(voteId, voteData.name, status, statusClass)
      );
    }
  }

  // 1. 受付中の投票を表示
  if (activeItems.length > 0) {
    // 回答状況で並び替え: 未回答 → 回答済
    // このロジックは振り分け時に行われているため、そのまま追加
    activeItems.forEach((item) => $activeList.append(item));
  } else {
    // 0件メッセージを表示
    showEmptyMessage($activeList);
  }

  // 2. 期間外の投票を表示
  if (closedItems.length > 0) {
    closedItems.forEach((item) => $closedList.append(item));
    // 期間外コンテナを表示
    $('#closed-container').show();
  } else {
    // 0件メッセージを表示
    showEmptyMessage($closedList);
    // アイテムがなければコンテナを非表示にしたい場合:
    // $('#closed-container').hide();
  }
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
  // 期間外コンテナのメッセージと共通化
  $list.append(`
    <li class="empty-message">
      <div class="vote-link empty">
        該当の投票はありません🍀
      </div>
    </li>
  `);
}
