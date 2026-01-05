import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    const mode = 'base';
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
    captureInitialState();
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
 * 通知設定ブロックのHTMLテンプレートを生成する
 */
function createNotificationBlockHtml(type, data = {}) {
  const days = data.days === undefined ? 1 : data.days;
  const beforeAfter = data.beforeAfter || 'before';
  const message = data.message || '';

  // ラベル判定の修正
  let blockLabel = '締切';
  if (type === 'event') blockLabel = 'イベント';
  if (type === 'collect') blockLabel = '開始'; // 💰 集金は「開始の何日前/後」とする

  return `
    <div class="notification-block" data-type="${type}">
      <button type="button" class="remove-notify-button" title="削除">
        <i class="fas fa-trash-alt"></i>
      </button>

      <div class="timing-group">
        <label class="label-title">通知タイミング</label>
        
        <div class="days-input-group">
          ${blockLabel}の
          <input
            type="text"
            min="0"
            value="${days}"
            class="small-input days-input"
          />
          日
          <select class="before-after-select">
            <option value="before" ${
              beforeAfter === 'before' ? 'selected' : ''
            }>前</option>
            <option value="after" ${
              beforeAfter === 'after' ? 'selected' : ''
            }>後</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="label-title">通知メッセージ</label>
        <textarea
          rows="4"
          placeholder="通知メッセージ..."
          class="msg-textarea"
        >${message}</textarea>
      </div>
    </div>
  `;
}

async function loadBaseConfig() {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'configs', 'noticeBase')
  );
  if (docSnap.exists()) {
    const d = docSnap.data();
    // 5つのセクションを読み込む
    renderNotifications('event', d.eventNotifications || []);
    renderNotifications('eventAdj', d.eventAdjNotifications || []);
    renderNotifications('collect', d.collectNotifications || []); // 💰 追加
    renderNotifications('vote', d.voteNotifications || []);
    renderNotifications('call', d.callNotifications || []);
  } else {
    // デフォルト表示
    const defaultVal = [{ days: 1, beforeAfter: 'before', message: '' }];
    renderNotifications('event', defaultVal);
    renderNotifications('eventAdj', defaultVal);
    renderNotifications('collect', defaultVal); // 💰 追加
    renderNotifications('vote', defaultVal);
    renderNotifications('call', defaultVal);
  }
}

/**
 * 読み込んだデータをDOMに反映。
 */
function renderNotifications(type, notifications) {
  const wrapper = $(`#${type}-settings-wrapper`);
  wrapper.empty();

  notifications.forEach((data) => {
    const html = createNotificationBlockHtml(type, data);
    wrapper.append(html);
  });
}

function setupEventHandlers() {
  // 通知設定追加ボタン
  $(document).on('click', '.add-notify-button', function () {
    const type = $(this).data('type');
    const wrapper = $(`#${type}-settings-wrapper`);
    const defaultData = { days: 1, beforeAfter: 'before', message: '' };
    const html = createNotificationBlockHtml(type, defaultData);
    wrapper.append(html);
  });

  // 通知設定削除ボタン
  $(document).on('click', '.remove-notify-button', function () {
    $(this).closest('.notification-block').remove();
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('編集前に戻しますか？')) restoreInitialState();
  });

  $('#save-button').on('click', async () => {
    if (!validateData()) return;
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
  return {
    eventNotifications: collectNotifications('event'),
    eventAdjNotifications: collectNotifications('eventAdj'),
    collectNotifications: collectNotifications('collect'), // 💰 追加
    voteNotifications: collectNotifications('vote'),
    callNotifications: collectNotifications('call'),
    updatedAt: utils.serverTimestamp(),
  };
}

/**
 * 特定のタイプの通知設定をDOMから抽出
 */
function collectNotifications(type) {
  const notifications = [];
  $(`#${type}-settings-wrapper .notification-block`).each(function () {
    const block = $(this);
    const days = parseInt(block.find('.days-input').val());
    const beforeAfter = block.find('.before-after-select').val();
    const message = block.find('.msg-textarea').val().trim();

    if (!isNaN(days)) {
      notifications.push({
        days: days,
        beforeAfter: beforeAfter,
        message: message,
      });
    }
  });
  return notifications;
}

function validateData() {
  utils.clearErrors();
  return true;
}

function captureInitialState() {}
function restoreInitialState() {
  location.reload();
}
