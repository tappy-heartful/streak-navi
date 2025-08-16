import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
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
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamVoteId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

function setupPageMode(mode) {
  const title = mode === 'edit' ? '回答修正' : '回答登録';
  const buttonText = mode === 'edit' ? '回答を修正する' : '回答を登録する';
  $('#title').text(title);
  $('#page-title').text(title);
  $('#answer-submit').text(buttonText);
}

async function fetchVoteData(voteId) {
  const voteDoc = await utils.getDoc(utils.doc(utils.db, 'votes', voteId));
  if (!voteDoc.exists()) {
    await utils.showDialog('該当する投票が見つかりません', true);
    throw new Error('Vote not found');
  }
  return voteDoc.data();
}

async function fetchAnswerData(voteId, uid) {
  const ansDoc = await utils.getDoc(
    utils.doc(utils.db, 'voteAnswers', `${voteId}_${uid}`)
  );
  if (ansDoc.exists()) {
    return ansDoc.data().answers;
  }
  return null;
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
    let firstErrorItem = null;

    $('.vote-item').each(function () {
      const questionTitle = $(this).find('.vote-item-title').text();
      const selected = $(this).find('input[type="radio"]:checked').val();
      answers[questionTitle] = selected || null;

      // 未回答の場合、最初の要素を保持
      if (!selected && !firstErrorItem) {
        firstErrorItem = $(this);
      }
    });

    if (firstErrorItem) {
      await utils.showDialog(
        `「${firstErrorItem
          .find('.vote-item-title')
          .text()}」の回答を選択してください。`,
        true
      );
      return; // ここで送信処理中断
    }

    const confirmed = await utils.showDialog(
      `回答を${mode === 'edit' ? '修正' : '登録'}しますか？`
    );
    if (!confirmed) return;

    try {
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

      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamVoteId,
        action: mode === 'edit' ? '修正' : '登録',
      });

      utils.hideSpinner();
      await utils.showDialog(
        `回答を${mode === 'edit' ? '修正' : '登録'}しました`,
        true
      );
      window.location.href =
        '../vote-confirm/vote-confirm.html?voteId=' + voteId;
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamVoteId,
        action: mode === 'edit' ? '修正' : '登録',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  $(document).on('click', '.back-link', function () {
    window.location.href = '../vote-confirm/vote-confirm.html?voteId=' + voteId;
  });
}
