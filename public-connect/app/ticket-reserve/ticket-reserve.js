import * as utils from '../common/functions.js';

let currentLiveId = null;
let maxCompanions = 0;
let isMember = false;

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    const urlParams = new URLSearchParams(window.location.search);
    currentLiveId = urlParams.get('liveId');

    if (!currentLiveId) {
      await utils.showDialog('ライブIDが見つかりません。', true);
      window.location.href = '../home/home.html';
      return;
    }

    // streak-navi（usersコレクション）に存在するかチェック
    const uid = utils.getSession('uid');
    const userRef = utils.doc(utils.db, 'users', uid);
    const userSnap = await utils.getWrapDoc(userRef);
    isMember = userSnap.exists();

    // UI初期化
    if (isMember) {
      $('#res-type-container').show();
      $('#memberNameDisplay').val(utils.getSession('displayName'));
    }

    await loadLiveDetail();

    // 予約種別切り替え時のイベント
    $('input[name="resType"]').on('change', function () {
      toggleFormUI(this.value);
    });

    // Hero画像設定
    $('.hero').css(
      '--hero-bg',
      'url("https://tappy-heartful.github.io/streak-connect-images/background/ticket-reserve.jpg")',
    );
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * UIの表示切り替えロジック
 */
function toggleFormUI(type) {
  if (type === 'invite') {
    // 知人を招待モード
    $('#representative-area').hide();
    $('#representativeName').prop('required', false);
    $('#member-info-area').show();
    $('.companion-title').text('招待するお客様のお名前');
  } else {
    // 一般予約モード
    $('#representative-area').show();
    $('#representativeName').prop('required', true);
    $('#member-info-area').hide();
    $('.companion-title').text('同伴者様');
  }
}

/**
 * ライブ詳細情報の読み込みとフォーム生成
 */
async function loadLiveDetail() {
  const container = $('#live-detail-container');
  const liveRef = utils.doc(utils.db, 'lives', currentLiveId);
  const liveSnap = await utils.getWrapDoc(liveRef);

  if (!liveSnap.exists()) {
    container.html('<p class="no-data">ライブ情報が見つかりませんでした。</p>');
    return;
  }

  const data = liveSnap.data();
  maxCompanions = data.maxCompanions || 0;

  container.html(`
    <div class="ticket-card detail-mode">
      <div class="ticket-info">
        <div class="t-date">${data.date}</div>
        <h3 class="t-title">${data.title}</h3>
        <div class="t-details">
          <p><i class="fa-solid fa-location-dot"></i> ${data.venue}</p>
          <p><i class="fa-solid fa-clock"></i> Open ${data.open} / Start ${data.start}</p>
          <p><i class="fa-solid fa-ticket"></i>${data.advance}</p>
        </div>
      </div>
    </div>
  `);

  const companionContainer = $('#companion-inputs-container');
  companionContainer.empty();

  if (maxCompanions > 0) {
    // 招待予約が初期値(invite)なので「招待するお客様〜」をデフォルトに
    const titleText = isMember ? '招待するお客様のお名前' : '同伴者様';
    companionContainer.append(
      `<h3 class="sub-title companion-title">${titleText}</h3>`,
    );

    for (let i = 1; i <= maxCompanions; i++) {
      companionContainer.append(`
        <div class="form-group">
          <label for="companionName${i}">ゲスト ${i}</label>
          <div class="input-row">
            <input type="text" id="companionName${i}" name="companionName" class="companion-input" placeholder="お名前を入力">
            <span class="honorific">様</span>
          </div>
        </div>
      `);
    }
  }

  await fetchExistingReservation();

  if (isMember) {
    // 画面ロード時に選択されている radio の値で UI を初期化
    toggleFormUI($('input[name="resType"]:checked').val());
  }

  $('#reservation-form-container').fadeIn();
}

/**
 * 既存予約の取得
 */
async function fetchExistingReservation() {
  const uid = utils.getSession('uid');
  const reservationId = `${currentLiveId}_${uid}`;
  const resRef = utils.doc(utils.db, 'liveReservations', reservationId);
  const resSnap = await utils.getWrapDoc(resRef);

  if (resSnap.exists()) {
    const resData = resSnap.data();

    // 予約種別の復元
    if (resData.resType) {
      $(`input[name="resType"][value="${resData.resType}"]`).prop(
        'checked',
        true,
      );
      toggleFormUI(resData.resType);
    }

    $('#representativeName').val(resData.representativeName || '');
    const companions = resData.companions || [];
    companions.forEach((name, index) => {
      $(`#companionName${index + 1}`).val(name);
    });

    $('#submit-btn').text('予約内容を更新する / UPDATE');
  } else {
    $('#representativeName').val(utils.getSession('displayName') || '');
  }
}

