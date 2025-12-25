import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '練習場所一覧' }]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: 'スタジオ一覧表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // 管理者の場合のみ新規登録ボタン表示
  utils.isAdmin('Studio') ? $('#add-button').show() : $('#add-button').hide();

  const $container = $('#studio-content-area').empty();

  // 1. 都道府県データをorder順に取得
  const prefRef = utils.collection(utils.db, 'prefectures');
  const qPref = utils.query(prefRef, utils.orderBy('order', 'asc'));
  const prefSnap = await utils.getWrapDocs(qPref);

  // 2. スタジオデータを全件取得
  const studiosRef = utils.collection(utils.db, 'studios');
  const studioSnap = await utils.getWrapDocs(studiosRef);

  if (prefSnap.empty) {
    $container.append(
      '<p class="empty-message">都道府県データが設定されていません。</p>'
    );
    return;
  }

  // スタジオデータを都道府県ごとにグループ化
  const studiosByPref = {};
  studioSnap.docs.forEach((doc) => {
    const data = doc.data();
    const prefId = data.prefecture; // 紐付けキー
    if (!studiosByPref[prefId]) studiosByPref[prefId] = [];
    studiosByPref[prefId].push({ id: doc.id, ...data });
  });

  // 3. 都道府県ごとに表を作成
  prefSnap.docs.forEach((prefDoc) => {
    const prefData = prefDoc.data();
    const prefId = prefDoc.id;
    const prefStudios = studiosByPref[prefId] || [];

    if (prefStudios.length > 0) {
      $container.append(makePrefectureSection(prefData.name, prefStudios));
    }
  });
}

/**
 * 都道府県ごとのセクションとテーブルを生成
 */
function makePrefectureSection(prefName, studios) {
  const $section = $(`
    <section class="prefecture-section">
      <h3 class="prefecture-title">${prefName}</h3>
      <div class="table-wrapper">
        <table class="studio-table">
          <thead>
            <tr>
              <th>スタジオ名</th>
              <th>公式サイト</th>
              <th>地図</th>
              <th>部屋一覧</th>
              <th>電話番号</th>
              <th>空き情報</th>
              <th>利用料</th>
              <th>予約方法</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `);

  const $tbody = $section.find('tbody');

  studios.forEach((studio) => {
    // rooms配列をaタグの列に変換
    const roomsHtml = (studio.rooms || [])
      .map((roomName) => {
        return `<a href="${
          studio.roomsUrl || '#'
        }" target="_blank" class="room-link">${roomName}</a>`;
      })
      .join('');

    const row = `
      <tr>
        <td class="studio-name">
          <a href="../studio-confirm/studio-confirm.html?studioId=${
            studio.id
          }">${studio.name}</a>
        </td>
        <td class="text-center">
          ${
            studio.hp
              ? `<a href="${studio.hp}" target="_blank"><i class="fas fa-external-link-alt"></i> HP</a>`
              : '-'
          }
        </td>
        <td class="text-center">
          ${
            studio.map
              ? `<a href="${studio.map}" target="_blank"><i class="fas fa-map-marker-alt"></i> Map</a>`
              : '-'
          }
        </td>
        <td>${roomsHtml || '-'}</td>
        <td>
          ${
            studio.tel
              ? `<a href="tel:${studio.tel}"><i class="fas fa-phone-alt"></i> ${studio.tel}</a>`
              : '-'
          }
        </td>
        <td>${studio.availabilityInfo || '-'}</td>
        <td>${studio.fee || '-'}</td>
        <td>${studio.reserve || '-'}</td>
        <td class="pre-wrap">${studio.note || '-'}</td>
      </tr>
    `;
    $tbody.append(row);
  });

  return $section;
}
