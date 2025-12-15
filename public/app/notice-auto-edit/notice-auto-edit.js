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
    // 💡 初期状態のキャプチャは、DOMの操作が完了した後に行う
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
 * @param {string} type - 通知タイプ ('event', 'vote', 'call')
 * @param {object} [data={}] - 初期値データ
 * @returns {string} 生成されたHTML文字列
 */
function createNotificationBlockHtml(type, data = {}) {
  const days = data.days || 1;
  const beforeAfter = data.beforeAfter || 'before'; // before:前, after:後
  const time = data.time || '09:00';
  const message = data.message || '';
  const blockLabel = type === 'event' ? 'イベント' : '締切';

  // 💡 修正: timing-group内を縦並びに変更し、時刻入力を日数入力の直下に配置
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
            type="number"
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

        <input
          type="time"
          value="${time}"
          class="time-input-field"
        />
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

// データ読み込み（自動通知設定）
async function loadBaseConfig() {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'configs', 'noticeBase')
  );
  if (docSnap.exists()) {
    const d = docSnap.data();

    // 通知設定の配列を読み込み、DOMを構築する
    renderNotifications('event', d.eventNotifications || []);
    renderNotifications('vote', d.voteNotifications || []);
    renderNotifications('call', d.callNotifications || []);
  } else {
    // データがない場合、各項目にデフォルトの空設定を1つずつ追加
    renderNotifications('event', [
      { days: 1, beforeAfter: 'before', time: '09:00', message: '' },
    ]);
    renderNotifications('vote', [
      { days: 1, beforeAfter: 'before', time: '09:00', message: '' },
    ]);
    renderNotifications('call', [
      { days: 1, beforeAfter: 'before', time: '09:00', message: '' },
    ]);
  }
}

/**
 * データベースから読み込んだ通知設定をDOMに反映する
 * @param {string} type - 通知タイプ ('event', 'vote', 'call')
 * @param {Array<object>} notifications - 通知設定の配列
 */
function renderNotifications(type, notifications) {
  const wrapper = $(`#${type}-settings-wrapper`);
  wrapper.empty();

  if (notifications.length === 0) {
    // 設定が0の場合も、最低1つ空のブロックを追加する
    notifications.push({
      days: 1,
      beforeAfter: 'before',
      time: '09:00',
      message: '',
    });
  }

  notifications.forEach((data) => {
    const html = createNotificationBlockHtml(type, data);
    wrapper.append(html);
  });
}

function setupEventHandlers() {
  // 通知設定追加ボタンのハンドラ
  $(document).on('click', '.add-notify-button', function () {
    const type = $(this).data('type');
    const wrapper = $(`#${type}-settings-wrapper`);
    const defaultData = {
      days: 1,
      beforeAfter: 'before',
      time: '09:00',
      message: '',
    };
    const html = createNotificationBlockHtml(type, defaultData);
    wrapper.append(html);
  });

  // 通知設定削除ボタンのハンドラ
  $(document).on('click', '.remove-notify-button', function () {
    const wrapper = $(this).closest('.notify-settings-wrapper');

    // 最後の1つは削除させない（設定なし＝通知なしと見なす）
    if (wrapper.find('.notification-block').length > 1) {
      $(this).closest('.notification-block').remove();
    } else {
      // 最後の1つを削除しようとした場合、中身をクリアする
      const block = $(this).closest('.notification-block');
      block.find('.days-input').val('1');
      block.find('.before-after-select').val('before');
      block.find('.time-input-field').val('09:00');
      block.find('.msg-textarea').val('');
      utils.showDialog('最後の設定のため、中身をクリアしました。');
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('編集前に戻しますか？')) restoreInitialState();
  });

  $('#save-button').on('click', async () => {
    // 💡 自動通知設定は常にバリデーションOK
    if (!validateData()) return;

    const confirm = await utils.showDialog('設定を保存しますか？');
    if (!confirm) return;

    utils.showSpinner();
    try {
      // 💡 自動通知設定のみの保存ロジックに固定
      const data = collectBaseData();
      await utils.setDoc(utils.doc(utils.db, 'configs', 'noticeBase'), data);

      await utils.showDialog('保存しました', true);
      // 💡 確認画面へ遷移 (notice-auto-confirm.html)
      window.location.href = `../notice-auto-confirm/notice-auto-confirm.html`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('エラーが発生しました');
    }
  });

  $(document).on(
    'click',
    '.back-link',
    () =>
      (window.location.href = '../notice-auto-confirm/notice-auto-confirm.html')
  );
}

/**
 * 画面上の設定をコレクションする
 */
function collectBaseData() {
  return {
    // 💡 event, vote, call のそれぞれに通知設定の配列を格納
    eventNotifications: collectNotifications('event'),
    voteNotifications: collectNotifications('vote'),
    callNotifications: collectNotifications('call'),

    updatedAt: utils.serverTimestamp(),
  };
}

/**
 * 特定のタイプの通知設定をDOMから抽出して配列にする
 * @param {string} type - 通知タイプ ('event', 'vote', 'call')
 * @returns {Array<object>} 抽出された通知設定の配列
 */
function collectNotifications(type) {
  const notifications = [];
  $(`#${type}-settings-wrapper .notification-block`).each(function () {
    const block = $(this);
    const days = parseInt(block.find('.days-input').val()) || 0;
    const beforeAfter = block.find('.before-after-select').val();
    const time = block.find('.time-input-field').val();
    const message = block.find('.msg-textarea').val().trim();

    // 💡 日数と時刻が空でない場合のみ有効な設定として登録
    // ただし、0日も有効
    if (days >= 0 && time) {
      notifications.push({
        days: days,
        beforeAfter: beforeAfter,
        time: time,
        message: message,
      });
    }
  });
  return notifications;
}

function validateData() {
  utils.clearErrors();
  // 自動通知設定は任意なので常に true を返す
  return true;
}

function captureInitialState() {
  /* 復元ロジック（リロードで代用） */
}
function restoreInitialState() {
  location.reload();
}
