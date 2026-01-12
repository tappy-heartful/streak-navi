import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      {
        title: '自動通知設定確認',
        url: '../notice-auto-confirm/notice-auto-confirm.html',
      },
      { title: '自動通知設定編集' },
    ]);

    await setupPage();
    setupEventHandlers();
  } catch (e) {
    await utils.writeLog({
      dataId: 'noticeBase',
      action: '自動通知設定編集',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage() {
  $('#page-title').text('自動通知設定編集');
  await loadBaseConfig();
}

/**
 * 通知設定ブロックのHTMLテンプレート
 */
function createNotificationBlockHtml(type, data = {}) {
  const days = data.days === undefined ? 1 : data.days;
  const beforeAfter = data.beforeAfter || 'before';
  const interval = data.interval === undefined ? 14 : data.interval;
  const message = data.message || '';

  // ラベル判定
  let blockLabel = '締切';
  if (type.endsWith('Start')) blockLabel = '受付開始日';
  if (type.endsWith('End')) blockLabel = '受付終了日';
  if (type === 'collectRemind') blockLabel = '受付終了日';

  const intervalHtml =
    type === 'collectRemind'
      ? `
    <div class="interval-input-group">
      から
      <input type="text" min="1" value="${interval}" class="small-input interval-input" />
      日ごと
    </div>
  `
      : '';

  return `
    <div class="notification-block" data-type="${type}">
      <button type="button" class="remove-notify-button" title="削除">
        <i class="fas fa-trash-alt"></i>
      </button>

      <div class="timing-group">
        <label class="label-title">通知タイミング</label>
        <div class="days-input-group">
          ${blockLabel}の
          <input type="text" min="0" value="${days}" class="small-input days-input" />
          日
          <select class="before-after-select">
            <option value="before" ${
              beforeAfter === 'before' ? 'selected' : ''
            }>前</option>
            <option value="after" ${
              beforeAfter === 'after' ? 'selected' : ''
            }>後</option>
          </select>
          ${intervalHtml}
        </div>
      </div>

      <div class="form-group">
        <label class="label-title">通知メッセージ</label>
        <textarea rows="4" placeholder="通知メッセージ..." class="msg-textarea">${message}</textarea>
      </div>
    </div>
  `;
}

// 物理名のリスト
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
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'configs', 'noticeBase')
  );
  const d = docSnap.exists() ? docSnap.data() : {};

  configKeys.forEach((key) => {
    const notifications =
      d[`${key}Notifications`] ||
      (key === 'collectRemind'
        ? [{ days: 1, beforeAfter: 'after', interval: 14, message: '' }]
        : [{ days: 1, beforeAfter: 'before', message: '' }]);
    renderNotifications(key, notifications);
  });
}

function renderNotifications(type, notifications) {
  const wrapper = $(`#${type}-settings-wrapper`);
  wrapper.empty();
  notifications.forEach((data) =>
    wrapper.append(createNotificationBlockHtml(type, data))
  );
}

function setupEventHandlers() {
  $(document).on('click', '.add-notify-button', function () {
    const type = $(this).data('type');
    const defaultData =
      type === 'collectRemind'
        ? { days: 1, beforeAfter: 'after', interval: 14, message: '' }
        : { days: 1, beforeAfter: 'before', message: '' };
    $(`#${type}-settings-wrapper`).append(
      createNotificationBlockHtml(type, defaultData)
    );
  });

  $(document).on('click', '.remove-notify-button', function () {
    $(this).closest('.notification-block').remove();
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('編集前に戻しますか？')) location.reload();
  });

  $('#save-button').on('click', async () => {
    const confirm = await utils.showDialog('設定を保存しますか？');
    if (!confirm) return;

    utils.showSpinner();
    try {
      const data = collectBaseData();
      await utils.setDoc(utils.doc(utils.db, 'configs', 'noticeBase'), data);
      await utils.showDialog('保存しました', true);
      window.location.href = `../notice-auto-confirm/notice-auto-confirm.html`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('エラーが発生しました');
    }
  });

  $(document).on('click', '.back-link', () => {
    window.location.href = '../notice-auto-confirm/notice-auto-confirm.html';
  });
}

function collectBaseData() {
  const data = { updatedAt: utils.serverTimestamp() };
  configKeys.forEach((key) => {
    data[`${key}Notifications`] = collectNotifications(key);
  });
  return data;
}

function collectNotifications(type) {
  const notifications = [];
  $(`#${type}-settings-wrapper .notification-block`).each(function () {
    const block = $(this);
    const days = parseInt(block.find('.days-input').val());
    const beforeAfter = block.find('.before-after-select').val();
    const message = block.find('.msg-textarea').val().trim();
    const item = { days, beforeAfter, message };

    if (type === 'collectRemind') {
      const interval = parseInt(block.find('.interval-input').val());
      item.interval = isNaN(interval) ? 14 : interval;
    }

    if (!isNaN(days)) notifications.push(item);
  });
  return notifications;
}
