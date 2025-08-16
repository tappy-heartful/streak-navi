import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  try {
    // 初期処理
    await utils.initDisplay();
    await loadPendingVotesForAnnouncement();
    await loadMenu();

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

    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
    });
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

// 未投票の投票を取得して「お知らせ」に表示
async function loadPendingVotesForAnnouncement() {
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  const uid = utils.getSession('uid');
  const $announcementList = $('.notification-list');
  $announcementList.empty();

  let hasPending = false;

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();

    if (voteData.isActive === false) continue; // 終了は除外

    const voteId = voteDoc.id;
    const answerId = `${voteId}_${uid}`;
    const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
    const answerSnap = await utils.getDoc(answerDocRef);

    if (!answerSnap.exists()) {
      // 未投票ならお知らせに追加
      $announcementList.append(`
        <li>
          <a href="../vote-confirm/vote-confirm.html?voteId=${voteId}" class="notification-link">
            📝${voteData.name}
          </a>
        </li>
      `);
      hasPending = true;
    }
  }

  // 未投票がなければ「お知らせはありません🍀」を表示
  if (!hasPending) {
    $announcementList.append(`
      <li class="empty-message">
        <div class="notification-link">
          お知らせはありません🍀
        </div>
      </li>
    `);
  }
}

// メニューを読み込んで表示する関数
async function loadMenu() {
  const $menuList = $('.menu-list');
  const voteAdminFlg = utils.getSession('voteAdminFlg');

  // 投票一覧
  $menuList.append(
    `<a href="../vote-list/vote-list.html" class="menu-button vote">📊 投票一覧</a>`
  );

  // 投票新規作成
  if (voteAdminFlg === utils.globalStrTrue) {
    // 投票管理者の場合にのみ表示
    $menuList.append(
      `<a href="../vote-edit/vote-edit.html?mode=new" class="menu-button memo">📝 投票新規作成</a>`
    );
  }

  // ユーザ一覧
  $menuList.append(
    `<a href="../user-list/user-list.html" class="menu-button user">👥 ユーザ一覧</a>`
  );
}
