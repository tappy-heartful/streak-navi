import * as utils from '../common/functions.js';

let initialState = {};
let userSectionId = '';
let attachedFiles = []; // { name: string, url: string, path: string }

$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode;
    const boardId = utils.globalGetParamBoardId;
    await utils.initDisplay();

    userSectionId = utils.getSession('sectionId');
    await setupScopeSelect();

    // パンくず設定（略）...
    setupBreadcrumbs(mode, boardId);

    await setupPage(mode, boardId);
    captureInitialState();
    setupEventHandlers(mode, boardId);
  } catch (e) {
    console.error(e);
    await utils.writeLog({
      dataId: utils.getParam('boardId') || 'new',
      action: '編集画面初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

// パンくず設定用（可読性のため分離）
function setupBreadcrumbs(mode, boardId) {
  let breadcrumb = [
    { title: '掲示板一覧', url: '../board-list/board-list.html' },
  ];
  if (mode === 'new') {
    breadcrumb.push({ title: '掲示板新規作成' });
  } else {
    breadcrumb.push(
      {
        title: '掲示板確認',
        url: `../board-confirm/board-confirm.html?boardId=${boardId}`,
      },
      { title: mode === 'edit' ? '掲示板編集' : '掲示板新規作成(コピー)' }
    );
  }
  utils.renderBreadcrumb(breadcrumb);
}

async function setupScopeSelect() {
  if (userSectionId) {
    const sectionSnap = await utils.getWrapDoc(
      utils.doc(utils.db, 'sections', userSectionId)
    );
    if (sectionSnap.exists()) {
      $('#board-scope').append(
        `<option value="${userSectionId}">${
          sectionSnap.data().name
        }専用</option>`
      );
    }
  }
}

async function setupPage(mode, boardId) {
  if (mode === 'new') {
    $('#page-title, #title').text('掲示板新規作成');
    $('#save-button').text('登録する');
  } else {
    const label = mode === 'edit' ? '掲示板編集' : '掲示板新規作成(コピー)';
    $('#page-title, #title').text(label);
    $('#save-button').text(mode === 'edit' ? '更新する' : '登録する');
    await loadBoardData(boardId, mode);
  }
}

async function loadBoardData(boardId, mode) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'boards', boardId)
  );
  if (!docSnap.exists()) throw new Error('投稿が見つかりません');

  const data = docSnap.data();
  $('#board-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));
  $('#board-content').val(data.content || '');
  $('#board-scope').val(data.sectionId || 'all');

  // ファイル情報の読み込み
  if (data.files && Array.isArray(data.files)) {
    attachedFiles = [...data.files];
    renderFileList();
  }
}

function setupEventHandlers(mode, boardId) {
  // ファイル選択ボタンの連動
  $('#btn-file-select').on('click', () => $('#board-file-input').click());

  // ファイルアップロード処理
  $('#board-file-input').on('change', async function (e) {
    const files = e.target.files;
    if (!files.length) return;

    utils.showSpinner();
    try {
      for (let file of files) {
        // 保存パス: boards/uniqueId/filename_timestamp
        const timestamp = Date.now();
        const path = `boards/attachments/${timestamp}_${file.name}`;
        const storageRef = utils.ref(utils.storage, path);

        await utils.uploadBytes(storageRef, file);
        const url = await utils.getDownloadURL(storageRef);

        attachedFiles.push({ name: file.name, url: url, path: path });
      }
      renderFileList();
    } catch (err) {
      console.error(err);
      alert('ファイルのアップロードに失敗しました');
    } finally {
      utils.hideSpinner();
      $(this).val('');
    }
  });

  // ファイル削除処理
  $(document).on('click', '.btn-file-delete', async function () {
    const index = $(this).data('index');
    const file = attachedFiles[index];

    if (!(await utils.showDialog(`「${file.name}」を削除しますか？`))) return;

    try {
      utils.showSpinner();
      // Storageから削除（共通関数 deleteStorageFile または utils.deleteObject を想定）
      const fileRef = utils.ref(utils.storage, file.path);
      await utils.deleteObject(fileRef);

      attachedFiles.splice(index, 1);
      renderFileList();
    } catch (err) {
      console.error(err);
      alert('ファイルの削除に失敗しました');
    } finally {
      utils.hideSpinner();
    }
  });

  // 保存（登録/更新）
  $('#save-button').on('click', async () => {
    if (!validateData()) return;
    const actionLabel = mode === 'edit' ? '更新' : '登録';
    if (!(await utils.showDialog(`${actionLabel}しますか？`))) return;

    utils.showSpinner();
    try {
      const boardData = collectData(mode);
      let savedBoardId;

      if (mode === 'edit') {
        const boardRef = utils.doc(utils.db, 'boards', boardId);
        await utils.updateDoc(boardRef, {
          ...boardData,
          updatedAt: utils.serverTimestamp(),
        });
        await utils.writeLog({ dataId: boardId, action: '掲示板更新' });
        savedBoardId = boardId;
      } else {
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'boards'),
          boardData
        );
        await utils.writeLog({ dataId: docRef.id, action: '掲示板新規登録' });
        savedBoardId = docRef.id;
      }

      utils.hideSpinner();
      await utils.showDialog(`${actionLabel}しました`, true);
      window.location.href = `../board-confirm/board-confirm.html?boardId=${savedBoardId}`;
    } catch (e) {
      console.error(e);
      utils.hideSpinner();
      utils.showDialog(`${actionLabel}に失敗しました`);
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('入力を復元しますか？')) restoreInitialState();
  });

  $('.back-link').on('click', () => {
    window.location.href =
      mode === 'new'
        ? '../board-list/board-list.html'
        : `../board-confirm/board-confirm.html?boardId=${boardId}`;
  });
}

function renderFileList() {
  const $list = $('#file-list').empty();
  attachedFiles.forEach((file, index) => {
    $list.append(`
      <li class="file-item">
        <div class="file-info">
          <i class="far fa-file"></i>
          <span>${DOMPurify.sanitize(file.name)}</span>
        </div>
        <button type="button" class="btn-file-delete" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      </li>
    `);
  });
}

function collectData(mode) {
  const scope = $('#board-scope').val();
  const data = {
    title: $('#board-title').val().trim(),
    content: $('#board-content').val().trim(),
    sectionId: scope === 'all' ? null : scope,
    files: attachedFiles, // アップロード済みのファイル情報を配列で保存
    updatedAt: utils.serverTimestamp(),
  };

  if (mode !== 'edit') {
    data.createdAt = utils.serverTimestamp();
    data.createdBy = utils.getSession('uid') || 'anonymous';
    data.createdByName = utils.getSession('displayName') || '匿名';
  }
  return data;
}

function validateData() {
  utils.clearErrors();
  let isValid = true;
  if (!$('#board-title').val().trim()) {
    utils.markError($('#board-title'), 'タイトルを入力してください');
    isValid = false;
  }
  if (!$('#board-content').val().trim()) {
    utils.markError($('#board-content'), '内容を入力してください');
    isValid = false;
  }
  return isValid;
}

function captureInitialState() {
  initialState = {
    scope: $('#board-scope').val(),
    title: $('#board-title').val(),
    content: $('#board-content').val(),
    files: [...attachedFiles],
  };
}

function restoreInitialState() {
  $('#board-scope').val(initialState.scope);
  $('#board-title').val(initialState.title);
  $('#board-content').val(initialState.content);
  attachedFiles = [...initialState.files];
  renderFileList();
  utils.clearErrors();
}
