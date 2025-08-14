import * as utils from '../common/functions.js';

$(document).ready(async function () {
  await utils.initDisplay();
  await renderVote();
  utils.hideSpinner();
});

////////////////////////////
// 投票データ表示
////////////////////////////
async function renderVote() {
  try {
    const voteId = utils.globalGetParamVoteId;
    const isAdmin = utils.getSession('voteAdminFlg') === utils.globalStrTrue;
    const uid = utils.getSession('uid');
    const myProfileUrl = utils.getSession('pictureUrl') || ''; // LINEプロフィール画像URL

    // votes から投票情報を取得
    const voteSnap = await utils.getDoc(utils.doc(utils.db, 'votes', voteId));
    if (!voteSnap.exists()) {
      await utils.showDialog('該当の投票が見つかりません', true);
      window.location.href = '../vote-list/vote-list.html';
      return;
    }
    const voteData = voteSnap.data();

    // voteAnswers から自分の回答取得
    const myAnswerData = await utils.getDoc(
      utils.doc(utils.db, 'voteAnswers', `${voteId}_${uid}`)
    );
    const myAnswer = myAnswerData?.data()?.answers || {};

    // 画面に反映
    $('#vote-title').text(voteData.name);
    $('#vote-description').text(voteData.explain);
    $('#vote-status').text(voteData.isActive ? '受付中' : '終了');

    const container = $('#vote-items-container').empty();

    // 集計結果表示
    const voteResults = await getVoteResults(voteId, voteData.items);
    renderView(voteData.items, voteResults, container, myAnswer, myProfileUrl);

    // ボタン制御をセットアップ
    setupEventHandlers(voteId, isAdmin, voteData.isActive);
  } catch (e) {
    console.error(e);
    utils.showError('投票データ取得に失敗しました', e);
  }
}

////////////////////////////
// voteAnswersから集計
////////////////////////////
async function getVoteResults(voteId, items) {
  const results = {};
  items.forEach((item) => {
    results[item.name] = {};
    item.choices.forEach((choice) => {
      results[item.name][choice.name] = 0;
    });
  });

  const answersSnap = await utils.getDocs(
    utils.collection(utils.db, 'voteAnswers')
  );

  answersSnap.forEach((doc) => {
    if (!doc.id.startsWith(voteId + '_')) return;
    const answerData = doc.data();
    if (!answerData.answers) return;

    Object.entries(answerData.answers).forEach(([itemTitle, choiceName]) => {
      if (results[itemTitle] && results[itemTitle][choiceName] !== undefined) {
        results[itemTitle][choiceName] += 1;
      }
    });
  });

  return results;
}

////////////////////////////
// 投票結果表示
////////////////////////////
function renderView(items, voteResults, container, myAnswer, myProfileUrl) {
  items.forEach((item) => {
    const results = voteResults[item.name] || {};
    const maxVotes = Math.max(...Object.values(results), 1);

    const barsHtml = item.choices
      .map((choice) => {
        const count = results[choice.name] ?? 0;
        const percent = (count / maxVotes) * 100;
        const isMyChoice = myAnswer[item.name] === choice.name;

        const iconHtml = isMyChoice
          ? `<img src="${myProfileUrl}" alt="あなたの選択" class="my-choice-icon"/>`
          : '';

        return `
          <div class="result-bar ${isMyChoice ? 'my-choice' : ''}">
            <div class="label">${iconHtml}${choice.name}</div>
            <div class="bar-container">
              <div class="bar" style="width: ${percent}%"></div>
            </div>
            <div class="vote-count">${count}票</div>
          </div>
        `;
      })
      .join('');

    const html = `
      <div class="vote-item">
        <div class="vote-item-title">${item.name}</div>
        <div class="vote-results">${barsHtml}</div>
      </div>
    `;

    container.append(html);
  });
}

////////////////////////////
// イベント & 表示制御
////////////////////////////
function setupEventHandlers(voteId, isAdmin, isOpen) {
  if (!isOpen) $('.save-button').hide();
  if (!isAdmin) {
    $('.delete-button').hide();
    $('.edit-button').hide();
    $('.copy-button').hide();
  }

  $('.save-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-answer/vote-answer.html?voteId=${voteId}`;
    });

  $('.delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog(
        '投票と回答を削除しますか？\nこの操作は元に戻せません'
      );
      if (!confirmed) return;

      const dialogResultAgain = await utils.showDialog('本当に削除しますか？');
      if (!dialogResultAgain) return;

      try {
        utils.showSpinner();
        await utils.deleteDoc(utils.doc(utils.db, 'votes', voteId));

        const answersSnap = await utils.getDocs(
          utils.collection(utils.db, 'voteAnswers')
        );
        for (const doc of answersSnap.docs) {
          if (doc.id.startsWith(voteId + '_')) {
            await utils.deleteDoc(utils.doc(utils.db, 'voteAnswers', doc.id));
          }
        }

        utils.hideSpinner();
        await utils.showDialog('削除しました', true);
        window.location.href = '../vote-list/vote-list.html';
      } catch (err) {
        console.error(err);
        await utils.showDialog('削除しました', true);
      }
    });

  $('.edit-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-edit/vote-edit.html?mode=edit&voteId=${voteId}`;
    });

  $('.copy-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-edit/vote-edit.html?mode=copy&voteId=${voteId}`;
    });
}
