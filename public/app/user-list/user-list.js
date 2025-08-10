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
    // 1. sections コレクションを取得
    const sectionSnapshot = await utils.getDocs(
      utils.collection(utils.db, 'section')
    );

    // sections をオブジェクトにマッピング（id => { name: "〇〇部門" }）
    const sectionMap = {};
    sectionSnapshot.forEach((doc) => {
      sectionMap[doc.id] = doc.data();
    });

    // 2. roles コレクションを取得
    const rolesSnapshot = await utils.getDocs(
      utils.collection(utils.db, 'roles')
    );

    // roles をオブジェクトにマッピング（roleId => roleName）
    const roleMap = {};
    rolesSnapshot.forEach((doc) => {
      const roleData = doc.data();
      roleMap[doc.id] = roleData.name || '';
    });

    // 3. users コレクションを取得
    const userSnapshot = await utils.getDocs(
      utils.collection(utils.db, 'users')
    );

    // sectionId ごとにユーザーを分類
    const usersBySection = {};

    userSnapshot.forEach((doc) => {
      const user = doc.data();
      user.uid = doc.id;
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
        // roleIdに対応する役職名を取得（メンバーはなし、なければ空文字）
        const roleName = [1, 2].includes(user.roleId)
          ? roleMap[user.roleId]
          : '';

        // 役職バッジ表示部分（役職名があれば表示）
        const roleBadgeHtml = roleName
          ? `<span class="leader-badge">${roleName}</span>`
          : '';

        const li = $(`
          <li class="user-item" onclick="window.location.href = '../user-confirm/user-confirm.html?uid=${
            user.uid || ''
          }'">
            <img src="${user.pictureUrl || '../../images/favicon.png'}" alt="${
          user.displayName || '名無し'
        }のアイコン">
            <span class="username">${user.displayName || '名無し'}</span>
            ${roleBadgeHtml}
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
