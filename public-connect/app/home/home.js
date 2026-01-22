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

// 投票・募集・集金・イベントをまとめて「お知らせ」に表示
async function loadPendingAnnouncements() {
  const uid = utils.getSession('uid');
  const $announcementList = $('.notification-list');
  $announcementList.empty();

  let hasPending = false;

  // --------------------------------------------------
  // 1. 投票セクション
  // --------------------------------------------------
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getWrapDocs(qVotes);

  let hasPendingVotes = false;
  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    if (!utils.isInTerm(voteData.acceptStartDate, voteData.acceptEndDate))
      continue;

    if (!hasPendingVotes) {
      $announcementList.append(
        `<li class="pending-message">📌投票、受付中です！</li>`
      );
      hasPendingVotes = true;
      hasPending = true;
    }
    $announcementList.append(`
      <li>
        <a href="../vote-confirm/vote-confirm.html?voteId=${voteDoc.id}" class="notification-link">
          📝${voteData.name}
        </a>
      </li>
    `);
  }

  // --------------------------------------------------
  // 2. 曲募集セクション
  // --------------------------------------------------
  const callsRef = utils.collection(utils.db, 'calls');
  const qCalls = utils.query(callsRef, utils.orderBy('createdAt', 'desc'));
  const callsSnap = await utils.getWrapDocs(qCalls);

  let hasPendingCalls = false;
  for (const callDoc of callsSnap.docs) {
    const callData = callDoc.data();
    if (!utils.isInTerm(callData.acceptStartDate, callData.acceptEndDate))
      continue;

    if (!hasPendingCalls) {
      $announcementList.append(
        `<li class="pending-message">📌候補曲、募集中です！</li>`
      );
      hasPendingCalls = true;
      hasPending = true;
    }
    $announcementList.append(`
      <li>
        <a href="../call-confirm/call-confirm.html?callId=${callDoc.id}" class="notification-link">
          🎶${callData.title}
        </a>
      </li>
    `);
  }

  // --------------------------------------------------
  // 3. 集金セクション
  // --------------------------------------------------
  const collectsRef = utils.collection(utils.db, 'collects');
  const collectsSnap = await utils.getWrapDocs(collectsRef);

  let hasPendingCollects = false;
  for (const collectDoc of collectsSnap.docs) {
    const collectData = collectDoc.data();

    // A. 受付期間チェック
    if (!utils.isInTerm(collectData.acceptStartDate, collectData.acceptEndDate))
      continue;

    // B. 対象ユーザー (participants) に含まれているかチェック
    const participants = collectData.participants || [];
    if (!participants.includes(uid)) continue;

    // C. 担当者（建て替え、または集金管理）本人の場合は除外
    if (collectData.upfrontPayer === uid || collectData.managerName === uid)
      continue;

    // D. 支払い済みチェック
    const responseRef = utils.doc(
      utils.db,
      'collects',
      collectDoc.id,
      'responses',
      uid
    );
    const responseSnap = await utils.getWrapDoc(responseRef);

    // ドキュメントが存在しなければ未支払い
    if (!responseSnap.exists()) {
      if (!hasPendingCollects) {
        $announcementList.append(
          `<li class="pending-message">📌集金、受付中です！</li>`
        );
        hasPendingCollects = true;
        hasPending = true;
      }
      $announcementList.append(`
        <li>
          <a href="../collect-confirm/collect-confirm.html?collectId=${collectDoc.id}" class="notification-link">
            💰${collectData.title}
          </a>
        </li>
      `);
    }
  }

  // --------------------------------------------------
  // 4. イベントデータの取得と判定
  // --------------------------------------------------
  const eventsRef = utils.collection(utils.db, 'events');
  const qEvents = utils.query(eventsRef, utils.orderBy('date', 'asc'));
  const eventsSnap = await utils.getWrapDocs(qEvents);

  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');

  const allEvents = await Promise.all(
    eventsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const eventId = doc.id;
      const isInTerm = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

      const res = {
        id: eventId,
        title: data.title,
        date: data.date,
        type: data.attendanceType,
        isPast: data.date && data.date < todayStr,
        isAssignPending: data.allowAssign,
        isSchedule: data.attendanceType === 'schedule',
        isAttendance: data.attendanceType === 'attendance',
      };

      if (isInTerm && uid) {
        const coll = res.isSchedule
          ? 'eventAdjustAnswers'
          : 'eventAttendanceAnswers';
        const answerSnap = await utils.getWrapDoc(
          utils.doc(utils.db, coll, `${eventId}_${uid}`)
        );
        res.isUnanswered = !answerSnap.exists();
      }

      if (data.date) {
        const eventDate = new Date(data.date.replace(/\./g, '/'));
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        res.diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      }
      return res;
    })
  );

  const upcomingEvents = allEvents.filter((e) => !e.isPast);

  // --------------------------------------------------
  // 5. 表示ロジック（イベント関連）
  // --------------------------------------------------

  // --- 5.1. 未回答の日程調整 (🗓️) ---
  const schedulePending = upcomingEvents.filter(
    (e) => e.isSchedule && e.isUnanswered
  );
  if (schedulePending.length > 0) {
    hasPending = true;
    $announcementList.append(
      `<li class="pending-message">📌日程調整、受付中です！</li>`
    );
    schedulePending.forEach((e) => {
      $announcementList.append(`
        <li><a href="../event-confirm/event-confirm.html?eventId=${e.id}" class="notification-link">🗓️ ${e.title}</a></li>
      `);
    });
  }

  // --- 5.2. 直近の確定イベントを1つだけ表示 ---
  let targetEvent = upcomingEvents.find(
    (e) => e.isAttendance && e.isUnanswered
  );
  if (!targetEvent) {
    targetEvent = upcomingEvents.find((e) => e.date);
  }

  if (targetEvent) {
    hasPending = true;
    let header = targetEvent.isUnanswered
      ? '📌出欠確認、受付中です！'
      : `📌次のイベントまで、あと${targetEvent.diffDays}日！`;
    if (targetEvent.diffDays === 0) header = '📌今日はイベント当日です！';

    $announcementList.append(`<li class="pending-message">${header}</li>`);
    $announcementList.append(`
      <li>
        <a href="../event-confirm/event-confirm.html?eventId=${targetEvent.id}" class="notification-link">
          📅${targetEvent.date} ${targetEvent.title}
        </a>
      </li>
    `);
  }

  // --- 5.3. 譜割り受付中 (🎵) ---
  const assignPending = upcomingEvents.filter((e) => e.isAssignPending);
  if (assignPending.length > 0) {
    hasPending = true;
    $announcementList.append(
      `<li class="pending-message">📌譜割り、受付中です！</li>`
    );
    assignPending.forEach((e) => {
      $announcementList.append(`
        <li>
          <a href="../assign-confirm/assign-confirm.html?eventId=${e.id}" class="notification-link">
            🎵${e.date} ${e.title}
          </a>
        </li>
      `);
    });
  }

  // --------------------------------------------------
  // 6. お知らせがない場合のメッセージ
  // --------------------------------------------------
  if (
    !hasPending &&
    !hasPendingVotes &&
    !hasPendingCalls &&
    !hasPendingCollects
  ) {
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
    utils.limit(4)
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
