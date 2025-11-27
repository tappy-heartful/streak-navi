import * as utils from '../common/functions.js';

let allInstruments = [];
let userInstrumentIds = [];

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

    // Instrumentsデータを事前に取得
    await loadAllInstruments();
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

async function loadAllInstruments() {
  const instrumentSnapshot = await utils.getWrapDocs(
    utils.collection(utils.db, 'instruments')
  );
  allInstruments = instrumentSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function setUpPage() {
  const uid = utils.globalGetParamUid;
  const isInit = utils.globalGetParamIsInit;
  const userRef = utils.doc(utils.db, 'users', uid);
  const userSnap = await utils.getWrapDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('ユーザが見つかりません：' + uid);
  }

  const userData = userSnap.data();

  // ユーザーの楽器IDを読み込む (配列として保存されている想定)
  userInstrumentIds = userData.instrumentIds || [];

  // 初回ログインの場合
  if (isInit === utils.globalStrTrue) {
    $('#title').text('ユーザ登録');
    $('#page-title').text('ユーザ登録');
    $('#save-button').text('登録する');
    $('.page-footer').addClass('hidden');
    $('#init-message').text('以下を設定してください');
  }

  // ユーザー名
  $('#user-name').text(userData.displayName_decoded || '名無し');
  $('.user-icon').attr(
    'src',
    userData.pictureUrl_decoded || utils.globalBandLogoImage
  );
  $('.user-icon').attr(
    'onerror',
    "this.onerror=null; this.src='" + utils.globalLineDefaultImage + "';"
  );

  // パートと役職をプルダウンに反映
  await populateSections(userData.sectionId);
  await populateRoles(userData.roleId);

  // 略称
  $('#abbreviation').val(userData.abbreviation);
}

async function populateSections(selectedId) {
  const sectionSnapshot = await utils.getWrapDocs(
    utils.collection(utils.db, 'sections')
  );
  const $select = $('#section-select');
  $select.empty();

  // 選択肢がない場合に備え、空のオプションを追加
  $select.append($('<option>').val('').text('--- 選択してください ---'));

  sectionSnapshot.forEach((doc) => {
    const data = doc.data();
    const option = $('<option>')
      .val(doc.id)
      .text(data.name_decoded || '(名称なし)');
    if (doc.id === selectedId) {
      option.prop('selected', true);
    }
    $select.append(option);
  });

  // パート選択後、楽器リストを更新
  populateInstruments(selectedId);
}

// 💡 変更点: 楽器のプルダウンからチェックボックスリストを生成に変更
function populateInstruments(sectionId) {
  const $list = $('#instrument-checkbox-list');
  $list.empty();

  const $note = $('<p class="select-note">');

  if (!sectionId) {
    $list.append($note.text('--- パートを選択してください ---'));
    return;
  }

  // パートIDに一致する楽器のみをフィルタリング
  const filteredInstruments = allInstruments.filter(
    (inst) => inst.sectionId === sectionId
  );

  if (filteredInstruments.length > 0) {
    filteredInstruments.forEach((inst, index) => {
      const id = `instrument-${inst.id}`;

      const $item = $(`
                <div>
                    <input type="checkbox" id="${id}" class="instrument-checkbox" value="${
        inst.id
      }">
                    <label for="${id}">${
        inst.name_decoded || '(名称なし)'
      }</label>
                </div>
            `);

      // ユーザーデータにIDが含まれていればチェックを入れる
      if (userInstrumentIds.includes(inst.id)) {
        $item.find(`#${id}`).prop('checked', true);
      }
      $list.append($item);
    });
  } else {
    $list.append($note.text('--- 該当する楽器がありません ---'));
  }
}

async function populateRoles(selectedId) {
  const roleSnapshot = await utils.getWrapDocs(
    utils.collection(utils.db, 'roles')
  );
  const $select = $('#role-select');
  $select.empty();

  roleSnapshot.forEach((doc) => {
    const data = doc.data();
    const option = $('<option>')
      .val(doc.id)
      .text(data.name_decoded || '(名称なし)');
    if (doc.id === selectedId) {
      option.prop('selected', true);
    }
    $select.append(option);
  });
}

function setupEventHandlers() {
  // 💡 変更点: パート選択時のイベントハンドラ
  $('#section-select').on('change', function () {
    const selectedSectionId = $(this).val();

    // 選択されたパートに基づいて楽器チェックボックスを更新
    populateInstruments(selectedSectionId);

    // パートが変更された場合、以前の選択状態をリセットする (見た目上はpopulateInstrumentsで更新されるが、内部データもクリア)
    userInstrumentIds = [];
    utils.clearErrors($('#instrument-checkbox-list'));
  });

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
    $list.append($item);
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
      utils.hideSpinner();
      await utils.showDialog('入力内容を確認してください', true);
      return;
    }

    // Firestoreから最新の合言葉マップを取得
    const secretWordMap = await getSecretWordMap();

    // 基本更新データ
    const updatedData = {
      sectionId: $('#section-select').val(),
      roleId: $('#role-select').val(),
      abbreviation: $('#abbreviation').val(),
      // 💡 変更点: 選択された楽器IDの配列を取得
      instrumentIds: getSelectedInstrumentIds(),
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
        utils.markError(
          $('#secret-word-list'),
          '正しい合言葉を入力してください：' + word
        );
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

// 💡 変更点: チェックボックスから選択された楽器IDを取得
function getSelectedInstrumentIds() {
  // .instrument-checkbox クラスを持つチェックボックスのうち、チェックされているものの value を配列として取得
  const selectedIds = [];
  $('#instrument-checkbox-list')
    .find('.instrument-checkbox:checked')
    .each(function () {
      selectedIds.push($(this).val());
    });
  return selectedIds;
}

async function getSecretWordMap() {
  const snapshot = await utils.getWrapDocs(
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
  const abbreviation = $('#abbreviation').val();

  // 楽器の選択状態を取得
  const selectedInstruments = getSelectedInstrumentIds();

  if (!sectionId) {
    utils.markError($('#section-select'), 'パートを選択してください');
    isValid = false;
  }
  // 💡 変更点: チェックボックスのコンテナに対してエラー表示
  if (selectedInstruments.length === 0) {
    utils.markError(
      $('#instrument-checkbox-list'),
      '演奏する楽器を一つ以上選択してください'
    );
    isValid = false;
  }
  if (!roleId) {
    utils.markError($('#role-select'), '役職を選択してください');
    isValid = false;
  }

  if (!abbreviation) {
    utils.markError($('#abbreviation'), '略称を入力してください');
    isValid = false;
  } else if (abbreviation.length > 2) {
    utils.markError($('#abbreviation'), '略称は2文字で以下で入力してください');
    isValid = false;
  }

  return isValid;
}
