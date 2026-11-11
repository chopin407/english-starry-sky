import { readFile } from "node:fs/promises";

const configName = "miniprogram.config.local.json";
const configUrl = new URL(`../${configName}`, import.meta.url);

export async function readMiniprogramConfig() {
  const source = await readFile(configUrl, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return "{}";
  });
  let config;
  try {
    config = JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${configName} 不是有效的 JSON。`);
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${configName} 必须是 JSON 对象。`);
  }

  const value = (key, envName) => {
    const local = config[key] ?? "";
    if (typeof local !== "string") throw new Error(`${configName} 的 ${key} 必须是字符串。`);
    return (process.env[envName] ?? local).trim();
  };

  return {
    appid: value("appid", "MINIPROGRAM_APPID"),
    privateKeyPath: value("privateKeyPath", "MINIPROGRAM_PRIVATE_KEY_PATH"),
    mediaBase: value("mediaBase", "MINIPROGRAM_MEDIA_BASE"),
  };
}
