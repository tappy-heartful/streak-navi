import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      { title: '固定通知確認' }, // 💡 パンくずリストも変更
    ]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'noticeBase', // 固定通知はIDを固定
      action: '固定通知確認初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // ページタイトルを再設定
  $('#page-title').text('固定通知の確認');

  // base-config-sectionのhiddenクラスを削除する必要はない（HTMLで削除済み）
  await loadBaseConfig();

  // 編集ボタンの遷移先設定
  $('#edit-button').on('click', () => {
    // 💡 編集画面へ遷移。
    window.location.href = '../notice-pinned-edit/notice-pinned-edit.html';
  });
}

// 固定通知の読み込み (元のロジックを流用)
async function loadBaseConfig() {
  const docRef = utils.doc(utils.db, 'configs', 'noticeBase');
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();

    // イベント
    if (d.eventNotify) {
      $('#base-event-timing').text(
        'イベントの' +
          (d.eventDaysBefore === 0 ? ' 当日 ' : ` ${d.eventDaysBefore} 日前 `) +
          (d.eventTime || '00:00') // 時刻を追加
      );
      $('#base-event-msg').text(d.eventMessage_decoded || d.eventMessage || '');
    } else {
      $('#base-event-timing').text('通知しない');
      $('#base-event-msg').text('ー');
    }

    // 投票
    if (d.voteNotify) {
      $('#base-vote-timing').text(
        '締切の' +
          (d.voteDaysBefore === 0 ? ' 当日 ' : ` ${d.voteDaysBefore} 日前 `) +
          (d.voteTime || '00:00')
      );
      $('#base-vote-msg').text(d.voteMessage_decoded || d.voteMessage || '');
    } else {
      $('#base-vote-timing').text('通知しない');
      $('#base-vote-msg').text('ー');
    }

    // 曲募集
    if (d.callNotify) {
      $('#base-call-timing').text(
        '締切の' +
          (d.callDaysBefore === 0 ? ' 当日 ' : ` ${d.callDaysBefore} 日前 `) +
          (d.callTime || '00:00')
      );
      $('#base-call-msg').text(d.callMessage_decoded || d.callMessage || '');
    } else {
      $('#base-call-timing').text('通知しない');
      $('#base-call-msg').text('ー');
    }
  } else {
    $('.label-value').text('未設定');
  }
}

// 💡 loadCustomNotice 関数は削除
