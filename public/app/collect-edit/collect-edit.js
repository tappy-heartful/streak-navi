import * as utils from '../common/functions.js';

let initialState = {};
let allUsers = [];
let sectionsMap = {};

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    const mode = utils.globalGetParamMode;
    const collectId = utils.globalGetParamCollectId;

    // データの初期ロード
    await loadInitialMasterData();

    // パンくず設定
    let breadcrumb = [
      { title: '集金一覧', url: '../collect-list/collect-list.html' },
    ];
    if (mode === 'new') {
      breadcrumb.push({ title: '集金新規作成' });
    } else {
      breadcrumb.push(
        {
          title: '集金確認',
          url: `../collect-confirm/collect-confirm.html?collectId=${collectId}`,
        },
        { title: mode === 'edit' ? '集金編集' : '集金新規作成(コピー)' }
      );
    }
    utils.renderBreadcrumb(breadcrumb);

    await setupPage(mode, collectId);
    captureInitialState();
    setupEventHandlers(mode, collectId);
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * 部署・ユーザーマスタの読み込みとUI生成
 */
async function loadInitialMasterData() {
  const [usersSnap, sectionsSnap] = await Promise.all([
    utils.getWrapDocs(utils.collection(utils.db, 'users')),
    utils.getWrapDocs(utils.collection(utils.db, 'sections')),
  ]);

  allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  sectionsSnap.docs.forEach((d) => {
    sectionsMap[d.id] = d.data().name;
  });

  // ソート (sectionId ASC, roleId ASC)
  allUsers.sort((a, b) => {
    if (a.sectionId !== b.sectionId)
      return a.sectionId.localeCompare(b.sectionId);
    return (a.roleId || '').localeCompare(b.roleId || '');
  });

  renderParticipantSelector();
  initDropdowns();
}

function renderParticipantSelector() {
  const $container = $('#participant-selection-container').empty();

  const grouped = {};
  allUsers.forEach((u) => {
    if (!grouped[u.sectionId]) grouped[u.sectionId] = [];
    grouped[u.sectionId].push(u);
  });

  Object.keys(grouped).forEach((sId) => {
    const sectionName = sectionsMap[sId] || `部署コード:${sId}`;
    const $sectionDiv = $(`
      <div class="section-group">
        <div class="section-title">${sectionName}</div>
        <div class="user-grid"></div>
      </div>
    `);

    grouped[sId].forEach((u) => {
      const $userItem = $(`
        <label class="user-checkbox-item">
          <input type="checkbox" class="user-chk" value="${u.id}">
          <span>${u.displayName}</span>
        </label>
      `);
      $sectionDiv.find('.user-grid').append($userItem);
    });
    $container.append($sectionDiv);
  });
}

function initDropdowns() {
  allUsers.forEach((u) => {
    // valueにユーザーID、textに名前を表示
    $('#upfront-payer').append(new Option(u.displayName, u.id));
    if (u.sectionId === '1') {
      $('#manager-name').append(new Option(u.displayName, u.id));
    }
  });
}

async function setupPage(mode, collectId) {
  const saveBtn = $('#save-button');

  if (mode === 'new' || mode === 'copy') {
    saveBtn.text('登録');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day13th = new Date();
    day13th.setDate(day13th.getDate() + 13);

    $('#accept-start-date').val(utils.formatDateToYMDHyphen(tomorrow));
    $('#accept-end-date').val(utils.formatDateToYMDHyphen(day13th));

    if (mode === 'copy') {
      $('#page-title, #title').text('集金新規作成(コピー)');
      await loadCollectData(collectId, mode);
    }
  } else {
    $('#page-title, #title').text('集金編集');
    saveBtn.text('更新');
    $('#accept-start-date').hide();
    $('#accept-start-text').show();
    await loadCollectData(collectId, mode);
  }
}

/**
 * 自動計算 (IDベースで判定)
 */
function runCalculations() {
  const total = Number($('#upfront-amount').val()) || 0;
  const payerId = $('#upfront-payer').val(); // 選択された建替者のID
  const selectedParticipantIds = $('.user-chk:checked')
    .map(function () {
      return $(this).val(); // 各チェックボックスのvalue(ID)を取得
    })
    .get();
  const count = selectedParticipantIds.length;

  $('#participant-count-display').val(count);

  if (total > 0 && count > 0) {
    const perPerson = Math.ceil(total / count);
    $('#amount-per-person').val(perPerson);

    // 建替者(ID)が対象者リスト(ID配列)に含まれているか
    const isPayerIncluded = selectedParticipantIds.includes(payerId);
    const remittance = isPayerIncluded
      ? perPerson * (count - 1)
      : perPerson * count;
    $('#remittance-amount').val(remittance);
  } else {
    $('#amount-per-person').val('');
    $('#remittance-amount').val('');
  }
}

