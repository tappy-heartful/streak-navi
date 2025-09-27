import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    utils.setBreadcrumb([{ title: '譜面一覧' }]);
    await utils.initDisplay();
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
  const scoreSnap = await utils.getDocs(qScore);

  scores = scoreSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // ▼ ジャンルデータ取得
  const genresRef = utils.collection(utils.db, 'genres');
  const genreSnap = await utils.getDocs(genresRef);
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

  // ▼ 検索イベント（タイトル & ジャンル）
  $('#search-box, #genre-select').on('input change', function () {
    filterScores();
  });

  // クリアボタン
  $('#clear-button').on('click', () => {
    $('#search-box').val('');
    $('#genre-select').val('');
    // 必要ならここで検索結果リセット処理を呼ぶ
    renderScoreList();
  });
}

// フィルタリング処理
function filterScores() {
  const keyword = $('#search-box').val().toLowerCase();
  const selectedGenre = $('#genre-select').val();

  const filtered = scores.filter((s) => {
    const matchTitle = s.title.toLowerCase().includes(keyword);
    const matchGenre = !selectedGenre || s.genre === selectedGenre;
    return matchTitle && matchGenre;
  });

  renderScores(filtered);
}

function renderScores(scoreArray) {
  const $list = $('#score-list').empty();
  if (scoreArray.length === 0) {
    showEmptyMessage($list);
    return;
  }
  for (const s of scoreArray) {
    $list.append(makeScoreItem(s.id, s.title));
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
