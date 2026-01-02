import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: '集金一覧', url: '../collect-list/collect-list.html' },
      { title: '集金確認' },
    ]);
    await renderCollect();
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: utils.globalGetParamCollectId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function renderCollect() {
  const collectId = utils.globalGetParamCollectId;
  const isAdmin = utils.isAdmin('Collect');

  const snap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collects', collectId)
  );
  if (!snap.exists()) throw new Error('データが見つかりません');
  const data = snap.data();

  const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');

  // 表示のセット
  $('#target-date').text(
    data.targetDate ? utils.getDayOfWeek(data.targetDate_decoded) : '-'
  );
  $('#collect-title').text(data.title);
  $('#accept-term').text(`${
    data.acceptStartDate ? utils.getDayOfWeek(data.acceptStartDate_decoded) : ''
  } ～
      ${
        data.acceptEndDate ? utils.getDayOfWeek(data.acceptEndDate_decoded) : ''
      }`);
  $('#amount-per-person').text(formatYen(data.amountPerPerson));
  $('#collect-remarks').text(data.remarks || '-');

  // 詳細情報ボックス
  $('#upfront-amount').text(formatYen(data.upfrontAmount));
  $('#upfront-payer').text(data.upfrontPayer || '-');
  $('#participant-count').text(`${data.participantCount || '-'} 名`);
  $('#manager-name').text(data.managerName || '-');

  // 支払いボタンの制御
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
  const $payContainer = $('#payment-link-container').empty();

  if (data.paymentUrl) {
    if (isActive) {
      // ボタン構造を反映
      $payContainer.append(`
        <div id="answer-menu" class="menu-section">
        <h2 class="menu-title">支払いメニュー</h2>
          <div class="confirm-buttons">
            <button id="pay-button" class="save-button">支払う
            </button>
          </div>
        </div>
      `);

      // ボタン押下時の処理（別タブで開く）
      $('#pay-button').on('click', function () {
        window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
      });
    } else {
      $payContainer.html('<span class="info-msg">受付期間外です</span>');
    }
  } else {
    $payContainer.text('設定なし');
  }

  setupEventHandlers(collectId, isAdmin);
}

function setupEventHandlers(collectId, isAdmin) {
  if (!isAdmin) $('#collect-menu').hide();

  $('#collect-edit-button').on('click', () => {
    window.location.href = `../collect-edit/collect-edit.html?mode=edit&collectId=${collectId}`;
  });

  $('#collect-copy-button').on('click', () => {
    window.location.href = `../collect-edit/collect-edit.html?mode=copy&collectId=${collectId}`;
  });

  $('#collect-delete-button').on('click', async () => {
    if (!(await utils.showDialog('この集金データを削除してもよろしいですか？')))
      return;
    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('collects', collectId);
      window.location.href = '../collect-list/collect-list.html';
    } finally {
      utils.hideSpinner();
    }
  });
}
