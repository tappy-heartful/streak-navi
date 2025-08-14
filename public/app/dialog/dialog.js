export function showDialog(message, isConfirm = false) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('custom-dialog');
    const msg = document.getElementById('dialog-message');
    const okBtn = document.getElementById('dialog-ok');
    const cancelBtn = document.getElementById('dialog-cancel');

    // メッセージ更新
    msg.textContent = message;

    // ボタン表示を毎回リセット
    if (isConfirm) {
      okBtn.textContent = 'OK';
      cancelBtn.classList.add('hidden');
    } else {
      okBtn.textContent = 'はい';
      cancelBtn.textContent = 'いいえ';
      cancelBtn.classList.remove('hidden');
    }

    // オーバーレイ表示
    overlay.classList.remove('hidden');

    const cleanup = () => {
      overlay.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    okBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
  });
}
