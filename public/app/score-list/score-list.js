import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([{ title: '譜面一覧' }]);
    await setUpPage();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

let scores = []; // 譜面データ
let genres = []; // ジャンルデータ

async function setUpPage() {
  // 管理者の場合のみ新規登録ボタン表示
  utils.getSession('isScoreAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();

  const scoresRef = utils.collection(utils.db, 'scores');
  const qScore = utils.query(scoresRef, utils.orderBy('createdAt', 'desc'));
  const scoreSnap = await utils.getWrapDocs(qScore);

  scores = scoreSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // ▼ ジャンルデータ取得
  const genresRef = utils.collection(utils.db, 'genres');
  const genreSnap = await utils.getWrapDocs(genresRef);
  genres = genreSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // ▼ ジャンルプルダウンに反映
  const $genreSelect = $('#genre-select');
  genres.forEach((g) => {
    $genreSelect.append(`<option value="${g.id}">${g.name}</option>`);
  });

  renderScores(scores);

  // ▼ 検索イベント（タイトル & ジャンル & 並び順）
  $('#search-box, #genre-select, #sort-select').on('input change', function () {
    filterScores();
  });

  // クリアボタン
  $('#clear-button').on('click', () => {
    $('#search-box').val('');
    $('#genre-select').val('');
    $('#sort-select').val('createdAt-desc');
    filterScores();
  });
}

// フィルタリング処理
// フィルタリング処理
function filterScores() {
  const keyword = $('#search-box').val().toLowerCase();
  const selectedGenre = $('#genre-select').val();
  const sortValue = $('#sort-select').val();

  let filtered = scores.filter((s) => {
    const matchTitle = s.title.toLowerCase().includes(keyword);
    const matchGenre = !selectedGenre || s.genres?.includes(selectedGenre);
    return matchTitle && matchGenre;
  });

  // 並び替え処理
  filtered.sort((a, b) => {
    switch (sortValue) {
      case 'createdAt-asc':
        return a.createdAt?.toMillis?.() - b.createdAt?.toMillis?.();
      case 'createdAt-desc':
        return b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.();
      case 'title-asc':
        return a.title.localeCompare(b.title, 'ja');
      case 'title-desc':
        return b.title.localeCompare(a.title, 'ja');
      default:
        return 0;
    }
  });

  renderScores(filtered);
}

function renderScores(scoreArray) {
  const $list = $('#score-list').empty();

  if (scoreArray.length === 0) {
    showEmptyMessage($list);
    $('#playlist-link').hide();
    return;
  }

  // 譜面一覧描画
  for (const s of scoreArray) {
    $list.append(makeScoreItem(s.id, s.title));
  }

  // --- プレイリストリンク生成 ---
  const watchIds = scoreArray
    .map((s) => utils.extractYouTubeId(s.referenceTrack))
    .filter((id) => !!id)
    .join(',');

  if (watchIds) {
    $('#playlist-link')
      .attr(
        'href',
        `https://www.youtube.com/watch_videos?video_ids=${watchIds}`
      )
      .show();
  } else {
    $('#playlist-link').hide();
  }
}

function makeScoreItem(scoreId, title) {
  return $(`
    <li>
      <a href="../score-confirm/score-confirm.html?scoreId=${scoreId}" class="score-link">
        <span class="score-title">🎼 ${title}</span>
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="score-link empty">
        該当の譜面はありません🍀
      </div>
    </li>
  `);
}
