import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // 初期処理
    await utils.initDisplay();
    await loadPendingAnnouncements();
    await loadBlueNotes();
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

// Blue Noteを読み込んで表示する関数
async function loadBlueNotes() {
  const $blueNote = $('#blue-note');
  $blueNote.empty();

  // 今日の日付を4桁(例: "0914")で取得
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayId = month + day;

  // blueNotesコレクションを参照
  const notesRef = utils.collection(utils.db, 'blueNotes');
  const docRef = utils.doc(notesRef, todayId);
  const docSnap = await utils.getDoc(docRef);

  let youtubeUrl;

  if (docSnap.exists()) {
    // 今日の日付が見つかった場合
    youtubeUrl = docSnap.data().youtubeUrl;
  } else {
    // 全データを取得してランダムに1件選ぶ
    const snapshot = await utils.getDocs(notesRef);
    const allDocs = snapshot.docs;

    if (allDocs.length > 0) {
      const randomDoc = allDocs[Math.floor(Math.random() * allDocs.length)];
      youtubeUrl = randomDoc.data().youtubeUrl;
    }
  }

  // YouTube埋め込みを表示
  if (youtubeUrl) {
    $blueNote.append(utils.buildYouTubeHtml(youtubeUrl));
  } else {
    $blueNote.append('<p>Blue Noteが見つかりませんでした。</p>');
  }
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

    // TOP表示フラグが false または未設定ならスキップ
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
  // 「別の曲を聴く」ボタン
  $('#blue-note-refresh').on('click', async () => {
    const $blueNote = $('#blue-note');
    $blueNote.empty();

    // blueNotesコレクションを参照
    const notesRef = utils.collection(utils.db, 'blueNotes');
    const snapshot = await utils.getDocs(notesRef);
    const allDocs = snapshot.docs;

    if (allDocs.length > 0) {
      const randomDoc = allDocs[Math.floor(Math.random() * allDocs.length)];
      const youtubeUrl = randomDoc.data().youtubeUrl;

      // 埋め込み表示
      $blueNote.append(utils.buildYouTubeHtml(youtubeUrl));
    } else {
      $blueNote.append('<p>Blue Noteが見つかりませんでした。</p>');
    }
  });
}
