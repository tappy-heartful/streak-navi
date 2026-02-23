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
  const $upcomingBody = $('#upcoming-list-body').empty(); // 追加
  const $expiredBody = $('#expired-list-body').empty(); // 追加（旧closed）

  const myUid = utils.getSession('uid');
  const today = utils.format(new Date()); // "YYYY-MM-DD"形式

  // --- (中略：データ取得部分は変更なし) ---
  const collectRef = utils.collection(utils.db, 'collects');
  const userRef = utils.collection(utils.db, 'users');
  const qCollects = utils.query(collectRef, utils.orderBy('targetDate', 'asc'));
  const [snap, userSnap] = await Promise.all([
    utils.getWrapDocs(qCollects),
    utils.getWrapDocs(userRef),
  ]);
  const userMap = {};
  userSnap.forEach((doc) => {
    userMap[doc.id] = doc.data().displayName || '不明';
  });
  const collectDocsWithPaymentStatus = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      let hasPaid = false;
      if (myUid && data.participants && data.participants.includes(myUid)) {
        const responseDocRef = utils.doc(
          utils.db,
          'collects',
          doc.id,
          'responses',
          myUid,
        );
        const responseSnap = await utils.getWrapDoc(responseDocRef);
        hasPaid = responseSnap.exists();
      }
      return { id: doc.id, data: data, hasPaid: hasPaid, myUid: myUid };
    }),
  );
  // --- (ここまで変更なし) ---

  let activeCount = 0;
  let upcomingCount = 0;
  let expiredCount = 0;

  collectDocsWithPaymentStatus.forEach(({ id, data, hasPaid, myUid }) => {
    // 期間判定ロジック
    const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
    const isUpcoming = data.acceptStartDate > today; // 開始日が今日より後
    const isExpired = data.acceptEndDate < today; // 終了日が今日より前

    const formatYen = (num) => (num ? `¥${Number(num).toLocaleString()}` : '-');
    const amountText = formatYen(data.amountPerPerson);
    const upfrontText = formatYen(data.upfrontAmount);
    const termText = `${data.acceptStartDate}～<br>${data.acceptEndDate}`;

    // ステータステキストのカスタム（任意）
    let customStatusText = isActive ? '受付中' : isUpcoming ? '受付前' : '終了';

    const row = makeCollectRow(
      id,
      data,
      isActive,
      amountText,
      upfrontText,
      termText,
      userMap,
      hasPaid,
      myUid,
      customStatusText, // 引数を追加するか、内部で判定するように調整
    );

    if (isActive) {
      $activeBody.append(row);
      activeCount++;
    } else if (isUpcoming) {
      $upcomingBody.append(row);
      upcomingCount++;
    } else {
      $expiredBody.append(row);
      expiredCount++;
    }
  });

  // 表示制御
  if (activeCount === 0) showEmptyRow($activeBody);
  if (upcomingCount === 0) $('#upcoming-container').hide();
  if (expiredCount === 0) $('#expired-container').hide();
}

function makeCollectRow(
  id,
  data,
  isActive,
  amountText,
  upfrontText,
  termText,
  userMap,
  hasPaid,
  myUid,
) {
  // ステータスラベルの判定
  let statusClass = isActive ? 'pending' : 'closed';
  let statusText = isActive ? '受付中' : '期間外';

  // 💡 自分が参加者リストに入っている、かつ支払い済みの場合
  if (data.participants && data.participants.includes(myUid) && hasPaid) {
    statusClass = 'answered';
    statusText = '支払済';
  }

  const isInTerm = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);

  const managerDisplayName =
    userMap[data.managerName] || data.managerName || '-';
  const payerDisplayName =
    userMap[data.upfrontPayer] || data.upfrontPayer || '-';

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
    '<tr><td colspan="8" class="empty-text">現在、受付中の集金はありません。</td></tr>',
  );
}
