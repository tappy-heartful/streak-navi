import * as utils from '../common/functions.js';

// グローバル変数
let allAnswers = []; // 日程調整の全回答データを格納する配列

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // パンくずリスト
    utils.renderBreadcrumb([
      { title: 'イベント一覧', url: '../event-list/event-list.html' },
      { title: 'イベント確認' },
    ]);

    await renderEvent();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamEventId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

////////////////////////////
// イベントデータ表示
////////////////////////////
async function renderEvent() {
  const eventId = utils.globalGetParamEventId;
  const isAdmin = utils.isAdmin('Event');
  const uid = utils.getSession('uid');

  // events からデータを取得
  const eventSnap = await utils.getWrapDoc(
    utils.doc(utils.db, 'events', eventId)
  );
  if (!eventSnap.exists()) {
    throw new Error('イベントが見つかりません：' + eventId);
  }
  const eventData = eventSnap.data();

  // 【新規データ構造の判定】回答を受け付けているかどうか
  const isAcceptingResponses =
    eventData.isAcceptingResponses !== undefined
      ? eventData.isAcceptingResponses
      : eventData.attendanceType !== 'none';

  // ------------------------------------------------------------------
  // 回答データ取得（日程調整 or 出欠確認に応じてコレクションを切り替え）
  // ------------------------------------------------------------------
  // attendanceType は、isAcceptingResponsesがfalseでも、schedule/attendance のどちらかを持つ
  const attendanceType = eventData.attendanceType || 'attendance'; // デフォルトは'attendance'
  const isSchedule = attendanceType === 'schedule';
  const answerCollectionName = isSchedule
    ? 'eventAdjustAnswers'
    : 'eventAttendanceAnswers';

  // 自分の回答の存在チェック
  const myAnswerData = await utils.getWrapDoc(
    utils.doc(utils.db, answerCollectionName, `${eventId}_${uid}`)
  );
  const myAnswerExists = myAnswerData.exists();

  // 全回答の取得（回答数のカウント用）
  const answersSnap = await utils.getWrapDocs(
    utils.collection(utils.db, answerCollectionName)
  );
  allAnswers = answersSnap.docs
    .filter((doc) => doc.id.startsWith(eventId + '_'))
    .map((doc) => ({ id: doc.id, ...doc.data() }));
  const answerCount = allAnswers.length;

  // ------------------------------------------------------------------
  // 1. 回答ステータス表示 (answer-status-label) の切り替え
  // ------------------------------------------------------------------
  let statusClass = '';
  let statusText = '';
  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // イベント日付の判定（日程調整の場合は単一の日付は空なのでスキップ）
  const eventDateStr = eventData.date || '';
  let isPast = false;
  if (eventDateStr) {
    const [year, month, day] = eventDateStr.split('.').map(Number);
    const eventDateObj = new Date(year, month - 1, day);
    isPast = eventDateObj < todayOnly;
  }

  if (isPast) {
    // 終了
    statusClass = 'closed';
    statusText = '終了';
    // 【修正箇所 1】attendanceType === 'none' の判定を isAcceptingResponses で行う
  } else if (!isAcceptingResponses) {
    // 回答受付なし
    statusClass = 'closed';
    statusText = '回答を受け付けてません';
  } else if (myAnswerExists) {
    // 回答済
    statusClass = 'answered';
    statusText = '回答済';
  } else {
    // 未回答
    statusClass = 'pending';
    statusText = '未回答';
  }

  $('#answer-status-label')
    .removeClass('pending answered closed')
    .addClass(statusClass)
    .text(statusText);

  // ------------------------------------------------------------------
  // 2. 日付表示の切り替え
  // ------------------------------------------------------------------
  if (isSchedule) {
    // 日程調整の場合: 候補日を表示
    $('#event-date').text('候補日一覧');
    const dates = (eventData.candidateDates || [])
      .map((dateStr) => `・${utils.getDayOfWeek(dateStr)}`)
      .join('\n');
    $('#candidate-dates-display').text(dates || '候補日が設定されていません');
  } else {
    // 出欠確認/受付なしの場合: 単一の日付を表示
    $('#event-date').text(utils.getDayOfWeek(eventData.date_decoded) || '');
    $('#candidate-dates-display').remove();
  }

  // ------------------------------------------------------------------
  // 3. 画面下部の「状況」（旧：出欠）表示の修正
  // ------------------------------------------------------------------
  const $attendanceTitle = $('#event-attendance-title');
  const $attendanceContainer =
    $('#event-attendance').removeClass('label-value');
  $attendanceContainer.empty();

  // 【修正箇所 2】attendanceType === 'none' の判定を isAcceptingResponses で行う
  if (!isAcceptingResponses) {
    $attendanceContainer
      .addClass('label-value')
      .text('回答を受け付けていません');
  } else if (isSchedule) {
    // 日程調整受付中
    $attendanceTitle.text('日程調整');
    // 【修正】回答人数を新しいクラスと文言で表示
    $attendanceContainer
      .addClass('label-value')
      .empty() // 既存のテキストをクリア
      .append(`<span class="answer-count-summary">回答${answerCount}人</span>`);

    // 1. ステータス一覧 (〇, △, ✕) 取得
    const statusesSnap = await utils.getWrapDocs(
      utils.collection(utils.db, 'eventAdjustStatus')
    );
    // doc.id順にソート（〇, △, ✕の順を想定）
    const adjustStatuses = statusesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      });

    // 2. 候補日ごとの回答を集計 (変更なし)
    const dateCounts = {};

    // allAnswers: [{ answers: { "2025.12.01": "statusId", ... }, ... }]
    allAnswers.forEach((answerDoc) => {
      const answers = answerDoc.answers || {};
      for (const date in answers) {
        const statusId = answers[date];
        if (!dateCounts[date]) {
          dateCounts[date] = {};
        }
        dateCounts[date][statusId] = (dateCounts[date][statusId] || 0) + 1;
      }
    });

    // 3. HTMLを生成して表示
    const candidateDates = eventData.candidateDates || [];
    const $table = $('<div class="adjust-table"></div>');

    // ヘッダー行 (日付/曜日のみ) (変更なし)
    const $headerRow = $('<div class="adjust-row header-row"></div>');
    $headerRow.append('<div class="date-cell">日程</div>');
    $headerRow.append('<div class="status-summary-cell">回答</div>');
    $table.append($headerRow);

    // データ行
    candidateDates.forEach((date) => {
      const dayOfWeek = utils.getDayOfWeek(date, true); // 曜日を取得
      const dateParts = date.split('.');
      const monthDay = `${dateParts[1]}/${dateParts[2]}`; // 月/日 形式

      const counts = dateCounts[date] || {};
      let summaryHtml = '';

      // ○△✕ と回答人数を結合
      adjustStatuses.forEach((status) => {
        const count = counts[status.id] || 0;

        let countHtml;
        if (count > 0) {
          // 回答者が1人以上の場合はリンクにする
          countHtml = `<a href="#" 
                            class="status-count adjust-count-link status-${status.name}"
                            data-date="${date}"
                            data-status-id="${status.id}"
                            data-status-name="${status.name}">
                            ${status.name}${count}
                         </a>`;
        } else {
          // 回答者が0の場合はリンクなしの黒テキスト
          countHtml = `<span class="status-count status-count-zero status-${status.name}">
                            ${status.name}${count}
                         </span>`;
        }
        summaryHtml += countHtml;
      });

      const $row = $('<div class="adjust-row"></div>');
      // 日付と曜日
      $row.append(`
            <div class="date-cell">
                <span class="date-part">${monthDay}</span>
                <span class="day-part">(${dayOfWeek})</span>
            </div>
        `);
      // 回答サマリー
      $row.append(`
            <div class="status-summary-cell">
                ${summaryHtml || '<span class="no-answer-text">未回答</span>'}
            </div>
        `);
      $table.append($row);
    });

    $attendanceContainer.append($table);
  } else if (attendanceType === 'attendance') {
    // 出欠受付中
    $attendanceTitle.text('出欠');
    // 【修正】回答人数を新しいクラスと文言で表示
    $attendanceContainer
      .addClass('label-value')
      .html(`<span class="answer-count-summary">回答${answerCount}人</span>`);

    // 従来の出欠確認の回答結果を表示する
    // ステータス一覧取得
    const statusesSnap = await utils.getWrapDocs(
      utils.collection(utils.db, 'attendanceStatuses')
    );
    const statuses = statusesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 全ユーザ情報取得
    const usersSnap = await utils.getWrapDocs(
      utils.collection(utils.db, 'users')
    );
    const users = {};
    usersSnap.docs.forEach((doc) => {
      users[doc.id] = doc.data();
    });

    // 【新規】sectionsコレクションからパート名を取得
    const sectionsSnap = await utils.getWrapDocs(
      utils.collection(utils.db, 'sections')
    );
    const sections = {};
    sectionsSnap.docs.forEach((doc) => {
      sections[doc.id] = doc.data().name || 'パート名なし';
    });

    // ステータスごとに表示
    for (const status of statuses) {
      const $statusBlock = $(`
      <div class="attendance-status-block">
        <h3>${status.name}</h3>
        <div class="status-content"></div>
      </div>
    `);

      const $statusContent = $statusBlock.find('.status-content');

      // このステータスに該当するユーザを抽出
      const filteredAnswers = allAnswers.filter(
        (ans) => ans.status === status.id
      );

      if (filteredAnswers.length === 0) {
        $statusContent.append('<p class="no-user">該当者なし</p>');
      } else {
        // 回答者をパートIDでグルーピング
        const usersBySection = {};
        filteredAnswers.forEach((ans) => {
          const uid = ans.id.replace(eventId + '_', '');
          const user = users[uid];
          if (!user) return;

          const sectionId = user.sectionId || 'unknown'; // sectionIdがない場合は'unknown'
          if (!usersBySection[sectionId]) {
            usersBySection[sectionId] = [];
          }
          usersBySection[sectionId].push(user);
        });

        // パートIDでソート（表示順を安定させるため）
        const sortedSectionIds = Object.keys(usersBySection).sort();

        // グループ化されたパートごとに表示を生成
        for (const sectionId of sortedSectionIds) {
          const sectionName = sections[sectionId] || '未所属';
          const sectionUsers = usersBySection[sectionId];

          // パート名の見出し
          const $sectionBlock = $(`
            <div class="attendance-section-group">
              <h4>${sectionName}</h4>
              <div class="attendance-users"></div>
            </div>
          `);
          const $attendanceUsers = $sectionBlock.find('.attendance-users');

          // ユーザアイテムの生成
          for (const user of sectionUsers) {
            const $userItem = $(`
              <div class="attendance-user small-user">
                <img src="${user.pictureUrl}" alt="${user.displayName}" />
                <span>${user.displayName}</span>
              </div>
            `);

            $attendanceUsers.append($userItem);
          }

          $statusContent.append($sectionBlock);
        }
      }

      $attendanceContainer.append($statusBlock);
    }
  }

  // ------------------------------------------------------------------
  // 4. その他の項目の表示（変更なし）
  // ------------------------------------------------------------------

  $('#event-title').text(eventData.title_decoded || '');

  // 場所（リンク有りならリンク化）
  if (eventData.website) {
    $('#event-place').html(
      `<a href="${eventData.website}" target="_blank" rel="noopener noreferrer">
        ${eventData.placeName || eventData.website}
      </a>`
    );
  } else {
    $('#event-place').text(eventData.placeName_decoded || '');
  }

  // 交通アクセス（URLかテキストか判定）
  if (eventData.access) {
    if (/^https?:\/\//.test(eventData.access)) {
      $('#event-access').html(
        `<a href="${eventData.access}" target="_blank" rel="noopener noreferrer">${eventData.access}</a>`
      );
    } else {
      $('#event-access').html(eventData.access.replace(/\n/g, '<br>'));
    }
  } else {
    $('#event-access').text('');
  }

  // Google Map
  if (eventData.googleMap) {
    $('#event-google-map').html(
      `<a href="${eventData.googleMap}" target="_blank" rel="noopener noreferrer">
        Google Mapで見る
        <i class="fas fa-arrow-up-right-from-square"></i>
      </a>`
    );
  } else {
    $('#event-google-map').text('');
  }

  // やる曲
  $('#event-songs').html(eventData.songs?.replace(/\n/g, '<br>') || '');

  // タイムスケジュール
  $('#event-schedule').html(eventData.schedule?.replace(/\n/g, '<br>') || '');

  // 服装
  $('#event-dress').html(eventData.dress?.replace(/\n/g, '<br>') || '');

  // その他
  $('#event-other').html(eventData.other?.replace(/\n/g, '<br>') || '');

  // ------------------------------------------------------------------
  // 5. 回答メニュー制御
  // ------------------------------------------------------------------
  // 【修正箇所 3】attendanceType === 'none' の判定を isAcceptingResponses で行う
  if (!isAcceptingResponses || isPast) {
    $('#answer-menu').hide();
  } else {
    // 回答済みかどうかの判定を myAnswerExists に変更
    if (myAnswerExists) {
      $('#answer-save-button').text('回答を修正する');
    } else {
      $('#answer-save-button').text('回答する');
      $('#answer-delete-button').hide();
    }
  }

  // 🔽 管理者用メニュー制御
  if (!isAdmin) {
    $('#event-menu').hide();
  }

  setupEventHandlers(eventId, uid, isSchedule); // isScheduleを渡す
}

