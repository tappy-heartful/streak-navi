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

  // タイトル・作成者
  $('#board-title').text(boardData.title_decoded || '無題');
  $('#board-author').text(boardData.createdByName_decoded || '匿名');

  // --- 内容の表示処理 (リンク化 & YouTube埋め込み) ---
  const content = boardData.content || '';
  const lines = content.split('\n');
  const $contentArea = $('#board-content').empty();

  // URL判定用の正規表現
  const urlRegex = /^(https?:\/\/[^\s]+)$/;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    const match = trimmedLine.match(urlRegex);

    if (match) {
      // 1行がリンクのみの場合
      const url = match[1];
      const $linkWrapper = $('<div class="content-link-line"></div>');
      $linkWrapper.append(
        `<a href="${url}" target="_blank" class="text-link">${url}</a>`
      );

      // YouTubeリンク判定
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const youtubeHtml = utils.buildYouTubeHtml(url);
        if (youtubeHtml) {
          $linkWrapper.append(youtubeHtml);
        }
      }
      $contentArea.append($linkWrapper);
    } else {
      // 通常のテキスト行
      $contentArea.append($('<span>' + line + '</span><br>'));
    }
  });

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
      const btnClass = isImage ? 'btn-view-image' : '';

      $fileList.append(`
        <a href="${file.url}" target="_blank" class="file-download-link ${btnClass}" data-url="${file.url}">
          <i class="fas ${icon}"></i>
          <span>${file.name}</span>
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
  // 画像プレビュー
  $(document).on('click', '.btn-view-image', function (e) {
    e.preventDefault();
    const url = $(this).data('url');
    const overlay = $(`
      <div class="image-preview-overlay">
        <div class="image-preview-content">
          <img src="${url}">
        </div>
      </div>
    `);
    $('body').append(overlay);
  });

  $(document).on('click', '.image-preview-overlay', function () {
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
