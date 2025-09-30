import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // パンくずリスト
    utils.renderBreadcrumb([
      { title: 'イベント一覧', url: '../event-list/event-list.html' },
      { title: 'イベント確認' },
    ]);

    await renderEvent();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamEventId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

////////////////////////////
// イベントデータ表示
////////////////////////////
async function renderEvent() {
  const eventId = utils.globalGetParamEventId;
  const isAdmin = utils.getSession('isEventAdmin') === utils.globalStrTrue;
  const uid = utils.getSession('uid');

  // events からデータを取得
  const eventSnap = await utils.getDoc(utils.doc(utils.db, 'events', eventId));
  if (!eventSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  const eventData = eventSnap.data();

  // 各項目を反映
  $('#event-date').text(eventData.date || '');
  $('#event-title').text(eventData.title || '');
  // TODO出欠は未実装のまま

  // 場所（リンク有りならリンク化）
  if (eventData.placeUrl) {
    $('#event-place').html(
      `<a href="${
        eventData.placeUrl
      }" target="_blank" rel="noopener noreferrer">
        ${eventData.placeName || eventData.placeUrl}
      </a>`
    );
  } else {
    $('#event-place').text(eventData.placeName || '');
  }

  // 交通アクセス（URLかテキストか判定）
  if (eventData.access) {
    if (/^https?:\/\//.test(eventData.access)) {
      $('#event-access').html(
        `<a href="${eventData.access}" target="_blank" rel="noopener noreferrer">${eventData.access}</a>`
      );
    } else {
      $('#event-access').html(eventData.access.replace(/\n/g, '<br>'));
    }
  } else {
    $('#event-access').text('');
  }

  // 駐車場情報（URLかテキストか判定）
  if (eventData.parking) {
    if (/^https?:\/\//.test(eventData.parking)) {
      $('#event-parking').html(
        `<a href="${eventData.parking}" target="_blank" rel="noopener noreferrer">${eventData.parking}</a>`
      );
    } else {
      $('#event-parking').html(eventData.parking.replace(/\n/g, '<br>'));
    }
  } else {
    $('#event-parking').text('');
  }

  // やる曲
  $('#event-songs').html(eventData.songs?.replace(/\n/g, '<br>') || '');

  // タイムスケジュール
  $('#event-schedule').html(eventData.schedule?.replace(/\n/g, '<br>') || '');

  // 服装
  $('#event-dress').html(eventData.dress?.replace(/\n/g, '<br>') || '');

  // その他
  $('#event-other').html(eventData.other?.replace(/\n/g, '<br>') || '');

  setupEventHandlers(eventId, isAdmin, eventData.isActive, uid);
}

////////////////////////////
// イベント & 表示制御
////////////////////////////
function setupEventHandlers(eventId, isAdmin, isActive, uid) {
  if (!isActive) {
    $('#answer-menu').hide();
  }
  if (!isAdmin) {
    $('#event-menu').hide();
  }

  // 回答する
  $('#answer-save-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../event-answer/event-answer.html?eventId=${eventId}`;
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
          utils.doc(utils.db, 'eventAnswers', `${eventId}_${uid}`)
        );

        await utils.writeLog({
          dataId: eventId,
          action: '回答削除',
          uid: uid,
        });

        utils.hideSpinner();
        await utils.showDialog('回答を取り消しました', true);
        window.location.reload();
      } catch (e) {
        await utils.writeLog({
          dataId: eventId,
          action: '回答削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        utils.hideSpinner();
      }
    });

  // 投票削除（管理者のみ）
  $('#event-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog(
        '投票と全員の回答を削除しますか？\nこの操作は元に戻せません'
      );
      if (!confirmed) return;

      const dialogResultAgain = await utils.showDialog('本当に削除しますか？');
      if (!dialogResultAgain) return;

      try {
        utils.showSpinner();
        await utils.deleteDoc(utils.doc(utils.db, 'events', eventId));

        const answersSnap = await utils.getDocs(
          utils.collection(utils.db, 'eventAnswers')
        );
        for (const doc of answersSnap.docs) {
          if (doc.id.startsWith(eventId + '_')) {
            await utils.deleteDoc(utils.doc(utils.db, 'eventAnswers', doc.id));
          }
        }

        // ログ登録
        await utils.writeLog({ dataId: eventId, action: '投票削除' });
        utils.hideSpinner();
        await utils.showDialog('削除しました', true);
        window.location.href = '../event-list/event-list.html';
      } catch (e) {
        // ログ登録
        await utils.writeLog({
          dataId: eventId,
          action: '投票削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        // スピナー非表示
        utils.hideSpinner();
      }
    });

  // 編集
  $('#event-edit-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../event-edit/event-edit.html?mode=edit&eventId=${eventId}`;
    });

  // コピー
  $('#event-copy-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../event-edit/event-edit.html?mode=copy&eventId=${eventId}`;
    });
}
