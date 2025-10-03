import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    const voteId = utils.globalGetParamVoteId;
    const uid = utils.getSession('uid');

    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: '投票一覧', url: '../vote-list/vote-list.html' },
      {
        title: '投票確認',
        url:
          '../vote-confirm/vote-confirm.html?voteId=' +
          utils.globalGetParamVoteId,
      },
      { title: '回答登録/修正' },
    ]);

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
    throw new Error('投票が見つかりません：' + voteId);
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
  $('#vote-description').text(voteData.description);

  const container = $('#vote-items-container').empty();

  voteData.items.forEach((item, index) => {
    const groupName = `question-${index}`;
    const choicesHtml = item.choices
      .map((choice, i) => {
        const choiceId = `${groupName}-choice-${i}`;
        const checked = answerData[item.name] === choice.name ? 'checked' : '';

        // リンクアイコン用HTML（枠外に配置）
        let iconHtml = '';
        if (choice.link) {
          const url = choice.link;
          try {
            const u = new URL(url);
            if (
              u.hostname.includes('youtube.com') ||
              u.hostname.includes('youtu.be')
            ) {
              iconHtml = `<a href="#" class="vote-choice-link youtube-link" data-video-url="${url}" data-video-title="${choice.name}"><i class="fa-brands fa-youtube"></i></a>`;
            } else {
              iconHtml = `<a href="${url}" class="vote-choice-link" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i></a>`;
            }
          } catch (e) {
            iconHtml = '';
          }
        }

        return `
          <div class="vote-choice-wrapper">
            <label class="vote-choice-label" for="${choiceId}">
              <input type="radio" name="${groupName}" id="${choiceId}" value="${choice.name}" ${checked}/>
              ${choice.name}
            </label>
            ${iconHtml}
          </div>
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
    let hasError = false;

    // 既存のエラーメッセージをクリア
    $('.error-message').remove();

    $('.vote-item').each(function () {
      const questionTitle = $(this).find('.vote-item-title').text();
      const selected = $(this).find('input[type="radio"]:checked').val();
      answers[questionTitle] = selected || null;

      // 未回答ならエラーメッセージ追加
      if (!selected) {
        hasError = true;
        $(this)
          .find('.vote-choices')
          .after(`<div class="error-message">回答を選択してください。</div>`);
      }
    });

    if (hasError) {
      await utils.showDialog(`すべての質問に回答してください。`, true);
      // エラーがある場合は送信処理中断
      return;
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

  $(document).on('click', '.youtube-link', async function (e) {
    e.preventDefault();
    const videoUrl = $(this).data('video-url') || $(this).attr('href');
    const title = $(this).attr('data-video-title') || '参考音源';

    const iframeHtml = utils.buildYouTubeHtml(videoUrl);

    await utils.showModal(title, iframeHtml);
  });

  $(document).on('click', '.back-link', function () {
    window.location.href = '../vote-confirm/vote-confirm.html?voteId=' + voteId;
  });
}
