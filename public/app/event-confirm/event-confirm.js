import * as utils from '../common/functions.js';

// グローバル変数
let allAnswers = []; // 日程調整の全回答データを格納する配列
let allUsers = {}; // 全ユーザデータを格納するオブジェクト
let allUserUids = []; // 全ユーザUIDの配列
let sections = {}; // 全パートデータを格納するオブジェクト
let unansweredUids = []; // 未回答者のUIDを格納する配列
// 【新規】録音・録画リンクのグローバル変数
let allRecordings = [];
let allScores = {}; // 【変更】全スコア（曲）データを格納するオブジェクト

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

  // ------------------------------------------------------------------
  // 共通データ取得 (全ユーザ、全パート、全曲)
  // ------------------------------------------------------------------
  const usersSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'users')
  );
  allUsers = {};
  usersSnap.docs.forEach((doc) => {
    allUsers[doc.id] = doc.data();
  });
  allUserUids = Object.keys(allUsers); // 全ユーザのUIDリスト

  const sectionsSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'sections')
  );
  sections = {};
  sectionsSnap.docs.forEach((doc) => {
    sections[doc.id] = doc.data().name || 'パート名なし';
  });

  // 【修正】全スコア（曲）データの取得
  const scoresSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'scores') // 💡 scoresコレクションに変更
  );
  allScores = {}; // 💡 allSongs から allScores に変数名を変更 (または既存の allSongs を上書き)
  scoresSnap.docs.forEach((doc) => {
    allScores[doc.id] = doc.data();
  });

  // ------------------------------------------------------------------

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

  // 受付中かどうかを判定(出欠回答は無条件OK)
  const isInTerm =
    !isSchedule ||
    utils.isInTerm(eventData.acceptStartDate, eventData.acceptEndDate);

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
  // 未回答者のUIDリスト作成
  // ------------------------------------------------------------------
  const answeredUids = allAnswers.map((doc) => doc.id.split('_')[1]);
  unansweredUids = allUserUids.filter((u) => !answeredUids.includes(u));
  const unansweredCount = unansweredUids.length;
  // ------------------------------------------------------------------

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
  } else if (!isAcceptingResponses || !isInTerm) {
    // 回答受付なし(受け付けてない、または日程調整期間外)
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

  if (isSchedule) {
    // 受付期間
    $('#event-acceept-term').text(
      `${
        eventData.acceptStartDate
          ? utils.getDayOfWeek(eventData.acceptStartDate_decoded)
          : ''
      } ～
        ${
          eventData.acceptEndDate
            ? utils.getDayOfWeek(eventData.acceptEndDate_decoded)
            : ''
        }`
    );
    // 日程調整受付中
    $attendanceTitle.text('日程調整');
    // 回答人数と未回答人数を新しいクラスと文言で表示
    $attendanceContainer
      .addClass('label-value')
      .empty() // 既存のテキストをクリア
      .append(
        `<span class="answer-count-summary">回答${answerCount}人 (未回答${unansweredCount}人)</span>`
      );

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

    // 【新規】未回答ステータスを追加
    const UNA_STATUS_ID = 'unanswered';
    const UNA_STATUS_NAME = '未';

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

      // 【新規】未回答者のリンクを追加
      let unansweredHtml;
      if (unansweredCount > 0) {
        unansweredHtml = `<a href="#" 
                            class="status-count adjust-count-link status-unanswered"
                            data-date="${date}"
                            data-status-id="${UNA_STATUS_ID}"
                            data-status-name="${UNA_STATUS_NAME}">
                            ${UNA_STATUS_NAME}${unansweredCount}
                         </a>`;
      } else {
        unansweredHtml = `<span class="status-count status-count-zero status-unanswered">
                            ${UNA_STATUS_NAME}${unansweredCount}
                         </span>`;
      }
      summaryHtml += unansweredHtml;

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
    // 日程調整受付期間は非表示
    $('#event-acceept-term-group').hide();
    // 出欠受付中
    $attendanceTitle.text('出欠');
    // 回答人数と未回答人数を新しいクラスと文言で表示
    $attendanceContainer
      .addClass('label-value')
      .html(
        `<span class="answer-count-summary">回答${answerCount}人 (未回答${unansweredCount}人)</span>`
      );

    // 従来の出欠確認の回答結果を表示する
    // ステータス一覧取得
    const statusesSnap = await utils.getWrapDocs(
      utils.collection(utils.db, 'attendanceStatuses')
    );
    const statuses = statusesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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
          const user = allUsers[uid]; // 全ユーザ情報から取得
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
          const sectionName = sections[sectionId] || '❓未設定';
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

    // 【新規】未回答者を見るボタンを追加
    if (unansweredCount > 0) {
      const $unansweredButton = $(
        '<button id="unanswered-button" class="action-button small-button">未回答者を見る</button>'
      );
      $attendanceContainer.append($unansweredButton);
    }
  }
  // ------------------------------------------------------------------
  // 【新規】6. 録音・録画リンクの取得と表示
  // ------------------------------------------------------------------
  const recordingsSnap = await utils.getWrapDocs(
    utils.query(
      utils.collection(utils.db, 'eventRecordings'),
      utils.where('eventId', '==', eventId),
      utils.orderBy('createdAt', 'asc') // 登録日時順にソート（任意）
    )
  );
  allRecordings = recordingsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  renderRecordings(eventId, uid, isAdmin);

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
  // ... renderEvent 関数の途中 ...

  // やる曲
  // ------------------------------------------------------------------
  // 🔽 【修正】やる曲をグループごとに表示するロジック (scoresコレクション対応)
  // ------------------------------------------------------------------
  // 🚨 注意: このロジックは、全スコアデータ allScores がグローバルに利用可能であることを前提としています。

  try {
    // songsDataは、編集画面から保存されたJSON文字列を想定
    const setlistGroups = eventData.setlist;
    let songsHtml = '';

    // 【新規追加】YouTubeプレイリスト用のIDリストを保持する配列
    let allWatchIds = [];

    if (Array.isArray(setlistGroups) && setlistGroups.length > 0) {
      setlistGroups.forEach((group) => {
        // 編集画面のデータ構造に合わせる: groupName -> title, songs -> songIds
        const groupTitle = group.title || '';

        let songListHtml = '';

        if (Array.isArray(group.songIds)) {
          songListHtml = group.songIds
            .map((songId) => {
              // 💡 allScores からデータを取得し、titleフィールドを参照
              const scoreData = allScores[songId];

              if (scoreData) {
                // 1. 譜面情報への参照リンクの作成
                let songNameHtml = scoreData.title;
                const scoreUrl = scoreData.scoreUrl; // 譜面URLフィールドを仮定

                if (scoreUrl) {
                  songNameHtml = `
                    <a href="${scoreUrl}" target="_blank" rel="noopener noreferrer" class="score-link">
                      ${scoreData.title}
                    </a>
                  `;
                }

                // 2. YouTubeプレイリスト用のIDを収集
                if (scoreData.referenceTrack) {
                  const videoId = utils.extractYouTubeId(
                    scoreData.referenceTrack
                  );
                  if (videoId) {
                    allWatchIds.push(videoId);
                  }
                }

                return songNameHtml;
              } else {
                return '曲名が見つかりません';
              }
            })
            .join('<br>'); // 曲名を改行で連結
        }

        if (groupTitle || songListHtml) {
          // グループ名か曲リストのいずれかがあれば表示
          // グループ名と曲名をHTMLに追記
          songsHtml += `
          <div class="setlist-group-confirm">
            <h4>${groupTitle}</h4>
            <div class="setlist-songs">${
              songListHtml || '曲が設定されていません'
            }</div>
          </div>
        `;
        }
      });

      // 3. #event-songs にHTMLを設定
      $('#event-songs').html(songsHtml);

      // 4. YouTubeプレイリストリンクの処理
      if (allWatchIds.length > 0) {
        // 重複を削除してユニークなIDリストにする
        const uniqueWatchIds = [...new Set(allWatchIds)];
        const videoIdsString = uniqueWatchIds.join(',');

        $('#playlist-link')
          .attr(
            'href',
            `https://www.youtube.com/watch_videos?video_ids=${videoIdsString}`
          )
          .show();
      } else {
        // やる曲はあるが、YouTube URLがない場合は非表示
        $('#playlist-link').hide();
      }
    } else {
      // JSONとしてパースできなかった場合、または空の場合
      $('#event-songs').text('設定されていません');
      // やる曲がないため非表示
      $('#playlist-link').hide();
    }
  } catch (e) {
    // JSONパースエラーが発生した場合（旧データ形式の可能性など）
    // 従来通り、テキストとして表示するフォールバック処理
    console.error('Error parsing setlist JSON or rendering songs:', e);
    $('#event-songs').html(
      eventData.songs?.replace(/\n/g, '<br>') || '設定されていません'
    );
    // エラーが発生した場合も非表示
    $('#playlist-link').hide();
  }

  // タイムスケジュール
  $('#event-schedule').html(eventData.schedule?.replace(/\n/g, '<br>') || '');

  // 服装
  $('#event-dress').html(eventData.dress?.replace(/\n/g, '<br>') || '');

  // 個人で持ってくるもの
  $('#event-bring').html(eventData.bring?.replace(/\n/g, '<br>') || '');

  // 施設に借りるもの
  $('#event-rent').html(eventData.rent?.replace(/\n/g, '<br>') || '');

  // 🔽 【新規追加】楽器構成の表示
  await renderInstrumentConfig(eventData.instrumentConfig);

  // 譜割
  if (eventData.allowAssign) {
    $('#event-asssign').html(
      `<a href="../assign-confirm/assign-confirm.html?eventId=${eventId}" target="_blank" rel="noopener noreferrer">
        譜割りを見る<i class="fas fa-arrow-up-right-from-square"></i>
      </a>`
    );
  } else {
    $('#event-asssign-group').hide();
  }

  // その他
  $('#event-other').html(eventData.other?.replace(/\n/g, '<br>') || '');

  // ------------------------------------------------------------------
  // 5. 回答メニュー制御
  // ------------------------------------------------------------------
  if (!isAcceptingResponses || isPast || !isInTerm) {
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

// ------------------------------------------------------------------
// 【新規関数】録音・録画リンク一覧の表示
// ------------------------------------------------------------------
function renderRecordings(eventId, currentUid, isAdmin) {
  const $container = $('#recording-list').empty();

  if (allRecordings.length === 0) {
    $container.html('<p class="no-user">登録されたリンクはありません。</p>');
  } else {
    const $ul = $('<ul class="recording-list-ul"></ul>');
    allRecordings.forEach((recording) => {
      const registeredUser = allUsers[recording.uid]
        ? allUsers[recording.uid].displayName
        : '退会済み';
      // 削除できる条件：管理者 OR 登録した本人
      const canDelete = isAdmin || recording.uid === currentUid;

      const deleteButton = canDelete
        ? `<button class="delete-recording-btn small-button" data-recording-id="${recording.id}">
                      <i class="fas fa-trash-alt"></i>
                   </button>`
        : '';

      const $li = $(`
                <li>
                    <a href="${recording.url}" target="_blank" rel="noopener noreferrer" class="recording-link" title="${recording.url}">
                        <i class="fas fa-play-circle"></i> ${recording.title}
                    </a>
                    <span class="registered-by">by ${registeredUser}</span>
                    ${deleteButton}
                </li>
            `);
      $ul.append($li);
    });
    $container.append($ul);
  }
}

////////////////////////////
// 楽器構成データ表示 (修正)
////////////////////////////
async function renderInstrumentConfig(configData) {
  const $configDiv = $('#instrument-config');

  if (!configData || Object.keys(configData).length === 0) {
    $configDiv.text('未設定');
    return;
  }

  let configHtml = '';

  // sectionsコレクションから全てのセクションを取得
  const sectionSnap = await utils.getWrapDocs(
    utils.collection(utils.db, 'sections')
  );

  // セクションデータをIDでルックアップできるように整形（IDが99のものを除外）
  const sectionsMap = new Map();
  sectionSnap.docs
    .filter((doc) => doc.id !== utils.globalStrUnset)
    .forEach((doc) => {
      sectionsMap.set(doc.id, doc.data().name_decoded || doc.data().name);
    });

  // データをセクションID順にソートして処理
  const sortedSectionIds = Object.keys(configData).sort((a, b) => {
    return parseInt(a, 10) - parseInt(b, 10);
  });

  for (const sectionId of sortedSectionIds) {
    const parts = configData[sectionId];
    const sectionName = sectionsMap.get(sectionId);

    // partNameのみを抽出し、「、」で連結
    const partNames = parts
      .map((p) => p.partName)
      .filter((name) => name) // 空のパート名を除外
      .join('、');

    if (sectionName && partNames) {
      // 🔽 修正: セクション名を太字にして改行し、パート名を表示
      configHtml += `
        <strong>${sectionName}</strong><br>
        ${partNames}<br><br>
      `;
    }
  }

  // 末尾の不要な改行タグを削除してセット
  $configDiv.html(configHtml.trim().replace(/<br><br>$/, ''));
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
        await utils.archiveAndDeleteDoc(
          answerCollectionName,
          `${eventId}_${uid}`
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
        await utils.archiveAndDeleteDoc('events', eventId);

        // eventAttendanceAnswers (出欠確認) の回答を削除
        const answersSnap = await utils.getWrapDocs(
          utils.collection(utils.db, 'eventAttendanceAnswers')
        );
        for (const doc of answersSnap.docs) {
          if (doc.id.startsWith(eventId + '_')) {
            await utils.archiveAndDeleteDoc('eventAttendanceAnswers', doc.id);
          }
        }

        // eventAdjustAnswers (日程調整) の回答も削除
        const adjustAnswersSnap = await utils.getWrapDocs(
          utils.collection(utils.db, 'eventAdjustAnswers')
        );
        for (const doc of adjustAnswersSnap.docs) {
          if (doc.id.startsWith(eventId + '_')) {
            await utils.archiveAndDeleteDoc('eventAdjustAnswers', doc.id);
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

  // 【イベント登録】出欠確認の未回答者ボタンクリックイベント
  $('#unanswered-button')
    .off('click')
    .on('click', function () {
      showUnansweredUsersModal(eventId, '出欠');
    });

  // 【新規】録音・録画リンク登録ボタン
  $('#add-recording-button')
    .off('click')
    .on('click', function () {
      showRecordingModal(eventId, uid);
    });

  // 【新規】録音・録画リンク削除ボタン
  $(document)
    .off('click', '.delete-recording-btn')
    .on('click', '.delete-recording-btn', async function (e) {
      e.preventDefault(); // リンク要素ではないが、念のためデフォルト動作を防止

      // 💡 修正点: クリックされた要素から、最も近い親/自身の .delete-recording-btn を取得
      const $targetButton = $(this).closest('.delete-recording-btn');
      const recordingId = $targetButton.data('recording-id');

      // recordingId が undefined でないかチェック (ロジックをより堅牢にするため)
      if (!recordingId) {
        console.error(
          'Recording ID is missing on the delete button.',
          $targetButton[0]
        );
        await utils.showDialog(
          '削除対象のデータが特定できませんでした。',
          true
        );
        return;
      }

      await deleteRecordingLink(eventId, recordingId, uid);
    });
}

// 日程調整の回答結果リンククリック時に回答者モーダルを表示する
async function showAdjustUsersModal(eventId, date, statusId, statusName) {
  utils.showSpinner();
  try {
    let targetUids = [];
    let modalTitle = '';

    const UNA_STATUS_ID = 'unanswered';

    if (statusId === UNA_STATUS_ID) {
      // 未回答者の場合
      targetUids = unansweredUids; // グローバル変数から取得
      modalTitle = `未回答の人`;
    } else {
      // 〇, △, ✕ の回答者の場合
      modalTitle = `${statusName}の人`;

      // 該当する回答者 UID を収集
      // allAnswers: イベントIDのプレフィックスを持つdoc.idを持つ配列と仮定
      allAnswers.forEach((doc) => {
        const answers = doc.answers || {};
        // 特定の日付に対する回答が、指定されたステータスIDと一致するか確認
        if (answers[date] === statusId) {
          // doc.idが "eventId_uid" 形式と仮定
          const uid = doc.id.split('_')[1];
          if (uid) {
            targetUids.push(uid);
          }
        }
      });
    }

    // 日付を "MM/DD" 形式に整形
    const [y, m, d] = date.split('.');
    const displayDate = `${m}/${d}(${utils.getDayOfWeek(date, true)})`;
    modalTitle = `${displayDate} ${modalTitle}`;

    // モーダルに描画
    const modalBody = await buildUsersModalBody(targetUids);

    utils.hideSpinner();
    await utils.showModal(modalTitle, modalBody);
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

// 出欠確認の未回答者ボタンクリック時に回答者モーダルを表示する
async function showUnansweredUsersModal(eventId, eventType) {
  utils.showSpinner();
  try {
    // モーダルに描画
    const modalTitle = `${eventType} 未回答者`;
    const modalBody = await buildUsersModalBody(unansweredUids);

    utils.hideSpinner();
    await utils.showModal(modalTitle, modalBody);
  } catch (e) {
    // ログ登録
    await utils.writeLog({
      dataId: eventId,
      action: '出欠未回答者確認',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
}

// UIDリストをパート別にグルーピングし、モーダルボディのHTMLを生成する共通関数
async function buildUsersModalBody(uids) {
  const usersBySection = {};

  // allUsers (グローバル変数) から情報を取得し、パートIDでグルーピング
  for (const uid of uids) {
    let userData = allUsers[uid];

    if (!userData) {
      // 退会済みユーザのデータ
      userData = {
        displayName: '退会済みユーザ',
        pictureUrl: utils.globalLineDefaultImage,
        sectionId: 'retired', // 仮のセクションID
      };
    }

    const sectionId = userData.sectionId || 'unknown';
    if (!usersBySection[sectionId]) {
      usersBySection[sectionId] = [];
    }
    usersBySection[sectionId].push(userData);
  }

  let modalBody = '';
  // sections (グローバル変数) のキーを元にソートし、表示順を安定させる
  const sortedSectionIds = Object.keys(sections).sort();

  // 未所属/退会済みを最後に表示するために、一時的に分離
  const miscSectionIds = ['unknown', 'retired'].filter(
    (id) => usersBySection[id]
  );
  const displaySectionIds = sortedSectionIds
    .filter((id) => !miscSectionIds.includes(id))
    .concat(miscSectionIds);

  if (displaySectionIds.length === 0) {
    return `<div class="empty-message-modal">該当者はいません。</div>`;
  }

  for (const sectionId of displaySectionIds) {
    const sectionName = sections[sectionId] || '❓未設定';
    const sectionUsers = usersBySection[sectionId];

    if (!sectionUsers) continue; // 該当ユーザがいなければスキップ

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

  return modalBody;
}
// ------------------------------------------------------------------
// 【新規関数】リンク登録モーダル表示
// ------------------------------------------------------------------
// event-confirm.js 内の showRecordingModal 関数 (修正後)

async function showRecordingModal(eventId, uid) {
  const modalTitle = '録音・録画リンクの登録';
  const modalBody = `
        <div class="form-group">
            <label for="recording-title" class="modal-label">タイトル <span class="required">*</span></label>
            <input type="text" id="recording-title" class="form-control" placeholder="例: 練習/ライブ 通し録音" required>
        </div>
        <div class="form-group">
            <label for="recording-url" class="modal-label">URL (リンク先) <span class="required">*</span></label>
            <input type="text" id="recording-url" class="form-control" placeholder="https://youtube.com/..." required>
        </div>
        <p class="modal-note">※ YouTube, Google Drive, Dropboxなどの公開リンクを登録してください。</p>
    `;

  // showModalの返り値がオブジェクトになることを想定して受け取る
  const result = await utils.showModal(
    modalTitle,
    modalBody,
    '登録',
    'キャンセル'
  );

  // result は { success: true, data: { 'recording-title': '...', 'recording-url': '...' } } または false
  if (result && result.success) {
    const title = result.data['recording-title'];
    const url = result.data['recording-url'];

    if (!title || !url) {
      await utils.showDialog('タイトルとURLは必須です。', true);
      return;
    }

    await saveRecordingLink(eventId, uid, title, url);
  }
}

// ------------------------------------------------------------------
// 【新規関数】リンク登録処理
// ------------------------------------------------------------------
async function saveRecordingLink(eventId, uid, title, url) {
  utils.showSpinner();
  try {
    const newDocRef = utils.doc(utils.collection(utils.db, 'eventRecordings'));

    await utils.setDoc(newDocRef, {
      eventId: eventId,
      uid: uid,
      title: title,
      url: url,
      createdAt: utils.serverTimestamp(),
    });

    await utils.writeLog({
      dataId: eventId,
      action: '録音・録画リンク登録',
      uid: uid,
    });

    utils.hideSpinner();
    await utils.showDialog('リンクを追加しました', true);
    window.location.reload();
  } catch (e) {
    await utils.writeLog({
      dataId: eventId,
      action: '録音・録画リンク登録',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
    utils.hideSpinner();
    await utils.showDialog('追加に失敗しました', true);
  }
}

// ------------------------------------------------------------------
// 【新規関数】リンク削除処理
// ------------------------------------------------------------------
async function deleteRecordingLink(eventId, recordingId, currentUid) {
  const isAdmin = utils.isAdmin('Event');

  // 削除権限のチェック (念のためサーバー側でもチェックが必要ですが、UI側で制御)
  const targetRecording = allRecordings.find((r) => r.id === recordingId);
  if (!targetRecording) return;
  if (!isAdmin && targetRecording.uid !== currentUid) {
    await utils.showDialog('このリンクを削除する権限がありません。', true);
    return;
  }

  const confirmed = await utils.showDialog(
    `リンク「${targetRecording.title}」を削除しますか？`
  );
  if (!confirmed) return;

  utils.showSpinner();
  try {
    await utils.archiveAndDeleteDoc('eventRecordings', recordingId);

    await utils.writeLog({
      dataId: eventId,
      action: '録音・録画リンク削除',
      uid: currentUid,
    });

    utils.hideSpinner();
    await utils.showDialog('リンクを削除しました', true);
    window.location.reload();
  } catch (e) {
    await utils.writeLog({
      dataId: eventId,
      action: '録音・録画リンク削除',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
    utils.hideSpinner();
    await utils.showDialog('削除に失敗しました', true);
  }
}
