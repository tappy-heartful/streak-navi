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

  // 1. 集金データとユーザーデータを並列で取得
  const collectRef = utils.collection(utils.db, 'collects');
  const userRef = utils.collection(utils.db, 'users'); // 追加

  const qCollects = utils.query(
    collectRef,
    utils.orderBy('targetDate', 'desc')
  );

  const [snap, userSnap] = await Promise.all([
    utils.getWrapDocs(qCollects),
    utils.getWrapDocs(userRef), // ユーザー一覧を取得
  ]);

  // 2. ユーザーIDをキーにした名前のマップを作成
  const userMap = {};
  userSnap.forEach((doc) => {
    userMap[doc.id] = doc.data().displayName || '不明';
  });

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

    // 3. 行作成関数に userMap を渡す
    const row = makeCollectRow(
      id,
      data,
      isActive,
      amountText,
      upfrontText,
      termText,
      userMap // 引数追加
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

// 引数に userMap を追加
function makeCollectRow(
  id,
  data,
  isActive,
  amountText,
  upfrontText,
  termText,
  userMap
) {
  const statusClass = isActive ? 'pending' : 'closed';
  const statusText = isActive ? '受付中' : '期間外';
  const isInTerm = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  // IDから名前に変換（該当がなければ元のIDまたは'-'を表示）
  const managerDisplayName =
    userMap[data.managerName] || data.managerName || '-';
  const payerDisplayName =
    userMap[data.upfrontPayer] || data.upfrontPayer || '-';

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
        <span class="answer-status ${statusClass}">${statusText}</span>
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
        <div class="info-item">立替: ${upfrontText}</div>
        <div class="info-item">人数: ${data.participantCount || '-'}名</div>
      </td>
      <td class="staff-col">
        <div class="staff-info">
          <span><i class="fas fa-user-tie"></i> ${managerDisplayName}</span><br>
          <span class="payer-label"><i class="fas fa-hand-holding-usd"></i> ${payerDisplayName}</span>
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
