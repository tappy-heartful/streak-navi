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
  $('#page-title').text('自動通知設定確認');

  await loadBaseConfig();

  $('#edit-button').on('click', () => {
    window.location.href = '../notice-auto-edit/notice-auto-edit.html';
  });
}

/**
 * 単一の通知設定ブロックのHTMLを生成する
 * @param {string} typeLabel - イベント or 締切
 * @param {object} notification - {days, beforeAfter, message}
 * @returns {string} HTML文字列
 */
function createNotificationDisplayBlock(typeLabel, notification) {
  const days = notification.days ?? 0;
  const beforeAfter = notification.beforeAfter === 'after' ? '後' : '前';
  const time = '9:00ごろ';
  // message_decoded または message を使用
  const message =
    notification.message ||
    notification.message_decoded ||
    '通知メッセージが設定されていません。';

  const timingText =
    days === 0
      ? `${typeLabel}の当日 ${time}`
      : `${typeLabel}の ${days} 日${beforeAfter}の ${time}`;

  const messageContent =
    message === '通知メッセージが設定されていません。'
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

    // ① イベント通知（出欠） -> ラベルは「イベント」
    renderNotificationSection('event', 'イベント', d.eventNotifications);

    // ② イベント通知（日程調整） -> ラベルは「締切」
    renderNotificationSection('eventAdj', '締切', d.eventAdjNotifications);

    // ③ 投票通知 -> ラベルは「締切」
    renderNotificationSection('vote', '締切', d.voteNotifications);

    // ④ 曲募集通知 -> ラベルは「締切」
    renderNotificationSection('call', '締切', d.callNotifications);
  } else {
    $('.notifications-container').html(
      '<div class="no-setting">設定データがありません。</div>'
    );
  }
}

/**
 * 通知セクション全体のレンダリングを行う
 */
function renderNotificationSection(type, typeLabel, notifications) {
  const container = $(`#${type}-notifications-container`);
  container.empty();

  // 0件（未設定）の場合はメッセージを表示
  if (notifications && notifications.length > 0) {
    notifications.forEach((notification) => {
      const html = createNotificationDisplayBlock(typeLabel, notification);
      container.append(html);
    });
  } else {
    container.html('<div class="no-setting">通知設定はありません。</div>');
  }
}
