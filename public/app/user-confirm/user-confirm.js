import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    await setUpPage();
    setupEventHandlers();
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamUid,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

async function setUpPage() {
  // GETパラメータからuid取得
  const uid = utils.globalGetParamUid;
  if (!uid) {
    throw new Error('ユーザが見つかりません：' + uid);
  }

  // usersコレクションから対象ユーザ取得
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error('ユーザが見つかりません：' + uid);
  }
  const userData = userSnap.data();

  // role名取得
  let roleName = '';
  if (userData.roleId != null) {
    const roleRef = utils.doc(utils.db, 'roles', String(userData.roleId));
    const roleSnap = await utils.getDoc(roleRef);
    if (roleSnap.exists()) {
      roleName = roleSnap.data().name || '';
    }
  }

  // section名取得
  let sectionName = '';
  if (userData.sectionId != null) {
    const sectionRef = utils.doc(
      utils.db,
      'sections',
      String(userData.sectionId)
    );
    const sectionSnap = await utils.getDoc(sectionRef);
    if (sectionSnap.exists()) {
      sectionName = sectionSnap.data().name || '';
    }
  }

  // 表示設定
  $('#user-name').text(userData.displayName || '');
  $('.user-icon').attr(
    'src',
    userData.pictureUrl || '../../images/favicon.png'
  );

  // 管理者権限(管理者権限がある場合のみ表示)
  let adminList = [];
  if (userData.userAdminFlg) adminList.push('ユーザ管理者');
  if (userData.voteAdminFlg) adminList.push('投票管理者');
  if (adminList.length > 0) {
    $('label:contains("管理者権限")').html(
      `管理者権限：${adminList.join('、')}
       <span class="tooltip-icon" data-tooltip="管理者はデータ操作ができます。" >？</span>`
    );
  } else {
    $('label:contains("管理者権限")').remove();
  }

  // パート・役職
  $('label:contains("パート")').html(
    `パート：${sectionName || '未設定'}
    <span class="tooltip-icon" data-tooltip="所属しているパート">？</span>`
  );
  $('label:contains("役職")').html(
    `役職：${roleName || '未設定'}
    <span class="tooltip-icon" data-tooltip="このユーザの役職">？</span>`
  );

  // 編集/退会/日付/uid表示条件チェック
  utils.getSession('uid') === uid
    ? $('#confirm-buttons').show()
    : $('#confirm-buttons').hide();
}

function setupEventHandlers() {
  // ツールチップ
  $('.tooltip-icon').on('click touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    $('.tooltip-icon').not(this).removeClass('show');
    $(this).toggleClass('show');
  });

  $(document).on('click touchstart', function () {
    $('.tooltip-icon').removeClass('show');
  });

  // 編集するボタン
  $('#confirm-buttons .edit-button').on('click', () => {
    // 現在のURLのクエリパラメータからuidを取得
    const uid = utils.globalGetParamUid;
    if (!uid) {
      throw new Error('ユーザが見つかりません：' + uid);
    }

    // 遷移先URL（固定パス）にuidを付加して遷移
    const targetUrl = `../user-edit/user-edit.html?uid=${uid}`;
    window.location.href = targetUrl;
  });

  // 削除するボタン
  $('#confirm-buttons .delete-button').on('click', async () => {
    try {
      const uid = utils.globalGetParamUid;
      if (!uid) {
        throw new Error('ユーザが見つかりません：' + uid);
      }

      // 確認ダイアログ
      const dialogResult = await utils.showDialog(
        'このユーザを退会してもよろしいですか？\nこの操作は元に戻せません'
      );

      if (!dialogResult) {
        // ユーザがキャンセルしたら処理中断
        return;
      }

      // 削除のためもう一度確認
      const dialogResultAgain = await utils.showDialog('本当に退会しますか？');

      if (!dialogResultAgain) {
        // ユーザがキャンセルしたら処理中断
        return;
      }

      // スピナー表示
      utils.showSpinner();

      // Firestoreの該当ユーザを削除
      const userRef = utils.doc(utils.db, 'users', uid);
      await utils.deleteDoc(userRef);

      // ログ登録
      await utils.writeLog({
        dataId: uid,
        action: '退会',
      });

      // スピナー非表示
      utils.hideSpinner();

      // 他者削除の場合ユーザ一覧、自分削除の場合ログインページへ戻る
      await utils.showDialog('退会しました', true);
      window.location.href =
        uid === utils.getSession('uid')
          ? '../login/login.html'
          : '../user-list/user-list.html';
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamUid,
        action: '退会',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });
}
