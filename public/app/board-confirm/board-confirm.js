import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '掲示板一覧', url: '../board-list/board-list.html' },
      { title: '掲示板確認' },
    ]);
    await renderBoard();
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: utils.globalGetParamBoardId || 'none',
      action: '掲示板確認',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

////////////////////////////
// 掲示板データ表示
////////////////////////////
async function renderBoard() {
  const boardId = utils.globalGetParamBoardId;
  if (!boardId) throw new Error('IDが指定されていません');

  // データの取得
  const boardSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'boards', boardId)
  );
  if (!boardSnap.exists()) {
    throw new Error('投稿が見つかりません');
  }
  const boardData = boardSnap.data();

  // タイトルと内容の反映（サニタイズ処理）
  $('#board-title').text(boardData.title || '無題');
  $('#board-content').html(
    DOMPurify.sanitize(boardData.content || '').replace(/\n/g, '<br>')
  );
  $('#board-author').text(boardData.createdByName || '匿名');

  // 公開範囲（セクション名）の取得
  if (boardData.sectionId) {
    const sectionSnap = await utils.getWrapDoc(
      utils.doc(utils.db, 'sections', boardData.sectionId)
    );
    const sectionName = sectionSnap.exists()
      ? sectionSnap.data().name
      : '不明なセクション';
    $('#board-scope').html(`<i class="fas fa-users"></i> ${sectionName}専用`);
  } else {
    $('#board-scope').html(`<i class="fas fa-globe"></i> 全体向け`);
  }

  // 権限チェック：作成者本人または管理者のみ編集・削除ボタンを表示
  const currentUid = utils.getSession('uid');
  if (currentUid === boardData.createdBy || utils.isAdmin('Board')) {
    $('.confirm-buttons').show();
  } else {
    $('.confirm-buttons').hide();
  }

  setupEventHandlers(boardId);
}

////////////////////////////
// イベントハンドラ
////////////////////////////
function setupEventHandlers(boardId) {
  // 編集
  $('#board-edit-button').on('click', () => {
    window.location.href = `../board-edit/board-edit.html?mode=edit&boardId=${boardId}`;
  });

  // コピー
  $('#board-copy-button').on('click', function () {
    window.location.href = `../board-edit/board-edit.html?mode=copy&boardId=${boardId}`;
  });

  // 削除
  $('#board-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'この投稿を削除しますか？\nこの操作は元に戻せません。'
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();
      // アーカイブして削除（共通関数を利用）
      await utils.archiveAndDeleteDoc('boards', boardId);
      await utils.writeLog({ dataId: boardId, action: '掲示板投稿削除' });

      utils.hideSpinner();
      await utils.showDialog('削除しました', true);
      window.location.href = '../board-list/board-list.html';
    } catch (e) {
      console.error(e);
      utils.hideSpinner();
      await utils.showDialog('削除に失敗しました');
    }
  });
}
