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

    const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');
    const amountText = formatYen(data.amountPerPerson);
    const upfrontText = formatYen(data.upfrontAmount);
    const termText = `${data.acceptStartDate}～<br>${data.acceptEndDate}`;

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
  const isInTerm = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  // 支払いリンクボタンの生成
  const payBtnHtml =
    isInTerm && data.paymentUrl
      ? `<a href="${data.paymentUrl}" target="_blank" title="支払いリンクを開く">
         <i class="fas fa-external-link-alt"></i> 支払う
       </a>`
      : `<span>-</span>`;

  return $(`
    <tr>
      <td class="list-table-row-header">
        <div class="target-date-label">${data.targetDate || '-'}</div>
        <div class="collect-title">
          <a href="../collect-confirm/collect-confirm.html?collectId=${id}">${
    data.title
  }</a>
        </div>
      </td>
      <td>
        <span class="collect-status ${statusClass}">${statusText}</span>
      </td>
      <td class="term-col">
        <div class="term-text">${termText}</div>
      </td>
      <td class="amount-col">
        <div class="main-amount">${amountText}</div>
      </td>
      <td class="pay-col">
        ${payBtnHtml}
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
      <td class="remarks-col">
        <div class="remarks-text">${data.remarks || '-'}</div>
      </td>
    </tr>
  `);
}

function showEmptyRow($tbody) {
  $tbody.append(
    '<tr><td colspan="8" class="empty-text">現在、受付中の集金はありません。</td></tr>'
  );
}
