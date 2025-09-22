import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // 初期処理
    await utils.initDisplay();
    await loadPendingAnnouncements();
    await initBlueNotes();
    await loadMedias();

    // イベント登録
    setupEventHandlers();

    // スピナー非表示
    utils.hideSpinner();

    const fromLogin = utils.globalGetParamFromLogin === '1'; // ログイン画面から
    const isInit = utils.globalGetParamIsInit === '1'; // ユーザ編集画面から

    // 初回遷移時ウェルカム演出
    if (fromLogin || isInit) {
      const lineIconPath = utils.getSession('pictureUrl');
      const lineAccountName = utils.getSession('displayName');

      $('#welcome-line-icon').attr('src', lineIconPath);
      $('#welcome-line-name').text(lineAccountName);

      // 挨拶メッセージ
      const greetingMessage = isInit
        ? 'ようこそ🌸'
        : fromLogin
        ? getGreetingMessage()
        : '';
      $('#greeting-message').text(greetingMessage);

      const $overlay = $('#first-login-overlay');
      $overlay.removeClass('hidden');
      // 表示
      setTimeout(() => {
        $overlay.addClass('show');
      }, 10); // 少し遅延させてCSS transitionを確実に動かす

      // 1.5秒表示 → フェードアウト（0.5秒）
      setTimeout(() => {
        $overlay.removeClass('show');
        // 完全に非表示に
        setTimeout(() => {
          $overlay.addClass('hidden');
        }, 500);
      }, 2000);
    }
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

// 挨拶メッセージを取得する関数
function getGreetingMessage() {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return 'おはようございます☀️';
  if (hour >= 11 && hour < 17) return 'こんにちは🎵';
  return 'こんばんは🌙';
}

// 未回答の投票・募集をまとめて「お知らせ」に表示
async function loadPendingAnnouncements() {
  const uid = utils.getSession('uid');
  const $announcementList = $('.notification-list');
  $announcementList.empty();

  let hasPending = false;

  // --- 未回答の投票 ---
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  let hasPendingVotes = false;

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    if (voteData.isActive === false) continue;

    const voteId = voteDoc.id;
    const answerId = `${voteId}_${uid}`;
    const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
    const answerSnap = await utils.getDoc(answerDocRef);

    if (!answerSnap.exists()) {
      if (!hasPendingVotes) {
        $announcementList.append(`
          <li class="pending-message">
            📌未回答の投票があります
          </li>
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
  }

  // --- 未回答の曲募集 ---
  const callsRef = utils.collection(utils.db, 'calls');
  const qCalls = utils.query(callsRef, utils.orderBy('createdAt', 'desc'));
  const callsSnap = await utils.getDocs(qCalls);

  let hasPendingCalls = false;

  for (const callDoc of callsSnap.docs) {
    const callData = callDoc.data();
    if (callData.isActive === false) continue;

    const callId = callDoc.id;
    const answerId = `${callId}_${uid}`;
    const answerDocRef = utils.doc(utils.db, 'callAnswers', answerId);
    const answerSnap = await utils.getDoc(answerDocRef);

    if (!answerSnap.exists()) {
      if (!hasPendingCalls) {
        $announcementList.append(`
          <li class="pending-message">
            📌候補曲、募集中！
          </li>
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
  }

  // どちらも未回答がなければ空メッセージ
  if (!hasPending) {
    $announcementList.append(`
      <li class="empty-message">
        <div class="notification-link">お知らせはありません🍀</div>
      </li>
    `);
  }
}

// Blue Notesを読み込んで表示する関数
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

    const html = utils.buildYouTubeHtml(watchIds);

    $videos.append(`
      <div class="blue-note-video ${item.role === 'current' ? 'active' : ''}"
           data-role="${item.role}"
           data-index="${item.index}">
        ${html}
      </div>
    `);
  });

  updateBlueNoteTitle();
}

function updateBlueNoteTitle() {
  $('#blue-note-title').text(blueNotes[currentIndex].title);
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
  const html = utils.buildYouTubeHtml(watchIds);

  $videos.append(`
    <div class="blue-note-video" data-role="next" data-index="${newNextIndex}">
      ${html}
    </div>
  `);

  updateBlueNoteTitle();
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
  const html = utils.buildYouTubeHtml(watchIds);

  $videos.prepend(`
    <div class="blue-note-video" data-role="prev" data-index="${newPrevIndex}">
      ${html}
    </div>
  `);

  updateBlueNoteTitle();
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
    const html = utils.buildYouTubeHtml(watchIds);
    $videos.append(`
      <div class="blue-note-video ${item.role === 'current' ? 'active' : ''}"
           data-role="${item.role}"
           data-index="${item.index}">
        ${html}
      </div>
    `);
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
  const q = utils.query(mediasRef, utils.orderBy('date', 'desc'));
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
function setupEventHandlers() {
  $('#blue-note-prev').on('click', showPrev);
  $('#blue-note-next').on('click', showNext);
  $('#blue-note-random').on('click', showRandom);
}
