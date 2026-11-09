const { stopAudio } = require("./lib/media");

App({
  onHide() { stopAudio(); },
});
