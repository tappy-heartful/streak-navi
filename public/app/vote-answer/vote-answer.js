import * as utils from '../common/functions.js';

$(document).ready(async function () {
  const voteId = utils.globalGetParamVoteId;
  const uid = utils.getSession('uid');

  await utils.initDisplay();

  // 回答データがあるか確認してモード判定
  let mode = 'new';
  let answerData = await fetchAnswerData(voteId, uid);
  if (answerData) {
    mode = 'edit';
  }

  setupPageMode(mode);

  // 投票データ取得
  const voteData = await fetchVoteData(voteId);

  // 回答データがなければ空オブジェクト
  answerData = answerData || {};

  renderVote(voteData, answerData);

  setupEventHandlers(mode, voteId, uid);

  utils.hideSpinner();
});

function setupPageMode(mode) {
  const title = mode === 'edit' ? '回答修正' : '回答登録';
  const buttonText = mode === 'edit' ? '回答を修正する' : '回答を登録する';
  $('#title').text(title);
  $('#page-title').text(title);
  $('#answer-submit').text(buttonText);
}

async function fetchVoteData(voteId) {
  try {
    const voteDoc = await utils.getDoc(utils.doc(utils.db, 'votes', voteId));
    if (!voteDoc.exists()) {
      await utils.showDialog('該当する投票が見つかりません', true);
      throw new Error('Vote not found');
    }
    return voteDoc.data();
  } catch (e) {
    console.error(e);
    await utils.showDialog('投票データの取得に失敗しました', true);
    throw e;
  }
}

async function fetchAnswerData(voteId, uid) {
  try {
    const ansDoc = await utils.getDoc(
      utils.doc(utils.db, 'voteAnswers', `${voteId}_${uid}`)
    );
    if (ansDoc.exists()) {
      return ansDoc.data().answers;
    }
    return null;
  } catch (e) {
    console.error(e);
    await utils.showDialog('回答データの取得に失敗しました', true);
    return null;
  }
}

function renderVote(voteData, answerData = {}) {
  $('#vote-title').text(voteData.name);
  $('#vote-description').text(voteData.explain);

  const container = $('#vote-items-container').empty();

  voteData.items.forEach((item, index) => {
    const groupName = `question-${index}`;
    const choicesHtml = item.choices
      .map((choice, i) => {
        const choiceId = `${groupName}-choice-${i}`;
        const checked = answerData[item.name] === choice.name ? 'checked' : '';
        return `
          <label class="vote-choice-label" for="${choiceId}">
            <input type="radio" name="${groupName}" id="${choiceId}" value="${choice.name}" ${checked}/>
            ${choice.name}
          </label>
        `;
      })
      .join('');

    const itemHtml = $(`
      <div class="vote-item">
        <div class="vote-item-title">${item.name}</div>
        <div class="vote-choices">${choicesHtml}</div>
      </div>
    `);
    container.append(itemHtml);
  });
}

function setupEventHandlers(mode, voteId, uid) {
  $('#answer-submit').on('click', async function () {
    const answers = {};

    $('.vote-item').each(function () {
      const questionTitle = $(this).find('.vote-item-title').text();
      const selected = $(this).find('input[type="radio"]:checked').val();
      answers[questionTitle] = selected || null;
    });

    const confirmed = await utils.showDialog(
      `回答を${mode === 'edit' ? '修正' : '登録'}しますか？`
    );
    if (!confirmed) return;

    try {
      // スピナー表示
      utils.showSpinner();

      await utils.setDoc(
        utils.doc(utils.db, 'voteAnswers', `${voteId}_${uid}`),
        {
          voteId,
          uid,
          answers,
          updatedAt: utils.serverTimestamp(),
        },
        { merge: true }
      );

      // スピナー非表示
      utils.hideSpinner();

      await utils.showDialog(
        `回答を${mode === 'edit' ? '修正' : '登録'}しました`,
        true
      );
      window.location.href =
        '../vote-confirm/vote-confirm.html?voteId=' + voteId;
    } catch (e) {
      console.error(e);
      await utils.showDialog('回答の保存に失敗しました', true);
    }
  });
}
