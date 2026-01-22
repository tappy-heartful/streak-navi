import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // 並行してデータ取得
    await Promise.all([loadUpcomingLives(), loadLatestMedia()]);
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: 'none',
      action: 'Home初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function loadUpcomingLives() {
  const container = $('#live-list');
  // 未来の日付のもの、または最新のものを取得するクエリ
  const q = utils.query(
    utils.collection(utils.db, 'lives'),
    utils.orderBy('date', 'asc'),
    utils.limit(3)
  );

  const snapshot = await utils.getWrapDocs(q);
  if (snapshot.empty) {
    container.html('<p class="no-data">Stay tuned for upcoming schedules.</p>');
    return;
  }

  container.empty();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    container.append(`
      <div class="live-card">
        <div class="live-date-box">
          <span class="l-date">${data.date}</span>
        </div>
        <div class="live-info">
          <h3 class="l-title">${data.title}</h3>
          <p class="l-venue"><i class="fa-solid fa-location-dot"></i> ${
            data.venue || 'TBA'
          }</p>
        </div>
      </div>
    `);
  });
}

async function loadLatestMedia() {
  const container = $('#media-preview');
  const q = utils.query(
    utils.collection(utils.db, 'medias'),
    utils.orderBy('date', 'desc'),
    utils.limit(1)
  );

  const snapshot = await utils.getWrapDocs(q);
  if (snapshot.empty) return;

  const data = snapshot.docs[0].data();
  container.html(utils.buildInstagramHtml(data.instagramUrl));

  // Instagramの再スキャン
  if (window.instgrm) window.instgrm.Embeds.process();
}
