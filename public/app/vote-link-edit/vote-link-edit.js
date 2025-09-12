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

    // データ取得＆画面反映
    await loadVoteData(utils.globalGetParamVoteId);

    // 初期状態を保存
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

  // 投票名表示
  $('#vote-title').text(data.name);

  // 投票説明リンク用テキストボックス
  $('#vote-description-link').val(data.descriptionLink || '');
  $('#vote-description-link').attr(
    'placeholder',
    (data.description || '投票説明') + ' のリンク'
  );

  // 投票項目表示
  const $container = $('#vote-items-container');
  $container.empty();

  data.items.forEach((item, itemIdx) => {
    const $item = $(`
      <div class="vote-item">
        <label>項目名：${item.name}</label>
        <input type="text" class="vote-item-link" placeholder="${
          item.name
        } のリンク" value="${item.link || ''}" />
        <div class="vote-choices"></div>
      </div>
    `);

    const $choicesContainer = $item.find('.vote-choices');
    item.choices.forEach((choice, choiceIdx) => {
      $choicesContainer.append(`
        <div class="choice-wrapper">
          ・${choice.name}
          <input type="text" class="vote-choice-link" placeholder="${
            choice.name
          } のリンク" value="${choice.link || ''}" />
        </div>
      `);
    });

    $container.append($item);
  });
}

//==================================
// イベントハンドラ登録
//==================================
function setupEventHandlers() {
  // クリアボタン
  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('編集前に戻しますか？')) restoreInitialState();
  });

  // 保存ボタン
  $('#save-button').on('click', async () => {
    // 入力チェック
    if (!validateVoteData()) {
      utils.showDialog('リンク形式を確認してください', true);
      return;
    }

    if (!(await utils.showDialog('保存しますか？'))) return;

    utils.showSpinner();
    try {
      const voteId = utils.globalGetParamVoteId;
      const voteRef = utils.doc(utils.db, 'votes', voteId);

      // --- 既存データ取得 ---
      const docSnap = await utils.getDoc(voteRef);
      if (!docSnap.exists()) throw new Error('投票が見つかりません：' + voteId);
      const existingData = docSnap.data();

      // --- リンクだけ更新 ---
      const updatedData = { ...existingData };

      // 投票説明リンク
      updatedData.descriptionLink = $('#vote-description-link').val().trim();

      // 項目リンク・選択肢リンク
      updatedData.items = existingData.items.map((item, i) => {
        const $itemElem = $('#vote-items-container .vote-item').eq(i);
        const itemLink = $itemElem.find('.vote-item-link').val().trim();

        const newItem = { ...item, link: itemLink };

        if (item.choices && item.choices.length) {
          newItem.choices = item.choices.map((choice, cIdx) => {
            const choiceLink = $itemElem
              .find('.vote-choice-link')
              .eq(cIdx)
              .val()
              .trim();
            return { ...choice, link: choiceLink };
          });
        }

        return newItem;
      });

      // 更新日時
      updatedData.updatedAt = utils.serverTimestamp();

      // --- Firestore 更新 ---
      await utils.updateDoc(voteRef, updatedData);

      // ログ登録
      await utils.writeLog({ dataId: voteId, action: '保存' });

      utils.hideSpinner();
      await utils.showDialog('保存しました', true);
      window.location.href = `../vote-confirm/vote-confirm.html?voteId=${voteId}`;
    } catch (e) {
      await utils.writeLog({
        dataId: utils.globalGetParamVoteId,
        action: '保存',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      utils.hideSpinner();
    }
  });

  // 戻るリンク
  $(document).on('click', '.back-link', () => {
    window.location.href = `../vote-confirm/vote-confirm.html?voteId=${utils.globalGetParamVoteId}`;
  });
}

//==================================
// 初期状態保存・復元
//==================================
function captureInitialState() {
  initialStateHtml = {
    voteDescriptionLink: $('#vote-description-link').val(),
    items: $('#vote-items-container .vote-item')
      .map(function () {
        return {
          link: $(this).find('.vote-item-link').val(),
          choices: $(this)
            .find('.vote-choice-link')
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
  $('#vote-description-link').val(initialStateHtml.voteDescriptionLink);

  $('#vote-items-container .vote-item').each(function (idx) {
    $(this).find('.vote-item-link').val(initialStateHtml.items[idx].link);
    $(this)
      .find('.vote-choice-link')
      .each(function (cIdx) {
        $(this).val(initialStateHtml.items[idx].choices[cIdx]);
      });
  });

  clearErrors();
}

//==================================
// 入力チェック（URL形式）
//==================================
function validateVoteData() {
  let isValid = true;
  clearErrors();

  const urlPattern = /^(https?:\/\/|mailto:|tel:)/i;

  // 投票説明
  const voteLink = $('#vote-description-link').val().trim();
  if (voteLink && !urlPattern.test(voteLink)) {
    markError($('#vote-description-link'), '正しいリンク形式ではありません');
    isValid = false;
  }

  // 項目リンク
  $('#vote-items-container .vote-item').each(function () {
    const $itemLink = $(this).find('.vote-item-link');
    const val = $itemLink.val().trim();
    if (val && !urlPattern.test(val)) {
      markError($itemLink, '正しいリンク形式ではありません');
      isValid = false;
    }

    $(this)
      .find('.vote-choice-link')
      .each(function () {
        const choiceVal = $(this).val().trim();
        if (choiceVal && !urlPattern.test(choiceVal)) {
          markError($(this), '正しいリンク形式ではありません');
          isValid = false;
        }
      });
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
