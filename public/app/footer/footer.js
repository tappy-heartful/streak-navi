import * as utils from '../common/functions.js';
////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  document.getElementById('share-button').addEventListener('click', () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: document.title,
          url: url,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('URLをコピーしました');
      });
    }
  });
});
