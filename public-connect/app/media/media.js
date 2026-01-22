import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 共通パーツ表示など
    await utils.initDisplay();

    // メディア取得・表示
    await loadMedias();

    // Instagramの埋め込みを再スキャン（動的追加後に必要）
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: 'none',
      action: 'Media初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function loadMedias() {
  const mediaList = $('#media-list');

  // クエリ作成：mediasコレクションからdate降順で4件
  const q = utils.query(
    utils.collection(utils.db, 'medias'),
    utils.orderBy('date', 'desc'),
    utils.limit(4)
  );

  const snapshot = await utils.getWrapDocs(q);

  if (snapshot.empty) {
    mediaList.html('<p class="no-data">No media found.</p>');
    return;
  }

  mediaList.empty();

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const html = `
      <div class="media-card">
        <div class="media-info">
          <span class="media-date">${data.date}</span>
          <h3 class="media-title">${data.title}</h3>
        </div>
        <div class="media-body">
          ${utils.buildInstagramHtml(data.instagramUrl)}
        </div>
      </div>
    `;
    mediaList.append(html);
  });
}
