import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン不要で表示
    await utils.initDisplay();

    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticketId');

    if (!ticketId) {
      throw new Error('有効なチケットIDが見つかりません。');
    }

    // パンくずリスト、バックリンク設定
    const liveId = ticketId ? ticketId.split('_')[0] : '';
    utils.renderBreadcrumb($('#breadcrumb'), liveId);
    $('.btn-back-home').attr(
      'href',
      `../live-detail/live-detail.html?liveId=${liveId}`,
    );

    await loadTicketInfo(ticketId);

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
async function loadTicketInfo(ticketId) {
  const container = $('#ticket-content-area');
  const actionArea = $('.live-actions');
  container.empty();
  actionArea.empty();

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
  const liveDetailUrl = `../live-detail/live-detail.html?liveId=${resData.liveId}`;

  let html = `
    <p style="margin-top:25px; font-size:0.8rem; color:#888; text-align:center;">
      ${
        isInvite && currentUid && resData.uid === currentUid
          ? 'ご招待する人にこのページを共有してください。'
          : '当日はこの画面を会場受付にてご提示ください。'
      }
    </p>

    <div class="ticket-card detail-mode">
      <div class="res-no-wrapper">
        <span class="res-no-label">RESERVATION NO.</span>
        <span class="res-no-value">${resData.reservationNo || '----'}</span>
      </div>

      <div class="ticket-info">
        <div class="t-date">${liveData.date}</div>
        <a href="${liveDetailUrl}" class="t-title-link">
            <h3 class="t-title">${liveData.title}</h3>
          </a>
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
        <p><i class="fa-solid fa-users"></i> 合計人数: ${resData.totalCount} 名</p>
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

  // 4. ログインユーザー本人の場合のアクション
  if (currentUid && resData.uid === currentUid) {
    let btnHtml = `
      <div class="reserved-actions">
        <a href="../ticket-reserve/ticket-reserve.html?liveId=${resData.liveId}" class="btn-action btn-reserve-red">
          <i class="fa-solid fa-pen-to-square"></i> 予約を変更
        </a>
        <button class="btn-action btn-delete-outline" onclick="handleDeleteTicket('${resData.liveId}')">
          <i class="fa-solid fa-trash-can"></i> 予約を取り消す
        </button>
        <button class="btn-action btn-copy-outline" onclick="handleCopyTicketUrl('${resData.resType}')">
          <i class="fa-solid fa-solid fa-copy"></i> チケットURLをコピー
        </button>
      </div>
    `;
    actionArea.html(btnHtml);
  }

  container.html(html);
}

/**
 * チケット取り消し処理
 */
window.handleDeleteTicket = async function (liveId) {
  if (await utils.deleteTicket(liveId)) location.href = '../mypage/mypage.html';
};

/**
 * チケットURLをクリップボードにコピー
 */
window.handleCopyTicketUrl = async function (resType) {
  try {
    await navigator.clipboard.writeText(window.location.href);

    // 予約種別によってメッセージを出し分け
    const message =
      resType === 'invite'
        ? 'チケットURLをコピーしました。\nご招待する人に共有してください。'
        : 'チケットURLをコピーしました。\n同伴者様に共有してください。';

    await utils.showDialog(message, true);
  } catch (err) {
    console.error('Copy failed:', err);
    alert('URLのコピーに失敗しました。');
  }
};
