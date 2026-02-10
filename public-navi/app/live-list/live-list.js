import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await renderLiveList();
  } catch (e) {
    console.error('Error loading lives:', e);
  } finally {
    utils.hideSpinner();
  }
});

async function renderLiveList() {
  const isAdmin = utils.isAdmin('Live'); // 権限チェック
  if (isAdmin) $('#live-add-button').show();

  const $liveList = $('#live-list').empty();

  // Firestoreからlivesコレクションを取得（日付順）
  const livesRef = utils.collection(utils.db, 'lives');
  const qLive = utils.query(livesRef, utils.orderBy('date', 'desc')); // 新しい順
  const liveSnap = await utils.getWrapDocs(qLive);

  if (liveSnap.empty) {
    $liveList.append(
      '<li class="empty-msg">現在予定されているライブはありません。</li>',
    );
    return;
  }

  liveSnap.forEach((doc) => {
    const data = doc.data();
    const liveId = doc.id;
    const html = makeLiveCard(liveId, data);
    $liveList.append(html);
  });
}

function makeLiveCard(id, data) {
  // 曜日の取得（共通関数がある前提）
  const dayOfWeek = data.date ? `(${utils.getDayOfWeek(data.date, true)})` : '';

  // フライヤーがなければデフォルト画像
  const imgUrl = data.flyerUrl || '../../images/no-image.png';

  return `
        <li>
            <a href="../live-detail/live-detail.html?liveId=${id}" class="event-link">
                <img src="${imgUrl}" alt="flyer" class="live-thumbnail">
                <div class="event-info">
                    <span class="event-date">
                        <i class="far fa-calendar-alt"></i> ${data.date}${dayOfWeek} 
                        <span style="margin-left:8px;"><i class="far fa-clock"></i> ${data.open || '--:--'} / ${data.start || '--:--'}</span>
                    </span>
                    <span class="event-title">${data.title}</span>
                    <span class="event-venue">
                        <i class="fas fa-map-marker-alt"></i> ${data.venue}
                    </span>
                </div>
                <div class="event-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </a>
        </li>
    `;
}
