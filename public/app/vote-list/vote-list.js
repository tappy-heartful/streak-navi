import * as utils from '../common/functions.js';

$(document).ready(async function () {
  await utils.initDisplay();
  await setUpPage();
  utils.hideSpinner();
});

async function setUpPage() {
  const list = $('#vote-list').empty();

  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  if (votesSnap.empty) {
    showEmptyMessage(list);
    return;
  }

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    const voteId = voteDoc.id;

    list.append(makeVoteItem(voteId, voteData.name));
  }

  utils.getSession('voteAdminFlg') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();
}

function makeVoteItem(voteId, name) {
  return $(`
    <li>
      <a href="../vote-confirm/vote-confirm.html?voteId=${voteId}" class="vote-link">
        ${name}
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="vote-link empty">
        該当の投票はありません🍀
      </div>
    </li>
  `);
}
