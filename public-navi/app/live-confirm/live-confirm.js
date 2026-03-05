import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([
      { title: 'ライブ一覧', url: '../live-list/live-list.html' },
      { title: 'ライブ確認' },
    ]);
    await renderLive();
  } catch (e) {
    await utils.writeLog({
      dataId: utils.globalGetParamLiveId,
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

async function renderLive() {
  const liveId = utils.globalGetParamLiveId;

  const liveSnap = await utils.getWrapDoc(utils.doc(utils.db, 'lives', liveId));
  if (!liveSnap.exists()) {
    throw new Error('ライブ情報が見つかりません：' + liveId);
  }

  const data = liveSnap.data();

  // 基本情報の描画（既存）
  if (data.flyerUrl) $('#live-flyer').attr('src', data.flyerUrl).show();
  $('#live-title').text(data.title || '');
  $('#live-date').text(
    `${data.date} (${utils.getDayOfWeek(data.date, true)})` || '',
  );
  $('#live-open').text(data.open || '--:--');
  $('#live-start').text(data.start || '--:--');
  $('#live-venue').text(data.venue || '');

  let venueLinks = '';
  if (data.venueUrl)
    venueLinks += `<a href="${data.venueUrl}" target="_blank"><i class="fas fa-external-link-alt"></i>会場HP</a>`;
  if (data.venueGoogleMap)
    venueLinks += `<a href="${data.venueGoogleMap}" target="_blank"><i class="fas fa-map-marker-alt"></i>Google Map</a>`;
  $('#live-venue-links').html(venueLinks);

  $('#live-advance').text(data.advance || '未設定');
  $('#live-door').text(data.door || '未設定');
  $('#live-isAcceptReserve').text(
    data.isAcceptReserve ? '予約受付対象' : '予約不可',
  );
  $('#live-reserve-term').text(
    `${data.acceptStartDate || '未設定'} ～ ${data.acceptEndDate || ''}`,
  );
  $('#live-stock').text(
    `${data.totalReserved || 0} / ${data.ticketStock || 0}`,
  );
  $('#live-maxCompanions').text(data.maxCompanions || 0);
  $('#live-notes').text(data.notes || '');

  if (utils.isAdmin('Live')) {
    $('.confirm-buttons').show();
  }

  await renderAnalysis(liveId, data.totalReserved || 0);
  await renderEnqueteAnalysis(liveId);
  setupEventHandlers(liveId);
}

// ライブ分析の描画処理
async function renderAnalysis(liveId, totalReserved) {
  try {
    const checkInsRef = utils.collection(utils.db, 'checkIns');
    const q = utils.query(checkInsRef, utils.where('liveId', '==', liveId));
    const snap = await utils.getWrapDocs(q);

    const allCheckIns = snap.docs.map((doc) => doc.data());
    const doorCheckIns = allCheckIns.filter((c) => c.type === 'door');
    const reserveCheckIns = allCheckIns.filter((c) => c.type !== 'door');

    const totalEntry = allCheckIns.length;
    const doorCount = doorCheckIns.length;
    const reserveCount = reserveCheckIns.length;

    // 予約来場率（予約数0の場合は0%）
    const checkInRate =
      totalReserved > 0 ? Math.round((reserveCount / totalReserved) * 100) : 0;

    // 数値を表示
    $('#stat-total-entry').text(`${totalEntry} 名`);
    $('#stat-reserve-checkin').text(`${reserveCount} 名`);
    $('#stat-door-count').text(`${doorCount} 名`);
    $('#stat-checkin-rate').text(`${checkInRate} %`);
    $('#analysis-section').fadeIn();

    // グラフ描画 (Chart.js)
    const ctx = document.getElementById('checkin-chart').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['予約来場', '当日受付', '未来場(予約中)'],
        datasets: [
          {
            data: [
              reserveCount,
              doorCount,
              Math.max(0, totalReserved - reserveCount),
            ],
            backgroundColor: ['#e91e63', '#4caf50', '#ddd'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        cutout: '70%',
      },
    });
  } catch (e) {
    console.error('Analysis Error:', e);
  }
}
// renderLive内の管理者チェック後に追加
// await renderEnqueteAnalysis(liveId);

async function renderEnqueteAnalysis(liveId) {
  try {
    // 1. 質問設定と回答データの取得
    const [qSnap, aSnap] = await Promise.all([
      utils.getWrapDoc(utils.doc(utils.db, 'configs', 'enqueteQuestions')),
      utils.getWrapDocs(
        utils.query(
          utils.collection(utils.db, 'enqueteAnswers'),
          utils.where('liveId', '==', liveId),
        ),
      ),
    ]);

    if (!qSnap.exists() || aSnap.empty) return;

    const questions = qSnap.data().questions;
    const allAnswers = aSnap.docs.map((doc) => doc.data().common);
    $('#enquete-section').show();

    const $statsContainer = $('#enquete-stats-container').empty();
    const $textContainer = $('#enquete-text-answers').empty();

    questions.forEach((q) => {
      const answersForQ = allAnswers
        .map((a) => a[q.id])
        .filter((v) => v !== undefined && v !== '');

      if (q.type === 'rating') {
        renderRatingStats($statsContainer, q, answersForQ);
      } else if (q.type === 'radio') {
        renderRadioStats($statsContainer, q, answersForQ);
      } else if (q.type === 'textarea' || q.type === 'text') {
        renderTextAnswers($textContainer, q, answersForQ);
      }
    });
  } catch (e) {
    console.error('Enquete Analysis Error:', e);
  }
}

function renderRatingStats($container, q, answers) {
  const avg = answers.length
    ? (answers.reduce((a, b) => a + b, 0) / answers.length).toFixed(1)
    : 0;
  const counts = [0, 0, 0, 0, 0]; // 1-5のカウント
  answers.forEach((v) => counts[v - 1]++);

  const html = `
    <div class="enquete-stat-card">
      <div class="stat-header">
        <span class="question-label">${q.label}</span>
        <span class="avg-badge">${avg}</span>
      </div>
      <div class="rating-bar-group">
        ${counts
          .reverse()
          .map((count, i) => {
            const num = 5 - i;
            const percent = answers.length ? (count / answers.length) * 100 : 0;
            return `
            <div class="rating-bar-row">
              <span class="star-num">${num}★</span>
              <div class="bar-bg"><div class="bar-fill" style="width: ${percent}%"></div></div>
              <span class="count-num">${count}</span>
            </div>`;
          })
          .join('')}
      </div>
    </div>`;
  $container.append(html);
}

function renderRadioStats($container, q, answers) {
  const html = `
    <div class="enquete-stat-card">
      <div class="stat-header"><span class="question-label">${q.label}</span></div>
      <div class="radio-stats">
        ${q.options
          .map((opt) => {
            const count = answers.filter((a) => a === opt).length;
            const percent = answers.length ? (count / answers.length) * 100 : 0;
            return `
            <div class="radio-row">
              <div class="radio-info"><span>${opt}</span><span>${count}票</span></div>
              <div class="bar-bg"><div class="bar-fill" style="width: ${percent}%; background: #4caf50;"></div></div>
            </div>`;
          })
          .join('')}
      </div>
    </div>`;
  $container.append(html);
}

function renderTextAnswers($container, q, answers) {
  if (answers.length === 0) return;
  const html = `
    <div class="text-answer-group">
      <h4>${q.label}</h4>
      ${answers.map((a) => `<div class="feedback-card">${a}</div>`).join('')}
    </div>`;
  $container.append(html);
}

function setupEventHandlers(liveId) {
  $('#live-edit-button').on('click', () => {
    window.location.href = `../live-edit/live-edit.html?mode=edit&liveId=${liveId}`;
  });
  $('#live-copy-button').on('click', () => {
    window.location.href = `../live-edit/live-edit.html?mode=copy&liveId=${liveId}`;
  });
  $('#live-delete-button').on('click', async () => {
    const confirmed = await utils.showDialog(
      'このライブ情報を削除しますか？\n予約データ等も確認の上、実行してください。',
    );
    if (!confirmed) return;
    try {
      utils.showSpinner();
      await utils.archiveAndDeleteDoc('lives', liveId);
      await utils.writeLog({ dataId: liveId, action: 'ライブ削除' });
      await utils.showDialog('削除しました', true);
      window.location.href = '../live-list/live-list.html';
    } catch (e) {
      console.error(e);
      await utils.showDialog('削除に失敗しました');
    } finally {
      utils.hideSpinner();
    }
  });
}
