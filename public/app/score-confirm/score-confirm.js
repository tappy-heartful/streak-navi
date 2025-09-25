import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    utils.setBreadcrumb([
      { title: '譜面一覧', url: '../score-list/score-list.html' },
      { title: '譜面確認' },
    ]);
    await utils.initDisplay();
    await renderScore();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamScoreId,
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
// 譜面データ表示
////////////////////////////
async function renderScore() {
  const scoreId = utils.globalGetParamScoreId;

  // score コレクションから取得
  const scoreSnap = await utils.getDoc(utils.doc(utils.db, 'scores', scoreId));
  if (!scoreSnap.exists()) {
    throw new Error('譜面が見つかりません：' + scoreId);
  }
  const scoreData = scoreSnap.data();

  $('#score-date').text(scoreData.date || '');
  $('#score-title').text(scoreData.title || '');

  // Instagramリンク
  if (scoreData.instagramUrl) {
    $('#score-instagram').html(
      utils.buildInstagramHtml(scoreData.instagramUrl)
    );
  } else {
    $('#score-instagram').text('未設定');
  }

  // YouTubeリンク
  if (scoreData.youtubeUrl) {
    $('#score-youtube').html(utils.buildYouTubeHtml(scoreData.youtubeUrl));
  } else {
    $('#score-youtube').text('未設定');
  }

  // GoogleDriveリンク
  if (scoreData.driveUrl) {
    $('#score-drive').html(utils.buildGoogleDriveHtml(scoreData.driveUrl));
  } else {
    $('#score-drive').text('未設定');
  }

  // ホーム表示
  $('#is-disp-top').text(
    scoreData.isDispTop === true ? '表示する' : '表示しない'
  );

  // 管理者の場合のみ編集・削除ボタン表示
  utils.getSession('isScoreAdmin') === utils.globalStrTrue
    ? $('.confirm-buttons').show()
    : $('.confirm-buttons').hide();

  // Instagram埋め込みを処理
  if (window.instgrm) {
    window.instgrm.Embeds.process();
  }
  setupEventHandlers(scoreId);
}

////////////////////////////
// イベントハンドラ
////////////////////////////
function setupEventHandlers(scoreId) {
  // 編集
  $('#score-edit-button').on('click', () => {
    window.location.href = `../score-edit/score-edit.html?mode=edit&scoreId=${scoreId}`;
  });

  // コピー
  $('#score-copy-button').on('click', () => {
    window.location.href = `../score-edit/score-edit.html?mode=copy&scoreId=${scoreId}`;
  });

  // 削除
  $('#score-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'この譜面を削除しますか？\nこの操作は元に戻せません。'
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();
      await utils.deleteDoc(utils.doc(utils.db, 'scores', scoreId));
      await utils.writeLog({ dataId: scoreId, action: '譜面削除' });
      utils.hideSpinner();
      await utils.showDialog('削除しました', true);
      window.location.href = '../score-list/score-list.html';
    } catch (e) {
      await utils.writeLog({
        dataId: scoreId,
        action: '譜面削除',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });
}
