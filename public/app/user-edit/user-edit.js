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
  // 合言葉追加/削除
  const $list = $('#secret-word-list');

  // 合言葉追加
  $('#add-secret-word').on('click', function () {
    const $item = $(`
      <div class="secret-word-item">
        <input type="text" class="secret-word-input" placeholder="LINEで告知された合言葉を入力..." />
        <button type="button" class="remove-secret-word">×</button>
      </div>
    `);
    $list.append($item);
  });

  // 合言葉削除ボタン
  $list.on('click', '.remove-secret-word', function () {
    $(this).closest('.secret-word-item').remove();
  });

  // 登録/更新ボタン押下
  // 合言葉と権限の対応マップ
  const secretWordMap = {
    'One by One': 'isVoteAdmin',
    'Soul Station': 'isUserAdmin',
    'Fun Time': 'isEventAdmin',
    'Portrait in Jazz': 'isScoreAdmin',
    Milestones: 'isMoneyAdmin',
    'Time Stream': 'isMediaAdmin',
    'Life is Swing': 'isSystemAdmin',
  };

  $('#save-button').on('click', async function () {
    const uid = utils.globalGetParamUid;
    const isInit = utils.globalGetParamIsInit;

    clearErrors(); // エラークリア

    // 入力チェック
    if (!validateUserData()) {
      await utils.showDialog('入力内容を確認してください', true);
      return;
    }

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

      if (!word) {
        // 空欄は無視
        return;
      }

      if (secretWordMap[word]) {
        // 正しい → 何もしない（更新データに反映）
        updatedData[secretWordMap[word]] = true;
      } else {
        // 間違い → エラー表示
        markError($input, '正しい合言葉を入力してください');
        hasError = true;
      }
    });

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

      // 画面遷移
      window.location.href =
        isInit === utils.globalStrTrue
          ? '../top/top.html?isInit=1'
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

function validateUserData() {
  let isValid = true;
  clearErrors();

  const sectionId = $('#section-select').val();
  const roleId = $('#role-select').val();
  const secretWord = $('#secret-word').val()?.trim();

  if (!sectionId) {
    markError($('#section-select'), 'パートを選択してください');
    isValid = false;
  }
  if (!roleId) {
    markError($('#role-select'), '役職を選択してください');
    isValid = false;
  }

  return isValid;
}

//==================================
// エラー表示ユーティリティ
//==================================
function clearErrors() {
  $('.error-message').remove();
  $('.error-field').removeClass('error-field');
}

function markError($field, message) {
  const $item = $field.closest('.secret-word-item'); // 親コンテナを取得
  $item.append(`<div class="error-message">${message}</div>`); // 末尾に追加
  $field.addClass('error-field');
}
