import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (code || state || error) {
      await handleLineLoginCallback(code, state, error);
      return;
    }

    await utils.initDisplay();

    await Promise.all([
      loadTickets(),
      renderMembers(),
      loadMedias(),
      renderGoodsItems(),
    ]);

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

// チケット情報の読み込み（予約状態の判定付き）
async function loadTickets() {
  const upcomingContainer = $('#upcoming-list');
  const uid = utils.getSession('uid');

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

  // 日本時間での今日の日付取得
  const todayStr = utils.format(new Date(), 'yyyy.MM.dd');

  // ログイン中なら予約済みリストを取得
  let myTickets = [];
  if (uid) {
    const resQ = utils.query(
      utils.collection(utils.db, 'tickets'),
      utils.where('uid', '==', uid),
    );
    const resSnap = await utils.getWrapDocs(resQ);
    myTickets = resSnap.docs.map((doc) => doc.data().liveId);
  }

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const liveId = docSnap.id;
    const isPast = data.date < todayStr;
    const isReserved = myTickets.includes(liveId);

    // 詳細ボタン（共通パーツ）
    const detailBtnHtml = `
      <button class="btn-detail" onclick="handleLiveDetail('${liveId}')">
        <i class="fa-solid fa-circle-info"></i> 詳細 / VIEW INFO
      </button>
    `;

    // ボタン部分の生成
    let actionButtons = '';
    if (!isPast) {
      if (isReserved) {
        actionButtons = `
          <div class="reserved-actions">
            ${detailBtnHtml}
            <button class="btn-reserve" onclick="handleReserve('${liveId}')">変更 / CHANGE RESERVE</button>
            <button class="btn-reserve btn-delete" onclick="handleDeleteTicket('${liveId}')">取消 / CANCEL</button>
          </div>
        `;
      } else {
        actionButtons = `
          <div class="reserved-actions">
            ${detailBtnHtml}
            <button class="btn-reserve" onclick="handleReserve('${liveId}')">予約 / RESERVE</button>
          </div>
        `;
      }
    }

    const cardHtml = `
      <div class="ticket-card" data-id="${liveId}">
        <div class="ticket-img-wrapper" onclick="handleLiveDetail('${liveId}')">
          <div class="img-overlay"><i class="fa-solid fa-magnifying-glass"></i></div>
          <img src="${data.flyerUrl || 'https://tappy-heartful.github.io/streak-connect-images/favicon.png'}" class="ticket-img" alt="flyer">
        </div>
        
        <div class="ticket-info">
          <div class="t-date">${isReserved ? '<span class="reserved-label">予約済み</span> ' : ''}${data.date}</div>
          <h3 class="t-title">${data.title}</h3>
          <div class="t-details">
            <div><i class="fa-solid fa-location-dot"></i> ${data.venue}</div>
            <div><i class="fa-solid fa-clock"></i> Open ${data.open} / Start ${data.start}</div>
            <div><i class="fa-solid fa-ticket"></i> 前売：${data.advance}</div>
            <div><i class="fa-solid fa-ticket"></i> 当日：${data.door}</div>
          </div>
          ${actionButtons}
        </div>
      </div>
    `;

    if (!isPast) upcomingContainer.append(cardHtml);
  });
}

/**
 * ライブ詳細ページへ遷移
 */
window.handleLiveDetail = function (liveId) {
  location.href = `../live-detail/live-detail.html?liveId=${liveId}`;
};

/**
 * 予約画面へ遷移
 */
window.handleReserve = function (liveId) {
  location.href = `../ticket-reserve/ticket-reserve.html?liveId=${liveId}`;
};

// 予約画面へ
window.handleReserve = function (liveId) {
  location.href = `../ticket-reserve/ticket-reserve.html?liveId=${liveId}`;
};

// 予約取り消し（削除機能）
window.handleDeleteTicket = async function (liveId) {
  // 削除機能は共通
  await utils.deleteTicket(liveId);
  await loadTickets(); // 表示を更新
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
          <img src="https://tappy-heartful.github.io/streak-connect-images/members/${m.img}" alt="${m.name}" class="member-img">
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
 * BOOTHの商品画像を配列に基づいて生成する
 */
async function renderGoodsItems() {
  // 表示したい画像のファイル名を配列で定義
  const items = [
    'item1.jpg',
    'item2.jpg',
    'item3.jpg',
    'item4.jpg',
    // 'item5.jpg' など、追加があればここに足すだけ
  ];

  const $container = $('#goods-list');
  const basePath =
    'https://tappy-heartful.github.io/streak-connect-images/goods/';

  // 配列をループしてHTMLを生成
  items.forEach((fileName, index) => {
    const fullPath = `${basePath}${fileName}`;
    const imgHtml = `
      <img
        src="${fullPath}"
        alt="Goods ${index + 1}"
        class="square-img btn-view-image"
        data-url="${fullPath}"
      />
    `;
    $container.append(imgHtml);
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
