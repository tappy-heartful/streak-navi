////////////////////////////
// グローバル変数
////////////////////////////
let initialStateHtml;

////////////////////////////
// 初期処理（画面読み込み時）
////////////////////////////
$(document).ready(function () {
  initDisplay();
  const mode = getModeFromURL();
  setupPageMode(mode);
  setupEventHandlers(mode);
});

////////////////////////////
// モード取得
////////////////////////////
function getModeFromURL() {
  const params = new URLSearchParams(location.search);
  return params.get('mode') || 'new';
}

////////////////////////////
// 画面モードに応じた表示切替
////////////////////////////
function setupPageMode(mode) {
  const actionButtons = document.getElementById('action-buttons');
  const confirmButtons = document.getElementById('confirm-buttons');
  const inputs = document.querySelectorAll('input, textarea, button');
  const pageTitle = document.getElementById('page-title');
  const submitButton = document.getElementById('submit-button');

  // タイトル切り替え
  switch (mode) {
    case 'new':
      pageTitle.textContent = '投票新規作成';
      submitButton.textContent = '登録';
      break;
    case 'edit':
      pageTitle.textContent = '投票編集';
      submitButton.textContent = '更新';
      break;
    case 'confirm':
      pageTitle.textContent = '投票確認';
      break;
    default:
      pageTitle.textContent = '投票管理';
  }

  // モードごとの表示制御
  if (mode === 'confirm') {
    actionButtons.classList.add('hidden');
    confirmButtons.classList.add('confirm-buttons');

    // 入力を無効化
    inputs.forEach((el) => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.setAttribute('readonly', true);
        el.setAttribute('disabled', true);
      }
    });
  } else {
    actionButtons.classList.add('action-buttons');
    confirmButtons.classList.add('hidden');

    // 投票項目を初期表示 & 状態を保存
    const newItem = createVoteItemTemplate();
    $('#vote-items-container').append(newItem);
    captureInitialState();
  }
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
    showDialog('クリアしますか？').then((result) => {
      if (result) {
        restoreInitialState();
      }
    });
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
