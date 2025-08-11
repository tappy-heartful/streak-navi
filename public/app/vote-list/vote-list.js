import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  await utils.initDisplay();
  await loadVotes();
  setupEventHandlers();
  utils.hideSpinner();
});

////////////////////////////
// 投票一覧読み込み
////////////////////////////
async function loadVotes() {
  // votes を createdAt 順で取得
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  // タブごとのUL（jQueryで取得）
  const $pendingList = $('[data-tab-content="pending"]');
  const $votedList = $('[data-tab-content="voted"]');
  const $closedList = $('[data-tab-content="closed"]');

  // 初期化
  $pendingList.empty();
  $votedList.empty();
  $closedList.empty();

  // 件数カウンター
  let pendingCount = 0;
  let votedCount = 0;
  let closedCount = 0;

  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    const voteId = voteDoc.id;

    // isActive=false → 終了タブ
    if (voteData.isActive === false) {
      $closedList.append(makeVoteItem(voteId, voteData.name));
      closedCount++;
      continue;
    }

    // 投票済みか確認
    const answerId = `${utils.getSession('uid')}_${voteId}`;
    const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
    const answerSnap = await utils.getDoc(answerDocRef);

    if (answerSnap.exists()) {
      $votedList.append(makeVoteItem(voteId, voteData.name));
      votedCount++;
    } else {
      $pendingList.append(makeVoteItem(voteId, voteData.name));
      pendingCount++;
    }
  }

  // 各タブに該当なしメッセージを追加
  const noVoteMessage = '<li>💁‍♀️該当の投票はありません</li>';
  if (pendingCount === 0) {
    $pendingList.append(noVoteMessage);
  }
  if (votedCount === 0) {
    $votedList.append(noVoteMessage);
  }
  if (closedCount === 0) {
    $closedList.append(noVoteMessage);
  }
}

////////////////////////////
// 投票アイテム生成
////////////////////////////
function makeVoteItem(voteId, name) {
  return $('<li>').append(
    $('<a>')
      .attr('href', `../vote-confirm/vote-confirm.html?voteId=${voteId}`)
      .addClass('vote-link')
      .text('📝' + name)
  );
}

////////////////////////////
// タブ切り替え処理
////////////////////////////
function setupEventHandlers() {
  $('.tab').on('click', function () {
    $('.tab').removeClass('active');
    $('[data-tab-content]').addClass('hidden');

    $(this).addClass('active');
    const target = $(this).data('tab');
    $(`[data-tab-content="${target}"]`).removeClass('hidden');
  });
}
