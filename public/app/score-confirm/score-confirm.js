import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: '譜面一覧', url: '../score-list/score-list.html' },
      { title: '譜面確認' },
    ]);
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

  const scoreSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'scores', scoreId)
  );
  if (!scoreSnap.exists()) throw new Error('譜面が見つかりません：' + scoreId);

  const scoreData = scoreSnap.data();

  // タイトル
  $('#score-title').text(scoreData.title_decoded || '');

  // 譜面（Google Driveリンク）
  if (scoreData.scoreUrl) {
    $('#score-drive').html(
      `<a href="${scoreData.scoreUrl}" target="_blank">譜面をみる<i class="fas fa-arrow-up-right-from-square"></i></a>`
    );
  } else {
    $('#score-drive').text('未設定');
  }

  // 参考音源（YouTube埋め込み）
  if (scoreData.referenceTrack) {
    $('#reference-track').html(
      utils.buildYouTubeHtml(scoreData.referenceTrack)
    );
  } else {
    $('#reference-track').text('未設定');
  }

  // ジャンル（複数対応）
  if (Array.isArray(scoreData.genres) && scoreData.genres.length > 0) {
    const genreNames = [];
    for (const gid of scoreData.genres) {
      const gSnap = await utils.getWrapDoc(utils.doc(utils.db, 'genres', gid));
      if (gSnap.exists()) {
        genreNames.push(gSnap.data().name_decoded);
      }
    }
    $('#score-genre').text(genreNames.join('、'));
  } else {
    $('#score-genre').text('未設定');
  }

  // 略称
  $('#abbreviation').text(scoreData.abbreviation_decoded || '未設定');

  // 🔽 【新規追加】楽器構成の表示
  await renderInstrumentConfig(scoreData.instrumentConfig);

  // 備考
  $('#score-note').text(scoreData.note_decoded || '未設定');

  // ホーム表示
  $('#is-disp-top').text(
    scoreData.isDispTop === true ? '表示する' : '表示しない'
  );

  // ボタン制御
  utils.isAdmin('Score')
    ? $('.confirm-buttons').show()
    : $('.confirm-buttons').hide();
  setupEventHandlers(scoreId);
}

////////////////////////////
// 楽器構成データ表示 (修正)
////////////////////////////
async function renderInstrumentConfig(configData) {
  const $configDiv = $('#instrument-config');

  if (!configData || Object.keys(configData).length === 0) {
    $configDiv.text('未設定');
    return;
  }

  let configHtml = '';

  // sectionsコレクションから全てのセクションを取得
  const sectionSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'sections')
  );

  // セクションデータをIDでルックアップできるように整形（IDが99のものを除外）
  const sectionsMap = new Map();
  sectionSnap.docs
    .filter((doc) => doc.id !== '99')
    .forEach((doc) => {
      sectionsMap.set(doc.id, doc.data().name_decoded || doc.data().name);
    });

  // データをセクションID順にソートして処理
  const sortedSectionIds = Object.keys(configData).sort((a, b) => {
    return parseInt(a, 10) - parseInt(b, 10);
  });

  for (const sectionId of sortedSectionIds) {
    const parts = configData[sectionId];
    const sectionName = sectionsMap.get(sectionId);

    // partNameのみを抽出し、「、」で連結
    const partNames = parts
      .map((p) => p.partName)
      .filter((name) => name) // 空のパート名を除外
      .join('、');

    if (sectionName && partNames) {
      // 🔽 修正: セクション名を太字にして改行し、パート名を表示
      configHtml += `
        <strong>${sectionName}</strong><br>
        ${partNames}<br><br>
      `;
    }
  }

  // 末尾の不要な改行タグを削除してセット
  $configDiv.html(configHtml.trim().replace(/<br><br>$/, ''));
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
