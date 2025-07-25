////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  initDisplay();

  // 仮のモード判定（URLのmodeパラメータを取得）
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'new';

  const actionButtons = document.getElementById('action-buttons');
  const confirmButtons = document.getElementById('confirm-buttons');
  const inputs = document.querySelectorAll('input, textarea, button');

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
