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
      pageTitle.textContent = '投票作成';
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

  // 確認モード制御
  if (mode === 'confirm') {
    actionButtons.classList.add('hidden');
    confirmButtons.classList.remove('hidden');
    inputs.forEach((el) => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.setAttribute('readonly', true);
        el.setAttribute('disabled', true);
      }
    });
  }
});
