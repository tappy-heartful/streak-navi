import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '投票一覧' }]);
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
  utils.isAdmin('Vote') ? $('#add-button').show() : $('#add-button').hide();

  const $activeBody = $('#active-list-body').empty();
  const $closedBody = $('#closed-list-body').empty();

  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getWrapDocs(qVotes);

  // 全回答を取得して投票ごとの回答数を集計
  const allAnswersSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'voteAnswers')
  );
  const answerCountMap = {};
  allAnswersSnap.forEach((doc) => {
    const voteId = doc.id.split('_')[0];
    answerCountMap[voteId] = (answerCountMap[voteId] || 0) + 1;
  });

  const uid = utils.getSession('uid');
  let activeCount = 0;
  let closedCount = 0;

  for (const voteDoc of votesSnap.docs) {
    const data = voteDoc.data();
    const id = voteDoc.id;

    const isActive = utils.isInTerm(data.acceptStartDate, data.acceptEndDate);
    const participantCount = answerCountMap[id] || 0;

    if (isActive) {
      // 受付中の処理（自分の回答状況を確認）
      const answerId = `${id}_${uid}`;
      const answerSnap = await utils.getWrapDoc(
        utils.doc(utils.db, 'voteAnswers', answerId)
      );

      const statusText = answerSnap.exists() ? '回答済' : '未回答';
      const statusClass = answerSnap.exists() ? 'answered' : 'pending';

      $activeBody.append(
        makeVoteRow(
          id,
          data.name_decoded || data.name,
          statusText,
          statusClass,
          participantCount,
          data.createdBy_decoded || '不明'
        )
      );
      activeCount++;
    } else {
      // 期間外の処理
      $closedBody.append(
        makeVoteRow(
          id,
          data.name_decoded || data.name,
          '期間外',
          'closed',
          participantCount,
          data.createdBy_decoded || '不明'
        )
      );
      closedCount++;
    }
  }

  if (activeCount === 0) showEmptyRow($activeBody);
  if (closedCount === 0) {
    $('#closed-container').hide();
  }
}

function makeVoteRow(id, name, status, statusClass, count, creator) {
  return $(`
    <tr>
      <td class="list-table-row-header">
        <a href="../vote-confirm/vote-confirm.html?voteId=${id}">
          ${name}
        </a>
      </td>
      <td>
        <span class="answer-status ${statusClass}">${status}</span>
      </td>
      <td class="count-col">
        ${count}人
      </td>
      <td class="creator-col">
        ${creator}
      </td>
    </tr>
  `);
}

function showEmptyRow($tbody) {
  $tbody.append(
    '<tr><td colspan="4" class="empty-text">該当する投票はありません🍀</td></tr>'
  );
}
