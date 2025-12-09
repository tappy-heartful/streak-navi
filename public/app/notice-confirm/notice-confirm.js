import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      { title: '通知設定確認' },
    ]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '通知設定確認初期表示',
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
    $('#page-title').text('通知設定確認(基本)');
    $('#base-config-section').removeClass('hidden');
    await loadBaseConfig();
  } else {
    $('#page-title').text('通知設定確認(カスタム)');
    $('#custom-config-section').removeClass('hidden');
    $('#delete-button').removeClass('hidden');
    await loadCustomNotice(noticeId);
  }

  $('#edit-button').on('click', () => {
    let url = `../notice-edit/notice-edit.html?mode=${mode}`;
    if (noticeId) url += `&noticeId=${noticeId}`;
    window.location.href = url;
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

// 基本設定の読み込み
async function loadBaseConfig() {
  const docRef = utils.doc(utils.db, 'configs', 'noticeBase');
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();

    // イベント
    if (d.eventNotify) {
      $('#base-event-timing').text(`イベントの ${d.eventDaysBefore} 日前`);
      $('#base-event-msg').text(d.eventMessage_decoded || d.eventMessage || '');
    } else {
      $('#base-event-timing').text('通知しない');
      $('#base-event-msg').text('ー');
    }

    // 投票
    if (d.voteNotify) {
      $('#base-vote-timing').text(`締切の ${d.voteDaysBefore} 日前`);
      $('#base-vote-msg').text(d.voteMessage_decoded || d.voteMessage || '');
    } else {
      $('#base-vote-timing').text('通知しない');
      $('#base-vote-msg').text('ー');
    }

    // 曲募集
    if (d.callNotify) {
      $('#base-call-timing').text(`締切の ${d.callDaysBefore} 日前`);
      $('#base-call-msg').text(d.callMessage_decoded || d.callMessage || '');
    } else {
      $('#base-call-timing').text('通知しない');
      $('#base-call-msg').text('ー');
    }
  } else {
    $('.label-value').text('未設定');
  }
}

async function loadCustomNotice(id) {
  const docRef = utils.doc(utils.db, 'notices', id);
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#custom-title').text(d.title_decoded || d.title);
    $('#custom-date').text(`${d.scheduledDate} ${d.scheduledTime}`);
    $('#custom-related').text(`${d.relatedType}：${d.relatedTitle}`);
    $('#custom-message').text(d.message_decoded || d.message);
  }
}
