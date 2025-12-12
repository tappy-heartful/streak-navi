import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 💡 パンくずリストをカスタム通知用に調整
    utils.renderBreadcrumb([
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
      { title: 'カスタム通知確認' },
    ]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetparams.get('noticeId') || 'none',
      action: 'カスタム通知確認初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  const noticeId = utils.globalGetparams.get('noticeId');

  if (!noticeId) {
    // IDがない場合はエラーまたは一覧へリダイレクト
    utils.showDialog('通知IDが見つかりません。', true);
    window.location.href = '../notice-list/notice-list.html';
    return;
  }

  $('#page-title').text('カスタム通知の確認');
  // 💡 hiddenクラスはHTML側で削除済み
  // 削除ボタンはカスタム通知では表示されるのでhiddenを削除(HTML側で削除済み)
  await loadCustomNotice(noticeId);

  $('#edit-button').on('click', () => {
    // 💡 編集画面への遷移パスとモードを調整
    // カスタム通知の編集は mode=edit (または mode=new)
    // notice-editフォルダが notice-custom-edit に変更されていると仮定し、パスを調整
    window.location.href = `../notice-custom-edit/notice-custom-edit.html?mode=edit&noticeId=${noticeId}`;
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

// 💡 loadBaseConfig 関数は削除

// カスタム通知の読み込み
async function loadCustomNotice(id) {
  const docRef = utils.doc(utils.db, 'notices', id);
  const docSnap = await utils.getWrapDoc(docRef);

  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#custom-title').text(d.title_decoded || d.title);
    $('#custom-date').text(`${d.scheduledDate} ${d.scheduledTime}`);
    // relatedTitleが空の場合に備えてフォールバックを強化
    const relatedText = d.relatedId
      ? `${d.relatedType}：${d.relatedTitle}`
      : '紐づけなし';
    $('#custom-related').text(relatedText);
    $('#custom-message').text(d.message_decoded || d.message);
  } else {
    $('#page-title').text('エラー');
    $('#custom-config-section').html(
      '<p class="error-message">指定されたカスタム通知が見つかりませんでした。</p>'
    );
    $('#delete-button').addClass('hidden');
    $('#edit-button').addClass('hidden');
  }
}
