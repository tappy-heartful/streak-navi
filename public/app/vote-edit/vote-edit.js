import * as utils from '../common/functions.js';
////////////////////////////
// グローバル変数
////////////////////////////
let initialStateHtml;

////////////////////////////
// 初期処理（画面読み込み時）
////////////////////////////
$(document).ready(async function () {
  await utils.initDisplay();
  const mode = utils.globalGetParamMode;
  setupPageMode(mode);
  setupEventHandlers(mode);
  // スピナー非表示
  utils.hideSpinner();
});

////////////////////////////
// 画面モードに応じた表示切替
////////////////////////////
function setupPageMode(mode) {
  const title = document.getElementById('title');
  const pageTitle = document.getElementById('page-title');
  const submitButton = document.getElementById('answer-button');

  switch (mode) {
    case 'new':
      pageTitle.textContent = '投票新規作成';
      title.textContent = '投票新規作成';
      submitButton.textContent = '登録';
      break;
    case 'edit':
      pageTitle.textContent = '投票編集';
      title.textContent = '投票編集';
      submitButton.textContent = '更新';
      break;
    default:
      pageTitle.textContent = '投票管理';
      throw new Error('モード不正です');
  }
  // 初期項目と状態保持
  const newItem = createVoteItemTemplate();
  $('#vote-items-container').append(newItem);
  captureInitialState();
}

////////////////////////////
// イベントハンドラー設定
////////////////////////////
function setupEventHandlers(mode) {
  // 投票項目を追加
  $('#add-item').on('click', function () {
    const newItem = createVoteItemTemplate();
    $('#vote-items-container').append(newItem);
  });

  // 動的追加要素へのイベント委任
  $('#vote-items-container')
    .on('click', '.add-choice', function () {
      const $choices = $(this).siblings('.vote-choices');
      const index = $choices.find('.choice-wrapper').length + 1;
      const choice = $(`
        <div class="choice-wrapper">
          <input type="text" class="vote-choice" placeholder="選択肢${index}" />
          <button class="remove-choice">×</button>
        </div>
      `);
      $choices.append(choice);
    })
    .on('click', '.remove-choice', function () {
      $(this).parent('.choice-wrapper').remove();
    })
    .on('click', '.remove-item', function () {
      $(this).closest('.vote-item').remove();
    });

  // クリアボタン：初期状態に戻す
  $('.clear-button').on('click', function () {
    utils.showDialog('クリアしますか？').then((result) => {
      if (result) {
        restoreInitialState();
      }
    });
  });

  // 登録/更新ボタン
  $('.answer-button').on('click', function () {
    utils
      .showDialog((mode === 'new' ? '登録' : '更新') + 'しますか？')
      .then((result) => {});
  });
}

////////////////////////////
// 投票項目テンプレート生成
////////////////////////////
function createVoteItemTemplate() {
  return $(`
    <div class="vote-item">
      <input type="text" class="vote-item-title" placeholder="項目名（例：演目候補）" />
      <div class="vote-choices">
        <div class="choice-wrapper">
          <input type="text" class="vote-choice" placeholder="選択肢1" />
          <button class="remove-choice">×</button>
        </div>
        <div class="choice-wrapper">
          <input type="text" class="vote-choice" placeholder="選択肢2" />
          <button class="remove-choice">×</button>
        </div>
      </div>
      <button class="add-choice">＋ 選択肢を追加</button>
      <button class="remove-item">× 項目を削除</button>
    </div>
  `);
}

////////////////////////////
// 初期状態の保存・復元（クリアボタン用）
////////////////////////////
function captureInitialState() {
  initialStateHtml = {
    title: $('#vote-title').val(),
    description: $('#vote-description').val(),
    isOpen: $('#is-open').prop('checked'),
    voteItemsHtml: $('#vote-items-container').html(),
  };
}

function restoreInitialState() {
  $('#vote-title').val(initialStateHtml.title);
  $('#vote-description').val(initialStateHtml.description);
  $('#is-open').prop('checked', initialStateHtml.isOpen);
  $('#vote-items-container').html(initialStateHtml.voteItemsHtml);
}
