import * as utils from '../common/functions.js';

$(document).ready(async function () {
  await utils.initDisplay();
  await renderVote();
  setupEventHandlers();
  utils.hideSpinner();
});

////////////////////////////
// 投票データ表示
////////////////////////////
async function renderVote() {
  try {
    const voteId = utils.globalGetParamVoteId;
    const isAdmin = utils.getSession('voteAdminFlg') === utils.globalStrTrue;

    // votes から投票情報を取得
    const voteSnap = await utils.getDoc(utils.doc(utils.db, 'votes', voteId));
    if (!voteSnap.exists()) {
      await utils.showDialog('該当の投票が見つかりません', true);
      window.location.href = '../vote-list/vote-list.html';
      return;
    }
    const voteData = voteSnap.data();

    // 画面に反映
    $('#vote-title').text(voteData.name);
    $('#vote-description').text(voteData.explain);
    $('#vote-status').text(voteData.isActive ? '受付中' : '終了');

    const container = $('#vote-items-container').empty();

    // 管理者向け表示
    if (isAdmin) {
      const voteResults = await getVoteResults(voteId, voteData.items);
      container.append(
        '<div class="section-label">※以下情報は投票管理者のみ閲覧できます</div>'
      );
      renderAdminView(voteData.items, voteResults, container);
    } else {
      // 一般向け表示
      renderGeneralView(voteData.items, container);
    }
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

  // voteAnswers は [投票ID]_[uid] がドキュメントID
  const answersSnap = await utils.getDocs(
    utils.collection(utils.db, 'voteAnswers')
  );
  answersSnap.forEach((doc) => {
    const docId = doc.id;
    if (!docId.startsWith(voteId + '_')) return;

    const answerData = doc.data();
    answerData.items.forEach((itemAns) => {
      const itemTitle = itemAns.name;
      itemAns.choices.forEach((choiceName) => {
        if (
          results[itemTitle] &&
          results[itemTitle][choiceName] !== undefined
        ) {
          results[itemTitle][choiceName] += 1;
        }
      });
    });
  });

  return results;
}

////////////////////////////
// 一般向け表示
////////////////////////////
function renderGeneralView(items, container) {
  items.forEach((item) => {
    const choicesHtml = item.choices
      .map((choice) => `<div class="vote-choice">・${choice.name}</div>`)
      .join('');

    const html = `
      <div class="vote-item">
        <div class="vote-item-title">${item.name}</div>
        <div class="vote-choices">${choicesHtml}</div>
      </div>
    `;

    container.append(html);
  });
}

////////////////////////////
// 管理者向け表示
////////////////////////////
function renderAdminView(items, voteResults, container) {
  items.forEach((item) => {
    const results = voteResults[item.name] || {};
    const maxVotes = Math.max(...Object.values(results), 1);

    const barsHtml = item.choices
      .map((choice) => {
        const count = results[choice.name] ?? 0;
        const percent = (count / maxVotes) * 100;

        return `
          <div class="result-bar">
            <div class="label">・${choice.name}</div>
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
// イベント
////////////////////////////
function setupEventHandlers() {
  $('.delete-button').on('click', function () {
    utils.showDialog('削除しますか？').then((result) => {
      if (result) {
        alert('削除処理（未実装）');
      }
    });
  });

  $('.save-button').on('click', function () {
    window.location.href =
      '../vote-answer/vote-answer.html?voteId=' + utils.globalGetParamVoteId;
  });
}
