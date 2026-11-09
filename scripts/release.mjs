import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

function run(label, program, args, env) {
  console.log("\n" + label);
  const result = spawnSync(program, args, { cwd: root, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(label + "失败：" + (result.signal || result.status));
}

function npm(args, env) {
  if (!process.env.npm_execpath) throw new Error("请通过 npm run release 调用。");
  run("运行 npm " + args.join(" "), process.execPath, [process.env.npm_execpath, ...args], env);
}

async function uploadMini(ci, appid, privateKeyPath, version, desc) {
  const base = await realpath(tmpdir());
  const stage = await mkdtemp(join(base, "english-galaxy-mini-"));
  try {
    const config = JSON.parse(await readFile(join(root, "miniprogram/project.config.json"), "utf8"));
    await writeFile(join(stage, "project.config.json"), JSON.stringify({ ...config, appid }, null, 2));
    await cp(join(root, "miniprogram/app"), join(stage, "app"), { recursive: true });
    const project = new ci.Project({ appid, type: "miniProgram", projectPath: stage, privateKeyPath });
    await ci.upload({ project, version, desc, setting: { useProjectConfig: true } });
  } finally {
    const target = await realpath(stage);
    if (dirname(target) !== base || !basename(target).startsWith("english-galaxy-mini-")) {
      throw new Error("临时目录位置异常，已跳过清理。");
    }
    await rm(target, { recursive: true, force: true });
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: "boolean" },
    publish: { type: "boolean" },
    target: { type: "string", default: "all" },
    web: { type: "string", default: "cloudflare" },
    desc: { type: "string" },
  } });
  if (values.help) {
    console.log("npm run release -- [--target=all|web|mini] [--web=cloudflare|lan] [--publish] [--desc=更新说明]");
    console.log("默认只构建；--publish 才会部署 Web 和上传微信小程序开发版本。");
    return;
  }
  if (!["all", "web", "mini"].includes(values.target)) throw new Error("--target 必须为 all、web 或 mini。");
  if (!["cloudflare", "lan"].includes(values.web)) throw new Error("--web 必须为 cloudflare 或 lan。");
  const web = values.target !== "mini";
  const mini = values.target !== "web";
  const lan = values.web === "lan";
  const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const build = new Date().toISOString().replace(/\D/g, "");
  const env = { ...process.env, ENGLISH_GALAXY_BUILD: build };
  const desc = values.desc || "英语星空 " + version + " (" + build + ")";
  const appid = env.MINIPROGRAM_APPID?.trim();
  let ci, privateKeyPath, wrangler;

  if (values.publish && mini) {
    if (!/^wx[0-9a-f]{16}$/i.test(appid || "")) throw new Error("请设置有效的 MINIPROGRAM_APPID。");
    if (!env.MINIPROGRAM_PRIVATE_KEY_PATH?.trim()) throw new Error("请设置 MINIPROGRAM_PRIVATE_KEY_PATH。");
    privateKeyPath = resolve(env.MINIPROGRAM_PRIVATE_KEY_PATH);
    if (!(await stat(privateKeyPath)).isFile()) throw new Error("上传密钥路径必须指向文件。");
    try { ci = require("miniprogram-ci"); }
    catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
      throw new Error("请先安装 miniprogram-ci，见 README_DEV.md。");
    }
  }
  if (values.publish && web && !lan) {
    const manifest = join(root, "node_modules/wrangler/package.json");
    try {
      const { bin } = JSON.parse(await readFile(manifest, "utf8"));
      wrangler = resolve(dirname(manifest), typeof bin === "string" ? bin : bin.wrangler);
      await stat(wrangler);
    } catch {
      throw new Error("请先安装项目本地 Wrangler，见 README_DEV.md。");
    }
  }

  const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const lanScript = ["-NoProfile", "-File", join(root, "scripts/deploy-lan.ps1")];
  console.log("英语星空 " + version + " · 构建 " + build);
  if (mini) npm(["run", "test:mini"], env);
  if (web) {
    if (lan) run("构建 Web 局域网发布包", powershell, [...lanScript, "-BuildOnly"], env);
    else {
      npm(["test"], env);
      npm(["run", "build"], env);
    }
  }
  if (!values.publish) {
    console.log("\n构建完成：" + [web && (lan ? "dist/english-starry-sky.tar.gz" : "dist/"), mini && "miniprogram/"].filter(Boolean).join("、"));
    return;
  }

  if (mini) {
    console.log("\n上传微信小程序开发版本");
    await uploadMini(ci, appid, privateKeyPath, version, desc);
    console.log("微信小程序已上传。请在微信公众平台提交审核，审核通过后发布。");
  }
  if (web) {
    if (lan) {
      const args = [...lanScript, "-DeployOnly"];
      if (env.LAN_SSH_TARGET) args.push("-SshTarget", env.LAN_SSH_TARGET);
      if (env.LAN_REMOTE_DIR) args.push("-RemoteDir", env.LAN_REMOTE_DIR);
      if (env.LAN_PORT) args.push("-Port", env.LAN_PORT);
      if (env.LAN_INCREMENTAL === "1") args.push("-Incremental");
      run("部署 Web 到局域网", powershell, args, env);
    } else {
      run("部署 Web 到 Cloudflare", process.execPath, [wrangler, "deploy", "--config", join(root, "wrangler.jsonc")], env);
    }
    console.log("Web 已部署。");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
