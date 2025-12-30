import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '集金一覧' }]);
    await setUpPage();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

async function setUpPage() {
  utils.isAdmin('Collect') ? $('#add-button').show() : $('#add-button').hide();

  const $activeBody = $('#active-list-body').empty();
  const $closedBody = $('#closed-list-body').empty();

  const collectRef = utils.collection(utils.db, 'collects');
  const qCollects = utils.query(
    collectRef,
    utils.orderBy('targetDate', 'desc')
  );
  const snap = await utils.getWrapDocs(qCollects);

  let activeCount = 0;
  let closedCount = 0;

  snap.forEach((doc) => {
    const data = doc.data();
    const id = doc.id;

    const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

    // 金額整形用ヘルパー
    const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');

    const amountText = formatYen(data.amountPerPerson);
    const upfrontText = formatYen(data.upfrontAmount);
    const termText = `${data.acceptStartDate} ～ ${data.acceptEndDate}`;

    const row = makeCollectRow(
      id,
      data,
      isActive,
      amountText,
      upfrontText,
      termText
    );

    if (isActive) {
      $activeBody.append(row);
      activeCount++;
    } else {
      $closedBody.append(row);
      closedCount++;
    }
  });

  if (activeCount === 0) showEmptyRow($activeBody);
  if (closedCount === 0) $('#closed-container').hide();
}

function makeCollectRow(id, data, isActive, amountText, upfrontText, termText) {
  const statusClass = isActive ? 'status-active' : 'status-closed';
  const statusText = isActive ? '受付中' : '期間外';

  return $(`
    <tr>
      <td class="list-table-row-header">
        <div class="collect-title">
          <a href="../collect-confirm/collect-confirm.html?collectId=${id}">${
    data.title
  }</a>
        </div>
        <div class="term-sub"><i class="far fa-calendar-alt"></i> 受付: ${termText}</div>
        <div class="remarks-sub">${data.remarks || ''}</div>
      </td>
      <td>
        <span class="collect-status ${statusClass}">${statusText}</span>
      </td>
      <td class="amount-col">
        <div class="main-amount">${amountText}</div>
        <div class="date-label">${data.targetDate || '-'} 対象</div>
      </td>
      <td class="info-col">
        <div class="info-item">建替: ${upfrontText}</div>
        <div class="info-item">人数: ${data.participantCount || '-'}名</div>
      </td>
      <td class="staff-col">
        <div class="staff-info">
          <span><i class="fas fa-user-tie"></i> ${
            data.managerName || '-'
          }</span><br>
          <span class="payer-label"><i class="fas fa-hand-holding-usd"></i> ${
            data.upfrontPayer || '-'
          }</span>
        </div>
      </td>
    </tr>
  `);
}

function showEmptyRow($tbody) {
  $tbody.append(
    '<tr><td colspan="5" class="empty-text">現在、受付中の集金はありません。</td></tr>'
  );
}
