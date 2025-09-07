import * as utils from '../common/functions.js'; // 共通関数群読み込み

//==================================
// グローバル変数
//==================================
let initialStateHtml; // 初期表示状態の保存用

//==================================
// 初期化処理（ページ読込時）
//==================================
$(document).ready(async function () {
  try {
    await utils.initDisplay(); // 共通初期化

    // データ取得
    await loadVoteData(utils.globalGetParamVoteId);

    // データ反映後に初期状態を保存
    captureInitialState();

    setupEventHandlers();
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

//==================================
// 投票データ取得＆画面反映
//==================================
async function loadVoteData(voteId) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'votes', voteId));
  if (!docSnap.exists()) {
    throw new Error('投票が見つかりません：' + voteId);
  }
  const data = docSnap.data();

  // 投票名・説明・公開状態
  $('#vote-title').val(data.name);
  $('#vote-description').val(data.explain);
  $('#is-open').prop('checked', !!data.isActive);
  $('#is-anonymous').prop('checked', !!data.isAnonymous);
  $('#hide-votes').prop('checked', !!data.hideVotes);

  // 項目表示
  $('#vote-items-container').empty();
  data.items.forEach((item) => {
    const $item = createVoteItemTemplate();
    $item.find('.vote-item-title').val(item.name);
    const $choices = $item.find('.vote-choices').empty();
    item.choices.forEach((choice, idx) => {
      $choices.append(`
          <div class="choice-wrapper">
            ・<input type="text" class="vote-choice" placeholder="選択肢${
              idx + 1
            }" value="${choice.name}" />
            <button class="remove-choice">×</button>
          </div>
        `);
    });
    $('#vote-items-container').append($item);
  });
}

//==================================
// イベントハンドラ登録
//==================================
function setupEventHandlers() {
  // 【クリアボタン】初期状態に戻す
  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('編集前に戻しますか？')) restoreInitialState();
  });

  // 【保存ボタン】
  $('#save-button').on('click', async () => {
    // 入力チェック
    if (!validateVoteData()) {
      utils.showDialog('入力内容を確認してください', true);
      return;
    }

    // 確認ダイアログ
    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner(); // スピナー表示

    try {
      // 入力データ取得
      const voteData = collectVoteData();

      // 更新
      const voteId = utils.globalGetParamVoteId;
      await utils.updateDoc(utils.doc(utils.db, 'votes', voteId), {
        ...voteData,
        updatedAt: utils.serverTimestamp(),
      });

      // ログ登録
      await utils.writeLog({
        dataId: voteId,
        action: '更新',
      });
      utils.hideSpinner();
      await utils.showDialog('更新しました', true);
      window.location.href = `../vote-confirm/vote-confirm.html?voteId=${voteId}`;
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamVoteId,
        action: '保存',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  // 確認画面に戻る
  $(document).on('click', '.back-link', function (e) {
    window.location.href = `../vote-confirm/vote-confirm.html?voteId=${utils.globalGetParamVoteId}`;
  });
}

//==================================
// 項目テンプレート生成
//==================================
function createVoteItemTemplate() {
  return $(`
    <div class="vote-item">
      <input type="text" class="vote-item-title" placeholder="項目名（例：演目候補）" />
      <div class="vote-choices">
        ${choiceTemplate(1)[0].outerHTML}
        ${choiceTemplate(2)[0].outerHTML}
      </div>
      <button class="add-choice">＋ 選択肢を追加</button>
      <button class="remove-item">× 項目を削除</button>
    </div>
  `);
}

//==================================
// 選択肢テンプレート生成
//==================================
function choiceTemplate(index) {
  return $(`
    <div class="choice-wrapper">
      ・<input type="text" class="vote-choice" placeholder="選択肢${index}" />
      <button class="remove-choice">×</button>
    </div>
  `);
}

//==================================
// 初期状態の保存と復元
//==================================
function captureInitialState() {
  initialStateHtml = {
    title: $('#vote-title').val(),
    description: $('#vote-description').val(),
    isOpen: $('#is-open').prop('checked'),
    isAnonymous: $('#is-anonymous').prop('checked'),
    hideVotes: $('#hide-votes').prop('checked'),
    items: $('#vote-items-container .vote-item')
      .map(function () {
        return {
          name: $(this).find('.vote-item-title').val(),
          choices: $(this)
            .find('.vote-choice')
            .map(function () {
              return $(this).val();
            })
            .get(),
        };
      })
      .get(),
  };
}

function restoreInitialState() {
  $('#vote-title').val(initialStateHtml.title);
  $('#vote-description').val(initialStateHtml.description);
  $('#is-open').prop('checked', initialStateHtml.isOpen);
  $('#is-anonymous').prop('checked', initialStateHtml.isAnonymous);
  $('#hide-votes').prop('checked', initialStateHtml.hideVotes);

  $('#vote-items-container').empty();
  initialStateHtml.items.forEach((item) => {
    const $item = createVoteItemTemplate();
    $item.find('.vote-item-title').val(item.name);

    const $choices = $item.find('.vote-choices').empty();
    item.choices.forEach((choice, idx) => {
      $choices.append(choiceTemplate(idx + 1));
      $choices.find('.vote-choice').last().val(choice);
    });

    $('#vote-items-container').append($item);
  });

  clearErrors();
}

//==================================
// 投票データ収集
//==================================
function collectVoteData() {
  const voteData = {
    name: $('#vote-title').val().trim(),
    explain: $('#vote-description').val().trim(),
    isActive: $('#is-open').prop('checked'),
    isAnonymous: $('#is-anonymous').prop('checked'),
    hideVotes: $('#hide-votes').prop('checked'),
    createdAt: utils.serverTimestamp(),
    items: [],
  };

  $('#vote-items-container .vote-item').each(function () {
    const itemName = $(this).find('.vote-item-title').val().trim();
    if (!itemName) return;

    const itemObj = { name: itemName, choices: [] };

    $(this)
      .find('.vote-choice')
      .each(function () {
        const choiceName = $(this).val().trim();
        if (choiceName) itemObj.choices.push({ name: choiceName });
      });

    voteData.items.push(itemObj);
  });

  return voteData;
}

//==================================
// 入力チェック
//==================================
function validateVoteData() {
  let isValid = true;
  clearErrors(); // 既存エラー解除

  // URLチェック(urlポイ値か)
}

//==================================
// エラー表示ユーティリティ
//==================================
function clearErrors() {
  $('.error-message').remove();
  $('.error-field').removeClass('error-field');
}

function markError($field, message) {
  $field
    .after(`<div class="error-message">${message}</div>`)
    .addClass('error-field');
}
