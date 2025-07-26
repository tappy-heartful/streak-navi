function showDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('custom-dialog');
    const msg = document.getElementById('dialog-message');
    const okBtn = document.getElementById('dialog-ok');
    const cancelBtn = document.getElementById('dialog-cancel');

    msg.textContent = message;
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
