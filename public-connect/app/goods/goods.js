import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();

    // 商品画像の制御
    renderGoodsItems();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});

/**
 * BOOTHの商品画像を配列に基づいて生成する
 */
function renderGoodsItems() {
  // 表示したい画像のファイル名を配列で定義
  const items = [
    'item1.jpg',
    'item2.jpg',
    'item3.jpg',
    'item4.jpg',
    // 'item5.jpg' など、追加があればここに足すだけ
  ];

  const $container = $('#goods-list');
  const basePath = '../../images/goods/';

  // 配列をループしてHTMLを生成
  items.forEach((fileName, index) => {
    const fullPath = `${basePath}${fileName}`;
    const imgHtml = `
      <img
        src="${fullPath}"
        alt="Goods ${index + 1}"
        class="square-img btn-view-image"
        data-url="${fullPath}"
      />
    `;
    $container.append(imgHtml);
  });
}
