import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    // 画面ごとのパンくずをセット
    utils.renderBreadcrumb([
      { title: 'ユーザ一覧', url: '../user-list/user-list.html' },
      {
        title: 'ユーザ確認',
        url: '../user-confirm/user-confirm.html?uid=' + utils.globalGetParamUid,
      },
      { title: 'ユーザ編集' },
    ]);
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
  const uid = utils.globalGetParamUid;
  const isInit = utils.globalGetParamIsInit;
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('ユーザが見つかりません：' + uid);
  }

  const userData = userSnap.data();

  // 初回ログインの場合
  if (isInit === utils.globalStrTrue) {
    $('#title').text('ユーザ登録');
    $('#page-title').text('ユーザ登録');
    $('#save-button').text('登録する');
    $('.page-footer').addClass('hidden');
    $('#init-message').text('以下を設定してください');
  }

  // ユーザー名
  $('#user-name').text(userData.displayName || '名無し');
  $('.user-icon').attr('src', userData.pictureUrl || utils.globalBandLogoImage);

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
    $select.safeAppend(option);
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
    $select.safeAppend(option);
  });
}

function setupEventHandlers() {
  // 合言葉追加/削除
  const $list = $('#secret-word-list');

  // 合言葉追加
  $('#add-secret-word').on('click', function () {
    const $item = $(`
      <div class="secret-word-item">
        <input type="text" class="secret-word-input" placeholder="合言葉を入力..." />
        <button type="button" class="remove-secret-word">×</button>
      </div>
    `);
    $list.safeAppend($item);
  });

  // 合言葉削除ボタン
  $list.on('click', '.remove-secret-word', function () {
    const $item = $(this).closest('.secret-word-item');
    $item.next('.error-message').remove(); // 直後のエラーメッセージを削除
    $item.remove(); // テキストボックス＋ボタン本体を削除
  });

  $('#save-button').on('click', async function () {
    // スピナー表示
    utils.showSpinner();

    const uid = utils.globalGetParamUid;
    const isInit = utils.globalGetParamIsInit === 'true';

    utils.clearErrors(); // エラークリア

    // 入力チェック
    if (!validateUserData()) {
      await utils.showDialog('入力内容を確認してください', true);
      return;
    }

    // Firestoreから最新の合言葉マップを取得
    const secretWordMap = await getSecretWordMap();

    // 基本更新データ
    const updatedData = {
      sectionId: $('#section-select').val(),
      roleId: $('#role-select').val(),
    };

    // --- 合言葉チェック ---
    let hasError = false;

    $('.secret-word-input').each(function () {
      const $input = $(this);
      const word = $input.val().trim();

      if (!word) return; // 空欄は無視

      if (secretWordMap[word]) {
        // 正しい → 何もしない（更新データに反映）
        updatedData[secretWordMap[word]] = true;
      } else {
        // 間違い → エラー表示
        utils.markError($input, '正しい合言葉を入力してください');
        hasError = true;
      }
    });

    // スピナー非表示
    utils.hideSpinner();

    if (hasError) {
      // ひとつでもエラーがあれば処理中止
      await utils.showDialog('入力内容を確認してください', true);
      return;
    }

    const dialogResult = await utils.showDialog(
      'この内容で' + (isInit ? '登録' : '更新') + 'しますか？'
    );
    if (!dialogResult) return;

    // スピナー表示
    utils.showSpinner();

    try {
      const userRef = utils.doc(utils.db, 'users', uid);

      // 更新処理
      await utils.updateDoc(userRef, updatedData);

      // ログ登録
      await utils.writeLog({
        dataId: uid,
        action: isInit ? '登録' : '更新',
      });

      // スピナー非表示
      utils.hideSpinner();

      await utils.showDialog((isInit ? '登録' : '更新') + 'しました', true);

      // 初回ログインの場合、リダイレクト先が指定されていればそこに遷移
      const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');
      localStorage.removeItem('redirectAfterLogin');

      // 初回ログインウェルカム演出用にフラグ保持
      if (isInit) utils.setSession('isInit', true);

      // 画面遷移
      window.location.href = isInit
        ? redirectAfterLogin ?? '../home/home.html?'
        : '../user-confirm/user-confirm.html?uid=' + uid;
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamUid,
        action: isInit ? '登録' : '更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  // 確認画面に戻る
  $(document).on('click', '.back-link', function (e) {
    window.location.href =
      '../user-confirm/user-confirm.html?uid=' + utils.globalGetParamUid;
  });
}

async function getSecretWordMap() {
  const snapshot = await utils.getDocs(
    utils.collection(utils.db, 'secretWords')
  );
  const map = {};
  snapshot.forEach((doc) => {
    const data = doc.data();
    map[data.word] = data.roleField; // ここだけあればOK
  });
  return map;
}

function validateUserData() {
  let isValid = true;
  utils.clearErrors();

  const sectionId = $('#section-select').val();
  const roleId = $('#role-select').val();
  const secretWord = $('#secret-word').val()?.trim();

  if (!sectionId) {
    utils.markError($('#section-select'), 'パートを選択してください');
    isValid = false;
  }
  if (!roleId) {
    utils.markError($('#role-select'), '役職を選択してください');
    isValid = false;
  }

  return isValid;
}
