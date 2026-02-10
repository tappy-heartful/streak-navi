import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: 'ライブ一覧', url: '../live-list/live-list.html' },
      { title: 'ライブ確認' },
    ]);
    await renderLive();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamLiveId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function renderLive() {
  const liveId = utils.globalGetParamLiveId; // URLパラメータから取得

  const liveSnap = await utils.getWrapDoc(utils.doc(utils.db, 'lives', liveId));

  if (!liveSnap.exists()) {
    throw new Error('ライブ情報が見つかりません：' + liveId);
  }

  const data = liveSnap.data();

  // フライヤー画像の設定
  if (data.flyerUrl) {
    $('#live-flyer').attr('src', data.flyerUrl).show();
  }

  // 基本情報
  $('#live-title').text(data.title || '');
  $('#live-date').text(
    `${data.date} (${utils.getDayOfWeek(data.date, true)})` || '',
  );
  $('#live-open').text(data.open || '--:--');
  $('#live-start').text(data.start || '--:--');

  // 会場情報
  $('#live-venue').text(data.venue || '');
  let venueLinks = '';
  if (data.venueUrl) {
    venueLinks += `<a href="${data.venueUrl}" target="_blank"><i class="fas fa-external-link-alt"></i>会場HP</a>`;
  }
  if (data.venueGoogleMap) {
    venueLinks += `<a href="${data.venueGoogleMap}" target="_blank"><i class="fas fa-map-marker-alt"></i>Google Map</a>`;
  }
  $('#live-venue-links').html(venueLinks);

  // 料金
  $('#live-advance').text(data.advance || '未設定');
  $('#live-door').text(data.door || '未設定');

  // 予約設定
  $('#live-isAcceptReserve').text(
    data.isAcceptReserve ? '予約受付対象' : '予約不可',
  );
  $('#live-reserve-term').text(
    `${data.acceptStartDate || '未設定'} ～ ${data.acceptEndDate || ''}`,
  );
  $('#live-stock').text(
    `${data.totalReserved || 0} / ${data.ticketStock || 0}`,
  );
  $('#live-maxCompanions').text(data.maxCompanions || 0);

  // 備考
  $('#live-notes').text(data.notes || '');

  // 管理者の場合のみメニュー表示
  if (utils.isAdmin('Live')) {
    $('.confirm-buttons').show();
  }

  setupEventHandlers(liveId);
}

function setupEventHandlers(liveId) {
  // 編集
  $('#live-edit-button').on('click', () => {
    window.location.href = `../live-edit/live-edit.html?mode=edit&liveId=${liveId}`;
  });

  // コピー
  $('#live-copy-button').on('click', () => {
    window.location.href = `../live-edit/live-edit.html?mode=copy&liveId=${liveId}`;
  });

  // 削除
  $('#live-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'このライブ情報を削除しますか？\n予約データ等も確認の上、実行してください。',
    );
    if (!confirmed) return;

    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('lives', liveId);
      await utils.writeLog({ dataId: liveId, action: 'ライブ削除' });
      await utils.showDialog('削除しました', true);
      window.location.href = '../live-list/live-list.html';
    } catch (e) {
      console.error(e);
      await utils.showDialog('削除に失敗しました');
    } finally {
      utils.hideSpinner();
    }
  });
}
