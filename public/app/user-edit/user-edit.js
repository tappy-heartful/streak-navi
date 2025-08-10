import * as utils from '../common/functions.js';

$(document).ready(function () {
  utils.initDisplay();
  setUpPage();
  setupEventHandlers();
});

async function setUpPage() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get('uid');
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getDoc(userRef);

  if (!userSnap.exists()) {
    alert('ユーザーが見つかりません');
    return;
  }

  const userData = userSnap.data();

  // ユーザー名
  $('#user-name').text(userData.displayName || '名無し');
  $('.user-icon').attr(
    'src',
    userData.pictureUrl || '../../images/favicon.png'
  );

  // 管理者権限はラベル表示
  $('#is-user-admin-label').text(
    'ユーザ管理者：' + (userData.userAdminFlg ? 'はい' : 'いいえ')
  );
  $('#is-vote-admin-label').text(
    '投票管理者：' + (userData.voteAdminFlg ? 'はい' : 'いいえ')
  );

  // パートと役職をプルダウンに反映
  await populateSections(userData.sectionId);
  await populateRoles(userData.roleId);
}

async function populateSections(selectedId) {
  const sectionSnapshot = await utils.getDocs(
    utils.collection(utils.db, 'sections')
  );
  const $select = $('#section-select');
  $select.empty();

  sectionSnapshot.forEach((doc) => {
    const data = doc.data();
    const option = $('<option>')
      .val(doc.id)
      .text(data.name || '(名称なし)');
    if (doc.id === selectedId) {
      option.prop('selected', true);
    }
    $select.append(option);
  });
}

async function populateRoles(selectedId) {
  const roleSnapshot = await utils.getDocs(utils.collection(utils.db, 'roles'));
  const $select = $('#role-select');
  $select.empty();

  roleSnapshot.forEach((doc) => {
    const data = doc.data();
    const option = $('<option>')
      .val(doc.id)
      .text(data.name || '(名称なし)');
    if (doc.id === selectedId) {
      option.prop('selected', true);
    }
    $select.append(option);
  });
}

function setupEventHandlers() {
  $('#save-button').on('click', async function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const updatedData = {
      sectionId: $('#section-select').val(),
      roleId: $('#role-select').val(),
    };

    const userRef = utils.doc(utils.db, 'users', uid);
    try {
      // showDialogの結果をawaitで受け取る
      const dialogResult = await utils.showDialog('ユーザ情報を更新しますか？');

      if (!dialogResult) {
        // ユーザがキャンセルしたら処理中断
        return;
      }
      // 更新処理
      await utils.updateDoc(userRef, updatedData);
      await utils.showDialog('更新しました', true);
      window.location.href = '../user-list/user-list.html';
    } catch (e) {
      console.error(e);
      alert('更新に失敗しました');
    }
  });
}
