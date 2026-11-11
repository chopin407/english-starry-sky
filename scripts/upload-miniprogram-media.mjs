import { spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, readdir, rmdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const directories = ["atlas", "lessons", "reading"];
const defaultRemoteDir = "/var/www/english-starry-sky-media";
const indexFile = "atlas/index.json";
const audioFile = "lessons/7a/starter-unit-1-a-2c.mp3";

function run(program, args, stdio = "inherit") {
  const result = spawnSync(program, args, { stdio });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} 失败（${result.signal || result.status}）。`);
}

async function countFiles(dir) {
  let count = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(join(dir, entry.name));
    else if (entry.isFile()) count++;
    else throw new Error(`资源目录含非普通文件：${join(dir, entry.name)}`);
  }
  return count;
}

function remoteCommand(remoteDir) {
  return `set -eu
umask 022
root='${remoteDir}'
stage=$(mktemp -d "$root/release.XXXXXXXX")
release=$(basename "$stage")
cleanup() {
  if [ "$(readlink "$root/current" || true)" != "$release" ]; then
    rm -rf -- "$stage"
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
tar --no-same-owner --no-same-permissions -xf - -C "$stage"
test -s "$stage/${indexFile}"
test -s "$stage/${audioFile}"
test -d "$stage/reading"
chmod -R a+rX "$stage"
ln -s -- "$release" "$stage/.current"
mv -Tf -- "$stage/.current" "$root/current"
trap - EXIT HUP INT TERM
printf 'Activated %s/current -> %s\\n' "$root" "$release"`;
}

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: "boolean" },
    upload: { type: "boolean" },
    "ssh-target": { type: "string" },
    "remote-dir": { type: "string", default: defaultRemoteDir },
  } });
  if (values.help) {
    console.log("npm run media:upload -- [--ssh-target=user@host] [--remote-dir=/var/www/english-starry-sky-media] [--upload]");
    console.log("默认只预览。加 --upload 并指定 --ssh-target 后才通过 SSH 上传。");
    return;
  }

  const target = values["ssh-target"];
  const remoteDir = values["remote-dir"];
  if (values.upload && !target) throw new Error("上传时必须指定 --ssh-target=user@host。");
  if (target && !/^(?:[\w][\w.-]*@)?[\w][\w.-]*$/.test(target)) {
    throw new Error("--ssh-target 必须为 user@host 或 SSH 配置中的主机别名。");
  }
  if (!/^(?:\/[a-zA-Z0-9_][a-zA-Z0-9_.-]*)+$/.test(remoteDir)) {
    throw new Error("--remote-dir 必须是绝对路径，且各段只使用字母、数字、下划线、点或连字符。");
  }

  for (const file of [indexFile, audioFile]) {
    if (!(await stat(join(publicDir, file))).size) throw new Error(`资源为空：public/${file}`);
  }
  for (const dir of directories) {
    const count = await countFiles(join(publicDir, dir));
    if (!count) throw new Error(`资源目录为空：public/${dir}`);
    console.log(`public/${dir}/  ${count} 个文件`);
  }
  console.log(`目标目录：${target ? `${target}:` : ""}${remoteDir}/current/`);
  if (!values.upload) return;

  const temp = await mkdtemp(join(tmpdir(), "english-mini-media-"));
  const archive = join(temp, "media.tar");
  try {
    console.log("正在打包小程序媒体资源…");
    run("tar", ["-cf", archive, "-C", publicDir, ...directories]);
    console.log(`正在上传 ${Math.ceil((await stat(archive)).size / 1024 ** 2)} MiB 到 ${target}…`);
    const input = openSync(archive, "r");
    try {
      run("ssh", ["-T", "-o", "ConnectTimeout=10", target, remoteCommand(remoteDir)], [input, "inherit", "inherit"]);
    } finally {
      closeSync(input);
    }
  } finally {
    await unlink(archive).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await rmdir(temp);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
