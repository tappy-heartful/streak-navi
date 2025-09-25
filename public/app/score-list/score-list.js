import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    utils.setBreadcrumb([{ title: '譜面一覧' }]);
    await utils.initDisplay();
    await setUpPage();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // 管理者の場合のみ新規登録ボタン表示
  utils.getSession('isScoreAdmin') === utils.globalStrTrue
    ? $('#add-button').show()
    : $('#add-button').hide();

  const $list = $('#score-list').empty();

  const scoresRef = utils.collection(utils.db, 'scores');
  const qScore = utils.query(scoresRef, utils.orderBy('createdAt', 'desc'));
  const scoreSnap = await utils.getDocs(qScore);

  if (scoreSnap.empty) {
    showEmptyMessage($list);
    return;
  }

  for (const scoreDoc of scoreSnap.docs) {
    const scoreData = scoreDoc.data();
    const scoreId = scoreDoc.id;

    $list.append(makeScoreItem(scoreId, scoreData.title));
  }
}

function makeScoreItem(scoreId, title) {
  return $(`
    <li>
      <a href="../score-confirm/score-confirm.html?scoreId=${scoreId}" class="score-link">
        <span class="score-title">🎼 ${title}</span>
      </a>
    </li>
  `);
}

function showEmptyMessage($list) {
  $list.append(`
    <li class="empty-message">
      <div class="score-link empty">
        該当の譜面はありません🍀
      </div>
    </li>
  `);
}
