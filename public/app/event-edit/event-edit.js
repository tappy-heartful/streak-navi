import * as utils from '../common/functions.js'; // 共通関数群読み込み

//==================================
// グローバル変数
//==================================
let initialStateHtml; // 初期表示状態の保存用
let scoresList = []; // scoresをグローバルに持つ

//==================================
// 初期化処理（ページ読込時）
//==================================
$(document).ready(async function () {
  try {
    // 画面ごとのパンくずをセット
    let breadcrumb = [];
    const mode = utils.globalGetParamMode; // URLパラメータからモード取得
    if (['new'].includes(mode)) {
      breadcrumb.push(
        { title: 'イベント一覧', url: '../event-list/event-list.html' },
        { title: 'イベント新規作成' }
      );
    } else if (['edit', 'copy'].includes(mode)) {
      breadcrumb.push(
        { title: 'イベント一覧', url: '../event-list/event-list.html' },
        {
          title: 'イベント確認',
          url:
            '../event-confirm/event-confirm.html?eventId=' +
            utils.globalGetParamEventId,
        },
        {
          title: mode === 'edit' ? 'イベント編集' : 'イベント新規作成(コピー)',
        }
      );
    } else if (mode === 'createFromCall') {
      breadcrumb.push(
        { title: '曲募集一覧', url: '../call-list/call-list.html' },
        {
          title: '曲募集確認',
          url:
            '../call-confirm/call-confirm.html?callId=' +
            utils.globalGetParamCallId,
        },
        { title: '曲募集からイベント作成' }
      );
    }
    utils.setBreadcrumb(breadcrumb);
    await utils.initDisplay(); // 共通初期化

    // 譜面リスト保持
    const scoresSnapshot = await utils.getDocs(
      utils.collection(utils.db, 'scores')
    );
    scoresList = scoresSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
    }));

    // データ取得や初期表示の完了を待つ
    await setupPage(mode);

    // データ反映後に初期状態を保存
    captureInitialState();

    setupEventHandlers(mode);
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: utils.globalGetParamEventId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    // スピナー非表示
    utils.hideSpinner();
  }
});

//==================================
// ページの設定
//==================================
async function setupPage(mode) {
  const pageTitle = $('#page-title');
  const title = $('#title');
  const submitButton = $('#save-button');
  const backLink = $('.back-link');

  if (mode === 'new') {
    pageTitle.text('イベント新規作成');
    title.text('イベント新規作成');
    submitButton.text('登録');
    backLink.text('← イベント一覧に戻る');

    // 初期値セット
    $('#event-date').val('');
    $('#event-place-name').val('');
    $('#event-place-url').val('');
    $('#event-parking').val('');
    $('#event-schedule').val('');
    $('#event-dress').val('');
    $('#event-other').val('');
    $('#event-attendance').prop('checked', true);

    addScoreSelect(); // 初期1つ
  } else {
    // 編集/コピー/募集作成の場合はFirestoreから取得
    await loadEventData(utils.globalGetParamEventId, mode);
  }
}

