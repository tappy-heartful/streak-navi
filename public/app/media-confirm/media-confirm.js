import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    utils.setBreadcrumb([
      { title: 'メディア一覧', url: '../media-list/media-list.html' },
      { title: 'メディア確認' },
    ]);
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
      utils.buildInstagramHtml(mediaData.instagramUrl)
    );
  } else {
    $('#media-instagram').text('未設定');
  }

  // YouTubeリンク
  if (mediaData.youtubeUrl) {
    $('#media-youtube').html(utils.buildYouTubeHtml(mediaData.youtubeUrl));
  } else {
    $('#media-youtube').text('未設定');
  }

  // GoogleDriveリンク
  if (mediaData.driveUrl) {
    $('#media-drive').html(utils.buildGoogleDriveHtml(mediaData.driveUrl));
  } else {
    $('#media-drive').text('未設定');
  }

  // ホーム表示
  $('#is-disp-top').text(
    mediaData.isDispTop === true ? '表示する' : '表示しない'
  );

  // 管理者の場合のみ編集・削除ボタン表示
  utils.getSession('isMediaAdmin') === utils.globalStrTrue
    ? $('.confirm-buttons').show()
    : $('.confirm-buttons').hide();

  // Instagram埋め込みを処理
  if (window.instgrm) {
    window.instgrm.Embeds.process();
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
      await utils.deleteDoc(utils.doc(utils.db, 'medias', mediaId));
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
}
