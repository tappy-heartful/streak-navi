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
    $('#vote-status').text(voteData.isActive ? '受付中' : '期間外');

    const container = $('#vote-items-container').empty();

    // 管理者向け表示
    if (isAdmin) {
      const voteResults = await getVoteResults(voteId, voteData.items);
      container.append(
        '<div class="section-label">※投票結果は投票管理者のみ閲覧できます</div>'
      );
      renderAdminView(voteData.items, voteResults, container);
    } else {
      // 一般向け表示
      renderGeneralView(voteData.items, container);
    }

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

  // voteAnswers は [投票ID]_[uid] がドキュメントID
  const answersSnap = await utils.getDocs(
    utils.collection(utils.db, 'voteAnswers')
  );

  answersSnap.forEach((doc) => {
    if (!doc.id.startsWith(voteId + '_')) return;
    const answerData = doc.data();

    if (!answerData.answers) return; // 回答データなし

    // answers オブジェクト形式に対応
    Object.entries(answerData.answers).forEach(([itemTitle, choiceName]) => {
      if (results[itemTitle] && results[itemTitle][choiceName] !== undefined) {
        results[itemTitle][choiceName] += 1;
      }
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
// イベント & 表示制御
////////////////////////////
function setupEventHandlers(voteId, isAdmin, isOpen) {
  // --- 表示制御 ---
  if (!isOpen) $('.save-button').hide(); // 回答するボタンは受付中のみ
  if (!isAdmin) {
    // 管理者のみ表示
    $('.delete-button').hide();
    $('.edit-button').hide();
    $('.copy-button').hide();
  }

  // --- 回答する ---
  $('.save-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-answer/vote-answer.html?voteId=${voteId}`;
    });

  // --- 削除する ---
  $('.delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog('投票と回答を削除しますか？');
      if (!confirmed) return;

      try {
        // スピナー表示
        utils.showSpinner();

        // 投票削除
        await utils.deleteDoc(utils.doc(utils.db, 'votes', voteId));

        // 関連回答削除
        const answersSnap = await utils.getDocs(
          utils.collection(utils.db, 'voteAnswers')
        );
        for (const doc of answersSnap.docs) {
          if (doc.id.startsWith(voteId + '_')) {
            await utils.deleteDoc(utils.doc(utils.db, 'voteAnswers', doc.id));
          }
        }

        // スピナー表示
        utils.hideSpinner();

        await utils.showDialog('削除しました', true);
        window.location.href = '../vote-list/vote-list.html';
      } catch (err) {
        console.error(err);
        await utils.showDialog('削除しました', true);
      }
    });

  // --- 編集する ---
  $('.edit-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-edit/vote-edit.html?mode=edit&voteId=${voteId}`;
    });

  // --- コピーする ---
  $('.copy-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-edit/vote-edit.html?mode=copy&voteId=${voteId}`;
    });
}
