import { duck } from "./sound";

let cancelCurrent: (() => void) | null = null;
let token = 0;

/* ---------- 录音预先下载 ----------
 * 线上服务器给文件加了 no-store（浏览器不缓存），而 <audio> 用的是分段请求，离线缓存（sw.js）也不接，
 * 结果同一个词每读一次都要重新下载，手机上要等一两秒。这里用 fetch 把整段录音下载到内存（顺带进离线缓存），
 * 播放时直接用内存里的那份。 */
const ready = new Map<string, string>(); // 网址 → 已下载好的 blob 地址
const loading = new Map<string, Promise<void>>();

export function preloadAudio(url: string | null | undefined) {
  if (!url || ready.has(url)) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        ready.set(url, URL.createObjectURL(b));
        if (ready.size > 400) {
          const [old, blob] = ready.entries().next().value as [string, string];
          URL.revokeObjectURL(blob);
          ready.delete(old);
        }
      })
      .catch(() => undefined)
      .finally(() => loading.delete(url));
    loading.set(url, p);
  }
  return p;
}

export function stopAudio() {
  token++;
  if (!cancelCurrent) return;
  cancelCurrent();
  cancelCurrent = null;
  duck(false);
}

/** Play a recording, falling back to the device voice. Resolves when playback ends. */
export async function play(url: string | null | undefined, text: string, accent: "uk" | "us" = "uk", rate = 1) {
  stopAudio();
  const mine = token;
  duck(true);
  try {
    return await speak(url, text, accent, rate, mine);
  } finally {
    if (mine === token) {
      cancelCurrent = null;
      duck(false);
    }
  }
}

async function speak(url: string | null | undefined, text: string, accent: "uk" | "us", rate: number, mine: number) {
  if (url) {
    // 已经下载好的直接播（要在点击的同一刻调用 play，手机浏览器才允许出声，所以不能先 await 下载）
    const a = new Audio(ready.get(url) ?? url);
    if (!ready.has(url)) void preloadAudio(url);
    a.playbackRate = rate;
    try {
      return await new Promise<"recorded" | "stopped">((resolve, reject) => {
        a.onended = () => resolve("recorded");
        a.onpause = () => resolve(a.ended ? "recorded" : "stopped");
        a.onerror = reject;
        cancelCurrent = () => {
          a.pause();
          resolve("stopped");
        };
        void a.play().catch(reject);
      });
    } catch {
      if (mine !== token) return "stopped" as const;
      a.pause();
      cancelCurrent = null;
    } finally {
      a.onended = a.onpause = a.onerror = null;
    }
  }
  const synthesis = window.speechSynthesis;
  if (!synthesis) return "unsupported" as const;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent === "uk" ? "en-GB" : "en-US";
  u.rate = rate * 0.95;
  const voices = synthesis.getVoices().filter((v) => v.lang.replace("_", "-") === u.lang);
  const best = voices.find((v) => /premium|enhanced|natural|google/i.test(v.name)) || voices[0];
  if (best) u.voice = best;
  return new Promise<"device" | "unsupported" | "stopped">((resolve) => {
    u.onend = () => resolve("device");
    u.onerror = () => resolve("unsupported");
    cancelCurrent = () => {
      resolve("stopped");
      synthesis.cancel();
    };
    synthesis.speak(u);
  });
}
