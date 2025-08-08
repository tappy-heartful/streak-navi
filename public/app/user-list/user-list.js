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
    // sections コレクションを取得
    const sectionSnapshot = await utils.getDocs(
      utils.collection(utils.db, 'section')
    );

    // sections をオブジェクトにマッピング（id => name など）
    const sectionMap = {};
    sectionSnapshot.forEach((doc) => {
      sectionMap[doc.id] = doc.data(); // id: { name: "〇〇部門" }
    });

    // users コレクションを取得
    const userSnapshot = await utils.getDocs(
      utils.collection(utils.db, 'users')
    );

    // sectionId ごとにユーザーを分類
    const usersBySection = {};

    userSnapshot.forEach((doc) => {
      const user = doc.data();
      const sectionId = user.sectionId || 'unknown';
      if (!usersBySection[sectionId]) {
        usersBySection[sectionId] = [];
      }
      usersBySection[sectionId].push(user);
    });

    // セクションごとに表示
    for (const [sectionId, users] of Object.entries(usersBySection)) {
      const sectionName = sectionMap[sectionId]?.name || '未分類';
      const $sectionContainer = $('<div class="section-group"></div>');
      const $sectionTitle = $(`<h2 class="section-title">${sectionName}</h2>`);
      const $sectionList = $('<ul class="section-user-list"></ul>');

      users.forEach((user) => {
        const li = $(`
          <li class="user-item" onclick="window.location.href = '../user-confirm/user-confirm.html'">
            <img src="${user.pictureUrl || '../../images/favicon.png'}" alt="${
          user.displayName || '名無し'
        }のアイコン">
            <span class="username">${user.displayName || '名無し'}</span>
          </li>
        `);
        $sectionList.append(li);
      });

      $sectionContainer.append($sectionTitle).append($sectionList);
      $list.append($sectionContainer);
    }
  } catch (error) {
    console.error('ユーザーの取得に失敗しました:', error);
    $list.append('<li>ユーザーの取得に失敗しました</li>');
  }
});
