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
  const votesSnap = await utils.getWrapDocs(qVotes);

  let hasPendingVotes = false;

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();

    if (!utils.isInTerm(voteData.acceptStartDate, voteData.acceptEndDate))
      continue;

    const voteId = voteDoc.id;

    if (!hasPendingVotes) {
      $announcementList.append(`
            <li class="pending-message">📌投票、受付中です！</li>
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
  const callsSnap = await utils.getWrapDocs(qCalls);

  let hasPendingCalls = false;

  for (const callDoc of callsSnap.docs) {
    const callData = callDoc.data();
    if (!utils.isInTerm(callData.acceptStartDate, callData.acceptEndDate))
      continue;

    const callId = callDoc.id;

    if (!hasPendingCalls) {
      $announcementList.append(`
            <li class="pending-message">📌候補曲、募集中です！</li>
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

  // --- お知らせ対象のイベント ---
  const eventsRef = utils.collection(utils.db, 'events');
  const qEvents = utils.query(eventsRef, utils.orderBy('date', 'asc')); // 日付の昇順に修正
  const eventsSnap = await utils.getWrapDocs(qEvents);

  // 収集用の配列
  const schedulePending = []; // 日程調整中（未回答）
  const attendancePending = []; // 出欠受付中（未回答）
  const imminentEvents = []; // 30日以内のイベント（回答済みは除くロジックも検討したが、今回は「もうすぐイベントです！」の告知用途として回答の有無に関わらず抽出）

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 今日の0:00

  // 30日後の0:00 を計算
  const thirtyDaysLater = new Date(todayOnly);
  thirtyDaysLater.setDate(todayOnly.getDate() + 30); // 30日加算

  for (const eventDoc of eventsSnap.docs) {
    const eventData = eventDoc.data();
    const eventId = eventDoc.id;
    const attendanceType = eventData.attendanceType; // 'schedule', 'attendance'
    const isAcceptingResponses = eventData.isAcceptingResponses;
    const eventDateStr = eventData.date || '';

    // イベント日付オブジェクトの作成
    let eventDateObj = null;
    if (eventDateStr) {
      const [year, month, day] = eventDateStr.split('.').map(Number);
      if (year && month && day) {
        eventDateObj = new Date(year, month - 1, day);
      }
    }

    // 過去のイベントはスキップ
    if (eventDateObj && eventDateObj < todayOnly) continue;

    // ------------------------------------------------------------------
    // 1. 未回答のイベントの判定
    // ------------------------------------------------------------------
    let isPending = false;
    let listToPush = null;
    let answerDocRef = null;

    if (attendanceType === 'schedule' && isAcceptingResponses) {
      answerDocRef = utils.doc(
        utils.db,
        'eventAdjustAnswers',
        `${eventId}_${uid}`
      );
      listToPush = schedulePending;
    } else if (attendanceType === 'attendance' && isAcceptingResponses) {
      answerDocRef = utils.doc(
        utils.db,
        'eventAttendanceAnswers',
        `${eventId}_${uid}`
      );
      listToPush = attendancePending;
    }

    if (answerDocRef) {
      const answerSnap = await utils.getWrapDoc(answerDocRef);
      if (!answerSnap.exists()) {
        // 未回答の場合、該当のリストに追加
        listToPush.push({
          id: eventId,
          title: eventData.title,
          date: eventDateStr,
          type: attendanceType,
          display: attendanceType === 'schedule' ? '🗓️' : `📅${eventDateStr}`,
          message:
            attendanceType === 'schedule'
              ? '日程調整、受付中です！'
              : '出欠確認、受付中です！',
        });
        isPending = true;
      }
    }

    // ------------------------------------------------------------------
    // 2. 30日以内のイベントの判定
    // ------------------------------------------------------------------
    if (
      eventDateObj &&
      eventDateObj >= todayOnly &&
      eventDateObj < thirtyDaysLater
    ) {
      // 30日以内のイベントとして追加（重複を避けるために未回答イベントはスキップ）
      // 30日以内のイベントは、告知メッセージを優先するため、未回答リストに追加されたものはここではスキップしない。
      // ただし、同じイベントが二重にリストに表示されないように、リストを結合する際に工夫が必要です。

      // 🚨 今回は「もうすぐイベントです！」を最優先で表示するため、isPendingかどうかに関わらず、
      // 30日以内であれば imminentEvents に追加します。
      imminentEvents.push({
        id: eventId,
        title: eventData.title,
        date: eventDateStr,
        type: attendanceType,
        display: `📅${eventDateStr}`,
        message: 'もうすぐイベントです！',
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. 画面への表示 (優先順位: 日程調整未回答 > 出欠未回答 > もうすぐイベント)
  // ------------------------------------------------------------------
  let finalAnnouncements = {}; // {eventId: eventObject} で重複を排除

  // 優先度1: 日程調整中（未回答）
  schedulePending.forEach((event) => {
    finalAnnouncements[event.id] = event;
  });

  // 優先度2: 出欠受付中（未回答）
  attendancePending.forEach((event) => {
    // 既に日程調整として追加されていなければ追加
    if (!finalAnnouncements[event.id]) {
      finalAnnouncements[event.id] = event;
    }
  });

  // 優先度3: 30日以内のイベント
  imminentEvents.forEach((event) => {
    // 既に未回答イベントとして追加されていなければ追加
    if (!finalAnnouncements[event.id]) {
      finalAnnouncements[event.id] = event;
    }
  });

  const announcedEvents = Object.values(finalAnnouncements);

  // 最終的なリストを生成し、表示
  let currentMessage = '';

  announcedEvents.forEach((event) => {
    hasPending = true;
    // メッセージが切り替わった場合、新しいメッセージヘッダーを表示
    if (event.message !== currentMessage) {
      $announcementList.append(`
            <li class="pending-message">📌${event.message}</li>
        `);
      currentMessage = event.message;
    }

    $announcementList.append(`
        <li>
          <a href="../event-confirm/event-confirm.html?eventId=${event.id}" class="notification-link">
            ${event.display} ${event.title}
          </a>
        </li>
    `);
  });

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
  const allSnap = await utils.getWrapDocs(qAll);

  // --- isDispTop === true のみ抽出 ---
  const filteredDocs = allSnap.docs.filter(
    (doc) => doc.data().isDispTop === true
  );

  // 全曲プレイリストリンク生成（isDispTop=true のみ）
  const allWatchIds = filteredDocs
    .map((doc) => {
      const data = doc.data();
      // ✅ 修正: デコード済みURL (referenceTrack_decoded) を優先してID抽出に使用
      const urlToExtract = data.referenceTrack_decoded;
      return utils.extractYouTubeId(urlToExtract);
    })
    .filter((id) => !!id) // 空のIDを確実に除外
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
  const limitedDocs = filteredDocs.slice(0, 4);

  if (limitedDocs.length === 0) {
    $scoreList.append(
      '<div class="empty-message">譜面はまだ登録されていません🍀</div>'
    );
    return;
  }

  // 1行に2つずつ表示
  let rowDiv;
  limitedDocs.forEach((doc, idx) => {
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
  const snapshot = await utils.getWrapDocs(
    utils.query(
      utils.collection(utils.db, 'scores'),
      utils.orderBy('createdAt', 'desc')
    )
  );

  // --- isDispTop === true のみ抽出 ---
  scores = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      // ✅ 修正 A: ID抽出には、デコード済みのURLを優先的に使用
      const urlToExtract = data.referenceTrack_decoded;
      const extractedId = utils.extractYouTubeId(urlToExtract);

      return {
        id: doc.id,
        ...data,
        // ✅ 修正 B: BlueNoteの getWatchVideosOrder に合わせ、フィールド名を youtubeId_decoded に変更
        youtubeId_decoded: extractedId,
      };
    })
    // ✅ 修正 C: フィルター条件も新しいフィールド名に合わせる
    .filter((s) => s.isDispTop === true && !!s.youtubeId_decoded);

  if (scores.length === 0) return;

  // デフォルト → 4つのうちからランダム
  currentScoreIndex = utils.getRandomIndex(-1, 4);
  renderScoreVideos();
}

function renderScoreVideos() {
  const $videos = $('#score-videos');
  $videos.empty();

  const score = scores[currentScoreIndex];
  const watchIds = utils.getWatchVideosOrder(currentScoreIndex, scores);

  const html = utils.buildYouTubeHtml(watchIds, false, false);
  $videos.append(`
    <div class="video active" data-index="${currentScoreIndex}">
      ${html}
    </div>
  `);

  $('#score-player-title').text(score.title_decoded || '参考演奏');
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
  const snapshot = await utils.getWrapDocs(
    utils.collection(utils.db, 'blueNotes')
  );
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
  const randomIndex = utils.getRandomIndex(currentIndex, blueNotes.length);

  const indexes = [
    { index: prevIndex, role: 'prev' },
    { index: currentIndex, role: 'current' },
    { index: nextIndex, role: 'next' },
    { index: randomIndex, role: 'random' },
  ];

  indexes.forEach((item) => {
    const note = blueNotes[item.index];
    // この動画を先頭にして全体配列を作る
    const watchIds = utils.getWatchVideosOrder(item.index, blueNotes);

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
  $('#blue-note-title').text(blueNotes[currentIndex].title_decoded);
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

// 修正後の showNext()
function showNext() {
  // インデックス更新
  currentIndex = (currentIndex + 1) % blueNotes.length;

  // DOMをクリアして再構築することで、以前のプレーヤーの状態をリセットします
  renderBlueNoteVideos();
}

// 修正後の showPrev()
function showPrev() {
  // インデックス更新
  currentIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;

  // DOMをクリアして再構築することで、以前のプレーヤーの状態をリセットします
  renderBlueNoteVideos();
}

function showRandom() {
  // 新しいランダムインデックス
  currentIndex = utils.getRandomIndex(currentIndex, blueNotes.length);

  const $videos = $('#blue-note-videos');
  $videos.empty();

  // 再構築（prev, current, next, random 全部新規）
  const prevIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;
  const nextIndex = (currentIndex + 1) % blueNotes.length;
  const randomIndex = utils.getRandomIndex(currentIndex, blueNotes.length);

  const indexes = [
    { index: prevIndex, role: 'prev' },
    { index: currentIndex, role: 'current' },
    { index: nextIndex, role: 'next' },
    { index: randomIndex, role: 'random' },
  ];

  indexes.forEach((item) => {
    const watchIds = utils.getWatchVideosOrder(item.index, blueNotes);
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

// コンテンツを読み込んで表示する関数
async function loadMedias() {
  const mediasRef = utils.collection(utils.db, 'medias');
  const q = utils.query(
    mediasRef,
    utils.orderBy('date', 'desc'),
    utils.limit(3)
  );
  const snap = await utils.getWrapDocs(q);
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
