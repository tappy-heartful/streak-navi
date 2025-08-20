import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await renderVote();
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

////////////////////////////
// 投票データ表示
////////////////////////////
async function renderVote() {
  const voteId = utils.globalGetParamVoteId;
  const isAdmin = utils.getSession('voteAdminFlg') === utils.globalStrTrue;
  const uid = utils.getSession('uid');
  const myProfileUrl = utils.getSession('pictureUrl') || '';

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
  if (myAnswer && Object.keys(myAnswer).length > 0) {
    // 回答がある場合、回答するボタンを「再回答する」に変更
    $('#answer-save-button').text('再回答する');
  } else {
    // 回答がない場合、削除ボタンを非表示。回答するボタンを「回答する」に変更
    $('#answer-save-button').text('回答する');
    $('#answer-delete-button').hide();
  }

  const container = $('#vote-items-container').empty();

  // 集計結果表示
  const voteResults = await getVoteResults(voteId, voteData.items);
  renderView(voteData.items, voteResults, container, myAnswer, myProfileUrl);

  setupEventHandlers(voteId, isAdmin, voteData.isActive, uid);
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

        const voteCountView =
          count > 0
            ? `<a href="#" class="vote-count-link" data-item="${item.name}" data-choice="${choice.name}">${count}票</a>`
            : `${count}票`;
        return `
          <div class="result-bar ${isMyChoice ? 'my-choice' : ''}">
            <div class="label">${iconHtml}${choice.name}</div>
            <div class="bar-container">
              <div class="bar" style="width: ${percent}%"></div>
            </div>
            <div class="vote-count">
                ${voteCountView}
            </div>
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
function setupEventHandlers(voteId, isAdmin, isOpen, uid) {
  if (!isOpen) $('#answer-save-button').hide();
  if (!isAdmin) {
    $('#vote-menu').hide();
  }

  // 投票結果のクリックイベント
  $(document).on('click', '.vote-count-link', async function (e) {
    e.preventDefault();
    utils.showSpinner();

    const itemName = $(this).data('item');
    const choiceName = $(this).data('choice');

    try {
      // 該当投票の回答者 UID を収集
      const voterUids = [];
      const answersSnap = await utils.getDocs(
        utils.collection(utils.db, 'voteAnswers')
      );
      answersSnap.forEach((doc) => {
        if (!doc.id.startsWith(voteId + '_')) return;
        const data = doc.data();
        if (data.answers?.[itemName] === choiceName) {
          const uid = doc.id.split('_')[1];
          voterUids.push(uid);
        }
      });

      // users コレクションから情報取得
      const voters = [];
      for (const uid of voterUids) {
        const userSnap = await utils.getDoc(utils.doc(utils.db, 'users', uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          voters.push({
            name: userData.displayName || '名無し',
            pictureUrl: userData.pictureUrl || '',
          });
        }
      }

      // モーダルに描画
      const modalBody = voters
        .map(
          (v) => `
        <div class="voter">
          <img src="${v.pictureUrl}" alt="${v.name}" class="voter-icon"/>
          <span>${v.name}</span>
        </div>
      `
        )
        .join('');

      $('#vote-detail-modal .modal-title').text(`${choiceName} に投票した人`);
      $('#vote-detail-modal .modal-body').html(modalBody);
      $('#vote-detail-modal').removeClass('hidden');
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: voteId,
        action: '投票者確認',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // 閉じるボタン押下でモーダルを非表示にする
  $(document).on('click', '.modal-close', function () {
    $(this).closest('.modal').addClass('hidden');
  });

  // モーダルの外側をクリックした場合も閉じる
  $(document).on('click', '.modal', function (e) {
    if ($(e.target).hasClass('modal')) {
      $(this).addClass('hidden');
    }
  });

  // 回答する
  $('#answer-save-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-answer/vote-answer.html?voteId=${voteId}`;
    });

  // 回答削除（自分の回答のみ）
  $('#answer-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog('自分の回答を削除しますか？');
      if (!confirmed) return;

      try {
        utils.showSpinner();
        await utils.deleteDoc(
          utils.doc(utils.db, 'voteAnswers', `${voteId}_${uid}`)
        );

        await utils.writeLog({
          dataId: voteId,
          action: '回答削除',
          uid: uid,
        });

        utils.hideSpinner();
        await utils.showDialog('回答を削除しました', true);
        window.location.reload();
      } catch (e) {
        await utils.writeLog({
          dataId: voteId,
          action: '回答削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        utils.hideSpinner();
      }
    });

  // 投票削除（管理者のみ）
  $('#vote-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog(
        'この投票と全員の回答を削除しますか？\nこの操作は元に戻せません'
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

        // ログ登録
        await utils.writeLog({ dataId: voteId, action: '投票削除' });
        utils.hideSpinner();
        await utils.showDialog('削除しました', true);
        window.location.href = '../vote-list/vote-list.html';
      } catch (e) {
        // ログ登録
        await utils.writeLog({
          dataId: voteId,
          action: '投票削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        // スピナー非表示
        utils.hideSpinner();
      }
    });

  // 編集
  $('#vote-edit-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-edit/vote-edit.html?mode=edit&voteId=${voteId}`;
    });

  // コピー
  $('#vote-copy-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../vote-edit/vote-edit.html?mode=copy&voteId=${voteId}`;
    });
}
