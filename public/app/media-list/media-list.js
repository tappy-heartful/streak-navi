import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: 'メディア一覧' }]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  utils.isAdmin('Media') ? $('#add-button').show() : $('#add-button').hide();

  const $tbody = $('#media-list-body').empty();

  const mediasRef = utils.collection(utils.db, 'medias');
  const qMedia = utils.query(mediasRef, utils.orderBy('date', 'desc'));
  const mediaSnap = await utils.getWrapDocs(qMedia);

  if (mediaSnap.empty) {
    $tbody.append(
      '<tr><td colspan="4" class="empty-row">該当のメディアはありません🍀</td></tr>'
    );
    return;
  }

  mediaSnap.forEach((doc) => {
    const data = doc.data();
    const id = doc.id;

    // SNS/リンク列のアイコン生成
    const links = [];
    if (data.instagramUrl)
      links.push(
        `<a href="${data.instagramUrl}" target="_blank" class="sns-icon instagram"><i class="fab fa-instagram fa-lg"></i></a>`
      );
    if (data.youtubeUrl)
      links.push(
        `<a href="${data.youtubeUrl}" target="_blank" class="sns-icon youtube"><i class="fab fa-youtube fa-lg"></i></a>`
      );
    if (data.driveUrl)
      links.push(
        `<a href="${data.driveUrl}" target="_blank" class="sns-icon drive"><i class="fab fa-google-drive fa-lg"></i></a>`
      );

    const tr = $(`
      <tr>
        <td class="list-table-row-header">
          <a href="../media-confirm/media-confirm.html?mediaId=${id}">
            ${data.title_decoded || data.title || '無題'}
          </a>
        </td>
        <td class="media-date">
          ${utils.getDayOfWeek(data.date_decoded || data.date)}
        </td>
        <td class="media-links">
          ${links.length > 0 ? links.join(' ') : '-'}
        </td>
        <td class="media-top-status">
          ${
            data.isDispTop
              ? '<i class="fas fa-check-circle check-on"></i>'
              : '-'
          }
        </td>
      </tr>
    `);
    $tbody.append(tr);
  });
}
