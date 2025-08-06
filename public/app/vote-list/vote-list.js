import * as utils from '../common/functions.js';

////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  utils.initDisplay();
});

////////////////////////////
// タブ切り替え処理
////////////////////////////
document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document
      .querySelectorAll('.tab')
      .forEach((b) => b.classList.remove('active'));
    document
      .querySelectorAll('[data-tab-content]')
      .forEach((c) => c.classList.add('hidden'));

    button.classList.add('active');
    const target = button.dataset.tab;
    document
      .querySelector(`[data-tab-content="${target}"]`)
      .classList.remove('hidden');
  });
});
