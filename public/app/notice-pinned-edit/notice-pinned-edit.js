import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    // 💡 modeは常に 'base' として扱う
    const mode = 'base';
    const noticeId = null; // 自動通知設定では使用しない
    await utils.initDisplay();

    // 💡 パンくずリストを自動通知設定用に固定
    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      {
        title: '自動通知設定確認',
        url: '../notice-pinned-confirm/notice-pinned-confirm.html',
      },
      { title: '自動通知設定編集' },
    ]);

    await setupPage(); // mode, noticeId の引数を削除
    captureInitialState();
    setupEventHandlers();
  } catch (e) {
    await utils.writeLog({
      dataId: 'noticeBase', // 自動通知設定のIDに固定
      action: '自動通知設定編集',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage() {
  // 💡 HTML側で hidden を削除したので、ここでは loadBaseConfig のみ実行
  $('#page-title').text('自動通知設定編集');
  await loadBaseConfig();
}

// データ読み込み（自動通知設定）
async function loadBaseConfig() {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'configs', 'noticeBase')
  );
  if (docSnap.exists()) {
    const d = docSnap.data();

    // イベント通知
    $('#base-event-notify').prop('checked', d.eventNotify);
    $('#base-event-days').val(d.eventDaysBefore);
    $('#base-event-time').val(d.eventTime || '09:00');
    $('#base-event-msg').val(d.eventMessage);

    // 投票通知
    $('#base-vote-notify').prop('checked', d.voteNotify);
    $('#base-vote-days').val(d.voteDaysBefore);
    $('#base-vote-time').val(d.voteTime || '09:00');
    $('#base-vote-msg').val(d.voteMessage);

    // 曲募集通知
    $('#base-call-notify').prop('checked', d.callNotify);
    $('#base-call-days').val(d.callDaysBefore);
    $('#base-call-time').val(d.callTime || '09:00');
    $('#base-call-msg').val(d.callMessage);
  } else {
    // データがない場合の初期値設定
    $('#base-event-time').val('09:00');
    $('#base-vote-time').val('09:00');
    $('#base-call-time').val('09:00');

    $('#base-event-days').val('1');
    $('#base-vote-days').val('1');
    $('#base-call-days').val('1');
  }
}

// 💡 loadCustomNotice 関数は削除

function setupEventHandlers() {
  // 💡 カスタム通知：紐づけ対象の動的切り替えロジックは削除

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
      // 💡 確認画面へ遷移 (notice-pinned-confirm.html)
      window.location.href = `../notice-pinned-confirm/notice-pinned-confirm.html`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('エラーが発生しました');
    }
  });

  $(document).on(
    'click',
    '.back-link',
    () =>
      // 💡 確認画面へ遷移 (notice-pinned-confirm.html)
      (window.location.href =
        '../notice-pinned-confirm/notice-pinned-confirm.html')
  );
}

function collectBaseData() {
  return {
    // イベント
    eventNotify: $('#base-event-notify').prop('checked'),
    eventDaysBefore: parseInt($('#base-event-days').val()) || 0,
    eventTime: $('#base-event-time').val(),

    // 💡 メッセージは空文字列の場合Firestoreに登録しないという運用がない限り、空文字列で送信
    eventMessage: $('#base-event-msg').val(),

    // 投票
    voteNotify: $('#base-vote-notify').prop('checked'),
    voteDaysBefore: parseInt($('#base-vote-days').val()) || 0,
    voteTime: $('#base-vote-time').val(),
    voteMessage: $('#base-vote-msg').val(),

    // 曲募集
    callNotify: $('#base-call-notify').prop('checked'),
    callDaysBefore: parseInt($('#base-call-days').val()) || 0,
    callTime: $('#base-call-time').val(),
    callMessage: $('#base-call-msg').val(),

    updatedAt: utils.serverTimestamp(),
  };
}

// 💡 collectCustomData 関数は削除

function validateData() {
  utils.clearErrors();
  // 自動通知設定は任意なので常に true を返す
  return true;
}

function captureInitialState() {
  /* 復元ロジック（省略可、reloadで代用） */
}
function restoreInitialState() {
  location.reload();
}
