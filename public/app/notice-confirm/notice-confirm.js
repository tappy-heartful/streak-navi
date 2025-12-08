import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '通知一覧', url: '../notice-list/notice-list.html' },
      { title: '通知確認' },
    ]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '通知確認初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  const mode = utils.globalGetParamMode;
  const noticeId = utils.globalGetparams.get('noticeId');

  if (mode === 'base') {
    // 基本設定モード
    $('#page-title').text('通知基本設定の確認');
    $('#base-config-section').removeClass('hidden');
    await loadBaseConfig();
  } else {
    // カスタム通知モード
    $('#page-title').text('カスタム通知の確認');
    $('#custom-config-section').removeClass('hidden');
    $('#delete-button').removeClass('hidden');
    await loadCustomNotice(noticeId);
  }

  // 編集ボタンの遷移先設定
  $('#edit-button').on('click', () => {
    let url = `../notice-edit/notice-edit.html?mode=${mode}`;
    if (noticeId) url += `&noticeId=${noticeId}`;
    window.location.href = url;
  });

  // 削除ボタン（カスタムのみ）
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

// 基本設定の読み込み
async function loadBaseConfig() {
  const docRef = utils.doc(utils.db, 'configs', 'noticeBase'); // 固定ドキュメント
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#base-event-info').text(
      d.eventNotify
        ? `${d.eventDaysBefore}日前：${d.eventMessage}`
        : '通知しない'
    );
    $('#base-vote-info').text(
      d.voteNotify ? `${d.voteDaysBefore}日前：${d.voteMessage}` : '通知しない'
    );
    $('#base-call-info').text(
      d.callNotify ? `${d.callDaysBefore}日前：${d.callMessage}` : '通知しない'
    );
  } else {
    $('.label-value').text('未設定');
  }
}

// カスタム通知の読み込み
async function loadCustomNotice(id) {
  const docRef = utils.doc(utils.db, 'notices', id);
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#custom-title').text(d.title);
    $('#custom-date').text(`${d.scheduledDate} ${d.scheduledTime}`);
    $('#custom-related').text(`${d.relatedType}：${d.relatedTitle}`);
    $('#custom-message').text(d.message);
  }
}