////////////////////////////
// イベント & 表示制御
////////////////////////////
function setupEventHandlers(eventId, uid, isSchedule) {
  const answerPage = isSchedule
    ? '../event-adjust-answer/event-adjust-answer.html'
    : '../event-attendance-answer/event-attendance-answer.html';
  const answerCollectionName = isSchedule
    ? 'eventAdjustAnswers'
    : 'eventAttendanceAnswers';

  // 回答する
  $('#answer-save-button')
    .off('click')
    .on('click', function () {
      // 遷移先を isSchedule に応じて切り替え
      window.location.href = `${answerPage}?eventId=${eventId}`;
    });

  // 回答削除（自分の回答のみ）
  $('#answer-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog('自分の回答を取り消しますか？');
      if (!confirmed) return;

      try {
        utils.showSpinner();
        // 削除対象のコレクションを answerCollectionName に切り替え
        await utils.deleteDoc(
          utils.doc(utils.db, answerCollectionName, `${eventId}_${uid}`)
        );

        await utils.writeLog({
          dataId: eventId,
          action: '回答削除',
          uid: uid,
        });

        utils.hideSpinner();
        await utils.showDialog('回答を取り消しました', true);
        window.location.reload();
      } catch (e) {
        await utils.writeLog({
          dataId: eventId,
          action: '回答削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        utils.hideSpinner();
      }
    });

  // 投票削除（管理者のみ）
  $('#event-delete-button')
    .off('click')
    .on('click', async function () {
      const confirmed = await utils.showDialog(
        'イベントと全員の回答を削除しますか？\nこの操作は元に戻せません'
      );
      if (!confirmed) return;

      const dialogResultAgain = await utils.showDialog('本当に削除しますか？');
      if (!dialogResultAgain) return;

      try {
        utils.showSpinner();
        await utils.deleteDoc(utils.doc(utils.db, 'events', eventId));

        // eventAttendanceAnswers (出欠確認) の回答を削除
        const answersSnap = await utils.getWrapDocs(
          utils.collection(utils.db, 'eventAttendanceAnswers')
        );
        for (const doc of answersSnap.docs) {
          if (doc.id.startsWith(eventId + '_')) {
            await utils.deleteDoc(
              utils.doc(utils.db, 'eventAttendanceAnswers', doc.id)
            );
          }
        }

        // eventAdjustAnswers (日程調整) の回答も削除
        const adjustAnswersSnap = await utils.getWrapDocs(
          utils.collection(utils.db, 'eventAdjustAnswers')
        );
        for (const doc of adjustAnswersSnap.docs) {
          if (doc.id.startsWith(eventId + '_')) {
            await utils.deleteDoc(
              utils.doc(utils.db, 'eventAdjustAnswers', doc.id)
            );
          }
        }

        // ログ登録
        await utils.writeLog({ dataId: eventId, action: '投票削除' });
        utils.hideSpinner();
        await utils.showDialog('削除しました', true);
        window.location.href = '../event-list/event-list.html';
      } catch (e) {
        // ログ登録
        await utils.writeLog({
          dataId: eventId,
          action: '投票削除',
          status: 'error',
          errorDetail: { message: e.message, stack: e.stack },
        });
      } finally {
        // スピナー非表示
        utils.hideSpinner();
      }
    });

  // 編集
  $('#event-edit-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../event-edit/event-edit.html?mode=edit&eventId=${eventId}`;
    });

  // コピー
  $('#event-copy-button')
    .off('click')
    .on('click', function () {
      window.location.href = `../event-edit/event-edit.html?mode=copy&eventId=${eventId}`;
    });

  // 【イベント登録】日程調整結果のリンククリックイベント
  $(document)
    .off('click', '.adjust-count-link')
    .on('click', '.adjust-count-link', function (e) {
      e.preventDefault();
      const date = $(this).data('date');
      const statusId = String($(this).data('status-id'));
      const statusName = $(this).data('status-name');
      // eventId はこのスコープで利用可能と仮定
      showAdjustUsersModal(eventId, date, statusId, statusName);
    });
}

