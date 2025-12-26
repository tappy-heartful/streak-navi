import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
    utils.renderBreadcrumb([{ title: '譜面一覧' }]);
    await setUpPage();
  } catch (e) {
    await utils.writeLog({
      dataId: 'none',
      action: '初期表示',
      status: 'error',
      errorDetail: { message: e.message, stack: e.stack },
    });
  } finally {
    utils.hideSpinner();
  }
});

let scores = []; // 譜面データ
let genres = []; // ジャンルデータ
let events = [];

async function setUpPage() {
  utils.isAdmin('Score') ? $('#add-button').show() : $('#add-button').hide();

  const scoresRef = utils.collection(utils.db, 'scores');
  const qScore = utils.query(scoresRef, utils.orderBy('createdAt', 'desc'));
  const scoreSnap = await utils.getWrapDocs(qScore);

  scores = scoreSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const genresRef = utils.collection(utils.db, 'genres');
  const genreSnap = await utils.getWrapDocs(genresRef);
  genres = genreSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const $genreSelect = $('#genre-select');
  genres.forEach((g) => {
    $genreSelect.append(`<option value="${g.id}">${g.name}</option>`);
  });

  await loadAndProcessEvents();
  filterScores();

  $('#search-box, #genre-select, #event-filter-select, #sort-select').on(
    'input change',
    function () {
      filterScores();
    }
  );

  $('#clear-button').on('click', () => {
    $('#search-box').val('');
    $('#genre-select').val('');
    $('#event-filter-select').val('');
    $('#sort-select').val('createdAt-desc');
    filterScores();
  });
}

async function loadAndProcessEvents() {
  const eventsRef = utils.collection(utils.db, 'events');
  const eventSnap = await utils.getWrapDocs(eventsRef);
  const today = utils.format(new Date(), 'yyyy.MM.dd');
  const $eventFilterSelect = $('#event-filter-select');

  const rawEvents = eventSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  events = rawEvents
    .filter(
      (e) =>
        e.date &&
        e.date > today &&
        e.setlist &&
        Array.isArray(e.setlist) &&
        e.setlist.length > 0
    )
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((e) => {
      const scoreIdsInSetlist = [];
      e.setlist.forEach((item) => {
        if (item.songIds && Array.isArray(item.songIds)) {
          scoreIdsInSetlist.push(...item.songIds);
        }
      });
      return {
        id: e.id,
        title: e.title_decoded || e.title || `イベント(${e.id})`,
        date: e.date,
        scoreIdsInSetlist: scoreIdsInSetlist,
      };
    });

  const closestEventId = events.length > 0 ? events[0].id : '';

  $eventFilterSelect.empty();
  $eventFilterSelect.append($('<option>').val('').text('イベントを選択'));
  events.forEach((e) => {
    const isSelected = e.id === closestEventId ? 'selected' : '';
    $eventFilterSelect.append(
      `<option value="${e.id}" ${isSelected}>${e.date} ${e.title}</option>`
    );
  });
}

function filterScores() {
  const keyword = $('#search-box').val().toLowerCase();
  const selectedGenre = $('#genre-select').val();
  const selectedEventId = $('#event-filter-select').val();
  const sortValue = $('#sort-select').val();

  const $sortGroup = $('#sort-select').closest('.form-group');
  if (selectedEventId) {
    $sortGroup.hide();
  } else {
    $sortGroup.show();
  }

  let filtered = scores.filter((s) => {
    const matchTitle = s.title?.toLowerCase().includes(keyword);
    const matchGenre = !selectedGenre || s.genres?.includes(selectedGenre);

    let matchEvent = true;
    if (selectedEventId) {
      const eventData = events.find((e) => e.id === selectedEventId);
      matchEvent = eventData?.scoreIdsInSetlist.includes(s.id);
    }

    return matchTitle && matchGenre && matchEvent;
  });

  filtered.sort((a, b) => {
    if (selectedEventId) {
      const eventData = events.find((e) => e.id === selectedEventId);
      if (eventData) {
        const orderedIds = eventData.scoreIdsInSetlist;
        return orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id);
      }
    }

    switch (sortValue) {
      case 'createdAt-asc':
        return a.createdAt?.toMillis?.() - b.createdAt?.toMillis?.();
      case 'createdAt-desc':
        return b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.();
      case 'title-asc':
        return a.title.localeCompare(b.title, 'ja');
      case 'title-desc':
        return b.title.localeCompare(a.title, 'ja');
      default:
        return 0;
    }
  });

  renderScores(filtered);
}

function renderScores(scoreArray) {
  const $tbody = $('#score-table-body').empty();

  if (scoreArray.length === 0) {
    $tbody.append(
      '<tr><td colspan="5" class="text-center">該当の譜面はありません🍀</td></tr>'
    );
    $('#playlist-link').hide();
    return;
  }

  scoreArray.forEach((s) => {
    $tbody.append(makeScoreRow(s));
  });

  // YouTubeプレイリストリンクの生成
  const watchIds = scoreArray
    .map((s) =>
      utils.extractYouTubeId(s.referenceTrack_decoded || s.referenceTrack)
    )
    .filter((id) => !!id)
    .join(',');

  if (watchIds) {
    $('#playlist-link')
      .attr(
        'href',
        `https://www.youtube.com/watch_videos?video_ids=${watchIds}`
      )
      .show();
  } else {
    $('#playlist-link').hide();
  }
}

/**
 * 譜面テーブルの行生成
 */
function makeScoreRow(s) {
  // ジャンル名の紐付け
  const genreNames = (s.genres || [])
    .map((id) => genres.find((g) => g.id === id)?.name)
    .filter((name) => name)
    .join('\n');

  // URLデコード等の考慮（プロパティ名は既存の仕様に準拠）
  const scoreUrl = s.scoreUrl_decoded || s.scoreUrl;
  const refUrl = s.referenceTrack_decoded || s.referenceTrack;

  return $(`
    <tr>
      <td class="list-table-row-header">
        <a href="../score-confirm/score-confirm.html?scoreId=${s.id}">
          ${s.title}
        </a>
      </td>
      <td class="text-center">
        ${
          scoreUrl
            ? `<a href="${scoreUrl}" target="_blank" title="譜面を開く"><i class="fa-solid fa-file-pdf"></i> 譜面</a>`
            : '-'
        }
      </td>
      <td class="text-center">
        ${
          refUrl
            ? `<a href="${refUrl}" target="_blank" title="参考音源を聴く"><i class="fab fa-youtube fa-lg"></i> 参考音源</a>`
            : '-'
        }
      </td>
      <td style="white-space: pre-wrap; font-size: 12px;">${
        genreNames || '-'
      }</td>
    </tr>
  `);
}
