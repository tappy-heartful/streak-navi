import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '曲募集一覧' }]);
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
  // 管理者ボタンは「受付中」コンテナの直下にあるため、ロジックは変更なし
  utils.isAdmin('Call') ? $('#add-button').show() : $('#add-button').hide();

  // 修正点: リストの参照を新しいIDに変更
  const $activeList = $('#active-list').empty(); // 受付中
  const $closedList = $('#closed-list').empty(); // 期間外

  const callsRef = utils.collection(utils.db, 'calls');
  const qCalls = utils.query(callsRef, utils.orderBy('createdAt', 'desc'));
  const callsSnap = await utils.getWrapDocs(qCalls);

  // 各ステータスごとの配列に振り分け
  const activeItems = []; // 受付中 (未回答/回答済を含む)
  const closedItems = []; // 期間外

  const uid = utils.getSession('uid');

  for (const callDoc of callsSnap.docs) {
    const callData = callDoc.data();
    const callId = callDoc.id;

    // 回答状況による制御
    let status = '';
    let statusClass = '';

    const isActive = utils.isInTerm(
      callData.acceptStartDate,
      callData.acceptEndDate
    );

    if (isActive === false) {
      // 期間外
      status = '期間外';
      statusClass = 'closed';
      closedItems.push(
        makeCallItem(callId, callData.title, status, statusClass)
      );
    } else {
      // 受付中
      const answerId = `${callId}_${uid}`;
      const answerDocRef = utils.doc(utils.db, 'callAnswers', answerId);
      const answerSnap = await utils.getWrapDoc(answerDocRef);

      if (answerSnap.exists()) {
        status = '回答済';
        statusClass = 'answered';
      } else {
        status = '未回答';
        statusClass = 'pending';
      }

      // 受付中のリストに追加 (回答済、未回答の順序を考慮するため、pendingを先に、answeredを後にpushする必要がある)
      if (statusClass === 'pending') {
        activeItems.unshift(
          makeCallItem(callId, callData.title, status, statusClass)
        );
      } else {
        activeItems.push(
          makeCallItem(callId, callData.title, status, statusClass)
        );
      }
    }
  }

  // 1. 受付中の募集を表示 (未回答 → 回答済 の順で表示)
  if (activeItems.length > 0) {
    // activeItemsは既に未回答が先頭に来るように処理済み
    activeItems.forEach((item) => $activeList.append(item));
    $('#active-container').show();
  } else {
    showEmptyMessage($activeList);
    // アイテムがなければ新規作成ボタンを隠す（管理者のisAdmin判定はそのまま）
  }

  // 2. 期間外の募集を表示
  if (closedItems.length > 0) {
    closedItems.forEach((item) => $closedList.append(item));
    $('#closed-container').show();
  } else {
    showEmptyMessage($closedList);
    // $('#closed-container').hide(); // コンテナごと非表示にする場合
  }
}

function makeCallItem(callId, name, status, statusClass) {
  return $(`
    <li>
      <a href="../call-confirm/call-confirm.html?callId=${callId}" class="call-link">
      🎶 ${name}
        <span class="answer-status ${statusClass}">${status}</span>
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="call-link empty">
        該当の曲募集はありません🍀
      </div>
    </li>
  `);
}
