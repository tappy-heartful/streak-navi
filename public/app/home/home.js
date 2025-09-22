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

  currentIndex = 0; // 初期は先頭でOK
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
    $videos.append(`
      <div class="blue-note-video ${item.role === 'current' ? 'active' : ''}" 
           data-role="${item.role}" 
           data-index="${item.index}">
        ${utils.buildYouTubeHtml(note.youtubeId)}
      </div>
    `);
  });

  updateBlueNoteTitle();
}

function updateBlueNoteTitle() {
  $('#blue-note-title').text(blueNotes[currentIndex].title);
}

function showPrev() {
  const $videos = $('#blue-note-videos');
  const $current = $videos.find('[data-role="current"]');
  const $prev = $videos.find('[data-role="prev"]');
  const $next = $videos.find('[data-role="next"]');

  // current を next に
  $current.attr('data-role', 'next').removeClass('active');

  // prev を current に
  $prev.attr('data-role', 'current').addClass('active');
  currentIndex = parseInt($prev.attr('data-index'));

  // 古い next を削除
  $next.remove();

  // 新しい prev を作成
  const newPrevIndex = (currentIndex - 1 + blueNotes.length) % blueNotes.length;
  const newPrev = blueNotes[newPrevIndex];
  $videos.append(`
    <div class="blue-note-video" data-role="prev" data-index="${newPrevIndex}">
      ${utils.buildYouTubeHtml(newPrev.youtubeId)}
    </div>
  `);

  updateBlueNoteTitle();
}

function showNext() {
  const $videos = $('#blue-note-videos');
  const $current = $videos.find('[data-role="current"]');
  const $prev = $videos.find('[data-role="prev"]');
  const $next = $videos.find('[data-role="next"]');

  // current を prev に
  $current.attr('data-role', 'prev').removeClass('active');

  // next を current に
  $next.attr('data-role', 'current').addClass('active');
  currentIndex = parseInt($next.attr('data-index'));

  // 古い prev を削除
  $prev.remove();

  // 新しい next を作成
  const newNextIndex = (currentIndex + 1) % blueNotes.length;
  const newNext = blueNotes[newNextIndex];
  $videos.append(`
    <div class="blue-note-video" data-role="next" data-index="${newNextIndex}">
      ${utils.buildYouTubeHtml(newNext.youtubeId)}
    </div>
  `);

  updateBlueNoteTitle();
}

function showRandom() {
  const $videos = $('#blue-note-videos');
  $videos.empty();

  currentIndex = getRandomIndex(currentIndex);
  renderBlueNoteVideos(); // 再構築
}

function getRandomIndex(exclude) {
  let idx;
  do {
    idx = Math.floor(Math.random() * blueNotes.length);
  } while (idx === exclude && blueNotes.length > 1);
  return idx;
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
