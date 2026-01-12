import * as utils from '../common/functions.js';

let initialState = {};
let userSectionId = '';

$(document).ready(async function () {
  try {
    const mode = utils.globalGetParamMode; // new / edit / copy
    const boardId = utils.globalGetParamBoardId;
    await utils.initDisplay();

    // セクション情報の取得
    userSectionId = utils.getSession('sectionId');
    await setupScopeSelect();

    // パンくずリストの設定
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

// 公開範囲のセレクトボックス設定
async function setupScopeSelect() {
  if (userSectionId) {
    const sectionSnap = await utils.getWrapDoc(
      utils.doc(utils.db, 'sections', userSectionId)
    );
    if (sectionSnap.exists()) {
      const sectionName = sectionSnap.data().name;
      $('#board-scope').append(
        `<option value="${userSectionId}">${sectionName}専用</option>`
      );
    }
  }
}

async function setupPage(mode, boardId) {
  const pageTitle = $('#page-title');
  const titleTag = $('#title');
  const submitButton = $('#save-button');

  if (mode === 'new') {
    pageTitle.text('掲示板新規作成');
    titleTag.text('掲示板新規作成');
    submitButton.text('登録する');
  } else if (mode === 'edit' || mode === 'copy') {
    const label = mode === 'edit' ? '掲示板編集' : '掲示板新規作成(コピー)';
    pageTitle.text(label);
    titleTag.text(label);
    submitButton.text(mode === 'edit' ? '更新する' : '登録する');
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
}

function setupEventHandlers(mode, boardId) {
  // クリア・復元
  $('#clear-button').on('click', async () => {
    const msg =
      mode === 'new' ? '入力をクリアしますか？' : '編集前に戻しますか？';
    if (await utils.showDialog(msg)) restoreInitialState();
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
        // 更新
        const boardRef = utils.doc(utils.db, 'boards', boardId);
        await utils.updateDoc(boardRef, {
          ...boardData,
          updatedAt: utils.serverTimestamp(),
        });
        await utils.writeLog({ dataId: boardId, action: '掲示板更新' });
        savedBoardId = boardId;
      } else {
        // 新規作成(new) または コピー(copy)
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

  $('.back-link').on('click', () => {
    window.location.href =
      mode === 'new'
        ? '../board-list/board-list.html'
        : `../board-confirm/board-confirm.html?boardId=${boardId}`;
  });
}

function collectData(mode) {
  const scope = $('#board-scope').val();
  const data = {
    title: $('#board-title').val().trim(),
    content: $('#board-content').val().trim(),
    sectionId: scope === 'all' ? null : scope,
    updatedAt: utils.serverTimestamp(),
  };

  // 新規またはコピー時は作成者情報を付与
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
  };
}

function restoreInitialState() {
  $('#board-scope').val(initialState.scope);
  $('#board-title').val(initialState.title);
  $('#board-content').val(initialState.content);
  utils.clearErrors();
}
