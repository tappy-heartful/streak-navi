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
    const mode = utils.globalGetParamMode; // URLパラメータからモード取得

    // データ取得や初期表示の完了を待つ
    await setupPage(mode);

    // データ反映後に初期状態を保存
    captureInitialState();

    setupEventHandlers(mode);
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
// ページの設定
//==================================
async function setupPage(mode) {
  const pageTitle = $('#page-title');
  const title = $('#title');
  const submitButton = $('#save-button');
  const backLink = $('.back-link');

  if (mode === 'new') {
    pageTitle.text('投票新規作成');
    title.text('投票新規作成');
    submitButton.text('登録');
    backLink.text('← 投票一覧に戻る');
  } else if (mode === 'copy') {
    pageTitle.text('投票新規作成');
    title.text('投票新規作成');
    submitButton.text('登録');
    backLink.text('← 投票確認に戻る');
  } else if (mode === 'edit') {
    pageTitle.text('投票編集');
    title.text('投票編集');
    submitButton.text('更新');
    backLink.text('← 投票確認に戻る');
  } else {
    pageTitle.text('投票管理');
    throw new Error('モード不正です');
  }

  if (mode === 'copy' || mode === 'edit') {
    // 既存データ取得
    await loadVoteData(utils.globalGetParamVoteId, mode);
  } else if (mode === 'new') {
    // 初期表示で投票項目一つ表示
    $('#vote-items-container').append(createVoteItemTemplate());
  }
}

//==================================
// 投票データ取得＆画面反映
//==================================
async function loadVoteData(voteId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'votes', voteId));
  if (!docSnap.exists()) {
    await utils.showDialog('該当の投票データが見つかりません', true);
    window.location.href = '../vote-list/vote-list.html';
    return;
  }
  const data = docSnap.data();

  // 投票名・説明・公開状態
  $('#vote-title').val(data.name + (mode === 'copy' ? '（コピー）' : ''));
  $('#vote-description').val(data.explain);
  $('#is-open').prop('checked', !!data.isActive);

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
function setupEventHandlers(mode) {
  // 【項目追加ボタン】
  $('#add-item').on('click', () => {
    $('#vote-items-container').append(createVoteItemTemplate());
  });

  // 【項目内ボタン（動的要素用イベント委任）】
  $('#vote-items-container')
    // 選択肢追加
    .on('click', '.add-choice', function () {
      const $choices = $(this).siblings('.vote-choices');
      const index = $choices.find('.choice-wrapper').length + 1;
      $choices.append(choiceTemplate(index));
    })
    // 選択肢削除
    .on('click', '.remove-choice', function () {
      $(this).parent('.choice-wrapper').remove();
    })
    // 項目削除
    .on('click', '.remove-item', function () {
      $(this).closest('.vote-item').remove();
    });

  // 【クリアボタン】初期状態に戻す
  $('.clear-button').on('click', async () => {
    if (await utils.showDialog('クリアしますか？')) restoreInitialState();
  });

  // 【登録/更新ボタン】
  $('.save-button').on('click', async () => {
    // 入力チェック
    if (!validateVoteData()) {
      utils.showDialog('入力内容を確認してください', true);
      return;
    }

    // 確認ダイアログ
    if (
      !(await utils.showDialog(
        (['new', 'copy'].includes(mode) ? '登録' : '更新') + 'しますか？'
      ))
    )
      return;

    utils.showSpinner(); // スピナー表示

    try {
      // 入力データ取得
      const voteData = collectVoteData();

      if (['new', 'copy'].includes(mode)) {
        // 新規登録
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'votes'),
          voteData
        );

        // ログ登録
        await utils.writeLog({
          dataId: voteId,
          action: '登録',
        });
        utils.hideSpinner();
        await utils.showDialog('登録しました', true);

        window.location.href = `../vote-confirm/vote-confirm.html?voteId=${docRef.id}`;
      } else {
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
      }
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamVoteId,
        action: ['new', 'copy'].includes(mode) ? '登録' : '更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  // 確認/一覧画面に戻る
  $(document).on('click', '.back-link', function (e) {
    window.location.href = ['edit', 'copy'].includes(mode)
      ? `../vote-confirm/vote-confirm.html?voteId=${utils.globalGetParamVoteId}`
      : '../vote-list/vote-list.html';
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

  const title = $('#vote-title').val().trim();
  const description = $('#vote-description').val().trim();

  // 投票名必須
  if (!title) markError($('#vote-title'), '必須項目です'), (isValid = false);
  // 説明必須
  if (!description)
    markError($('#vote-description'), '必須項目です'), (isValid = false);

  // 項目名チェック
  const itemNames = [];
  $('#vote-items-container .vote-item').each(function () {
    const $item = $(this).find('.vote-item-title');
    const name = $item.val().trim();

    if (!name) return markError($item, '必須項目です'), (isValid = false);
    if (itemNames.includes(name))
      return markError($item, '項目名が重複しています'), (isValid = false);

    itemNames.push(name);
  });
  if (!itemNames.length) {
    $('#vote-items-container').before(
      '<div class="error-message">項目を1つ以上追加してください</div>'
    );
    isValid = false;
  }

  // 選択肢チェック
  $('#vote-items-container .vote-item').each(function () {
    const choiceNames = [];
    const $choices = $(this).find('.vote-choice');
    let hasChoice = false;

    $choices.each(function () {
      const val = $(this).val().trim();
      if (val) {
        hasChoice = true;
        if (choiceNames.includes(val)) isValid = false;
        choiceNames.push(val);
      }
    });

    if (!hasChoice) {
      $(this)
        .find('.vote-choices')
        .after(
          '<div class="error-message">選択肢を1つ以上入力してください</div>'
        );
      $choices.addClass('error-field');
      isValid = false;
    }
    if (new Set(choiceNames).size !== choiceNames.length) {
      $(this)
        .find('.vote-choices')
        .after('<div class="error-message">選択肢が重複しています</div>');
      $choices.addClass('error-field');
      isValid = false;
    }
  });

  return isValid;
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
