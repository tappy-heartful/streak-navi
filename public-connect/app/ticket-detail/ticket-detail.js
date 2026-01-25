import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン不要で表示
    await utils.initDisplay();

    const urlParams = new URLSearchParams(window.location.search);
    const fromPage = urlParams.get('fromPage');
    const ticketId = urlParams.get('ticketId');

    if (!ticketId) {
      throw new Error('有効なチケットIDが見つかりません。');
    }

    // パンくずリスト設定
    const breadcrumb = $('#breadcrumb');
    breadcrumb.append(
      `<a href="../home/home.html">Home</a>
       <span class="separator">&gt;</span>
       ${
         fromPage === 'mypage'
           ? `<a href="../mypage/mypage.html">My Page</a><span class="separator">&gt;</span>`
           : ``
       }
       <span class="current">Ticket</span>`,
    );

    await loadTicketInfo(ticketId, fromPage);

    // Hero画像
    $('.hero').css(
      '--hero-bg',
      'url("https://tappy-heartful.github.io/streak-connect-images/background/ticket-detail.jpg")',
    );
  } catch (e) {
    $('#ticket-content-area').html(`<p class="no-data">${e.message}</p>`);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * 予約情報の取得と表示
 */
async function loadTicketInfo(ticketId, fromPage) {
  const container = $('#ticket-content-area');
  const currentUid = utils.getSession('uid');

  // 1. 予約データの取得
  const resRef = utils.doc(utils.db, 'tickets', ticketId);
  const resSnap = await utils.getWrapDoc(resRef);

  if (!resSnap.exists()) {
    throw new Error('ご予約情報が見つかりませんでした。');
  }

  const resData = resSnap.data();

  // 2. ライブデータの取得
  const liveRef = utils.doc(utils.db, 'lives', resData.liveId);
  const liveSnap = await utils.getWrapDoc(liveRef);

  if (!liveSnap.exists()) {
    throw new Error('ライブ情報が削除されたか、存在しません。');
  }

  const liveData = liveSnap.data();

  // 3. UI構築
  const isInvite = resData.resType === 'invite';
  const typeLabel = isInvite
    ? 'INVITATION (招待枠)'
    : 'GENERAL RESERVATION (一般予約)';
  const repLabel = isInvite ? '予約担当' : '代表者様';
  const guestLabel = isInvite ? 'ご招待' : '同伴者様';

  let html = `
    <p style="margin-top:25px; font-size:0.8rem; color:#888; text-align:center;">
      当日はこの画面を会場受付にてご提示ください。
    </p>
    <div class="res-status-badge-wrapper">
     <div class="res-status-badge">CONFIRMED</div>
    </div>
    <div class="ticket-card detail-mode">
      <div class="ticket-info">
        <div class="t-date">${liveData.date}</div>
        <h3 class="t-title">${liveData.title}</h3>
        <div class="t-details">
          <p>
            <i class="fa-solid fa-location-dot"></i> 会場: ${liveData.venue}
            <a href="${liveData.venueGoogleMap}" target="_blank"><i class="fa-solid fa-map-location-dot"></i> Map</a>
            <a href="${liveData.venueUrl}" target="_blank"><i class="fa-solid fa-house"></i> HP</a>
          </p>
          <p><i class="fa-solid fa-clock"></i> Open ${liveData.open} / Start ${liveData.start}</p>
          <p><i class="fa-solid fa-ticket"></i> 前売料金:${liveData.advance}</p>
        </div>
      </div>
    </div>

    <div class="share-info-wrapper">
      <p style="color:#888; font-size:0.8rem; margin-bottom:5px;">${typeLabel}</p>
      <h3 class="sub-title" style="margin-top:0;">ご予約情報</h3>
      
      <div class="t-details">
        <p><i class="fa-solid fa-user-check"></i> ${repLabel}: ${resData.representativeName} 様</p>
      </div>

      <h3 class="sub-title">${guestLabel}</h3>
      <ul class="guest-list">
  `;

  if (resData.companions && resData.companions.length > 0) {
    resData.companions.forEach((name) => {
      html += `<li class="guest-item"><i class="fa-solid fa-user-tag" style="color:#e7211a; margin-right:10px;"></i> ${name} 様</li>`;
    });
  } else {
    html += `<li class="guest-item" style="color:#888;">同伴者の登録はありません</li>`;
  }

  html += `</ul></div>`;

  // 4. ログインユーザーが予約者本人の場合、編集・取消ボタンを表示
  if (currentUid && resData.uid === currentUid) {
    html += `
      <div class="owner-actions">
        <a href="../ticket-reserve/ticket-reserve.html?liveId=${resData.liveId}" class="btn-action btn-edit">
          <i class="fa-solid fa-pen-to-square"></i> 予約内容を変更する
        </a>
        <button class="btn-action btn-cancel" onclick="handleDeleteTicket('${resData.liveId}')">
          <i class="fa-solid fa-trash-can"></i> 予約を取り消す
        </button>
      </div>
    `;
  }

  container.html(html);

  // バックリンク
  $('.page-actions').html(
    fromPage === 'mypage'
      ? `<a href="../mypage/mypage.html" class="btn-back-home"> ← My Pageに戻る </a>`
      : `<a href="../home/home.html" class="btn-back-home"> ← Homeに戻る </a>`,
  );
}

/**
 * チケット取り消し処理
 */
window.handleDeleteTicket = async function (liveId) {
  if (await utils.deleteTicket(liveId)) {
    location.href = '../mypage/mypage.html';
  }
};
