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
      alert('ライブIDが見つかりません。');
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
        </div>
      </div>
    </div>
  `);

  const companionContainer = $('#companion-inputs-container');
  companionContainer.empty();

  if (maxCompanions > 0) {
    const titleText = isMember ? '招待するお客様のお名前' : '同伴者様';
    companionContainer.append(
      `<h3 class="sub-title companion-title">${titleText}</h3>`,
    );

    for (let i = 1; i <= maxCompanions; i++) {
      companionContainer.append(`
        <div class="form-group">
          <label for="companionName${i}">ゲスト ${i}</label>
          <input type="text" id="companionName${i}" name="companionName" class="companion-input" placeholder="お名前を入力">
        </div>
      `);
    }
  }

  await fetchExistingReservation();

  // メンバーの場合は初期UIを「招待」に合わせる
  if (isMember) {
    toggleFormUI('invite');
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
 * フォーム送信処理
 */
$('#reserve-form').on('submit', async function (e) {
  e.preventDefault();
  utils.showSpinner();

  try {
    const uid = utils.getSession('uid');
    const resType = isMember
      ? $('input[name="resType"]:checked').val()
      : 'general';

    // 招待モードなら代表者名は自分の名前（displayName）にする
    const representativeName =
      resType === 'invite'
        ? utils.getSession('displayName')
        : $('#representativeName').val();

    const companions = [];
    $('.companion-input').each(function () {
      const val = $(this).val().trim();
      if (val) companions.push(val);
    });

    const reservationId = `${currentLiveId}_${uid}`;
    const resRef = utils.doc(utils.db, 'liveReservations', reservationId);

    const reservationData = {
      liveId: currentLiveId,
      uid: uid,
      resType: resType,
      representativeName: representativeName,
      companions: companions,
      companionCount: companions.length,
      totalCount:
        resType === 'invite' ? companions.length : companions.length + 1,
      updatedAt: utils.serverTimestamp(),
    };

    const docSnap = await utils.getWrapDoc(resRef);
    if (!docSnap.exists()) {
      reservationData.createdAt = utils.serverTimestamp();
    }

    await utils.setDoc(resRef, reservationData, { merge: true });

    alert('予約が完了しました！');
    window.location.href = '../mypage/mypage.html';
  } catch (err) {
    console.error(err);
    alert('エラーが発生しました: ' + err.message);
  } finally {
    utils.hideSpinner();
  }
});
