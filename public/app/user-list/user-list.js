import * as utils from '../common/functions.js';
////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  initDisplay();
  const users = [
    {
      name: 'カウント 太郎',
      pictureUrl: '../../images/favicon.png',
    },
    {
      name: 'サミー 花子',
      pictureUrl: '../../images/favicon.png',
    },
    {
      name: 'マイルス 一郎',
      pictureUrl: '../../images/favicon.png',
    },
  ];

  const $list = $('#user-list');
  $list.empty();

  users.forEach((user) => {
    const li = $(`
      <li class="user-item" onclick="window.location.href = '../user-confirm/user-confirm.html'">
        <img src="${user.pictureUrl}" alt="${user.name}のアイコン">
        <span class="username">${user.name}</span>
      </li>
    `);
    $list.append(li);
  });
});
