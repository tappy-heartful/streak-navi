$(document).ready(function () {
  initDisplay();
  renderVote();
  setupEventHandlers();
});

function renderVote() {
  // 仮データ（本番は APIやストレージから取得する）
  const voteData = {
    title: '文化祭アンケート',
    description: '文化祭の出し物に関するアンケートです。',
    isOpen: true,
    items: [
      {
        title: '模擬店',
        choices: ['焼きそば', 'たこ焼き', 'クレープ'],
      },
      {
        title: 'ステージ企画',
        choices: ['ダンス', '演劇', 'バンド演奏'],
      },
    ],
  };

  $('#vote-title').text(voteData.title);
  $('#vote-description').text(voteData.description);
  $('#vote-status').text(voteData.isOpen ? '受付中' : '終了');

  const container = $('#vote-items-container');
  container.empty();

  voteData.items.forEach((item) => {
    const itemHtml = $(`
      <div class="vote-item">
        <div class="vote-item-title">${item.title}</div>
        <div class="vote-choices">
          ${item.choices
            .map((choice) => `<div class="vote-choice">・${choice}</div>`)
            .join('')}
        </div>
      </div>
    `);
    container.append(itemHtml);
  });
}

function setupEventHandlers() {
  $('.delete-button').on('click', function () {
    showDialog('削除しますか？').then((result) => {
      if (result) {
        alert('削除処理（未実装）');
      }
    });
  });

  $('.answer-button').on('click', function () {
    alert('回答ページへ遷移（未実装）');
  });
}
