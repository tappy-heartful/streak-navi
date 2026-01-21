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
    $('#board-scope').val(utils.globalGetParamSectionId || 'all');
    $('.back-link').text('← 掲示板一覧に戻る');
  } else {
    const label = mode === 'edit' ? '掲示板編集' : '掲示板新規作成(コピー)';
    $('#page-title, #title').text(label);
    $('#save-button').text(mode === 'edit' ? '更新する' : '登録する');
    await loadBoardData(boardId, mode);
    $('.back-link').text('← 掲示板確認に戻る');
  }
}

async function loadBoardData(boardId, mode) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'boards', boardId)
  );
  if (!docSnap.exists()) throw new Error('投稿が見つかりません');

  const data = docSnap.data();
  $('#board-title').val(
    data.title_decoded + (mode === 'copy' ? '（コピー）' : '')
  );
  $('#board-content').val(data.content_decoded || '');
  $('#board-scope').val(data.sectionId || 'all');

  // ファイル情報の読み込み
  if (mode === 'edit' && data.files && Array.isArray(data.files)) {
    // 💡 修正ポイント: エスケープされた name ではなく name_decoded を優先的に採用する
    attachedFiles = data.files.map((file) => {
      return {
        name: file.name_decoded || file.name, // デコード済みの値があればそれを使う
        url: file.url,
        path: file.path,
      };
    });
    renderFileList();
  }
}

function setupEventHandlers(mode, boardId) {
  $('#btn-file-select').on('click', () => $('#board-file-input').click());

  $('#board-file-input').on('change', async function (e) {
    const files = e.target.files;
    if (!files.length) return;

    utils.showSpinner();
    try {
      for (let file of files) {
        let uploadBlob = file;
        let fileName = file.name;
        let path = `boards/attachments/${Date.now()}_${fileName}`;

        if (file.type.startsWith('image/')) {
          try {
            uploadBlob = await utils.compressImage(file);
            if (
              !fileName.toLowerCase().endsWith('.jpg') &&
              !fileName.toLowerCase().endsWith('.jpeg')
            ) {
              path = path.replace(/\.[^/.]+$/, '') + '.jpg';
            }
          } catch (compressErr) {
            console.warn('圧縮失敗、オリジナルを使用:', compressErr);
            uploadBlob = file;
          }
        }

        const storageRef = utils.ref(utils.storage, path);
        await utils.uploadBytes(storageRef, uploadBlob);
        const url = await utils.getDownloadURL(storageRef);

        attachedFiles.push({ name: fileName, url: url, path: path });
      }
      renderFileList();
    } catch (err) {
      console.error(err);
      alert('アップロードに失敗しました');
    } finally {
      utils.hideSpinner();
      $(this).val('');
    }
  });

  $(document).on('click', '.btn-file-delete', async function () {
    const index = $(this).data('index');
    const file = attachedFiles[index];

    if (!(await utils.showDialog(`「${file.name}」を削除しますか？`))) return;

    try {
      utils.showSpinner();
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

  $('#save-button').on('click', async () => {
    if (!validateData()) {
      utils.showDialog('入力内容を確認してください', true);
      return;
    }
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
          <span>${file.name}</span>
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

  // 💡 attachedFiles には既にデコード済みのきれいな名前が入っているため、そのまま保存
  const data = {
    title: $('#board-title').val().trim(),
    content: $('#board-content').val().trim(),
    sectionId: scope === 'all' ? null : scope,
    files: attachedFiles,
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
