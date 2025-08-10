import * as utils from '../common/functions.js';

$(document).ready(function () {
  utils.initDisplay();
  setUpPage();
  setupEventHandlers();
});

async function setUpPage() {
  // GETパラメータからuid取得
  const uid = utils.globalGetParamUid;
  if (!uid) {
    utils.showDialog('ユーザIDが指定されていません');
    return;
  }

  // usersコレクションから対象ユーザ取得
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getDoc(userRef);
  if (!userSnap.exists()) {
    utils.showDialog('指定されたユーザが存在しません');
    return;
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

  // 管理フラグ表示
  if (userData.userAdminFlg) {
    $('#is-user-admin-label').html(
      `<label class="label-title">✅ユーザ管理者</label>
      <span class="tooltip-icon" data-tooltip="ユーザ管理者はユーザの権限編集・削除ができます。">？</span>`
    );
  }

  if (userData.voteAdminFlg) {
    $('#is-vote-admin-label').html(
      `<label class="label-title">✅投票管理者</label>
    <span class="tooltip-icon" data-tooltip="投票管理者は投票内容の作成・編集・公開ができます。">？</span>`
    );
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

  // 編集/退会/日付/uid表示条件チェック TODO そもそも他人のユーザ情報はfirestoreのルールを工夫しないとできない。DB直編集でよくね？
  const isAdmin = utils.getSession('userAdminFlg') === utils.globalStrTrue;
  const isSelf = utils.getSession('uid') === uid;
  if (isAdmin || isSelf) {
    // 日付とUID表示
    $('label:contains("アカウント作成日時")').html(
      `アカウント作成日時：${formatDateTime(userData.createdAt)}
      <span class="tooltip-icon" data-tooltip="このユーザが初めて登録された日時です。">？</span>`
    );
    $('label:contains("最終ログイン日時")').html(
      `最終ログイン日時：${formatDateTime(userData.lastLoginAt)}
      <span class="tooltip-icon" data-tooltip="最後にログインした日時です。アクティブ状況の確認に使えます。">？</span>`
    );
    $('#confirm-buttons').show();
  } else {
    // 権限なしの場合は非表示
    $('label:contains("アカウント作成日")').parent().remove();
    $('label:contains("最終ログイン日時")').parent().remove();
    $('label:contains("uid")').parent().remove();
    $('#confirm-buttons').hide();
  }
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
      alert('ユーザIDが見つかりません。');
      return;
    }

    // 遷移先URL（固定パス）にuidを付加して遷移
    const targetUrl = `../user-edit/user-edit.html?uid=${uid}`;
    window.location.href = targetUrl;
  });

  // 削除するボタン
  $('#confirm-buttons .delete-button').on('click', async () => {
    const uid = utils.globalGetParamUid;
    if (!uid) {
      alert('ユーザIDが見つかりません。');
      return;
    }

    // 確認ダイアログ
    const dialogResult = await utils.showDialog(
      'このユーザを削除してもよろしいですか？\n削除すると元に戻せません。'
    );

    if (!dialogResult) {
      // ユーザがキャンセルしたら処理中断
      return;
    }

    try {
      // Firestoreの該当ユーザを削除
      const userRef = utils.doc(utils.db, 'users', uid);
      await utils.deleteDoc(userRef);

      // 他者削除の場合ユーザ一覧、自分削除の場合ログインページへ戻る
      await utils.showDialog('ユーザを削除しました', true);
      window.location.href =
        uid === utils.getSession('uid')
          ? '../login/login.html'
          : '../user-list/user-list.html';
    } catch (error) {
      console.error('ユーザ削除エラー:', error);
      alert('削除に失敗しました。');
    }
  });
}

function formatDateTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : ts;
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}
