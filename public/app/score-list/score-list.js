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
// eventsには、フィルタリングとソートに必要なイベント情報を格納
let events = [];

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

  // ▼ Eventデータ取得と**フィルタリングオプション**生成
  await loadAndProcessEvents();

  // 💡 修正: 初期表示はfilterScoresに任せることで、イベントの初期選択と非表示制御を適用
  filterScores();

  // ▼ 検索イベント（タイトル & ジャンル & **イベントフィルター** & 並び順）
  $('#search-box, #genre-select, #event-filter-select, #sort-select').on(
    'input change',
    function () {
      filterScores();
    }
  );

  // クリアボタン
  $('#clear-button').on('click', () => {
    $('#search-box').val('');
    $('#genre-select').val('');
    // 💡 修正: event-filter-select はクリアするが、直近のイベント選択は行わない
    $('#event-filter-select').val('');
    $('#sort-select').val('createdAt-desc');
    filterScores();
  });
}

// 💡 修正: イベントデータ取得・処理・**フィルターオプション**への反映と**直近のイベントを選択**
async function loadAndProcessEvents() {
  const eventsRef = utils.collection(utils.db, 'events');
  const eventSnap = await utils.getWrapDocs(eventsRef);
  const today = utils.format(new Date(), 'yyyy.MM.dd');
  const $eventFilterSelect = $('#event-filter-select');

  const rawEvents = eventSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // 1. フィルタリングとスコアID抽出 (未来の日付 & setlistあり)
  events = rawEvents
    .filter(
      (e) =>
        e.date &&
        e.date > today && // 未来の日付
        e.setlist &&
        Array.isArray(e.setlist) &&
        e.setlist.length > 0 // setlistが存在し、空でない
    )
    // 💡 イベントの日付順（昇順）でソート
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((e) => {
      // setlist全体からsongIdsを結合してscoreIdsの配列を生成
      const scoreIdsInSetlist = [];
      e.setlist.forEach((item) => {
        if (item.songIds && Array.isArray(item.songIds)) {
          scoreIdsInSetlist.push(...item.songIds);
        }
      });

      return {
        id: e.id,
        title: e.title_decoded || e.title || `イベント(${e.id})`,
        date: e.date,
        scoreIdsInSetlist: scoreIdsInSetlist, // 譜面のIDリスト
      };
    });

  // 💡 直近のイベントIDを特定
  const closestEventId = events.length > 0 ? events[0].id : '';

  // 2. フィルターオプションに反映
  $eventFilterSelect.empty();
  $eventFilterSelect.append($('<option>').val('').text('イベントを選択'));
  events.forEach((e) => {
    // オプションの値は eventID のみ
    // 💡 修正: 直近のイベントを選択状態にする
    const isSelected = e.id === closestEventId ? 'selected' : '';
    $eventFilterSelect.append(
      `<option value="${e.id}" ${isSelected}>${e.date} ${e.title}</option>`
    );
  });
}

// フィルタリング処理 (修正)
function filterScores() {
  const keyword = $('#search-box').val().toLowerCase();
  const selectedGenre = $('#genre-select').val();
  const selectedEventId = $('#event-filter-select').val();
  const sortValue = $('#sort-select').val();

  // 💡 新規追加: ソートプルダウンの表示制御
  const $sortGroup = $('#sort-select').closest('.form-group');
  if (selectedEventId) {
    $sortGroup.hide(); // イベントが選択されたら非表示
  } else {
    $sortGroup.show(); // イベントが未選択なら表示
  }

  let filtered = scores.filter((s) => {
    // 1. タイトル、ジャンルによるフィルタリング
    const matchTitle = s.title.toLowerCase().includes(keyword);
    const matchGenre = !selectedGenre || s.genres?.includes(selectedGenre);

    // 2. イベントによるフィルタリング
    let matchEvent = true;
    if (selectedEventId) {
      const eventData = events.find((e) => e.id === selectedEventId);
      // 選択されたイベントのセットリストにこの譜面が含まれているか
      matchEvent = eventData?.scoreIdsInSetlist.includes(s.id);
    }

    return matchTitle && matchGenre && matchEvent;
  });

  // 並び替え処理
  filtered.sort((a, b) => {
    // 1. イベントフィルターが適用されている場合は、セットリスト順でソート（ソートプルダウンは非表示だがソートは適用）
    if (selectedEventId) {
      const eventData = events.find((e) => e.id === selectedEventId);
      if (eventData) {
        const orderedIds = eventData.scoreIdsInSetlist;
        const indexA = orderedIds.indexOf(a.id);
        const indexB = orderedIds.indexOf(b.id);
        return indexA - indexB;
      }
    }

    // 2. 標準ソート (イベントが選択されていない場合のみ実行)
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
  // 💡 イベントフィルターが選択されている場合、譜面IDの順序をイベント順に反映 (filterScoresでソート済みのためここでは不要だが、念のためロジックを保持)
  const selectedEventId = $('#event-filter-select').val();
  let displayScores = scoreArray;

  /*
  // filterScoresで既にソート済みのため、以下の再構築ロジックは冗長ですが、念のため残しておきます。
  if (selectedEventId) {
    const eventData = events.find((e) => e.id === selectedEventId);
    if (eventData) {
      const orderedIds = eventData.scoreIdsInSetlist;
      displayScores = orderedIds
        .map((id) => scoreArray.find((s) => s.id === id))
        .filter((s) => s);
    }
  }
  */

  for (const s of displayScores) {
    $list.append(makeScoreItem(s.id, s.title));
  }

  // --- プレイリストリンク生成 ---
  const watchIds = displayScores
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
