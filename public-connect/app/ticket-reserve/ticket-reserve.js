import * as utils from '../common/functions.js';

let currentLiveId = null;
let maxCompanions = 0;
let isMember = false;

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    // 【重要】リダイレクトが走っている最中に下のコードが動かないよう、
    // 確実にuidが存在するかチェックを入れ、なければここで処理を止める。
    const uid = utils.getSession('uid');
    if (!uid) return;

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
    await utils.writeLog({
      dataId: 'none',
      action: 'TicketReserve初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
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

  // 戻り先の判定
  const urlParams = new URLSearchParams(window.location.search);
  const fromPage = urlParams.get('fromPage');
  const backUrl =
    fromPage === 'mypage' ? '../mypage/mypage.html' : '../home/home.html';

  if (!liveSnap.exists()) {
    await utils.showDialog('ライブ情報が見つかりませんでした。', true);
    window.location.href = backUrl;
    return;
  }

  const data = liveSnap.data();

  // --- 予約受付可否・期間のチェック ---
  const todayStr = utils.format(new Date(), 'yyyy.MM.dd');
  const isAccepting = data.isAcceptReserve === true;
  const isWithinPeriod =
    (!data.acceptStartDate || todayStr >= data.acceptStartDate) &&
    (!data.acceptEndDate || todayStr <= data.acceptEndDate);

  if (!isAccepting || !isWithinPeriod) {
    let msg = '申し訳ありません。現在このライブの予約は受け付けておりません。';
    if (data.acceptStartDate && todayStr < data.acceptStartDate) {
      msg = `予約受付は ${data.acceptStartDate} から開始となります。`;
    } else if (data.acceptEndDate && todayStr > data.acceptEndDate) {
      msg = `予約受付は ${data.acceptEndDate} で終了いたしました。`;
    }

    await utils.showDialog(msg, true);
    window.location.href = backUrl;
    return;
  }
  // ----------------------------------

  maxCompanions = data.maxCompanions || 0;

  const liveDetailUrl = `../live-detail/live-detail.html?liveId=${currentLiveId}`;

  // 注意文言（notes）がある場合のみHTMLを生成
  const notesHtml = data.notes
    ? `<div class="live-notes-area"><p class="live-notes-text">${data.notes}</p></div>`
    : '';

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
        ${notesHtml} </div>
    </div>
  `);

  const companionContainer = $('#companion-inputs-container');
  companionContainer.empty();

  if (maxCompanions > 0) {
    const titleText = isMember ? '招待するお客様のお名前' : '同伴者様';
    companionContainer.append(
      `<h3 class="sub-title companion-title">${titleText}</h3>
      <p class="form-note" style="margin-bottom:20px;">※あだ名や間柄（「友人」「母」など）でも構いません</p>`,
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

  // 1. ユーザーへの確認
  if (!(await utils.showDialog('この内容で予約しますか？'))) {
    return false;
  }

  utils.showSpinner();

  const uid = utils.getSession('uid');
  const ticketId = `${currentLiveId}_${uid}`;

  try {
    const resType = isMember
      ? $('input[name="resType"]:checked').val()
      : 'general';
    const representativeName =
      resType === 'invite'
        ? utils.getSession('displayName')
        : $('#representativeName').val().trim();

    const companions = [];
    $('.companion-input').each(function () {
      const val = $(this).val().trim();
      if (val) companions.push(val);
    });

    const newTotalCount =
      resType === 'invite' ? companions.length : companions.length + 1;

    if (newTotalCount === 0) {
      throw new Error('予約人数が0名です。お名前を入力してください。');
    }

    await utils.runTransaction(utils.db, async (transaction) => {
      const liveRef = utils.doc(utils.db, 'lives', currentLiveId);
      const resRef = utils.doc(utils.db, 'tickets', ticketId);

      const liveSnap = await transaction.get(liveRef);
      const oldResSnap = await transaction.get(resRef);

      if (!liveSnap.exists()) throw new Error('ライブ情報が存在しません。');

      const liveData = liveSnap.data();
      const nowStr = utils.format(new Date(), 'yyyy.MM.dd');

      if (liveData.acceptStartDate && nowStr < liveData.acceptStartDate) {
        throw new Error(`予約受付は ${liveData.acceptStartDate} からです。`);
      }
      if (liveData.acceptEndDate && nowStr > liveData.acceptEndDate) {
        throw new Error(
          `予約受付は ${liveData.acceptEndDate} で終了しました。`,
        );
      }

      const ticketStock = liveData.ticketStock || 0;
      const currentTotalSold = liveData.totalReserved || 0;
      const oldResCount = oldResSnap.exists()
        ? oldResSnap.data().totalCount || 0
        : 0;
      const diff = newTotalCount - oldResCount;

      if (currentTotalSold + diff > ticketStock) {
        const remaining = ticketStock - currentTotalSold;
        throw new Error(
          `完売または残席不足です。 (現在の残り：${remaining > 0 ? remaining : 0}枚)`,
        );
      }

      let reservationNo = oldResSnap.exists()
        ? oldResSnap.data().reservationNo
        : Math.floor(1000 + Math.random() * 9000).toString();

      const ticketData = {
        liveId: currentLiveId,
        uid: uid,
        resType: resType,
        representativeName: representativeName,
        reservationNo: reservationNo,
        companions: companions,
        companionCount: companions.length,
        totalCount: newTotalCount,
        updatedAt: utils.serverTimestamp(),
      };

      if (!oldResSnap.exists()) {
        ticketData.createdAt = utils.serverTimestamp();
        transaction.set(resRef, ticketData);
      } else {
        transaction.update(resRef, ticketData);
      }

      transaction.update(liveRef, { totalReserved: currentTotalSold + diff });
    });

    utils.hideSpinner();
    await utils.showDialog(
      `予約を確定しました！ 次に表示されるチケットを、
       ${resType === 'invite' ? 'ご招待するお客様に共有して' : '当日会場受付にてご提示'}ください。`,
      true,
    );
    window.location.href =
      '../ticket-detail/ticket-detail.html?ticketId=' + ticketId;
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: ticketId || 'none',
      action: 'Ticket予約',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});
