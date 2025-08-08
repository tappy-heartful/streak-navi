import * as utils from '../common/functions.js';
////////////////////////////
// 初期表示
////////////////////////////
$(document).ready(async function () {
  // 初期処理
  utils.initDisplay();

  const $list = $('#user-list');
  $list.empty();

  try {
    // Firestore から users コレクションを取得
    const querySnapshot = await utils.getDocs(
      utils.collection(utils.db, 'users')
    );

    querySnapshot.forEach((doc) => {
      const user = doc.data(); // 1人のユーザーデータ
      const li = $(`
        <li class="user-item" onclick="window.location.href = '../user-confirm/user-confirm.html'">
          <img src="${user.pictureUrl || '../../images/favicon.png'}" alt="${
        user.displayName || '名無し'
      }のアイコン">
          <span class="username">${user.displayName || '名無し'}</span>
        </li>
      `);
      $list.append(li);
    });
  } catch (error) {
    console.error('ユーザーの取得に失敗しました:', error);
    $list.append('<li>ユーザーの取得に失敗しました</li>');
  }
});
