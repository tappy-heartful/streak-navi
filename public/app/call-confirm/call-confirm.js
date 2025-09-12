import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await renderCall();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamCallId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

////////////////////////////
// 曲募集データ表示
////////////////////////////
async function renderCall() {
  const callId = utils.globalGetParamCallId;
  const isAdmin = utils.getSession('isCallAdmin') === utils.globalStrTrue;
  const uid = utils.getSession('uid');
  const myProfileUrl = utils.getSession('pictureUrl') || '';

  // calls から募集情報を取得
  const callSnap = await utils.getDoc(utils.doc(utils.db, 'calls', callId));
  if (!callSnap.exists()) {
    throw new Error('募集が見つかりません：' + callId);
  }
  const callData = callSnap.data();

  // callAnswers から自分の回答取得（今回は回答状況は考慮しない）
  const myAnswerData = await utils.getDoc(
    utils.doc(utils.db, 'callAnswers', `${callId}_${uid}`)
  );
  const myAnswer = myAnswerData?.data()?.answers || {};

  // 画面に反映
  let statusClass = '';
  let statusText = '';
  if (!callData.isActive) {
    statusClass = 'closed';
    statusText = '終了';
  } else if (myAnswer && Object.keys(myAnswer).length > 0) {
    statusClass = 'voted';
    statusText = '回答済';
  } else {
    statusClass = 'pending';
    statusText = '未回答';
  }
  $('#answer-status-label')
    .removeClass('pending voted closed')
    .addClass(statusClass)
    .text(statusText);
  $('#call-title').text(callData.title);
  $('#call-description').text(callData.explain);
  $('#answer-status').text(callData.isActive ? '受付中' : '終了');
  $('#call-anonymous').text(callData.isAnonymous ? 'はい' : 'いいえ');

  // 募集項目を表示
  const container = $('#call-items').empty(); // #call-items を対象
  const items = callData.items || [];
  items.forEach((item) => {
    const itemHtml = `
    <div class="call-item">
      ${item}
    </div>
  `;
    container.append(itemHtml);
  });

  setupEventHandlers(callId, isAdmin, callData.isActive, uid);
}

////////////////////////////
// イベント & 権限制御
////////////////////////////
function setupEventHandlers(callId, isAdmin, isActive, uid) {
  if (!isActive) {
    $('#answer-menu').hide();
  }
  if (!isAdmin) {
    $('#call-menu').hide();
  }

  // 回答する/修正する
  $('#answer-save-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../call-answer/call-answer.html?callId=${callId}`;
    });

  // 回答削除（自分の回答のみ）
  $('#answer-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog('自分の回答を取り消しますか？');
      if (!confirmed) return;

      try {
        utils.showSpinner();
        await utils.deleteDoc(
          utils.doc(utils.db, 'callAnswers', `${callId}_${uid}`)
        );
        await utils.writeLog({
          dataId: callId,
          action: '回答削除',
          uid: uid,
        });
        utils.hideSpinner();
        await utils.showDialog('回答を取り消しました', true);
        window.location.reload();
      } catch (e) {
        await utils.writeLog({
          dataId: callId,
          action: '回答削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        utils.hideSpinner();
      }
    });

  // 募集削除（管理者のみ）
  $('#call-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog(
        '募集と全員の回答を削除しますか？\nこの操作は元に戻せません'
      );
      if (!confirmed) return;

      const confirmedAgain = await utils.showDialog('本当に削除しますか？');
      if (!confirmedAgain) return;

      try {
        utils.showSpinner();
        await utils.deleteDoc(utils.doc(utils.db, 'calls', callId));

        // 回答も削除
        const answersSnap = await utils.getDocs(
          utils.collection(utils.db, 'callAnswers')
        );
        for (const doc of answersSnap.docs) {
          if (doc.id.startsWith(callId + '_')) {
            await utils.deleteDoc(utils.doc(utils.db, 'callAnswers', doc.id));
          }
        }

        await utils.writeLog({ dataId: callId, action: '募集削除' });
        utils.hideSpinner();
        await utils.showDialog('削除しました', true);
        window.location.href = '../call-list/call-list.html';
      } catch (e) {
        await utils.writeLog({
          dataId: callId,
          action: '募集削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        utils.hideSpinner();
      }
    });

  // 編集
  $('#call-edit-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../call-edit/call-edit.html?mode=edit&callId=${callId}`;
    });

  // コピー
  $('#call-copy-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../call-edit/call-edit.html?mode=copy&callId=${callId}`;
    });
}
