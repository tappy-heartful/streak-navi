////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  initDisplay();
  const users = [
    {
      name: 'カウント 太郎',
      pictureUrl: 'https://profile.line-scdn.net/0h123456789abcdef',
    },
    {
      name: 'サミー 花子',
      pictureUrl: 'https://profile.line-scdn.net/0habcdef123456789',
    },
    {
      name: 'カウント 一郎',
      pictureUrl: 'https://profile.line-scdn.net/0hzyx987654321000',
    },
  ];

  const $list = $('#user-list');
  $list.empty();

  users.forEach((user) => {
    const li = $(`
      <li>
        <img src="${user.pictureUrl}" alt="${user.name}のアイコン">
        <span class="username">${user.name}</span>
      </li>
    `);
    $list.append(li);
  });
});
