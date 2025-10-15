import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // 初期処理
    await utils.initDisplay();
    await loadPendingAnnouncements();
    await loadQuickScores();
    await initScorePlayer();
    await initBlueNotes();
    await loadMedias();

    // イベント登録
    setupEventHandlers();

    // スピナー非表示
    utils.hideSpinner();
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

// 投票・募集・イベントをまとめて「お知らせ」に表示
async function loadPendingAnnouncements() {
  const uid = utils.getSession('uid');
  const $announcementList = $('.notification-list');
  $announcementList.empty();

  let hasPending = false;

  // --- 受付中の投票 ---
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  let hasPendingVotes = false;

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    if (voteData.isActive === false) continue;

    const voteId = voteDoc.id;

    if (!hasPendingVotes) {
      $announcementList.append(`
          <li class="pending-message">📌未回答の投票があります</li>
        `);
      hasPendingVotes = true;
      hasPending = true;
    }
    $announcementList.append(`
        <li>
          <a href="../vote-confirm/vote-confirm.html?voteId=${voteId}" class="notification-link">
            📝${voteData.name}
          </a>
        </li>
      `);
  }

  // --- 募集中の曲募集 ---
  const callsRef = utils.collection(utils.db, 'calls');
  const qCalls = utils.query(callsRef, utils.orderBy('createdAt', 'desc'));
  const callsSnap = await utils.getDocs(qCalls);

  let hasPendingCalls = false;

  for (const callDoc of callsSnap.docs) {
    const callData = callDoc.data();
    if (callData.isActive === false) continue;

    const callId = callDoc.id;

    if (!hasPendingCalls) {
      $announcementList.append(`
          <li class="pending-message">📌候補曲、募集中！</li>
        `);
      hasPendingCalls = true;
      hasPending = true;
    }
    $announcementList.append(`
        <li>
          <a href="../call-confirm/call-confirm.html?callId=${callId}" class="notification-link">
            🎶${callData.title}
          </a>
        </li>
      `);
  }

  // --- 未回答かつ今日以降のイベント ---
  const eventsRef = utils.collection(utils.db, 'events');
  const qEvents = utils.query(eventsRef, utils.orderBy('date', 'desc'));
  const eventsSnap = await utils.getDocs(qEvents);

  let hasPendingEvents = false;

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 今日の0:00

  for (const eventDoc of eventsSnap.docs) {
    const eventData = eventDoc.data();
    if (!eventData.attendance) continue; // 出欠受付なしは除外

    // eventDate 'yyyy.MM.dd'
    const [year, month, day] = (eventData.date || '').split('.').map(Number);
    if (!year || !month || !day) continue;

    const eventDateObj = new Date(year, month - 1, day);
    if (eventDateObj < todayOnly) continue; // 今日より前は対象外

    const eventId = eventDoc.id;

    if (!hasPendingEvents) {
      $announcementList.append(`
          <li class="pending-message">📌未回答のイベントがあります</li>
        `);
      hasPendingEvents = true;
      hasPending = true;
    }
    $announcementList.append(`
        <li>
          <a href="../event-confirm/event-confirm.html?eventId=${eventId}" class="notification-link">
            📅${eventData.date} ${eventData.title}
          </a>
        </li>
      `);
  }

  // どれも未回答がなければ空メッセージ
  if (!hasPending) {
    $announcementList.append(`
      <li class="empty-message">
        <div class="notification-link">お知らせはありません🍀</div>
      </li>
    `);
  }
}

// ホーム画面に譜面クイックアクセスを表示
async function loadQuickScores() {
  const $scoreList = $('.score-list');
  $scoreList.empty();

  // 全件（降順）
  const allScoresRef = utils.collection(utils.db, 'scores');
  const qAll = utils.query(allScoresRef, utils.orderBy('createdAt', 'desc'));
  const allSnap = await utils.getDocs(qAll);

  // 全曲プレイリストリンク生成
  const allWatchIds = allSnap.docs
    .map((doc) => utils.extractYouTubeId(doc.data().referenceTrack))
    .filter((id) => !!id)
    .join(',');
  if (allWatchIds) {
    $('#playlist-link-score')
      .attr(
        'href',
        `https://www.youtube.com/watch_videos?video_ids=${allWatchIds}`
      )
      .show();
  } else {
    $('#playlist-link-score').hide();
  }

  // クイック表示用（最新4件）
  const q = utils.query(
    allScoresRef,
    utils.orderBy('createdAt', 'desc'),
    utils.limit(4)
  );
  const snap = await utils.getDocs(q);

  if (snap.empty) {
    $scoreList.append(
      '<div class="empty-message">譜面はまだ登録されていません🍀</div>'
    );
    return;
  }

  // 1行に2つずつ
  let rowDiv;
  snap.docs.forEach((doc, idx) => {
    const data = doc.data();
    if (idx % 2 === 0) {
      rowDiv = $('<div class="quick-score-row"></div>');
      $scoreList.append(rowDiv);
    }

    const scoreLink = $(`
      <a href="../score-confirm/score-confirm.html?scoreId=${doc.id}" class="quick-score-link">
        🎼 ${data.title}
      </a>
    `);
    rowDiv.append(scoreLink);
  });
}