/**
 * フォーム送信処理（トランザクション実装）
 */
$('#reserve-form').on('submit', async function (e) {
  e.preventDefault();
  utils.showSpinner();

  try {
    const uid = utils.getSession('uid');
    // メンバーなら選択した種別、一般なら'general'
    const resType = isMember
      ? $('input[name="resType"]:checked').val()
      : 'general';

    // 招待モードなら代表者は自分（メンバー名）、一般なら入力された名前
    const representativeName =
      resType === 'invite'
        ? utils.getSession('displayName')
        : $('#representativeName').val().trim();

    // 同伴者リストの取得
    const companions = [];
    $('.companion-input').each(function () {
      const val = $(this).val().trim();
      if (val) companions.push(val);
    });

    // 予約合計人数の計算
    // 一般予約: 代表者(1) + 同伴者数
    // 招待予約: 同伴者（招待客）数のみ（※仕様に合わせて調整。自分を含めるなら+1してください）
    const newTotalCount =
      resType === 'invite' ? companions.length : companions.length + 1;

    if (newTotalCount === 0) {
      throw new Error('予約人数が0名です。お名前を入力してください。');
    }

    const reservationId = `${currentLiveId}_${uid}`;

    // トランザクション処理開始
    await utils.runTransaction(utils.db, async (transaction) => {
      const liveRef = utils.doc(utils.db, 'lives', currentLiveId);
      const resRef = utils.doc(utils.db, 'liveReservations', reservationId);

      const liveSnap = await transaction.get(liveRef);
      const oldResSnap = await transaction.get(resRef);

      if (!liveSnap.exists()) throw new Error('ライブ情報が存在しません。');

      const liveData = liveSnap.data();

      // --- 追加機能: 受付期間のチェック (任意) ---
      const nowStr = new Date().toISOString().split('T')[0].replace(/-/g, '.'); // "2026.01.25"形式
      if (liveData.acceptStartDate && nowStr < liveData.acceptStartDate) {
        throw new Error(`予約受付は ${liveData.acceptStartDate} からです。`);
      }
      if (liveData.acceptEndDate && nowStr > liveData.acceptEndDate) {
        throw new Error(
          `予約受付は ${liveData.acceptEndDate} で終了しました。`,
        );
      }

      // 在庫管理用変数の取得
      const ticketStock = liveData.ticketStock || 0;
      const currentTotalSold = liveData.totalReserved || 0; // すでに予約済みの総数

      // 今回の更新による増分を計算 (新規なら oldResCount は 0)
      const oldResCount = oldResSnap.exists()
        ? oldResSnap.data().totalCount || 0
        : 0;
      const diff = newTotalCount - oldResCount;

      // 在庫チェック
      if (currentTotalSold + diff > ticketStock) {
        const remaining = ticketStock - currentTotalSold;
        throw new Error(
          `完売または残席不足です。 (現在の残り：${remaining > 0 ? remaining : 0}枚)`,
        );
      }

      // 1. 予約データの作成/更新
      const reservationData = {
        liveId: currentLiveId,
        uid: uid,
        resType: resType,
        representativeName: representativeName,
        companions: companions,
        companionCount: companions.length,
        totalCount: newTotalCount,
        updatedAt: utils.serverTimestamp(),
      };

      if (!oldResSnap.exists()) {
        reservationData.createdAt = utils.serverTimestamp();
        transaction.set(resRef, reservationData); // 新規作成
      } else {
        transaction.update(resRef, reservationData); // 更新
      }

      // 2. ライブ側の総予約数を更新
      transaction.update(liveRef, {
        totalReserved: currentTotalSold + diff,
      });
    });

    utils.hideSpinner();
    await utils.showDialog('予約を確定しました！', true);
    window.location.href = '../mypage/mypage.html';
  } catch (err) {
    console.error('Transaction failed: ', err);
    utils.hideSpinner();
    // カスタムダイアログでエラーメッセージを表示
    await utils.showDialog(err.message, true);
  }
});
