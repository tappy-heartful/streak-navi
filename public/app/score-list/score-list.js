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
let events = []; // フィルタリングされたイベントデータと譜面の並び順を格納 (新規)

async function setUpPage() {
  // 管理者の場合のみ新規登録ボタン表示
  utils.isAdmin('Score') ? $('#add-button').show() : $('#add-button').hide();

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

  // ▼ Eventデータ取得とソートオプション生成
  await loadAndProcessEvents(); // 💡 新規追加

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

// 💡 新規追加: イベントデータ取得・処理・ソートオプションへの反映
async function loadAndProcessEvents() {
  const eventsRef = utils.collection(utils.db, 'events');
  const eventSnap = await utils.getWrapDocs(eventsRef);
  const today = utils.format(new Date(), 'yyyy.MM.dd');
  const $sortSelect = $('#sort-select');

  const rawEvents = eventSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // 1. フィルタリングとスコアID抽出
  events = rawEvents
    .filter(
      (e) =>
        e.date &&
        e.date > today && // 未来の日付
        e.setlist &&
        Array.isArray(e.setlist) &&
        e.setlist.length > 0 // setlistが存在し、空でない
    )
    .map((e) => {
      // setlist全体からsongIdsを結合してscoreIdsの配列を生成
      const orderedScoreIds = [];
      e.setlist.forEach((item) => {
        if (item.songIds && Array.isArray(item.songIds)) {
          orderedScoreIds.push(...item.songIds);
        }
      });

      return {
        id: e.id,
        title: e.title_decoded || e.title || `イベント(${e.id})`,
        date: e.date,
        orderedScoreIds: orderedScoreIds, // 譜面の並び順
      };
    });

  // 2. ソートオプションに反映
  events.forEach((e) => {
    // オプションの値は 'event-eventID' の形式にする
    $sortSelect.append(`<option value="event-${e.id}">${e.title} 順</option>`);
  });
}

// フィルタリング処理 (修正)
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
    // 1. イベント順ソートの判定
    if (sortValue.startsWith('event-')) {
      const eventId = sortValue.split('-')[1];
      const eventData = events.find((e) => e.id === eventId);

      if (eventData) {
        const orderedIds = eventData.orderedScoreIds;

        // setlist内でのインデックスを取得
        const indexA = orderedIds.indexOf(a.id);
        const indexB = orderedIds.indexOf(b.id);

        // setlistに存在しない譜面はリストの最後に配置するため、orderedIds.length を使用
        const posA = indexA === -1 ? orderedIds.length : indexA;
        const posB = indexB === -1 ? orderedIds.length : indexB;

        return posA - posB;
      }
    }

    // 2. 標準ソート
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
    .map((s) => utils.extractYouTubeId(s.referenceTrack_decoded))
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