// 譜面プレイヤー用
let scores = [];
let currentScoreIndex = 0;

async function initScorePlayer() {
  const snapshot = await utils.getDocs(
    utils.query(
      utils.collection(utils.db, 'scores'),
      utils.orderBy('createdAt', 'desc')
    )
  );
  scores = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
      youtubeId: utils.extractYouTubeId(doc.data().referenceTrack),
    }))
    .filter((s) => !!s.youtubeId);

  if (scores.length === 0) return;

  // デフォルト → 最新曲
  currentScoreIndex = 0;
  renderScoreVideos();
}

function renderScoreVideos() {
  const $videos = $('#score-videos');
  $videos.empty();

  const score = scores[currentScoreIndex];
  const watchIds = getWatchVideosOrder(currentScoreIndex, scores);

  const html = utils.buildYouTubeHtml(watchIds, false, false);
  $videos.append(`
    <div class="video active" data-index="${currentScoreIndex}">
      ${html}
    </div>
  `);

  $('#score-player-title').text(score.title || '参考演奏');
  updateScorePlaylistLink(watchIds);
}

function updateScorePlaylistLink(watchIds) {
  if (watchIds && watchIds.length > 0) {
    $('#playlist-link-score')
      .attr(
        'href',
        `https://www.youtube.com/watch_videos?video_ids=${watchIds.join(',')}`
      )
      .show();
  } else {
    $('#playlist-link-score').hide();
  }
}

function showScoreNext() {
  currentScoreIndex = (currentScoreIndex + 1) % scores.length;
  renderScoreVideos();
}

function showScorePrev() {
  currentScoreIndex = (currentScoreIndex - 1 + scores.length) % scores.length;
  renderScoreVideos();
}

function showScoreRandom() {
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * scores.length);
  } while (newIndex === currentScoreIndex && scores.length > 1);
  currentScoreIndex = newIndex;
  renderScoreVideos();
}

// 今日の一曲を読み込んで表示する関数
let blueNotes = [];
let currentIndex = 0;

async function initBlueNotes() {
  const snapshot = await utils.getDocs(utils.collection(utils.db, 'blueNotes'));
  blueNotes = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (blueNotes.length === 0) return;

  // 今日の日付 (MMDD形式, 4桁ゼロ埋め)
  const today = new Date();
  const todayId =
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  // 今日の日付に一致するdoc.idがあるか探す
  const todayIndex = blueNotes.findIndex((note) => note.id === todayId);

  if (todayIndex !== -1) {
    currentIndex = todayIndex; // 今日の日付に一致
  } else {
    // ランダムで選ぶ
    currentIndex = Math.floor(Math.random() * blueNotes.length);
  }

  renderBlueNoteVideos();
}

function renderBlueNoteVideos() {
  const $videos = $('#blue-note-videos');
  $videos.empty();

  const prevIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;
  const nextIndex = (currentIndex + 1) % blueNotes.length;
  const randomIndex = getRandomIndex(currentIndex);

  const indexes = [
    { index: prevIndex, role: 'prev' },
    { index: currentIndex, role: 'current' },
    { index: nextIndex, role: 'next' },
    { index: randomIndex, role: 'random' },
  ];

  indexes.forEach((item) => {
    const note = blueNotes[item.index];
    // この動画を先頭にして全体配列を作る
    const watchIds = getWatchVideosOrder(item.index, blueNotes);

    const html = utils.buildYouTubeHtml(watchIds, false, false);

    $videos.append(`
      <div class="video ${item.role === 'current' ? 'active' : ''}"
           data-role="${item.role}"
           data-index="${item.index}">
        ${html}
      </div>
    `);

    if (item.role === 'current') updateBlueNoteLink(watchIds);
  });

  updateBlueNoteTitle();
}

function updateBlueNoteTitle() {
  $('#blue-note-title').text(blueNotes[currentIndex].title);
}

function updateBlueNoteLink(watchIds) {
  // 全曲プレイリストリンク更新
  if (watchIds) {
    $('#playlist-link-blue-note')
      .attr(
        'href',
        `https://www.youtube.com/watch_videos?video_ids=${watchIds.join(',')}`
      )
      .show();
  } else {
    $('#playlist-link-blue-note').hide();
  }
}

function showNext() {
  // インデックス更新
  currentIndex = (currentIndex + 1) % blueNotes.length;

  const $videos = $('#blue-note-videos');
  const $current = $videos.find('[data-role="current"]');
  const $prev = $videos.find('[data-role="prev"]');
  const $next = $videos.find('[data-role="next"]');

  // current → prev に役割変更
  $current.attr('data-role', 'prev').removeClass('active');
  // 古い prev は破棄
  $prev.remove();

  // next を current に昇格
  $next.attr('data-role', 'current').addClass('active');

  // 新しい next を生成
  const newNextIndex = (currentIndex + 1) % blueNotes.length;
  const watchIds = getWatchVideosOrder(newNextIndex, blueNotes);
  const html = utils.buildYouTubeHtml(watchIds, false, false);

  $videos.append(`
    <div class="video" data-role="next" data-index="${newNextIndex}">
      ${html}
    </div>
  `);

  updateBlueNoteTitle();
  updateBlueNoteLink(getWatchVideosOrder(currentIndex, blueNotes));
}