// 日程調整の回答結果リンククリック時に回答者モーダルを表示する
async function showAdjustUsersModal(eventId, date, statusId, statusName) {
  utils.showSpinner();
  try {
    // 【新規】sectionsコレクションからパート名を取得
    const sectionsSnap = await utils.getWrapDocs(
      utils.collection(utils.db, 'sections')
    );
    const sections = {};
    sectionsSnap.docs.forEach((doc) => {
      sections[doc.id] = doc.data().name || 'パート名なし';
    });

    // 該当する回答者 UID を収集
    const adjustAnswerUids = [];
    // allAnswersはイベントIDのプレフィックスを持つdoc.idを持つ配列と仮定
    allAnswers.forEach((doc) => {
      const answers = doc.answers || {};
      // 特定の日付に対する回答が、指定されたステータスIDと一致するか確認
      if (answers[date] === statusId) {
        // doc.idが "eventId_uid" 形式と仮定
        const uid = doc.id.split('_')[1];
        if (uid) {
          adjustAnswerUids.push(uid);
        }
      }
    });

    // users コレクションから情報取得し、パートIDでグルーピング
    const usersBySection = {};
    for (const uid of adjustAnswerUids) {
      const userSnap = await utils.getWrapDoc(
        utils.doc(utils.db, 'users', uid)
      );
      let userData;
      if (userSnap.exists()) {
        userData = userSnap.data();
      } else {
        // 退会済みユーザのデータ
        userData = {
          displayName: '退会済みユーザ',
          pictureUrl: utils.globalBandLogoImage,
          sectionId: 'retired', // 仮のセクションID
        };
      }

      const sectionId = userData.sectionId || 'unknown';
      if (!usersBySection[sectionId]) {
        usersBySection[sectionId] = [];
      }
      usersBySection[sectionId].push(userData);
    }

    // モーダルに描画
    let modalBody = '';
    const sortedSectionIds = Object.keys(usersBySection).sort();

    for (const sectionId of sortedSectionIds) {
      const sectionName = sections[sectionId] || '未所属';
      const sectionUsers = usersBySection[sectionId];

      // パートごとのブロックを構築 (出欠確認の表示と同じ構造を使用)
      let userItemsHtml = '';
      for (const user of sectionUsers) {
        // 小型化のために small-user クラスを付与
        userItemsHtml += `
          <div class="attendance-user small-user">
            <img src="${user.pictureUrl}" alt="${user.displayName}" class="voter-icon"
              onerror="this.onerror=null; this.src='${utils.globalLineDefaultImage}';"/>
            <span>${user.displayName}</span>
          </div>
        `;
      }

      // パートグループのHTML
      modalBody += `
        <div class="attendance-section-group">
          <h4>${sectionName}</h4>
          <div class="attendance-users">${userItemsHtml}</div>
        </div>
      `;
    }

    // 日付を "MM/DD" 形式に整形
    const [y, m, d] = date.split('.');
    const displayDate = `${m}/${d}(${utils.getDayOfWeek(date, true)})`;

    utils.hideSpinner();
    // モーダルコンテンツは、パート表示を包含するdivでラップされていないため、そのまま `modalBody` を渡します。
    await utils.showModal(`${displayDate} ${statusName}の人`, modalBody);
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: eventId,
      action: '日程回答者確認',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
}
