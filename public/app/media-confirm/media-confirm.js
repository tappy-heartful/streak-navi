import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await renderMedia();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamMediaId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

////////////////////////////
// メディアデータ表示
////////////////////////////
async function renderMedia() {
  const mediaId = utils.globalGetParamMediaId;

  // media コレクションから取得
  const mediaSnap = await utils.getDoc(utils.doc(utils.db, 'medias', mediaId));
  if (!mediaSnap.exists()) {
    throw new Error('メディアが見つかりません：' + mediaId);
  }
  const mediaData = mediaSnap.data();

  $('#media-date').text(mediaData.date || '');
  $('#media-title').text(mediaData.title || '');

  // Instagramリンク
  if (mediaData.instagramUrl) {
    $('#media-instagram').html(
      `<a href="${mediaData.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagramリンク</a>`
    );
  } else {
    $('#media-instagram').text('未設定');
  }

  // YouTubeリンク
  if (mediaData.youtubeUrl) {
    const videoId = extractYouTubeId(mediaData.youtubeUrl);
    $('#media-youtube').html(
      `<a href="#" class="youtube-link" data-video-id="${videoId}">YouTubeを開く</a>`
    );
  } else {
    $('#media-youtube').text('未設定');
  }

  setupEventHandlers(mediaId);
}

////////////////////////////
// イベントハンドラ
////////////////////////////
function setupEventHandlers(mediaId) {
  // 編集
  $('#media-edit-button').on('click', () => {
    window.location.href = `../media-edit/media-edit.html?mode=edit&mediaId=${mediaId}`;
  });

  // コピー
  $('#media-copy-button').on('click', () => {
    window.location.href = `../media-edit/media-edit.html?mode=copy&mediaId=${mediaId}`;
  });

  // 削除
  $('#media-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'このメディアを削除しますか？\nこの操作は元に戻せません。'
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();
      await utils.deleteDoc(utils.doc(utils.db, 'media', mediaId));
      await utils.writeLog({ dataId: mediaId, action: 'メディア削除' });
      utils.hideSpinner();
      await utils.showDialog('削除しました', true);
      window.location.href = '../media-list/media-list.html';
    } catch (e) {
      await utils.writeLog({
        dataId: mediaId,
        action: 'メディア削除',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // YouTubeモーダル表示
  $(document).on('click', '.youtube-link', async function (e) {
    e.preventDefault();
    const videoId = $(this).data('video-id');
    const iframeHtml = utils.buildYouTubeHtml(videoId);
    await utils.showModal('YouTube', iframeHtml);
  });
}

////////////////////////////
// YouTube ID 抽出
////////////////////////////
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v');
    } else if (u.hostname.includes('youtu.be')) {
      return u.pathname.substring(1);
    }
  } catch (e) {
    return '';
  }
  return '';
}
