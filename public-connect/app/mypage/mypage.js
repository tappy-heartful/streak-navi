import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン必須
    await utils.initDisplay(true, true);

    // プロフィール反映
    $('#user-icon').attr(
      'src',
      utils.getSession('pictureUrl') || '../../images/line-profile-unset.png',
    );
    $('#user-name').text(utils.getSession('displayName') || 'Guest');

    // Hero画像設定
    $('.hero').css('--hero-bg', 'url("../../images/background/mypage.jpg")');

    await loadMyTickets();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * 自分の予約情報を取得して表示
 */
async function loadMyTickets() {
  const container = $('#my-tickets-container');
  const uid = utils.getSession('uid');

  // 1. 自分の予約を全件取得
  const q = utils.query(
    utils.collection(utils.db, 'liveReservations'),
    utils.where('uid', '==', uid),
    utils.orderBy('updatedAt', 'desc'),
  );

  const resSnapshot = await utils.getWrapDocs(q);

  if (resSnapshot.empty) {
    container.html('<p class="no-data">予約済みのチケットはありません。</p>');
    return;
  }

  container.empty();

  // 2. 予約情報ごとにライブ詳細を紐付けて表示
  for (const resDoc of resSnapshot.docs) {
    const resData = resDoc.data();

    // livesコレクションからライブ詳細を取得
    const liveRef = utils.doc(utils.db, 'lives', resData.liveId);
    const liveSnap = await utils.getWrapDoc(liveRef);

    if (!liveSnap.exists()) continue;
    const liveData = liveSnap.data();

    const companionText =
      resData.companions && resData.companions.length > 0
        ? resData.companions.join(', ')
        : 'なし';

    container.append(`
      <div class="ticket-card detail-mode">
        <div class="ticket-info">
          <div class="t-status-badge">RESERVED</div>
          <div class="t-date">${liveData.date}</div>
          <h3 class="t-title">${liveData.title}</h3>
          
          <div class="t-details">
            <p><i class="fa-solid fa-location-dot"></i> ${liveData.venue}</p>
            <p><i class="fa-solid fa-user"></i> 代表者: ${resData.representativeName}</p>
            <p><i class="fa-solid fa-users"></i> 同伴者: ${companionText}</p>
          </div>
          
          <div class="ticket-actions">
            <button class="btn-edit" onclick="location.href='../ticket-reserve/ticket-reserve.html?liveId=${resData.liveId}'">
              <i class="fa-solid fa-pen-to-square"></i> 変更する
            </button>
          </div>
        </div>
      </div>
    `);
  }
}
