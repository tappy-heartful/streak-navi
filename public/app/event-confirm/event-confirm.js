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
  // eventAnswers から自分の回答取得
  const myAnswerData = await utils.getDoc(
    utils.doc(utils.db, 'eventAnswers', `${eventId}_${uid}`)
  );
  const myAnswer = myAnswerData?.data()?.status || '';

  // 各項目を反映
  let statusClass = '';
  let statusText = '';

  // 日付判定（終了の追加）
  const now = new Date(); // 現在日時
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 今日0:00

  const [year, month, day] = (eventData.date || '').split('.').map(Number);
  const eventDateObj = new Date(year, month - 1, day);
  const isPast = eventDateObj < todayOnly;

  if (isPast) {
    // 終了
    statusClass = 'closed';
    statusText = '終了';
  } else if (!eventData.attendance) {
    // 回答受付なし
    statusClass = 'closed';
    statusText = '回答を受け付けてません';
  } else if (myAnswer) {
    // 回答済
    statusClass = 'answered';
    statusText = '回答済';
  } else {
    // 未回答
    statusClass = 'pending';
    statusText = '未回答';
  }

  $('#answer-status-label')
    .removeClass('pending answered closed')
    .addClass(statusClass)
    .text(statusText);

  $('#event-date').text(eventData.date || '');
  $('#event-title').text(eventData.title || '');

  // 出欠
  if (eventData.attendance) {
    // ステータス一覧取得
    const statusesSnap = await utils.getDocs(
      utils.collection(utils.db, 'attendanceStatuses')
    );
    const statuses = statusesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 回答一覧取得
    const answersSnap = await utils.getDocs(
      utils.collection(utils.db, 'eventAnswers')
    );
    const answers = answersSnap.docs
      .filter((doc) => doc.id.startsWith(eventId + '_'))
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    // 全ユーザ情報取得
    const usersSnap = await utils.getDocs(utils.collection(utils.db, 'users'));
    const users = {};
    usersSnap.docs.forEach((doc) => {
      users[doc.id] = doc.data();
    });

    // 出欠エリアをクリア
    const $container = $('#event-attendance');
    $container.empty();

    // ステータスごとに表示
    for (const status of statuses) {
      const $statusBlock = $(`
      <div class="attendance-status-block">
        <h3>${status.name}</h3>
        <div class="attendance-users" id="status-${status.id}"></div>
      </div>
    `);

      // このステータスに該当するユーザを追加
      const filteredAnswers = answers.filter((ans) => ans.status === status.id);

      if (filteredAnswers.length === 0) {
        $statusBlock
          .find('.attendance-users')
          .append('<p class="no-user">該当者なし</p>');
      } else {
        for (const ans of filteredAnswers) {
          const uid = ans.id.replace(eventId + '_', '');
          const user = users[uid];
          if (!user) continue;

          const $userItem = $(`
          <div class="attendance-user">
            <img src="${user.pictureUrl}" alt="${user.displayName}" />
            <span>${user.displayName}</span>
          </div>
        `);

          $statusBlock.find('.attendance-users').append($userItem);
        }
      }

      $container.append($statusBlock);
    }
  } else {
    $('#event-attendance').addClass('label-value').text('受け付けない');
  }

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

  // 🔽 回答メニュー制御
  if (!eventData.attendance || isPast) {
    $('#answer-menu').hide();
  } else {
    if (myAnswer) {
      $('#answer-save-button').text('回答を修正する');
    } else {
      $('#answer-save-button').text('回答する');
      $('#answer-delete-button').hide();
    }
  }

  // 🔽 管理者用メニュー制御
  if (!isAdmin) {
    $('#event-menu').hide();
  }

  setupEventHandlers(eventId, isAdmin, eventData.attendance, uid);
}

////////////////////////////
// イベント & 表示制御
////////////////////////////
function setupEventHandlers(eventId, uid) {
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
