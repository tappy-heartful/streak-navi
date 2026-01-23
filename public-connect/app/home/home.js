import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // 1. LINEログインからの戻り時
    if (code || state || error) {
      await handleLineLoginCallback(code, state, error);
      return; // リダイレクトが発生するためここで終了
    }

    // 2. 通常表示時の初期処理
    await utils.initDisplay();

    // 並行してデータ取得
    await Promise.all([loadUpcomingLives(), loadLatestMedia()]);
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: 'none',
      action: 'Home初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

/**
 * LINEコールバック処理
 */
async function handleLineLoginCallback(code, state, error) {
  try {
    utils.showSpinner();
    if (error) throw new Error('LINEログインに失敗しました: ' + error);
    if (!code || !state) throw new Error('無効なLINEログイン応答です');

    // 今のページのURL（クエリパラメータ抜き）をredirectUriとして送信
    const redirectUri = window.location.origin + window.location.pathname;

    const loginResponse = await fetch(
      `${utils.globalAuthServerRender}/line-login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, redirectUri }),
      },
    );

    const {
      customToken,
      profile,
      redirectAfterLogin, // サーバーのFirestoreから復元されたURL
      error: loginError,
    } = await loginResponse.json();

    if (loginError) throw new Error(loginError);
    if (!customToken) throw new Error('カスタムトークン取得失敗');

    // Firebaseログイン
    const userCredential = await utils.signInWithCustomToken(
      utils.auth,
      customToken,
    );
    const user = userCredential.user;
    utils.setSession('uid', user.uid);

    // 【修正】保存先を connectUsers に変更
    const userRef = utils.doc(utils.db, 'connectUsers', user.uid);
    const docSnap = await utils.getWrapDoc(userRef);
    const userExists = docSnap.exists();

    const displayName = profile.displayName || '名無し';
    const pictureUrl = profile.pictureUrl || utils.globalLineDefaultImage;

    const userData = {
      displayName,
      pictureUrl,
      lastLoginAt: utils.serverTimestamp(),
    };

    if (!userExists) {
      userData.createdAt = utils.serverTimestamp();
    }

    await utils.setDoc(userRef, userData, { merge: true });

    // 最新のユーザー情報をセッションに同期
    const latestUserSnap = await utils.getWrapDoc(userRef);
    const latestUserData = latestUserSnap.data();
    for (const [key, value] of Object.entries(latestUserData)) {
      utils.setSession(key, value);
    }
    utils.setSession('uid', user.uid);

    // 【修正】リダイレクト判定
    // サーバーから戻り先URLが来ていればそこへ、無ければホームへ
    const targetUrl = redirectAfterLogin || './home.html';
    window.location.href = targetUrl;
  } catch (e) {
    alert('ログインエラー: ' + e.message);
    await utils.writeLog({
      dataId: 'none',
      action: 'ログイン',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
    window.location.href = './home.html'; // エラー時もとりあえずホームへ
  } finally {
    utils.hideSpinner();
  }
}

async function loadUpcomingLives() {
  const container = $('#live-list');
  const q = utils.query(
    utils.collection(utils.db, 'lives'),
    utils.orderBy('date', 'asc'),
    utils.limit(3),
  );

  const snapshot = await utils.getWrapDocs(q);
  if (snapshot.empty) {
    container.html('<p class="no-data">Stay tuned for upcoming schedules.</p>');
    return;
  }

  container.empty();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    container.append(`
      <div class="live-card">
        <div class="live-date-box">
          <span class="l-date">${data.date}</span>
        </div>
        <div class="live-info">
          <h3 class="l-title">${data.title}</h3>
          <p class="l-venue"><i class="fa-solid fa-location-dot"></i> ${
            data.venue || 'TBA'
          }</p>
        </div>
      </div>
    `);
  });
}

async function loadLatestMedia() {
  const container = $('#media-preview');
  // 💡 limit(4) に変更
  const q = utils.query(
    utils.collection(utils.db, 'medias'),
    utils.orderBy('date', 'desc'),
    utils.limit(4),
  );

  const snapshot = await utils.getWrapDocs(q);
  if (snapshot.empty) return;

  container.empty();

  // 💡 ループですべてのドキュメントをappend
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    container.append(utils.buildInstagramHtml(data.instagramUrl));
  });

  // Instagramの再スキャン（これをしないと埋め込みが表示されない）
  if (window.instgrm) {
    window.instgrm.Embeds.process();
  }
}
