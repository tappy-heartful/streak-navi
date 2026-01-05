import * as utils from '../common/functions.js';

// 💡 変更点1: Instrumentsの全データを保持するグローバル変数
let allInstruments = [];

$(document).ready(async function () {
  let uid = '';
  try {
    await utils.initDisplay();
    uid = utils.globalGetParamUid ?? utils.getSession('uid') ?? '';
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: 'ユーザ一覧', url: '../user-list/user-list.html' },
      { title: 'ユーザ確認' },
    ]);

    // 💡 変更点2: Instrumentsデータを事前に取得
    await loadAllInstruments();
    await setUpPage(uid);
    setupEventHandlers(uid);
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: uid,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

// 💡 新規関数: Instrumentsの全データを取得しグローバル変数に保持
async function loadAllInstruments() {
  const instrumentSnapshot = await utils.getWrapDocs(
    utils.collection(utils.db, 'instruments')
  );
  allInstruments = instrumentSnapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name_decoded || '(名称なし)',
    sectionId: doc.data().sectionId, // sectionIdも取得しておくと便利
  }));
}

async function setUpPage(uid) {
  if (!uid) {
    throw new Error('ユーザが見つかりません：' + uid);
  }

  // usersコレクションから対象ユーザ取得
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getWrapDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error('ユーザが見つかりません：' + uid);
  }
  const userData = userSnap.data();

  // role名取得
  let roleName = '';
  if (userData.roleId != null) {
    const roleRef = utils.doc(utils.db, 'roles', String(userData.roleId));
    const roleSnap = await utils.getWrapDoc(roleRef);
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
    const sectionSnap = await utils.getWrapDoc(sectionRef);
    if (sectionSnap.exists()) {
      sectionName = sectionSnap.data().name || '';
    }
  }

  // 💡 変更点3: 楽器名の取得と整形
  let instrumentNames = '';
  const instrumentIds = userData.instrumentIds || []; // instrumentIdsは配列

  if (instrumentIds.length > 0) {
    // ユーザーの楽器ID配列を、instrumentsコレクションのデータと照合
    const selectedInstruments = allInstruments
      .filter((inst) => instrumentIds.includes(inst.id))
      .map((inst) => inst.name);

    if (selectedInstruments.length > 0) {
      instrumentNames = selectedInstruments.join('、');
    }
  }

  // 表示設定
  $('#user-name').text(userData.displayName_decoded || '');
  $('.user-icon').attr(
    'src',
    userData.pictureUrl_decoded || utils.globalLineDefaultImage
  );
  $('.user-icon').attr(
    'onerror',
    "this.onerror=null; this.src='" + utils.globalLineDefaultImage + "';"
  );

  // 管理者権限表示
  const secretWordsSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'secretWords')
  );
  let adminList = [];
  secretWordsSnap.forEach((doc) => {
    const role = doc.data(); // { label, roleField, word }
    if (userData[role.roleField]) {
      adminList.push(role.label);
    }
  });
  $('#admin').text(adminList.length > 0 ? adminList.join('、') : 'なし');

  // パート・役職
  $('#section').text(sectionName);
  $('#role').text(roleName);

  // 💡 変更点4: 楽器の表示
  $('#instruments').text(instrumentNames);

  // 略称
  $('#abbreviation').text(userData.abbreviation);

  // 🔽 追加：PayPay IDの表示制御
  if (userData.sectionId === '1') {
    $('#paypay-id').text(userData.paypayId || '未設定');
    $('#paypay-group').show();
  } else {
    $('#paypay-group').hide();
  }

  // 編集/退会ボタン表示
  utils.getSession('uid') === uid
    ? $('#confirm-buttons').show()
    : $('#confirm-buttons').hide();
}

function setupEventHandlers(uid) {
  // 編集するボタン
  $('#confirm-buttons .edit-button').on('click', () => {
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
      await utils.archiveAndDeleteDoc('users', uid);

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
        dataId: uid,
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
