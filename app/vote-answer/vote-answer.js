$(document).ready(function () {
  const mode = getParam('mode'); // 'new' or 'edit'
  initDisplay();
  setupPageMode(mode);
  renderVote();
  setupEventHandlers(mode);
});

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function setupPageMode(mode) {
  const title = mode === 'edit' ? '回答修正' : '回答登録';
  const buttonText = mode === 'edit' ? '回答を修正する' : '回答を登録する';
  $('#title').text(title);
  $('#page-title').text(title);
  $('#answer-submit').text(buttonText);
}

function renderVote() {
  // 仮データ
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

  $('#vote-title').text(voteData.title);
  $('#vote-description').text(voteData.description);

  const container = $('#vote-items-container');
  container.empty();

  voteData.items.forEach((item, index) => {
    const groupName = `question-${index}`;
    const choicesHtml = item.choices
      .map((choice, i) => {
        const choiceId = `${groupName}-choice-${i}`;
        return `
          <label class="vote-choice-label" for="${choiceId}">
            <input type="radio" name="${groupName}" id="${choiceId}" value="${choice}" />
            ${choice}
          </label>
        `;
      })
      .join('');

    const itemHtml = $(`
      <div class="vote-item">
        <div class="vote-item-title">${item.title}</div>
        <div class="vote-choices">${choicesHtml}</div>
      </div>
    `);
    container.append(itemHtml);
  });
}

function setupEventHandlers(mode) {
  $('#answer-submit').on('click', function () {
    const answers = {};

    $('.vote-item').each(function (index) {
      const questionTitle = $(this).find('.vote-item-title').text();
      const selected = $(this).find('input[type="radio"]:checked').val();
      answers[questionTitle] = selected || null;
    });

    console.log('選択結果:', answers);

    // 今後ここでAPI送信などに接続可能
    showDialog(`${mode === 'edit' ? '修正' : '登録'}しますか？`).then(
      (result) => {
        if (result) {
          alert(`回答を${mode === 'edit' ? '修正' : '登録'}しました（仮）`);
        }
      }
    );
  });
}
