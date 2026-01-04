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

  // 集金データとユーザーリストを同時に取得
  const [collectSnap, usersSnap] = await Promise.all([
    utils.getWrapDoc(utils.doc(utils.db, 'collects', collectId)),
    utils.getWrapDocs(utils.collection(utils.db, 'users')),
  ]);

  if (!collectSnap.exists()) throw new Error('データが見つかりません');
  const data = collectSnap.data();

  // IDから名前を引くためのマップ作成
  const userMap = {};
  usersSnap.docs.forEach((d) => {
    userMap[d.id] = d.data().displayName;
  });

  const formatYen = (num) =>
    num !== undefined && num !== null
      ? `¥${Number(num).toLocaleString()}`
      : '-';

  // 受付ステータス判定
  const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
  let statusClass = isActive ? 'pending' : 'closed';
  let statusText = isActive ? '受付中' : '期間外';

  $('#answer-status-label')
    .removeClass('pending answered closed')
    .addClass(statusClass)
    .text(statusText);

  // 基本情報
  $('#target-date').text(
    data.targetDate ? utils.getDayOfWeek(data.targetDate_decoded) : '-'
  );
  $('#collect-title').text(data.title);
  $('#accept-term').text(
    `${
      data.acceptStartDate
        ? utils.getDayOfWeek(data.acceptStartDate_decoded)
        : ''
    } ～ ${
      data.acceptEndDate ? utils.getDayOfWeek(data.acceptEndDate_decoded) : ''
    }`
  );
  $('#amount-per-person').text(formatYen(data.amountPerPerson));
  $('#collect-remarks').text(data.remarks || '-');

  // 管理・建替詳細
  $('#upfront-amount').text(formatYen(data.upfrontAmount));
  $('#upfront-payer').text(userMap[data.upfrontPayer] || '未設定');
  $('#participant-count').text(`${data.participantCount || 0} 名`);
  $('#manager-name').text(userMap[data.managerName] || '未設定');
  $('#remittance-amount').text(formatYen(data.remittanceAmount));

  // 調整情報の表示
  if (data.isAdjustmentEnabled) {
    $('#adjustment-status').text('あり（端数調整）');
    $('#adjustment-details').show();
    $('#adjustment-payer').text(userMap[data.adjustmentPayer] || '未設定');

    // 調整負担者の合計額を算出
    // (ベース金額) + (建替総額 - (全員のベース金額合計))
    const baseTotal = data.amountPerPerson * data.participantCount;
    const diff = data.upfrontAmount - baseTotal;
    const finalAmount = data.amountPerPerson + diff;
    $('#adjustment-payer-amount').text(formatYen(finalAmount));
  } else {
    $('#adjustment-status').text('なし（一律）');
    $('#adjustment-details').hide();
  }

  // 対象者リストの表示
  const $listContainer = $('#participant-list-container').empty();
  if (data.participants && data.participants.length > 0) {
    const names = data.participants.map(
      (id) => userMap[id] || '不明なユーザー'
    );
    $listContainer.text(names.join('、 '));
  } else {
    $listContainer.text('選択されていません');
  }

  // 支払いボタン
  const $payContainer = $('#payment-link-container').empty();
  if (data.paymentUrl && isActive) {
    $payContainer.append(`
        <div id="answer-menu" class="menu-section">
          <h2 class="menu-title">支払いメニュー</h2>
          <div class="confirm-buttons">
            <button id="pay-button" class="save-button"><i class="fas fa-external-link-alt"></i> 支払う</button>
          </div>
        </div>
      `);
    $('#pay-button').on('click', () => {
      window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
    });
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
      await utils.showDialog('削除しました', true);
      window.location.href = '../collect-list/collect-list.html';
    } finally {
      utils.hideSpinner();
    }
  });
}
