import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      { title: '自動通知設定確認' },
    ]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'noticeBase',
      action: '自動通知設定確認初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // ページタイトルを再設定
  $('#page-title').text('自動通知設定確認');

  await loadBaseConfig();

  // 編集ボタンの遷移先設定
  $('#edit-button').on('click', () => {
    // 💡 編集画面へ遷移。
    window.location.href = '../notice-auto-edit/notice-auto-edit.html';
  });
}

/**
 * 単一の通知設定ブロックのHTMLを生成する
 * @param {string} typeLabel - イベント or 締切
 * @param {object} notification - {days, beforeAfter, time, message}
 * @returns {string} HTML文字列
 */
function createNotificationDisplayBlock(typeLabel, notification) {
  const days = notification.days || 0;
  const beforeAfter = notification.beforeAfter === 'after' ? '後' : '前';
  const time = notification.time || '00:00';
  const message =
    notification.message_decoded || '通知メッセージが設定されていません。';

  const timingText =
    days === 0
      ? `${typeLabel}の当日 ${time}`
      : `${typeLabel}の ${days} 日${beforeAfter}の ${time}`;

  const messageContent =
    message.trim() === '通知メッセージが設定されていません。'
      ? `<div class="no-setting">${message}</div>`
      : `<div class="label-value pre-wrap">${message}</div>`;

  return `
        <div class="notification-display-block">
            <label class="label-title">通知タイミング</label>
            <div class="timing-value">${timingText}</div>
            
            <label class="label-title">通知メッセージ</label>
            ${messageContent}
        </div>
    `;
}

/**
 * 自動通知設定の読み込みと表示
 */
async function loadBaseConfig() {
  const docRef = utils.doc(utils.db, 'configs', 'noticeBase');
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();

    // イベント通知
    renderNotificationSection('event', 'イベント', d.eventNotifications);

    // 投票通知
    renderNotificationSection('vote', '締切', d.voteNotifications);

    // 曲募集通知
    renderNotificationSection('call', '締切', d.callNotifications);
  } else {
    // データがない場合
    $('.notifications-container').html(
      '<div class="no-setting">設定データがありません。</div>'
    );
  }
}

/**
 * 通知セクション全体のレンダリングを行う
 * @param {string} type - 通知タイプ ('event', 'vote', 'call')
 * @param {string} typeLabel - イベント or 締切
 * @param {Array<object>} notifications - 通知設定の配列
 */
function renderNotificationSection(type, typeLabel, notifications) {
  const container = $(`#${type}-notifications-container`);
  container.empty();

  const validNotifications = notifications?.filter((n) => n.days !== undefined);

  if (validNotifications && validNotifications.length > 0) {
    validNotifications.forEach((notification) => {
      const html = createNotificationDisplayBlock(typeLabel, notification);
      container.append(html);
    });
  } else {
    container.html('<div class="no-setting">通知設定はありません。</div>');
  }
}
