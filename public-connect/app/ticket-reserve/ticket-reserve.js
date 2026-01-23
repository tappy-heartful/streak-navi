import * as utils from '../common/functions.js';

let currentLiveId = null;
let maxCompanions = 0;

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    const urlParams = new URLSearchParams(window.location.search);
    currentLiveId = urlParams.get('liveId');

    if (!currentLiveId) {
      alert('ライブIDが見つかりません。一覧に戻ります。');
      window.location.href = './ticket.html'; // 一覧画面の名称に合わせて変更してください
      return;
    }

    // Hero画像設定
    $('.hero').css('--hero-bg', 'url("../../images/background/ticket.jpg")');

    await loadLiveDetail();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

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

  // 1. ライブ詳細の表示
  container.html(`
    <div class="ticket-card detail-mode">
      <div class="ticket-img-wrapper">
        <img src="${data.flyerUrl || '../../images/common/no-image.jpg'}" class="ticket-img" alt="flyer">
      </div>
      <div class="ticket-info">
        <div class="t-date">${data.date}</div>
        <h3 class="t-title">${data.title}</h3>
        <div class="t-details">
          <div><i class="fa-solid fa-location-dot"></i> ${data.venue}</div>
          <div><i class="fa-solid fa-clock"></i> Open ${data.open} / Start ${data.start}</div>
          <div><i class="fa-solid fa-link"></i> <a href="${data.venueUrl}" target="_blank" style="color:#aaa">Venue Website</a></div>
        </div>
      </div>
    </div>
  `);

  // 2. 同伴者入力欄の動的生成
  const companionContainer = $('#companion-inputs-container');
  companionContainer.empty();
  if (maxCompanions > 0) {
    companionContainer.append('<h3 class="sub-title">同伴者様</h3>');
    for (let i = 1; i <= maxCompanions; i++) {
      companionContainer.append(`
        <div class="form-group">
          <label for="companionName${i}">同伴者 ${i}</label>
          <input type="text" id="companionName${i}" name="companionName" class="companion-input" placeholder="同伴者のお名前">
        </div>
      `);
    }
  }

  // 3. 既存の予約があればデータをセット
  await fetchExistingReservation();

  $('#reservation-form-container').fadeIn();
}

/**
 * 既存予約の取得（更新モード用）
 */
async function fetchExistingReservation() {
  const uid = utils.getSession('uid');
  // liveId と uid を使って予約を探す
  const q = utils.query(
    utils.collection(utils.db, 'liveReservations'),
    utils.where('liveId', '==', currentLiveId),
    utils.where('uid', '==', uid),
  );

  const snapshot = await utils.getWrapDocs(q);
  if (!snapshot.empty) {
    const resData = snapshot.docs[0].data();
    $('#representativeName').val(resData.representativeName || '');

    const companions = resData.companions || [];
    companions.forEach((name, index) => {
      $(`#companionName${index + 1}`).val(name);
    });

    $('#submit-btn').text('予約内容を更新する / UPDATE');
  } else {
    // 予約がない場合は、代表者名にLINEの表示名をデフォルトセット
    $('#representativeName').val(utils.getSession('displayName') || '');
  }
}

/**
 * フォーム送信処理
 */
$('#reserve-form').on('submit', async function (e) {
  e.preventDefault();
  utils.showSpinner();

  try {
    const uid = utils.getSession('uid');
    const representativeName = $('#representativeName').val();

    // 同伴者名を配列にまとめる（空文字は除外）
    const companions = [];
    $('.companion-input').each(function () {
      const val = $(this).val().trim();
      if (val) companions.push(val);
    });

    // ドキュメントIDは「liveId_uid」で固定（1人1予約に限定）
    const reservationId = `${currentLiveId}_${uid}`;
    const resRef = utils.doc(utils.db, 'liveReservations', reservationId);

    const reservationData = {
      liveId: currentLiveId,
      uid: uid,
      representativeName: representativeName,
      companions: companions,
      companionCount: companions.length,
      totalCount: companions.length + 1, // 本人 + 同伴者
      updatedAt: utils.serverTimestamp(),
    };

    // 新規作成時のみ createdAt を設定
    const docSnap = await utils.getWrapDoc(resRef);
    if (!docSnap.exists()) {
      reservationData.createdAt = utils.serverTimestamp();
    }

    await utils.setDoc(resRef, reservationData, { merge: true });

    alert('予約が完了しました！');
    window.location.href = '../home/home.html';
  } catch (err) {
    console.error(err);
    alert('予約処理中にエラーが発生しました: ' + err.message);
  } finally {
    utils.hideSpinner();
  }
});
