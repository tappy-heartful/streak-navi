import * as utils from '../common/functions.js';

let initialState = {};

$(document).ready(async function () {
  try {
    // 💡 mode は 'new' または 'edit' に限定される
    const mode = utils.globalGetParamMode || 'new'; // modeがない場合は新規作成とみなす
    const noticeId = utils.globalGetparams.get('noticeId');
    await utils.initDisplay();

    // 画面ごとのパンくずをセット
    let breadcrumb = [
      { title: '通知設定一覧', url: '../notice-list/notice-list.html' },
    ];

    // 💡 カスタム通知専用のパンくずロジック
    if (mode === 'new') {
      breadcrumb.push({ title: 'カスタム通知新規作成' });
    } else {
      // 💡 確認画面のパスを notice-custom-confirm に変更
      breadcrumb.push(
        {
          title: 'カスタム通知確認',
          url: `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`,
        },
        { title: 'カスタム通知編集' }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    await setupPage(mode, noticeId);
    captureInitialState(mode, noticeId);
    setupEventHandlers(mode, noticeId);
  } catch (e) {
    await utils.writeLog({
      dataId: 'custom',
      action: 'カスタム通知設定編集',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function setupPage(mode, noticeId) {
  // 💡 カスタム通知専用
  $('#page-title').text(
    mode === 'new' ? 'カスタム通知新規作成' : 'カスタム通知編集'
  );
  // 💡 hiddenクラスはHTMLで削除済み
  if (noticeId) await loadCustomNotice(noticeId);
}

// 💡 loadBaseConfig 関数は削除

// データ読み込み（カスタム通知）
async function loadCustomNotice(id) {
  const docSnap = await utils.getWrapDoc(utils.doc(utils.db, 'notices', id));
  if (docSnap.exists()) {
    const d = docSnap.data();
    $('#custom-title').val(d.title);
    $('#custom-date').val(utils.formatDateToYMDHyphen(d.scheduledDate));
    $('#custom-time').val(d.scheduledTime);
    $('#custom-message').val(d.message);

    // 紐づけ対象の復元
    if (d.relatedType !== 'none') {
      $('#related-type').val(d.relatedType).trigger('change');
      // IDのセットは非同期ロード後に行うため、setTimeout等で微調整が必要な場合あり
      setTimeout(() => $('#related-id').val(d.relatedId), 500);
    }
  }
}

function setupEventHandlers(mode, noticeId) {
  // カスタム通知：紐づけ対象の動的切り替え
  $('#related-type').on('change', async function () {
    const type = $(this).val();
    const $idSelect = $('#related-id');

    if (type === 'none') {
      $idSelect.addClass('hidden').empty();
      return;
    }

    utils.showSpinner();
    // 💡 コレクション名は 'events', 'votes', 'calls'
    const snap = await utils.getWrapDocs(utils.collection(utils.db, type));
    $idSelect
      .empty()
      .append('<option value="">対象を選択してください</option>');
    snap.docs.forEach((doc) => {
      const d = doc.data();
      $idSelect.append(
        `<option value="${doc.id}">${
          d.title || d.name || '名称未設定'
        }</option>`
      );
    });
    $idSelect.removeClass('hidden');
    utils.hideSpinner();
  });

  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        mode === 'new' ? '入力内容をクリアしますか？' : '編集前に戻しますか？'
      )
    )
      restoreInitialState();
  });

  $('#save-button').on('click', async () => {
    // 💡 カスタム設定のバリデーションのみ実行
    if (!validateData()) return;
    const confirm = await utils.showDialog('設定を保存しますか？');
    if (!confirm) return;

    utils.showSpinner();
    try {
      const noticeId = utils.globalGetparams.get('noticeId');
      const data = collectCustomData();

      if (noticeId) {
        // 編集
        await utils.updateDoc(utils.doc(utils.db, 'notices', noticeId), data);
      } else {
        // 新規作成
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'notices'),
          data
        );
        noticeId = docRef.id; // 新しく作成されたIDを取得
      }

      await utils.showDialog('保存しました', true);
      // 💡 カスタム通知確認画面へ遷移
      window.location.href = `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`;
    } catch (e) {
      utils.hideSpinner();
      await utils.showDialog('エラーが発生しました');
    }
  });

  $(document).on(
    'click',
    '.back-link',
    () =>
      // 💡 戻るボタンの遷移ロジックをカスタム通知専用に調整
      (window.location.href =
        mode === 'new'
          ? '../notice-list/notice-list.html' // 新規作成時は一覧へ
          : `../notice-custom-confirm/notice-custom-confirm.html?noticeId=${noticeId}`) // 編集時は確認画面へ
  );
}

// 💡 collectBaseData 関数は削除

function collectCustomData() {
  const relId = $('#related-id').val();
  const relTitle = $('#related-id option:selected').text();
  return {
    title: $('#custom-title').val(),
    scheduledDate: utils.formatDateToYMDDot($('#custom-date').val()),
    scheduledTime: $('#custom-time').val(),
    relatedType: $('#related-type').val(),
    relatedId: relId || '',
    relatedTitle: relId ? relTitle : '',
    message: $('#custom-message').val(),
    createdAt: utils.serverTimestamp(),
  };
}

function validateData() {
  utils.clearErrors();
  let isValid = true;

  if (!$('#custom-title').val()) {
    utils.markError($('#custom-title'), '必須');
    isValid = false;
  }
  if (!$('#custom-date').val()) {
    utils.markError($('#custom-date'), '必須');
    isValid = false;
  }
  if (!$('#custom-time').val()) {
    utils.markError($('#custom-time'), '必須');
    isValid = false;
  }
  if (!$('#custom-message').val()) {
    utils.markError($('#custom-message'), '必須');
    isValid = false;
  }
  // 💡 基本設定はここではチェックしないため、modeの引数を削除
  return isValid;
}

function captureInitialState() {
  /* 復元ロジック（省略可、reloadで代用） */
}
function restoreInitialState() {
  location.reload();
}
