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

    // パンくずリスト設定
    utils.renderBreadcrumb($('#breadcrumb'), currentLiveId);
    $('.btn-back-home').attr(
      'href',
      `../live-detail/live-detail.html?liveId=${currentLiveId}`,
    );

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

  const liveDetailUrl = `../live-detail/live-detail.html?liveId=${currentLiveId}`;

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
          <a href="${liveDetailUrl}" class="t-title-link">
            <h3 class="t-title">${data.title}</h3>
          </a>
        <div class="t-details">
          <p><i class="fa-solid fa-location-dot"></i> ${data.venue}</p>
          <p><i class="fa-solid fa-clock"></i> Open ${data.open} / Start ${data.start}</p>
          <p><i class="fa-solid fa-ticket"></i>前売：${data.advance}</p>
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
      `<h3 class="sub-title companion-title">${titleText}</h3>
      <p class="form-note" style="margin-bottom:20px;">※あだ名や間柄（「友人」「母」など）でも構いません</p>`, // 💡 ここに注釈を追加
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

  await fetchExistingTicket();

  if (isMember) {
    // 画面ロード時に選択されている radio の値で UI を初期化
    toggleFormUI($('input[name="resType"]:checked').val());
  }

  $('#ticket-form-container').fadeIn();
}

/**
 * 既存予約の取得
 */
async function fetchExistingTicket() {
  const uid = utils.getSession('uid');
  const ticketId = `${currentLiveId}_${uid}`;
  const resRef = utils.doc(utils.db, 'tickets', ticketId);
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
    const newTotalCount =
      resType === 'invite' ? companions.length : companions.length + 1;

    if (newTotalCount === 0) {
      throw new Error('予約人数が0名です。お名前を入力してください。');
    }

    const ticketId = `${currentLiveId}_${uid}`;

    // トランザクション処理開始
    await utils.runTransaction(utils.db, async (transaction) => {
      const liveRef = utils.doc(utils.db, 'lives', currentLiveId);
      const resRef = utils.doc(utils.db, 'tickets', ticketId);

      const liveSnap = await transaction.get(liveRef);
      const oldResSnap = await transaction.get(resRef);

      if (!liveSnap.exists()) throw new Error('ライブ情報が存在しません。');

      const liveData = liveSnap.data();

      // 日本時間(Asia/Tokyo)で yyyy.mm.dd 形式を取得
      const nowStr = utils.format(new Date(), 'yyyy.MM.dd');

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
      const currentTotalSold = liveData.totalReserved || 0;

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

      // --- 1. 予約番号の生成 ---
      // 新規の場合は生成、更新の場合は既存の番号を維持
      let reservationNo;
      if (!oldResSnap.exists()) {
        // 数字のみ4桁のランダムな文字列を生成 (0000〜9999)
        reservationNo = Math.floor(1000 + Math.random() * 9000).toString();
      } else {
        reservationNo = oldResSnap.data().reservationNo;
      }

      // 2. 予約データの構築
      const ticketData = {
        liveId: currentLiveId,
        uid: uid,
        resType: resType,
        representativeName: representativeName,
        reservationNo: reservationNo, // 予約番号を追加
        companions: companions,
        companionCount: companions.length,
        totalCount: newTotalCount,
        updatedAt: utils.serverTimestamp(),
      };

      if (!oldResSnap.exists()) {
        ticketData.createdAt = utils.serverTimestamp();
        transaction.set(resRef, ticketData); // 新規作成
      } else {
        transaction.update(resRef, ticketData); // 更新
      }

      // 3. ライブ側の総予約数を更新
      transaction.update(liveRef, {
        totalReserved: currentTotalSold + diff,
      });
    });

    utils.hideSpinner();
    await utils.showDialog('予約を確定しました！ ', true);
    window.location.href =
      '../ticket-detail/ticket-detail.html?ticketId=' + ticketId;
  } catch (err) {
    console.error('Transaction failed: ', err);
    utils.hideSpinner();
    await utils.showDialog(err.message, true);
  }
});
