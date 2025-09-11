import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
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
  const $list = $('#call-list').empty();

  const callsRef = utils.collection(utils.db, 'calls');
  const qCalls = utils.query(callsRef, utils.orderBy('createdAt', 'desc'));
  const callsSnap = await utils.getDocs(qCalls);

  if (callsSnap.empty) {
    showEmptyMessage($list);
    return;
  }

  // 各ステータスごとの配列に振り分け
  const pendingItems = [];
  const calledItems = [];
  const closedItems = [];

  for (const callDoc of callsSnap.docs) {
    const callData = callDoc.data();
    const callId = callDoc.id;

    pendingItems.push(
      makeCallItem(callId, callData.title, '未回答', 'pending')
    );

    // TODO 回答状況による制御
    // let status = '';
    // let statusClass = '';

    // if (callData.isActive === false) {
    //   status = '終了';
    //   statusClass = 'closed';
    //   closedItems.push(
    //     makeCallItem(callId, callData.name, status, statusClass)
    //   );
    // } else {
    //   const answerId = `${callId}_${utils.getSession('uid')}`;
    //   const answerDocRef = utils.doc(utils.db, 'callAnswers', answerId);
    //   const answerSnap = await utils.getDoc(answerDocRef);

    //   if (answerSnap.exists()) {
    //     status = '回答済';
    //     statusClass = 'called';
    //     calledItems.push(
    //       makeCallItem(callId, callData.name, status, statusClass)
    //     );
    //   } else {
    //     status = '未回答';
    //     statusClass = 'pending';
    //     pendingItems.push(
    //       makeCallItem(callId, callData.name, status, statusClass)
    //     );
    //   }
    // }
  }

  // 表示順: 未回答 → 回答済 → 終了
  pendingItems.forEach((item) => $list.append(item));
  calledItems.forEach((item) => $list.append(item));
  closedItems.forEach((item) => $list.append(item));

  utils.getSession('isCallAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();
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
