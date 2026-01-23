import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // 1. メンバー情報の表示
    renderMembers();

    // 2. メディア（Instagram履歴）の取得
    await loadMedias();

    // Instagram再スキャン
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * メンバー表示
 */
function renderMembers() {
  const members = [
    {
      name: 'Shoei Matsushita',
      role: 'Guitar / Band Master',
      img: 'member1.jpg',
    },
    {
      name: 'Miku Nozoe',
      role: 'Trumpet / Section Leader',
      img: 'member2.jpg',
    },
    {
      name: 'Hiroto Murakami',
      role: 'Trombone / Section Leader',
      img: 'member3.jpg',
    },
    {
      name: 'Kana Asahiro',
      role: 'Trombone',
      img: 'member4.jpg',
    },
    {
      name: 'Shunta Yabu',
      role: 'Saxophne / Section Leader',
      img: 'member5.jpg',
    },
    {
      name: 'Takumi Fujimoto',
      role: 'Saxophne / Lead Alto Sax',
      img: 'member6.jpg',
    },
    {
      name: 'Taisei Yuyama',
      role: 'Saxophne / Lead Tenor Sax',
      img: 'member7.jpg',
    },
    {
      name: 'Akito Kimura',
      role: 'Drums',
      img: 'member8.jpg',
    },
    {
      name: 'Yojiro Nakagawa',
      role: 'Bass',
      img: 'member9.jpg',
    },
  ];

  const $grid = $('#member-grid');
  members.forEach((m) => {
    $grid.append(`
      <div class="member-card">
        <div class="member-img-wrapper">
          <img src="../../images/members/${m.img}" alt="${m.name}" class="member-img">
        </div>
        <div class="member-name">${m.name}</div>
        <div class="member-role">${m.role}</div>
      </div>
    `);
  });
}

/**
 * Instagram投稿取得
 */
async function loadMedias() {
  const mediaList = $('#media-list');
  const q = utils.query(
    utils.collection(utils.db, 'medias'),
    utils.orderBy('date', 'desc'),
    utils.limit(5), // Aboutページなので直近5件程度に絞るのがスマート
  );

  const snapshot = await utils.getWrapDocs(q);

  if (snapshot.empty) {
    mediaList.html('<p class="no-data">No history found.</p>');
    return;
  }

  mediaList.empty();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const html = `
      <div class="media-card">
        <div class="media-info">
          <span class="media-date">${data.date}</span>
          <h3 class="media-title">${data.title_decoded || data.title}</h3>
        </div>
        <div class="media-body">
          ${utils.buildInstagramHtml(data.instagramUrl)}
        </div>
      </div>
    `;
    mediaList.append(html);
  });
}
