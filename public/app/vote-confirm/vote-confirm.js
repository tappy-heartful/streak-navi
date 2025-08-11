import * as utils from '../common/functions.js';
$(document).ready(async function () {
  await utils.initDisplay();
  renderVote();
  setupEventHandlers();
  // スピナー非表示
  utils.hideSpinner();
});
function renderVote() {
  const voteData = {
    title: '2026年3月 曲投票',
    description: 'ラテンと4beatの曲投票です。',
    isOpen: true,
    items: [
      {
        title: 'ラテン',
        choices: ['Alianza', 'Obatala', 'Caraban'],
      },
      {
        title: '4beat',
        choices: ['Hay Burner', 'Tall Cotton', 'Queen Bee'],
      },
    ],
  };

  const voteResults = {
    ラテン: { Alianza: 12, Obatala: 8, Caraban: 4 },
    '4beat': { 'Hay Burner': 8, 'Tall Cotton': 5, 'Queen Bee': 10 },
  };

  $('#vote-title').text(voteData.title);
  $('#vote-description').text(voteData.description);
  $('#vote-status').text(voteData.isOpen ? '受付中' : '終了');

  const container = $('#vote-items-container').empty();

  container.append('<div class="section-label">※一般メンバー向け表示</div>');
  renderGeneralView(voteData.items, container);

  container.append('<div class="section-label">※管理者向け表示</div>');
  renderAdminView(voteData.items, voteResults, container);
}

function setupEventHandlers() {
  $('.delete-button').on('click', function () {
    utils.showDialog('削除しますか？').then((result) => {
      if (result) {
        alert('削除処理（未実装）');
      }
    });
  });

  $('.save-button').on('click', function () {
    window.location.href = '../vote-answer/vote-answer.html';
  });
}
function renderGeneralView(items, container) {
  items.forEach((item) => {
    const choicesHtml = item.choices
      .map((choice) => `<div class="vote-choice">・${choice}</div>`)
      .join('');

    const html = `
      <div class="vote-item">
        <div class="vote-item-title">${item.title}</div>
        <div class="vote-choices">${choicesHtml}</div>
      </div>
    `;

    container.append(html);
  });
}

function renderAdminView(items, voteResults, container) {
  items.forEach((item) => {
    const results = voteResults[item.title] || {};
    const maxVotes = Math.max(...Object.values(results), 1);

    const barsHtml = item.choices
      .map((choice) => {
        const count = results[choice] ?? 0;
        const percent = (count / maxVotes) * 100;

        return `
          <div class="result-bar">
            <div class="label">・${choice}</div>
            <div class="bar-container">
              <div class="bar" style="width: ${percent}%"></div>
            </div>
            <div class="vote-count">${count}票</div>
          </div>
        `;
      })
      .join('');

    const html = `
      <div class="vote-item">
        <div class="vote-item-title">${item.title}</div>
        <div class="vote-results">${barsHtml}</div>
      </div>
    `;

    container.append(html);
  });
}
