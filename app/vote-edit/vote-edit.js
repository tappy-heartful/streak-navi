////////////////////////////
//グローバル変数
////////////////////////////
let initialStateHtml;

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(function () {
  // 初期処理
  initDisplay();
  // モード取得
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'new';

  const actionButtons = document.getElementById('action-buttons');
  const confirmButtons = document.getElementById('confirm-buttons');
  const inputs = document.querySelectorAll('input, textarea, button');
  const pageTitle = document.getElementById('page-title');

  // タイトル切り替え
  switch (mode) {
    case 'new':
      pageTitle.textContent = '投票新規作成';
      break;
    case 'edit':
      pageTitle.textContent = '投票編集';
      break;
    case 'confirm':
      pageTitle.textContent = '投票確認';
      break;
    default:
      pageTitle.textContent = '投票管理';
  }

  // モード制御
  if (mode === 'confirm') {
    // 確認モードの場合
    actionButtons.classList.add('hidden');
    confirmButtons.classList.add('confirm-buttons');
    inputs.forEach((el) => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.setAttribute('readonly', true);
        el.setAttribute('disabled', true);
      }
    });
  } else {
    // 編集・新規モードの場合
    actionButtons.classList.add('action-buttons');
    confirmButtons.classList.add('hidden');

    // 項目追加
    const newItem = createVoteItemTemplate();
    $('#vote-items-container').append(newItem);

    //クリア処理用
    captureInitialState();
  }

  // 追加：投票項目追加ボタン処理
  $('#add-item').on('click', function () {
    const newItem = createVoteItemTemplate();
    $('#vote-items-container').append(newItem);
  });

  // 追加：動的追加要素へのイベント委任
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

  // クリアボタン処理
  $('.clear-button').on('click', function () {
    restoreInitialState();
  });

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
});
// 項目のHTMLテンプレート
function createVoteItemTemplate() {
  const voteItem = $(`
    <div class="vote-item">
      <input
        type="text"
        class="vote-item-title"
        placeholder="項目名（例：演目候補）"
      />
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

  return voteItem;
}
