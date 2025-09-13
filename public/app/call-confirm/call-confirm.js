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
// 募集データ表示
////////////////////////////
async function renderCall() {
  const callId = utils.globalGetParamCallId;
  const isAdmin = utils.getSession('isCallAdmin') === utils.globalStrTrue;
  const uid = utils.getSession('uid');

  // calls から募集情報を取得
  const callSnap = await utils.getDoc(utils.doc(utils.db, 'calls', callId));
  if (!callSnap.exists()) {
    throw new Error('募集が見つかりません：' + callId);
  }
  const callData = callSnap.data();

  // callAnswers から自分の回答取得
  const myAnswerData = await utils.getDoc(
    utils.doc(utils.db, 'callAnswers', `${callId}_${uid}`)
  );
  const myAnswer = myAnswerData?.data()?.answers || {};

  // 🔽 参加者数をカウント
  const answersSnap = await utils.getDocs(
    utils.collection(utils.db, 'callAnswers')
  );
  const participantCount = answersSnap.docs.filter((doc) =>
    doc.id.startsWith(callId + '_')
  ).length;

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
  $('#call-description').text(callData.description);
  $('#answer-status').text(
    `${callData.isActive ? '受付中' : '終了'}（${participantCount}人が回答中）`
  );
  $('#call-anonymous').text(callData.isAnonymous ? 'はい' : 'いいえ');

  // 募集項目＋回答を表示
  const container = $('#call-items').empty();
  const items = callData.items || [];

  // 全員の回答をまとめて取得
  const answersSnap2 = await utils.getDocs(
    utils.collection(utils.db, 'callAnswers')
  );
  const allAnswers = answersSnap2.docs
    .filter((doc) => doc.id.startsWith(callId + '_'))
    .map((doc) => doc.data());

  for (const genre of items) {
    const genreBlock = $(`<div class="genre-block"></div>`);
    genreBlock.append(`<div class="genre-title">🎵 ${genre}</div>`);

    const genreList = $('<div class="genre-answers"></div>');

    allAnswers.forEach((ans) => {
      const songs = ans.answers?.[genre] || [];
      if (songs.length > 0) {
        // 回答者名（匿名でなければ表示）
        if (!callData.isAnonymous) {
          genreList.append(
            `<div class="answer-user">回答者: ${ans.uid || '(不明)'}</div>`
          );
        }

        songs.forEach((song) => {
          const songHtml = `
            <div class="song-item">
              <div><strong>${song.title}</strong></div>
              ${
                song.url
                  ? `<div>参考音源: <a href="${song.url}" target="_blank">${song.url}</a></div>`
                  : ''
              }
              ${song.scorestatus ? `<div>譜面: ${song.scorestatus}</div>` : ''}
              ${
                song.purchase
                  ? `<div>購入先: <a href="${song.purchase}" target="_blank">${song.purchase}</a></div>`
                  : ''
              }
              ${song.note ? `<div>備考: ${song.note}</div>` : ''}
            </div>
          `;
          genreList.append(songHtml);
        });
      }
    });

    if (genreList.children().length > 0) {
      genreBlock.append(genreList);
    } else {
      genreBlock.append(`<div class="no-answer">（回答なし）</div>`);
    }

    container.append(genreBlock);
  }

  // 🔽 回答メニュー制御
  if (myAnswer && Object.keys(myAnswer).length > 0) {
    $('#answer-save-button').text('回答を修正する');
  } else {
    $('#answer-save-button').text('回答する');
    $('#answer-delete-button').hide();
  }

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
