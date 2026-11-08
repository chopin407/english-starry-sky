// 在智慧教育平台外研版九年级上册教材页的 Chrome DevTools Snippet 中运行。
// 点击出现的按钮选保存目录。只读取本页播放器已加载的 blob，不读取账号或请求头。
(() => {
  const bookId = "2c8772f1-c624-51e1-215d-f0a35f4b5820";
  if (
    location.origin !== "https://basic.smartedu.cn" ||
    location.pathname !== "/tchMaterial/detail" ||
    new URLSearchParams(location.search).get("contentId") !== bookId
  ) {
    throw new Error("请在外研版九年级上册的智慧教育平台教材页运行。");
  }

  // 来自平台完整音频清单，单位为毫秒。用来识别服务器返回的试听截段。
  const lengths = [
    194115, 68493, 67866, 39392, 66037, 166713, 47751, 175072, 104672,
    189884, 61596, 49005, 61361, 162951, 157152, 100597,
    187794, 82886, 70034, 40097, 67631, 197459, 171650, 103157,
    177658, 66168, 84062, 41116, 79438, 174001, 163448, 95608,
    178625, 51565, 78994, 41273, 76016, 169508, 164832, 89234,
    210886, 62328, 53420, 43102, 51774, 175490, 187924, 101694, 69459, 648960,
  ];
  const panel = document.querySelector('[class*="audioList-module_audio-list-wrapper_"]');
  const rows = [...(panel?.querySelectorAll('[class*="audioList-module_audio-item_"]') ?? [])];
  if (rows.length !== lengths.length || !panel.querySelector("audio")) {
    throw new Error("音频列表尚未加载，或当前教材不匹配。请在看到 50 条音频后重试。");
  }
  if (!window.showDirectoryPicker) {
    throw new Error("当前浏览器不支持选择保存目录，请用桌面版 Chrome。");
  }

  const buttonId = "fltrp9a-save-audio";
  if (document.getElementById(buttonId)) return;
  const button = document.createElement("button");
  button.id = buttonId;
  button.type = "button";
  button.textContent = "保存外研九上音频";
  Object.assign(button.style, {
    position: "fixed",
    top: "100px",
    right: "18px",
    zIndex: "2147483647",
    background: "#214fbc",
    color: "white",
    padding: "10px 16px",
    borderRadius: "8px",
    border: "0",
    cursor: "pointer",
  });
  document.body.append(button);

  const blobPrefix = `blob:${location.origin}/`;
  const active = (row) => row.matches('[class*="audioList-module_audio-item-active_"]');
  const audio = () => panel.querySelector("audio");
  const loadedUrl = (player) => player?.currentSrc || player?.src || "";

  async function loadTrack(row, expectedMs, used) {
    const previous = loadedUrl(audio());
    const alreadyActive = active(row);
    if (!alreadyActive) row.click();
    const until = Date.now() + 45000;
    while (Date.now() < until) {
      const player = audio();
      const url = loadedUrl(player);
      if (active(row) && url.startsWith(blobPrefix) && (alreadyActive || url !== previous) && !used.has(url)) {
        player.pause();
        if (player.readyState >= 1 && Number.isFinite(player.duration)) {
          if (Math.abs(player.duration * 1000 - expectedMs) > 1500) {
            throw new Error(`播放器时长 ${player.duration.toFixed(1)} 秒，完整音频应为 ${(expectedMs / 1000).toFixed(1)} 秒`);
          }
          const response = await fetch(url);
          if (!response.ok) throw new Error("播放器音频已失效");
          used.add(url);
          return response.blob();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("等待播放器加载超时");
  }

  async function extension(blob) {
    const [a, b, c, d] = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if ((a === 0x49 && b === 0x44 && c === 0x33) || (a === 0xff && (b & 0xe0) === 0xe0)) return "mp3";
    if (a === 0x4f && b === 0x67 && c === 0x67 && d === 0x53) return "ogg";
    throw new Error("播放器返回了未识别的音频格式");
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const folder = await window.showDirectoryPicker({ mode: "readwrite" });
      const used = new Set();
      const failed = [];
      for (const [i, row] of rows.entries()) {
        const number = String(i + 1).padStart(3, "0");
        const title = row.querySelector('[class*="audioList-module_center_"]')?.textContent.trim() || "Track";
        const name = title.replace(/[<>:"/\\|?*\s]+/g, " ").slice(0, 96).replace(/[. ]+$/, "");
        button.textContent = `正在保存 ${i + 1}/${rows.length}`;
        try {
          const blob = await loadTrack(row, lengths[i], used);
          const ext = await extension(blob);
          const handle = await folder.getFileHandle(`${number} - ${name}.${ext}`, { create: true });
          const file = await handle.createWritable();
          try {
            await file.write(blob);
            await file.close();
          } catch (error) {
            await file.abort().catch(() => {});
            throw error;
          }
        } catch (error) {
          failed.push(number);
          console.warn(`音频 ${number} 保存失败：${error.message}`);
        }
      }
      const summary = `已保存 ${rows.length - failed.length}/${rows.length} 条`;
      button.textContent = summary;
      console.info(summary, failed.length ? `失败编号：${failed.join("、")}` : "");
    } catch (error) {
      button.textContent = "保存外研九上音频";
      if (error.name !== "AbortError") console.error(error.message);
    } finally {
      audio()?.pause();
      button.disabled = false;
    }
  });
})();
