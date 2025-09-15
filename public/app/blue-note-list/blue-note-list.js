$(document).ready(function () {
  const months = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ];

  const $list = $('#month-list').empty();

  months.forEach((name, index) => {
    const month = String(index + 1).padStart(2, '0'); // "01" ~ "12"
    $list.append(`
      <li>
        <a href="../blue-note-edit/blue-note-edit.html?month=${month}" class="blue-note-link">
          🎷 ${name}
        </a>
      </li>
    `);
  });
});
