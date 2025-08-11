import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理（スピナー表示、投票一覧取得、イベントハンドラ設定、スピナー非表示）
  await utils.initDisplay();
  await setUpPage();
  setupEventHandlers();
  utils.hideSpinner();
});

////////////////////////////
// ページセットアップ処理
////////////////////////////
async function setUpPage() {
  // 投票一覧読み込み
  // FirestoreからvotesコレクションをcreatedAt降順で取得
  const votesRef = utils.collection(utils.db, 'votes');
  const qVotes = utils.query(votesRef, utils.orderBy('createdAt', 'desc'));
  const votesSnap = await utils.getDocs(qVotes);

  // 各タブのリスト要素を取得
  const pendingList = $('[data-tab-content="pending"]');
  const votedList = $('[data-tab-content="voted"]');
  const closedList = $('[data-tab-content="closed"]');

  // リストを初期化
  pendingList.empty();
  votedList.empty();
  closedList.empty();

  // 投票が1件もない場合は空メッセージを表示して終了
  if (votesSnap.empty) {
    showEmptyMessage(pendingList);
    showEmptyMessage(votedList);
    showEmptyMessage(closedList);
    return;
  }

  // 各投票データを処理
  for (const voteDoc of votesSnap.docs) {
    const voteData = voteDoc.data();
    const voteId = voteDoc.id;

    // isActive=falseの場合は「終了」タブに追加
    if (voteData.isActive === false) {
      closedList.append(makeVoteItem(voteId, voteData.name));
      continue;
    }

    // 回答済みかどうかを判定
    const answerId = `${voteId}_${utils.getSession('uid')}`;
    const answerDocRef = utils.doc(utils.db, 'voteAnswers', answerId);
    const answerSnap = await utils.getDoc(answerDocRef);

    // 回答済みなら「投票済み」タブ、未回答なら「未投票」タブに追加
    if (answerSnap.exists()) {
      votedList.append(makeVoteItem(voteId, voteData.name));
    } else {
      pendingList.append(makeVoteItem(voteId, voteData.name));
    }

    // 新規作成ボタン制御
    utils.getSession('voteAdminFlg') === utils.globalStrTrue
      ? $('#add-button').show()
      : $('#add-button').hide();
  }

  // 各タブが空の場合は空メッセージを表示
  if (!pendingList.children().length) showEmptyMessage(pendingList);
  if (!votedList.children().length) showEmptyMessage(votedList);
  if (!closedList.children().length) showEmptyMessage(closedList);
}

////////////////////////////
// 投票リストアイテム生成
////////////////////////////
function makeVoteItem(voteId, name) {
  // 投票詳細ページへのリンク付きリストアイテムを生成
  return $(`
    <li>
      <a href="../vote-confirm/vote-confirm.html?voteId=${voteId}" class="vote-link">
        📝 ${name}
      </a>
    </li>
  `);
}

////////////////////////////
// 空リスト用メッセージ表示
////////////////////////////
function showEmptyMessage($list) {
  // 「該当の投票はありません」メッセージをリストに追加
  $list.append(`
    <li class="empty-message">
      <div class="vote-link" style="text-align:center; color:#777; font-size:14px; background-color:#f0f0f0;">
        該当の投票はありません💦
      </div>
    </li>
  `);
}

////////////////////////////
// タブ切り替えイベント設定
////////////////////////////
function setupEventHandlers() {
  // タブクリック時の表示切り替え処理
  $('.tab').on('click', function () {
    $('.tab').removeClass('active');
    $('[data-tab-content]').addClass('hidden');

    $(this).addClass('active');
    $(`[data-tab-content="${$(this).data('tab')}"]`).removeClass('hidden');
  });
}
