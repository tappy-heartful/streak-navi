import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // パンくずリストをカスタム通知用に調整
    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      { title: 'カスタム通知確認' },
    ]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetparams.get('noticeId') || 'none',
      action: 'カスタム通知確認初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  const noticeId = utils.globalGetparams.get('noticeId');

  if (!noticeId) {
    utils.showDialog('通知IDが見つかりません。', true);
    window.location.href = '../notice-list/notice-list.html';
    return;
  }

  $('#page-title').text('カスタム通知の確認');
  await loadCustomNotice(noticeId);

  $('#edit-button').on('click', () => {
    // 編集画面への遷移
    window.location.href = `../notice-custom-edit/notice-custom-edit.html?mode=edit&noticeId=${noticeId}`;
  });

  // 💡 【追加】コピーボタンのイベントハンドラ
  $('#copy-button').on('click', async () => {
    // コピーはnoticeIdを付けて編集画面へ遷移させる
    window.location.href = `../notice-custom-edit/notice-custom-edit.html?mode=new&noticeId=${noticeId}`;
  });

  $('#delete-button').on('click', async () => {
    const confirm = await utils.showDialog('この通知設定を削除しますか？');
    if (!confirm) return;

    utils.showSpinner();
    try {
      await utils.deleteDoc(utils.doc(utils.db, 'notices', noticeId));
      await utils.showDialog('削除しました', true);
      window.location.href = '../notice-list/notice-list.html';
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('削除に失敗しました');
    }
  });
}

// カスタム通知の読み込み
async function loadCustomNotice(id) {
  const docRef = utils.doc(utils.db, 'notices', id);
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();

    // 紐づけ対象の表示
    const relatedText =
      d.relatedId && d.relatedType !== 'none'
        ? `${d.relatedType}：${d.relatedTitle}`
        : '紐づけなし';
    $('#custom-related').text(relatedText);

    // 💡 【修正】通知スケジュール (schedules) の表示
    const $scheduleContainer = $('#schedule-container');
    $scheduleContainer.empty();

    if (d.schedules && d.schedules.length > 0) {
      d.schedules.forEach((schedule) => {
        let notificationsHtml = '';

        // 通知時間とメッセージのリストを生成
        if (schedule.notifications && schedule.notifications.length > 0) {
          schedule.notifications.forEach((notification) => {
            const message =
              notification.message_decoded || notification.message || '';
            notificationsHtml += `
              <div class="time-message-display">
                <span class="time">${
                  notification.scheduledTime || '----'
                }</span>
                <span class="message-preview pre-wrap">${
                  message.length > 50
                    ? message.substring(0, 50) + '...'
                    : message
                }</span>
              </div>
            `;
          });
        }

        // 日付ごとのセクションをコンテナに追加
        const dateHtml = `
          <div class="date-display-group">
            <div class="date-header">通知日: ${
              schedule.scheduledDate || '----'
            }</div>
            ${
              notificationsHtml ||
              '<p class="label-value">通知時間・メッセージが設定されていません。</p>'
            }
          </div>
        `;
        $scheduleContainer.append(dateHtml);
      });
    } else {
      // スケジュールがない場合
      $('#no-schedule-message').removeClass('hidden');
    }
  } else {
    $('#page-title').text('エラー');
    $('#custom-config-section').html(
      '<p class="error-message">指定されたカスタム通知が見つかりませんでした。</p>'
    );
    $('#delete-button').addClass('hidden');
    $('#edit-button').addClass('hidden');
    $('#copy-button').addClass('hidden'); // コピーボタンも非表示
  }
}
