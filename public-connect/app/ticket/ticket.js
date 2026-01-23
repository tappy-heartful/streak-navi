import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // Hero画像設定
    $('.hero').css('--hero-bg', 'url("../../images/background/ticket.jpg")');

    await loadTickets();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

async function loadTickets() {
  const upcomingContainer = $('#upcoming-list');
  const pastContainer = $('#past-list');

  // 全ライブを取得（日付順）
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
  pastContainer.empty();

  // 本日の日付（比較用 YYYY.MM.DD形式）
  const now = new Date();
  const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const liveId = docSnap.id;

    // 日付比較でコンテナを振り分け
    const isPast = data.date < todayStr;

    const cardHtml = `
            <div class="ticket-card" data-id="${liveId}">
                <div class="ticket-img-wrapper">
                    <img src="${data.flyerUrl || '../../images/favicon.png'}" class="ticket-img" alt="flyer">
                </div>
                <div class="ticket-info">
                    <div class="t-date">${data.date}</div>
                    <h3 class="t-title">${data.title}</h3>
                    <div class="t-details">
                        <div><i class="fa-solid fa-location-dot"></i> ${data.venue}</div>
                        <div><i class="fa-solid fa-clock"></i> Open ${data.open} / Start ${data.start}</div>
                        <div><i class="fa-solid fa-link"></i> <a href="${data.venueUrl}" target="_blank" style="color:#aaa">Venue Website</a></div>
                    </div>
                    ${!isPast ? `<button class="btn-reserve" onclick="handleReserve('${liveId}')">予約する / RESERVE</button>` : ''}
                </div>
            </div>
        `;

    if (isPast) {
      pastContainer.append(cardHtml);
    } else {
      // 今後のライブは日付が近い順に上にしたいので prepend または sortの工夫が必要
      // orderBy(desc) なので append でOK
      upcomingContainer.append(cardHtml);
    }
  });

  if (upcomingContainer.children().length === 0) {
    upcomingContainer.html(
      '<p class="no-data">現在、予約受付中のライブはありません。</p>',
    );
  }
}

// 予約ボタンクリック時
window.handleReserve = async function (liveId) {
  location.href = `../ticket-reserve/ticket-reserve.html?liveId=${liveId}`;
};