function setupEventHandlers(mode, collectId) {
  $(document).on('change', '.user-chk, #upfront-payer', runCalculations);
  $('#upfront-amount').on('input', runCalculations);

  $('#save-button').on('click', async () => {
    if (!validateData(mode)) return;
    const actionText = mode === 'edit' ? '更新' : '登録';
    if (!(await utils.showDialog(`${actionText}しますか？`))) return;

    utils.showSpinner();
    try {
      const collectData = gatherData();
      let targetId = collectId;
      if (mode === 'edit') {
        collectData.updatedAt = utils.serverTimestamp();
        await utils.updateDoc(
          utils.doc(utils.db, 'collects', collectId),
          collectData
        );
      } else {
        collectData.createdAt = utils.serverTimestamp();
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'collects'),
          collectData
        );
        targetId = docRef.id;
      }
      await utils.writeLog({ dataId: targetId, action: actionText });
      await utils.showDialog(`${actionText}しました`, true);
      window.location.href = `../collect-confirm/collect-confirm.html?collectId=${targetId}`;
    } catch (e) {
      console.error(e);
    } finally {
      utils.hideSpinner();
    }
  });

  $('#clear-button').on('click', async () => {
    if (await utils.showDialog('リセットしますか？')) location.reload();
  });
}

function gatherData() {
  const participantIds = $('.user-chk:checked')
    .map(function () {
      return $(this).val(); // IDの配列を生成
    })
    .get();
  return {
    targetDate: utils.formatDateToYMDDot($('#target-date').val()),
    title: $('#collect-title').val().trim(),
    acceptStartDate: utils.formatDateToYMDDot(
      $('#accept-start-date').val() || $('#accept-start-text').text()
    ),
    acceptEndDate: utils.formatDateToYMDDot($('#accept-end-date').val()),
    amountPerPerson: Number($('#amount-per-person').val()),
    paymentUrl: $('#payment-url').val().trim(),
    upfrontAmount: Number($('#upfront-amount').val()),
    upfrontPayer: $('#upfront-payer').val(), // 建替者のID
    participantCount: participantIds.length,
    participants: participantIds, // 対象者IDの配列
    managerName: $('#manager-name').val(), // 管理担当者のID
    remittanceAmount: Number($('#remittance-amount').val()),
    remarks: $('#collect-remarks').val().trim(),
  };
}

async function loadCollectData(docId, mode) {
  const docSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'collects', docId)
  );
  const data = docSnap.data();

  $('#target-date').val(utils.formatDateToYMDHyphen(data.targetDate));
  $('#collect-title').val(data.title + (mode === 'copy' ? '（コピー）' : ''));

  const startYMD = utils.formatDateToYMDHyphen(data.acceptStartDate);
  $('#accept-start-date').val(startYMD);
  $('#accept-start-text').text(data.acceptStartDate);

  $('#accept-end-date').val(utils.formatDateToYMDHyphen(data.acceptEndDate));
  $('#upfront-amount').val(data.upfrontAmount || '');
  $('#upfront-payer').val(data.upfrontPayer || ''); // IDでセット
  $('#manager-name').val(data.managerName || ''); // IDでセット
  $('#payment-url').val(data.paymentUrl || '');
  $('#collect-remarks').val(data.remarks || '');

  if (data.participants) {
    // IDの配列を元にチェックボックスを復元
    data.participants.forEach((id) => {
      $(`.user-chk[value="${id}"]`).prop('checked', true);
    });
  }
  runCalculations();
}

function validateData(mode) {
  utils.clearErrors();
  let isValid = true;
  const startStr = $('#accept-start-date').val();
  const endStr = $('#accept-end-date').val();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!$('#target-date').val()) {
    utils.markError($('#target-date'), '必須');
    isValid = false;
  }
  if (!$('#upfront-payer').val()) {
    utils.markError($('#upfront-payer'), '必須');
    isValid = false;
  }
  if (!$('#manager-name').val()) {
    utils.markError($('#manager-name'), '必須');
    isValid = false;
  }

  // 日付バリデーション
  if (startStr && endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);

    if (mode !== 'edit' && start <= today) {
      utils.markError(
        $('#accept-start-date'),
        '開始日は明日以降にしてください'
      );
      isValid = false;
    }
    if (end <= start) {
      utils.markError(
        $('#accept-end-date'),
        '終了日は開始日より後にしてください'
      );
      isValid = false;
    }
  }

  if ($('.user-chk:checked').length === 0) {
    utils.markError(
      $('#participant-selection-container'),
      '対象者を1人以上選択してください'
    );
    isValid = false;
  }
  if (!$('#amount-per-person').val()) {
    utils.markError($('#amount-per-person'), '金額が計算されていません');
    isValid = false;
  }
  return isValid;
}

function captureInitialState() {
  initialState = gatherData();
}
