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
    await Promise.all([loadTickets(), renderMembers(), loadMedias()]);

    // Instagram再スキャン
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
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

// チケット情報の読み込み
async function loadTickets() {
  const upcomingContainer = $('#upcoming-list');

  // 全ライブを取得（日付順）
  const q = utils.query(
    utils.collection(utils.db, 'lives'),
    utils.orderBy('date', 'desc'),
  );

  const snapshot = await utils.getWrapDocs(q);

  if (snapshot.empty) {
    $('.ticket-grid').html('<p class="no-data">No information available.</p>');
    return;
  }

  upcomingContainer.empty();

  // 本日の日付（比較用 YYYY.MM.DD形式）
  const now = new Date();
  const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const liveId = docSnap.id;

    // 日付比較でコンテナを振り分け
    const isPast = data.date < todayStr;

    const cardHtml = `
            <div class="ticket-card" data-id="${liveId}">
                <div class="ticket-img-wrapper">
                    <img src="${data.flyerUrl || '../../images/favicon.png'}" class="ticket-img" alt="flyer">
                </div>
                <div class="ticket-info">
                    <div class="t-date">${data.date}</div>
                    <h3 class="t-title">${data.title}</h3>
                    <div class="t-details">
                        <div><i class="fa-solid fa-location-dot"></i> ${data.venue}</div>
                        <div><i class="fa-solid fa-clock"></i> Open ${data.open} / Start ${data.start}</div>
                        <div><i class="fa-solid fa-link"></i> <a href="${data.venueUrl}" target="_blank" style="color:#aaa">Venue Website</a></div>
                    </div>
                    ${!isPast ? `<button class="btn-reserve" onclick="handleReserve('${liveId}')">予約する / RESERVE</button>` : ''}
                </div>
            </div>
        `;

    if (!isPast) {
      // 今後のライブは日付が近い順に上にしたいので prepend または sortの工夫が必要
      // orderBy(desc) なので append でOK
      upcomingContainer.append(cardHtml);
    }
  });

  if (upcomingContainer.children().length === 0) {
    upcomingContainer.html(
      '<p class="no-data">現在、予約受付中のライブはありません。</p>',
    );
  }
}

// 予約ボタンクリック時
window.handleReserve = async function (liveId) {
  location.href = `../ticket-reserve/ticket-reserve.html?liveId=${liveId}`;
};

/**
 * メンバー表示
 */
async function renderMembers() {
  const members = [
    {
      name: 'Shoei Matsushita',
      role: 'Guitar / Band Master',
      origin: 'Ehime',
      img: 'member1.jpg',
    },
    {
      name: 'Miku Nozoe',
      role: 'Trumpet / Section Leader',
      origin: 'Ehime',
      img: 'member2.jpg',
    },
    {
      name: 'Hiroto Murakami',
      role: 'Trombone / Section Leader',
      origin: 'Ehime',
      img: 'member3.jpg',
    },
    {
      name: 'Kana Asahiro',
      role: 'Trombone / Lead Trombone',
      origin: 'Osaka',
      img: 'member4.jpg',
    },
    {
      name: 'Shunta Yabu',
      role: 'Saxophne / Section Leader',
      origin: 'Hiroshima',
      img: 'member5.jpg',
    },
    {
      name: 'Takumi Fujimoto',
      role: 'Saxophne / Lead Alto Sax',
      origin: 'Hiroshima',
      img: 'member6.jpg',
    },
    {
      name: 'Taisei Yuyama',
      role: 'Saxophne / Lead Tenor Sax',
      origin: 'Ehime',
      img: 'member7.jpg',
    },
    {
      name: 'Akito Kimura',
      role: 'Drums',
      origin: 'Okayama',
      img: 'member8.jpg',
    },
    {
      name: 'Yojiro Nakagawa',
      role: 'Bass',
      origin: 'Hiroshima',
      img: 'member9.jpg',
    },
  ];

  const $grid = $('#member-grid');
  members.forEach((m) => {
    $grid.append(`
      <div class="member-card">
        <div class="member-img-wrapper">
          <img src="../../images/members/${m.img}" alt="${m.name}" class="member-img">
        </div>
        <div class="member-info-content">
          <div class="member-role">${m.role}</div>
          <div class="member-name">${m.name.replace(/ /g, '<br>')}</div>
          <div class="member-origin">from ${m.origin}</div>
        </div>
      </div>
    `);
  });
}

/**
 * Instagram投稿取得
 */
async function loadMedias() {
  const mediaList = $('#media-list');
  const q = utils.query(
    utils.collection(utils.db, 'medias'),
    utils.orderBy('date', 'desc'),
    utils.limit(5),
  );

  const snapshot = await utils.getWrapDocs(q);

  if (snapshot.empty) {
    mediaList.html('<p class="no-data">No history found.</p>');
    return;
  }

  mediaList.empty();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const html = `
      <div class="media-card">
        <div class="media-info">
          <span class="media-date">${data.date}</span>
          <h3 class="media-title">${data.title_decoded || data.title}</h3>
        </div>
        <div class="media-body">
          ${utils.buildInstagramHtml(data.instagramUrl)}
        </div>
      </div>
    `;
    mediaList.append(html);
  });
}

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
