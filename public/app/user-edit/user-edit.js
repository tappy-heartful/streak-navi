import * as utils from '../common/functions.js';

$(document).ready(async function () {
  await utils.initDisplay();
  await setUpPage();
  setupEventHandlers();
  // スピナー非表示
  utils.hideSpinner();
});

async function setUpPage() {
  const uid = utils.globalGetParamUid;
  const isInit = utils.globalGetParamIsInit;
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getDoc(userRef);

  if (!userSnap.exists()) {
    alert('ユーザーが見つかりません');
    return;
  }

  const userData = userSnap.data();

  // 初回ログインの場合
  if (isInit === utils.globalStrTrue) {
    $('#title').text('ユーザ登録');
    $('#page-title').text('ユーザ登録');
    $('#save-button').text('登録する');
    $('.page-footer').addClass('hidden');
  }

  // ユーザー名
  $('#user-name').text(userData.displayName || '名無し');
  $('.user-icon').attr(
    'src',
    userData.pictureUrl || '../../images/favicon.png'
  );

  // 管理者権限はラベル表示
  if (userData.userAdminFlg) {
    $('#is-user-admin-label').html(
      `<label class="label-title">✅ユーザ管理者</label>`
    );
  }
  if (userData.voteAdminFlg) {
    $('#is-vote-admin-label').html(
      `<label class="label-title">✅投票管理者</label>`
    );
  }

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
  // 登録/更新ボタン押下
  $('#save-button').on('click', async function () {
    const uid = utils.globalGetParamUid;
    const isInit = utils.globalGetParamIsInit;
    const updatedData = {
      sectionId: $('#section-select').val(),
      roleId: $('#role-select').val(),
    };

    const userRef = utils.doc(utils.db, 'users', uid);
    try {
      // showDialogの結果をawaitで受け取る
      const dialogResult = await utils.showDialog(
        'ユーザ情報を' + (isInit ? '登録' : '更新') + 'しますか？'
      );

      if (!dialogResult) {
        // ユーザがキャンセルしたら処理中断
        return;
      }
      // 更新処理
      await utils.updateDoc(userRef, updatedData);
      await utils.showDialog((isInit ? '登録' : '更新') + 'しました', true);

      // 画面遷移 (初回ログインの場合TOP, それ以外の場合確認画面へ)
      window.location.href =
        isInit === utils.globalStrTrue
          ? '../top/top.html?firstLogin=1'
          : '../user-confirm/user-confirm.html?uid=' + utils.globalGetParamUid;
    } catch (e) {
      console.error(e);
      alert('更新に失敗しました');
    }
  });

  // 確認画面に戻る
  $(document).on('click', '.back-link', function (e) {
    window.location.href =
      '../user-confirm/user-confirm.html?uid=' + utils.globalGetParamUid;
  });
}