function showPrev() {
  // インデックス更新
  currentIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;

  const $videos = $('#blue-note-videos');
  const $current = $videos.find('[data-role="current"]');
  const $prev = $videos.find('[data-role="prev"]');
  const $next = $videos.find('[data-role="next"]');

  // current → next に役割変更
  $current.attr('data-role', 'next').removeClass('active');
  // 古い next は破棄
  $next.remove();

  // prev を current に昇格
  $prev.attr('data-role', 'current').addClass('active');

  // 新しい prev を生成
  const newPrevIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;
  const watchIds = getWatchVideosOrder(newPrevIndex, blueNotes);
  const html = utils.buildYouTubeHtml(watchIds, false, false);

  $videos.prepend(`
    <div class="video" data-role="prev" data-index="${newPrevIndex}">
      ${html}
    </div>
  `);

  updateBlueNoteTitle();
  updateBlueNoteLink(getWatchVideosOrder(currentIndex, blueNotes));
}

function showRandom() {
  // 新しいランダムインデックス
  currentIndex = getRandomIndex(currentIndex);

  const $videos = $('#blue-note-videos');
  $videos.empty();

  // 再構築（prev, current, next, random 全部新規）
  const prevIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;
  const nextIndex = (currentIndex + 1) % blueNotes.length;
  const randomIndex = getRandomIndex(currentIndex);

  const indexes = [
    { index: prevIndex, role: 'prev' },
    { index: currentIndex, role: 'current' },
    { index: nextIndex, role: 'next' },
    { index: randomIndex, role: 'random' },
  ];

  indexes.forEach((item) => {
    const watchIds = getWatchVideosOrder(item.index, blueNotes);
    const html = utils.buildYouTubeHtml(watchIds, false, false);
    $videos.append(`
      <div class="video ${item.role === 'current' ? 'active' : ''}"
           data-role="${item.role}"
           data-index="${item.index}">
        ${html}
      </div>
    `);
    if (item.role === 'current') updateBlueNoteLink(watchIds);
  });

  updateBlueNoteTitle();
}

function getRandomIndex(exclude) {
  let idx;
  do {
    idx = Math.floor(Math.random() * blueNotes.length);
  } while (idx === exclude && blueNotes.length > 1);
  return idx;
}

function getWatchVideosOrder(currentIndex, blueNotes) {
  // 今のインデックスから最後まで
  const after = blueNotes.slice(currentIndex).map((n) => n.youtubeId);
  // 先頭から今のインデックス直前まで
  const before = blueNotes.slice(0, currentIndex).map((n) => n.youtubeId);
  // 連結
  return [...after, ...before];
}

// コンテンツを読み込んで表示する関数
async function loadMedias() {
  const mediasRef = utils.collection(utils.db, 'medias');
  const q = utils.query(
    mediasRef,
    utils.orderBy('date', 'desc'),
    utils.limit(3)
  );
  const snap = await utils.getDocs(q);
  let isExist = false;

  const $contentList = $('.content-list');
  $contentList.empty();

  snap.forEach((doc) => {
    const data = doc.data();

    // ホーム表示フラグが false または未設定ならスキップ
    if (!data.isDispTop) {
      return;
    }
    isExist = true;

    let html = '';

    html += `<div class="content-item"><h4>${data.title}</h4>`;
    html += `<div class="media-date">${data.date}</div>`;

    // Instagram埋め込み
    if (data.instagramUrl) {
      html += utils.buildInstagramHtml(data.instagramUrl);
    }

    // YouTube埋め込み
    if (data.youtubeUrl) {
      html += utils.buildYouTubeHtml(data.youtubeUrl, true);
    }

    // Google Drive埋め込み
    if (data.driveUrl) {
      html += utils.buildGoogleDriveHtml(data.driveUrl, true); // 第二引数で注意文表示可否
    }

    html += `</div>`;
    $contentList.append(html);
  });

  // Instagram埋め込みを処理
  if (window.instgrm) {
    window.instgrm.Embeds.process();
  }

  if (!isExist) {
    $contentList.append(
      `<div class="content-item">メディアはまだ登録されていません🍀</div>`
    );
  }
}

// イベントハンドラ登録
async function setupEventHandlers() {
  $('#blue-note-prev').on('click', showPrev);
  $('#blue-note-next').on('click', showNext);
  $('#blue-note-random').on('click', showRandom);
  $('#score-next').on('click', showScoreNext);
  $('#score-prev').on('click', showScorePrev);
  $('#score-random').on('click', showScoreRandom);
}
