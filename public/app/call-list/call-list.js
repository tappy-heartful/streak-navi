import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '曲募集一覧' }]);
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
  utils.isAdmin('Call') ? $('#add-button').show() : $('#add-button').hide();

  const $activeBody = $('#active-list-body').empty();
  const $closedBody = $('#closed-list-body').empty();

  const callsRef = utils.collection(utils.db, 'calls');
  const qCalls = utils.query(callsRef, utils.orderBy('createdAt', 'desc'));
  const callsSnap = await utils.getWrapDocs(qCalls);

  // 回答数を集計
  const allAnswersSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'callAnswers')
  );
  const answerCountMap = {};
  allAnswersSnap.forEach((doc) => {
    const callId = doc.id.split('_')[0];
    answerCountMap[callId] = (answerCountMap[callId] || 0) + 1;
  });

  const uid = utils.getSession('uid');
  let activeCount = 0;
  let closedCount = 0;

  for (const callDoc of callsSnap.docs) {
    const data = callDoc.data();
    const id = callDoc.id;

    const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
    const participantCount = answerCountMap[id] || 0;

    // 募集項目(曲名/パート等)をリスト化
    const itemNames = (data.items || [])
      .map((item) => `・${item}`)
      .join('<br>');

    if (isActive) {
      const answerId = `${id}_${uid}`;
      const answerSnap = await utils.getWrapDoc(
        utils.doc(utils.db, 'callAnswers', answerId)
      );

      const statusText = answerSnap.exists() ? '回答済' : '未回答';
      const statusClass = answerSnap.exists() ? 'answered' : 'pending';

      const row = makeCallRow(
        id,
        data.title_decoded || data.title,
        statusText,
        statusClass,
        participantCount,
        itemNames
      );
      // 未回答を上に表示
      statusClass === 'pending'
        ? $activeBody.prepend(row)
        : $activeBody.append(row);
      activeCount++;
    } else {
      $closedBody.append(
        makeCallRow(
          id,
          data.title_decoded || data.title,
          '期間外',
          'closed',
          participantCount,
          itemNames
        )
      );
      closedCount++;
    }
  }

  if (activeCount === 0) showEmptyRow($activeBody);
  if (closedCount === 0) $('#closed-container').hide();
}

function makeCallRow(id, title, status, statusClass, count, itemsHtml) {
  return $(`
    <tr>
      <td class="list-table-row-header">
        <a href="../call-confirm/call-confirm.html?callId=${id}">
          ${title}
        </a>
      </td>
      <td>
        <span class="answer-status ${statusClass}">${status}</span>
      </td>
      <td class="count-col">
        ${count}人
      </td>
      <td class="items-col">
        ${itemsHtml || '-'}
      </td>
    </tr>
  `);
}

function showEmptyRow($tbody) {
  $tbody.append(
    '<tr><td colspan="4" class="empty-text">該当する曲募集はありません🍀</td></tr>'
  );
}
