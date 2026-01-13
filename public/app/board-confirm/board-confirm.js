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

  const boardSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'boards', boardId)
  );
  if (!boardSnap.exists()) throw new Error('投稿が見つかりません');

  const boardData = boardSnap.data();

  // タイトル・内容・作成者
  $('#board-title').text(boardData.title || '無題');
  $('#board-content').html(
    DOMPurify.sanitize(boardData.content || '').replace(/\n/g, '<br>')
  );
  $('#board-author').text(boardData.createdByName || '匿名');

  // 公開範囲
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

  // --- 添付ファイルの表示処理 ---
  if (boardData.files && boardData.files.length > 0) {
    const $fileList = $('#file-display-list').empty();
    boardData.files.forEach((file) => {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      const icon = isImage ? 'fa-image' : 'fa-file-pdf';
      const btnClass = isImage ? 'btn-view-image' : ''; // 画像のみプレビュー対象

      $fileList.append(`
        <a href="${
          file.url
        }" target="_blank" class="file-download-link ${btnClass}" data-url="${
        file.url
      }">
          <i class="fas ${icon}"></i>
          <span>${DOMPurify.sanitize(file.name)}</span>
          <i class="fas fa-external-link-alt" style="margin-left:auto; font-size:0.8rem; opacity:0.5;"></i>
        </a>
      `);
    });
    $('#file-section').show();
  }

  // 権限チェック
  const currentUid = utils.getSession('uid');
  if (currentUid === boardData.createdBy || utils.isAdmin('Board')) {
    $('#board-menu').show();
  } else {
    $('#board-menu').hide();
  }

  setupEventHandlers(boardId);
}

function setupEventHandlers(boardId) {
  // 画像プレビュー（リンク移動をキャンセルしてオーバーレイ表示）
  $(document).on('click', '.btn-view-image', function (e) {
    e.preventDefault();
    const url = $(this).data('url');
    const overlay = $(`
      <div class="receipt-preview-overlay">
        <div class="receipt-preview-content">
          <img src="${url}">
        </div>
      </div>
    `);
    $('body').append(overlay);
  });

  $(document).on('click', '.receipt-preview-overlay', function () {
    $(this).remove();
  });

  // 編集・コピー・削除
  $('#board-edit-button').on('click', () => {
    window.location.href = `../board-edit/board-edit.html?mode=edit&boardId=${boardId}`;
  });

  $('#board-copy-button').on('click', () => {
    window.location.href = `../board-edit/board-edit.html?mode=copy&boardId=${boardId}`;
  });

  $('#board-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'この投稿を削除しますか？\n添付ファイルも削除されます。'
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();

      // 1. Storageのファイルを削除（投稿データからパスを取得）
      const boardSnap = await utils.getWrapDoc(
        utils.doc(utils.db, 'boards', boardId)
      );
      if (boardSnap.exists()) {
        const data = boardSnap.data();
        if (data.files) {
          for (const file of data.files) {
            try {
              await utils.deleteObject(utils.ref(utils.storage, file.path));
            } catch (err) {
              console.warn('File delete failed:', file.path);
            }
          }
        }
      }

      // 2. ドキュメント削除
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
