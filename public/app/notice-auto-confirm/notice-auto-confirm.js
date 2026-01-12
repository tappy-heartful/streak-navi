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
 * 単一の通知設定ブロックのHTMLを生成
 */
function createNotificationDisplayBlock(type, notification) {
  const days = notification.days ?? 0;
  const beforeAfter = notification.beforeAfter === 'after' ? '後' : '前';
  const interval = notification.interval;
  const time = '9:00ごろ';

  // ラベル判定（物理名から推測）
  let typeLabel = '締切日';
  if (type.endsWith('Start')) typeLabel = '開始日';
  if (type.endsWith('End')) typeLabel = '終了日';
  if (type === 'collectRemind') typeLabel = '開始日';

  const message =
    notification.message || '通知メッセージが設定されていません。';

  let timingText = '';
  if (interval) {
    timingText = `${typeLabel}の ${days} 日${beforeAfter}から ${interval} 日おき ${time}`;
  } else {
    timingText =
      days === 0
        ? `${typeLabel}の当日 ${time}`
        : `${typeLabel}の ${days} 日${beforeAfter}の ${time}`;
  }

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

// 編集画面と共通の物理名リスト
const configKeys = [
  'eventStart',
  'eventEnd',
  'eventAdjStart',
  'eventAdjEnd',
  'collectStart',
  'collectEnd',
  'collectRemind',
  'voteStart',
  'voteEnd',
  'callStart',
  'callEnd',
];

async function loadBaseConfig() {
  const docRef = utils.doc(utils.db, 'configs', 'noticeBase');
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();

    configKeys.forEach((key) => {
      const container = $(`#${key}-notifications-container`);
      const notifications = d[`${key}Notifications`];

      container.empty();

      if (notifications && notifications.length > 0) {
        notifications.forEach((notification) => {
          container.append(createNotificationDisplayBlock(key, notification));
        });
      } else {
        container.html('<div class="no-setting">通知設定はありません。</div>');
      }
    });
  } else {
    $('.notifications-container').html(
      '<div class="no-setting">設定データがありません。</div>'
    );
  }
}
