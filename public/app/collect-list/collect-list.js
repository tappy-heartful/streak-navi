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
  // 管理者権限チェック（既存の仕組みを流用）
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

    // 状況判定（受付期間内かどうか）
    const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

    // 金額のカンマ区切り整形
    const amountText = data.amountPerPerson
      ? `¥${Number(data.amountPerPerson).toLocaleString()}`
      : '未定';

    // 担当者と建替者の表示用HTML
    const staffHtml = `
      <div class="staff-info">
        <span><i class="fas fa-user-tie"></i> ${
          data.managerName || '-'
        }</span><br>
        <span class="payer-label"><i class="fas fa-hand-holding-usd"></i> ${
          data.upfrontPayer || '-'
        }</span>
      </div>
    `;

    const row = makeCollectRow(id, data, isActive, amountText, staffHtml);

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

function makeCollectRow(id, data, isActive, amountText, staffHtml) {
  const statusClass = isActive ? 'status-active' : 'status-closed';
  const statusText = isActive ? '受付中' : '期間外';

  return $(`
    <tr>
      <td class="list-table-row-header">
        <a href="../collect-confirm/collect-confirm.html?collectId=${id}">
          ${data.title}
        </a>
        <div class="remarks-sub">${data.remarks || ''}</div>
      </td>
      <td>
        <span class="collect-status ${statusClass}">${statusText}</span>
      </td>
      <td class="amount-col">${amountText}</td>
      <td class="date-col">${data.targetDate || '-'}</td>
      <td class="staff-col">${staffHtml}</td>
    </tr>
  `);
}

function showEmptyRow($tbody) {
  $tbody.append(
    '<tr><td colspan="5" class="empty-text">現在、受付中の集金はありません。</td></tr>'
  );
}