//==================================
// イベントデータ取得＆画面反映
//==================================
async function loadEventData(eventId, mode) {
  const docSnap = await utils.getDoc(utils.doc(utils.db, 'events', eventId));
  if (!docSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  const data = docSnap.data();

  // 基本情報
  $('#event-title').val(data.name + (mode === 'copy' ? '（コピー）' : ''));
  $('#event-attendance').prop('checked', data.isActive); // 出欠連動

  // 追加項目
  $('#event-date').val(data.date || '');
  $('#event-place-name').val(data.placeName || '');
  $('#event-place-url').val(data.placeURL || '');
  $('#event-parking').val(data.parking || '');
  $('#event-schedule').val(data.schedule || '');
  $('#event-dress').val(data.dress || '');
  $('#event-other').val(data.other || '');

  // やる曲（scores）を反映
  $('#event-scores-container').empty();
  (data.scores || []).forEach((score) => {
    const $selectWrapper = $(`
      <div class="score-select-wrapper">
        <select class="score-select">
          <option value="">選択してください</option>
          ${scoresList
            .map((s) => `<option value="${s.id}">${s.title}</option>`)
            .join('')}
        </select>
        <button class="remove-score">×</button>
      </div>
    `);
    $('#event-scores-container').append($selectWrapper);
  });
  // 空のプルダウンを最低1つ表示
  if (!data.scores || !data.scores.length) addScoreSelect();

  // 項目表示
  $('#event-items-container').empty();
  (data.items || []).forEach((item) => {
    const $item = createEventItemTemplate();
    $item.find('.event-item-title').val(item.name);

    const $choices = $item.find('.event-choices').empty();
    (item.choices || []).forEach((choice, idx) => {
      $choices.append(choiceTemplate(idx + 1));
      $choices
        .find('.event-choice')
        .last()
        .val(choice.name || '');
    });

    $('#event-items-container').append($item);
  });
}

//==================================
// イベントハンドラ登録
//==================================
function setupEventHandlers(mode) {
  // 【項目追加ボタン】
  $('#add-item').on('click', () => {
    $('#event-items-container').append(createEventItemTemplate());
  });

  // 【項目内ボタン（動的要素用イベント委任）】
  $('#event-items-container')
    // 選択肢追加
    .on('click', '.add-choice', function () {
      const $choices = $(this).siblings('.event-choices');
      const index = $choices.find('.choice-wrapper').length + 1;
      $choices.append(choiceTemplate(index));
    })
    // 選択肢削除
    .on('click', '.remove-choice', function () {
      $(this).parent('.choice-wrapper').remove();
    })
    // 項目削除
    .on('click', '.remove-item', function () {
      $(this).closest('.event-item').remove();
    });

  // scores追加・削除イベント
  $(document).on('click', '#add-score', addScoreSelect);
  $(document).on('click', '.remove-score', function () {
    $(this).parent('.score-select-wrapper').remove();
  });

  // 【クリアボタン】初期状態に戻す
  $('#clear-button').on('click', async () => {
    if (
      await utils.showDialog(
        mode === 'new' ? '入力内容をクリアしますか？' : '編集前に戻しますか？'
      )
    )
      restoreInitialState();
  });

  // 【登録/更新ボタン】
  $('#save-button').on('click', async () => {
    // 入力チェック
    if (!validateEventData()) {
      utils.showDialog('入力内容を確認してください', true);
      return;
    }

    // 確認ダイアログ
    if (
      !(await utils.showDialog(
        (['new', 'copy', 'createFromCall'].includes(mode) ? '登録' : '更新') +
          'しますか？'
      ))
    )
      return;

    utils.showSpinner(); // スピナー表示

    try {
      const eventData = await collectEventData(mode); // イベント本文を取得。コピーの時は一致した場合のリンクも引き継ぎ

      if (['new', 'copy', 'createFromCall'].includes(mode)) {
        // --- 新規作成・コピー ---
        const docRef = await utils.addDoc(
          utils.collection(utils.db, 'events'),
          eventData
        );

        // ログ登録
        await utils.writeLog({ dataId: docRef.id, action: '登録' });
        utils.hideSpinner();
        await utils.showDialog('登録しました', true);

        if (await utils.showDialog('続いて選択肢のリンクを設定しますか？')) {
          // はいでリンク設定画面へ
          window.location.href = `../event-link-edit/event-link-edit.html?eventId=${docRef.id}`;
        } else {
          // いいえで確認画面へ
          window.location.href = `../event-confirm/event-confirm.html?eventId=${docRef.id}`;
        }
      } else {
        // --- 編集 ---
        const eventId = utils.globalGetParamEventId;
        const eventRef = utils.doc(utils.db, 'events', eventId);

        // 既存データ取得
        const docSnap = await utils.getDoc(eventRef);
        if (!docSnap.exists)
          throw new Error('イベントが見つかりません：' + eventId);
        const existingData = docSnap.data();

        // --- リンク情報を名前で統合 ---
        eventData.descriptionLink = existingData.descriptionLink || '';
        eventData.items = eventData.items.map((item) => {
          // 既存項目で同名のものを探す
          const existingItem = (existingData.items || []).find(
            (ei) => ei.name === item.name
          );

          return {
            ...item,
            link: existingItem?.link || '',
            choices: item.choices.map((choice) => {
              // 既存項目がある場合、同名選択肢のリンクを取得
              const existingChoice = existingItem?.choices?.find(
                (ec) => ec.name === choice.name
              );
              return { ...choice, link: existingChoice?.link || '' };
            }),
          };
        });

        eventData.updatedAt = utils.serverTimestamp();

        // --- Firestore 更新 ---
        await utils.updateDoc(eventRef, eventData);

        // ログ登録
        await utils.writeLog({ dataId: eventId, action: '更新' });
        utils.hideSpinner();
        await utils.showDialog('更新しました', true);

        if (await utils.showDialog('続いて選択肢のリンクを設定しますか？')) {
          // はいでリンク設定画面へ
          window.location.href = `../event-link-edit/event-link-edit.html?eventId=${eventId}`;
        } else {
          // いいえで確認画面へ
          window.location.href = `../event-confirm/event-confirm.html?eventId=${eventId}`;
        }
      }
    } catch (e) {
      // ログ登録
      await utils.writeLog({
        dataId: utils.globalGetParamEventId,
        action: ['new', 'copy', 'createFromCall'].includes(mode)
          ? '登録'
          : '更新',
        status: 'error',
        errorDetail: { message: e.message, stack: e.stack },
      });
    } finally {
      // スピナー非表示
      utils.hideSpinner();
    }
  });

  // 確認/一覧画面に戻る
  $(document).on('click', '.back-link', function (e) {
    window.location.href = ['edit', 'copy'].includes(mode)
      ? `../event-confirm/event-confirm.html?eventId=${utils.globalGetParamEventId}`
      : mode === 'createFromCall'
      ? `../call-confirm/call-confirm.html?callId=${utils.globalGetParamCallId}`
      : '../event-list/event-list.html';
  });
}

//==================================
// 項目テンプレート生成
//==================================
function createEventItemTemplate() {
  return $(`
    <div class="event-item">
      <input type="text" class="event-item-title" placeholder="項目名（例：演目候補）" />
      <div class="event-choices">
        ${choiceTemplate(1)[0].outerHTML}
        ${choiceTemplate(2)[0].outerHTML}
      </div>
      <button class="add-choice">＋ 選択肢を追加</button>
      <button class="remove-item">× 項目を削除</button>
    </div>
  `);
}

//==================================
// 選択肢テンプレート生成
//==================================
function choiceTemplate(index) {
  return $(`
    <div class="choice-wrapper">
      ・<input type="text" class="event-choice" placeholder="選択肢${index}" />
      <button class="remove-choice">×</button>
    </div>
  `);
}

//==================================
// 初期状態の保存と復元
//==================================
function captureInitialState() {
  initialStateHtml = {
    title: $('#event-title').val(),
    isActive: $('#event-attendance').prop('checked'),
    date: $('#event-date').val(),
    placeName: $('#event-place-name').val(),
    placeURL: $('#event-place-url').val(),
    parking: $('#event-parking').val(),
    schedule: $('#event-schedule').val(),
    dress: $('#event-dress').val(),
    other: $('#event-other').val(),
    scores: $('#event-scores-container select')
      .map((i, el) => $(el).val())
      .get(),
    items: $('#event-items-container .event-item')
      .map(function () {
        return {
          name: $(this).find('.event-item-title').val(),
          choices: $(this)
            .find('.event-choice')
            .map(function () {
              return $(this).val();
            })
            .get(),
        };
      })
      .get(),
  };
}

function restoreInitialState() {
  $('#event-title').val(initialStateHtml.title);
  $('#event-attendance').prop('checked', initialStateHtml.isActive);

  // 追加項目
  $('#event-date').val(initialStateHtml.date || '');
  $('#event-place-name').val(initialStateHtml.placeName || '');
  $('#event-place-url').val(initialStateHtml.placeURL || '');
  $('#event-parking').val(initialStateHtml.parking || '');
  $('#event-schedule').val(initialStateHtml.schedule || '');
  $('#event-dress').val(initialStateHtml.dress || '');
  $('#event-other').val(initialStateHtml.other || '');

  // scores
  $('#event-scores-container').empty();
  (initialStateHtml.scores || []).forEach((score) => {
    const $selectWrapper = $(`
      <div class="score-select-wrapper">
        <select class="score-select">
          <option value="">選択してください</option>
          ${scoresList
            .map((s) => `<option value="${s.id}">${s.title}</option>`)
            .join('')}
        </select>
        <button class="remove-score">×</button>
      </div>
    `);
    $('#event-scores-container').append($selectWrapper);
  });
  if (!initialStateHtml.scores || !initialStateHtml.scores.length)
    addScoreSelect();

  // 項目復元
  $('#event-items-container').empty();
  (initialStateHtml.items || []).forEach((item) => {
    const $item = createEventItemTemplate();
    $item.find('.event-item-title').val(item.name);

    const $choices = $item.find('.event-choices').empty();
    (item.choices || []).forEach((choice, idx) => {
      $choices.append(choiceTemplate(idx + 1));
      $choices.find('.event-choice').last().val(choice);
    });

    $('#event-items-container').append($item);
  });

  utils.clearErrors();
}

//==================================
// イベントデータ収集
//==================================
async function collectEventData(mode) {
  const eventData = {
    name: $('#event-title').val().trim(),
    description: $('#event-description').val().trim(),
    date: $('#event-date').val(), // yyyy.MM.dd形式で取得
    placeName: $('#event-place-name').val().trim(),
    placeURL: $('#event-place-url').val().trim(),
    parking: $('#event-parking').val().trim(),
    schedule: $('#event-schedule').val().trim(),
    dress: $('#event-dress').val().trim(),
    other: $('#event-other').val().trim(),
    isActive: $('#event-attendance').prop('checked'),
    scores: [],
    items: [], // 既存の項目・選択肢
    createdAt: utils.serverTimestamp(),
  };

  // scores取得（プルダウン複数）
  $('#event-scores-container select').each(function () {
    const val = $(this).val();
    if (val) eventData.scores.push(val);
  });

  // 既存項目の収集
  $('#event-items-container .event-item').each(function () {
    const itemName = $(this).find('.event-item-title').val().trim();
    if (!itemName) return;

    const itemObj = { name: itemName, choices: [] };
    $(this)
      .find('.event-choice')
      .each(function () {
        const choiceName = $(this).val().trim();
        if (choiceName) itemObj.choices.push({ name: choiceName });
      });

    eventData.items.push(itemObj);
  });

  return eventData;
}

//==================================
// 入力チェック
//==================================
function validateEventData() {
  let isValid = true;
  utils.clearErrors(); // 既存エラー解除

  // --- 基本情報チェック ---
  const title = $('#event-title').val().trim();
  const description = $('#event-description').val().trim();
  if (!title)
    utils.markError($('#event-title'), '必須項目です'), (isValid = false);
  if (!description)
    utils.markError($('#event-description'), '必須項目です'), (isValid = false);

  // --- 追加項目チェック ---
  const date = $('#event-date').val().trim();
  if (!date)
    utils.markError($('#event-date'), '必須項目です'), (isValid = false);

  const placeName = $('#event-place-name').val().trim();
  if (!placeName)
    utils.markError($('#event-place-name'), '必須項目です'), (isValid = false);

  const scoreValues = $('#event-scores-container select')
    .map((i, el) => $(el).val())
    .get()
    .filter((v) => v); // 空は除外

  if (!scoreValues.length) {
    $('#event-scores-container').after(
      '<div class="error-message">やる曲を1つ以上選択してください</div>'
    );
    isValid = false;
  }
  if (new Set(scoreValues).size !== scoreValues.length) {
    $('#event-scores-container').after(
      '<div class="error-message">やる曲が重複しています</div>'
    );
    isValid = false;
  }

  // --- 項目名チェック ---
  const itemNames = [];
  $('#event-items-container .event-item').each(function () {
    const $item = $(this).find('.event-item-title');
    const name = $item.val().trim();

    if (!name) return utils.markError($item, '必須項目です'), (isValid = false);
    if (itemNames.includes(name))
      return (
        utils.markError($item, '項目名が重複しています'), (isValid = false)
      );

    itemNames.push(name);
  });
  if (!itemNames.length) {
    $('#event-items-container').before(
      '<div class="error-message">項目を1つ以上追加してください</div>'
    );
    isValid = false;
  }

  // --- 選択肢チェック ---
  $('#event-items-container .event-item').each(function () {
    const choiceNames = [];
    const $choices = $(this).find('.event-choice');
    let hasChoice = false;

    $choices.each(function () {
      const val = $(this).val().trim();
      if (val) {
        hasChoice = true;
        if (choiceNames.includes(val)) isValid = false;
        choiceNames.push(val);
      }
    });

    if (!hasChoice) {
      $(this)
        .find('.event-choices')
        .after(
          '<div class="error-message">選択肢を1つ以上入力してください</div>'
        );
      $choices.addClass('error-field');
      isValid = false;
    }
    if (new Set(choiceNames).size !== choiceNames.length) {
      $(this)
        .find('.event-choices')
        .after('<div class="error-message">選択肢が重複しています</div>');
      $choices.addClass('error-field');
      isValid = false;
    }
  });

  return isValid;
}

// scores用プルダウンを追加
function addScoreSelect() {
  const selectHtml = `
    <div class="score-select-wrapper">
      <select class="score-select">
        <option value="">選択してください</option>
        ${scoresList
          .map((s) => `<option value="${s.id}">${s.title}</option>`)
          .join('')}
      </select>
      <button type="button" class="remove-score">×</button>
    </div>
  `;
  $('#event-scores-container').append(selectHtml);
}
