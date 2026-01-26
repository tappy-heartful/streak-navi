import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // ログイン不要で初期化
    await utils.initDisplay();

    const urlParams = new URLSearchParams(window.location.search);
    const liveId = urlParams.get('liveId');

    if (!liveId) {
      throw new Error('ライブ情報が見つかりません。');
    }

    // パンくずリスト設定
    utils.renderBreadcrumb($('#breadcrumb'));

    await loadLiveDetail(liveId);

    // Hero画像
    $('.hero').css(
      '--hero-bg',
      'url("https://tappy-heartful.github.io/streak-connect-images/background/live-detail.jpg")',
    );
  } catch (e) {
    console.error(e);
    $('#live-content-area').html(`<p class="no-data">${e.message}</p>`);
  } finally {
    utils.hideSpinner();
  }
});
async function loadLiveDetail(liveId) {
  const container = $('#live-content-area');
  const actionArea = $('.live-actions');

  container.empty();
  actionArea.empty();

  // 1. ライブデータの取得
  const liveRef = utils.doc(utils.db, 'lives', liveId);
  const liveSnap = await utils.getWrapDoc(liveRef);

  if (!liveSnap.exists()) {
    throw new Error('ライブ情報が存在しません。');
  }
  const data = liveSnap.data();

  // 2. 予約状況の確認（ログイン時のみ）
  const uid = utils.getSession('uid');
  let isReserved = false;
  if (uid) {
    const ticketId = `${liveId}_${uid}`;
    const ticketRef = utils.doc(utils.db, 'tickets', ticketId);
    const ticketSnap = await utils.getWrapDoc(ticketRef);
    isReserved = ticketSnap.exists();
  }

  // 3. 基本UI構築（注意事項エリアに「notes」も追加）
  const notesHtml = data.notes
    ? `<div class="live-notes-area" style="margin-top:15px; border-left:2px solid #e7211a; padding-left:15px; white-space:pre-wrap; font-size:0.9rem; color:#ccc;">${data.notes}</div>`
    : '';

  let html = `
    ${data.flyerUrl ? `<div class="flyer-wrapper"><img src="${data.flyerUrl}" alt="Flyer"></div>` : ''}

    <div class="live-info-card">
      <div class="l-date">
        ${isReserved ? '<span class="reserved-label" style="background:#e7211a; color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:3px; margin-right:8px; vertical-align:middle;">予約済み</span>' : ''}
        ${data.date}
      </div>
      <h2 class="l-title">${data.title}</h2>
      
      <div class="info-list">
        <div class="info-item">
          <i class="fa-solid fa-location-dot"></i>
          <div>
            <div class="label">会場</div>
            <div class="val">
              ${data.venue}<br>
              ${data.venueUrl ? `<a href="${data.venueUrl}" target="_blank" style="font-size:0.8rem;">公式サイト</a> / ` : ''}
              ${data.venueGoogleMap ? `<a href="${data.venueGoogleMap}" target="_blank" style="font-size:0.8rem;">地図を見る</a>` : ''}
            </div>
          </div>
        </div>

        <div class="info-item">
          <i class="fa-solid fa-clock"></i>
          <div>
            <div class="label">時間</div>
            <div class="val">Open ${data.open} / Start ${data.start}</div>
          </div>
        </div>

        <div class="info-item">
          <i class="fa-solid fa-ticket"></i>
          <div>
            <div class="label">料金</div>
            <div class="val">前売: ${data.advance}<br>当日: ${data.door}</div>
          </div>
        </div>
      </div>
    </div>

    <h3 class="sub-title">注意事項</h3>
    <div class="t-details" style="padding-left:15px; border-left: 2px solid #333;">
      <p><i class="fa-solid fa-users"></i> お一人様 ${data.maxCompanions}名様まで同伴可能</p>
      <p><i class="fa-solid fa-circle-info"></i> チケット残数: あと ${data.ticketStock - (data.totalReserved || 0)} 枚</p>
      ${notesHtml}
    </div>
  `;

  container.html(html);

  // 4. ボタンの制御ロジック
  const todayStr = utils.format(new Date(), 'yyyy.MM.dd');
  const isAccepting = data.isAcceptReserve === true;
  const isPast = data.date < todayStr;
  const isBefore = data.acceptStartDate && todayStr < data.acceptStartDate;
  const isAfter = data.acceptEndDate && todayStr > data.acceptEndDate;

  let btnHtml = '';

  if (isPast) {
    btnHtml = `<a class="btn-action" disabled style="background:#444; color:#888;">このライブは終了しました</a>`;
  } else if (!isAccepting || isBefore || isAfter) {
    // 予約不可の状態（期間外、または管理者が停止中）
    const statusText = isBefore
      ? '予約受付前'
      : isAfter
        ? '予約受付終了'
        : '予約受付停止中';

    btnHtml = `
      <div style="max-width:400px; margin:0 auto;">
        ${
          isReserved
            ? `
          <a href="../ticket-detail/ticket-detail.html?ticketId=${liveId}_${uid}" class="btn-action btn-view-white" style="margin-bottom:10px;">
            <i class="fa-solid fa-ticket"></i> チケットを表示
          </a>
        `
            : ''
        }
        <a class="btn-action" disabled style="background:#444; color:#888;">${statusText}</a>
        ${data.acceptStartDate ? `<p class="accept-period" style="font-size:0.8rem; color:#888; margin-top:8px;">受付期間: ${data.acceptStartDate} ～ ${data.acceptEndDate}</p>` : ''}
      </div>
    `;
  } else {
    // 予約受付中の状態
    if (isReserved) {
      btnHtml = `
        <div class="reserved-actions">
          <a href="../ticket-detail/ticket-detail.html?ticketId=${liveId}_${uid}" class="btn-action btn-view-white">
            <i class="fa-solid fa-ticket"></i> チケットを表示
          </a>
          <a href="../ticket-reserve/ticket-reserve.html?liveId=${liveId}" class="btn-action btn-reserve-red">
            <i class="fa-solid fa-pen-to-square"></i> 予約内容を変更
          </a>
          <button class="btn-action btn-delete-outline" onclick="handleCancelTicket('${liveId}')">
            <i class="fa-solid fa-trash-can"></i> 予約を取り消す
          </button>
        </div>
      `;
    } else {
      btnHtml = `
        <div style="max-width:400px; margin:0 auto;">
          <a href="../ticket-reserve/ticket-reserve.html?liveId=${liveId}" class="btn-action btn-reserve-red">
            <i class="fa-solid fa-paper-plane"></i> このライブを予約する
          </a>
          <p class="accept-period">受付期間: ${data.acceptStartDate} ～ ${data.acceptEndDate}</p>
        </div>
      `;
    }
  }

  actionArea.html(btnHtml);
}
/**
 * 予約取り消し処理
 */
window.handleCancelTicket = async function (liveId) {
  if (await utils.deleteTicket(liveId)) await loadLiveDetail(liveId);
};
