import * as utils from '../common/functions.js';

$(document).ready(async function () {
  try {
    await utils.initDisplay();
  } catch (e) {
    console.error(e);
  } finally {
    utils.hideSpinner();
  }
});
