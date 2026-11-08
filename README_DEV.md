# 英语星空（新版）

英语练习网页，收录人教版 PEP 六上、初中英语五册及外研版九年级。界面基于开源项目 [词光 Word Atlas](https://github.com/designfuchen/word-atlas)（MIT）改造。

## 打开方式
在这个文件夹里运行：

```bash
npm run dev
```

电脑浏览器打开 http://localhost:5191 ；手机连同一个网络，打开 `http://电脑的地址:5191`。

## 发布到局域网

在项目根目录打开 PowerShell。本机需要 Node.js 20+、Python 3.9+ 和 OpenSSH（`ssh`、`scp`）。首次构建先运行 `npm ci`。

```powershell
# 只运行测试、编译和打包，生成 dist/english-starry-sky.tar.gz
.\scripts\deploy-lan.ps1 -BuildOnly

# 只上传现有发布包并发布，保留本机发布包供下次使用
.\scripts\deploy-lan.ps1 -DeployOnly

# 构建并上传到 kjg@192.168.1.74，默认使用 HTTP 端口 8091
.\scripts\deploy-lan.ps1

# 构建后只上传有变化的文件
.\scripts\deploy-lan.ps1 -Incremental

# 直接从本机已有发布包提取有变化的文件并上传
.\scripts\deploy-lan.ps1 -Incremental -DeployOnly

# 换服务器、安装目录或 HTTP 端口
.\scripts\deploy-lan.ps1 -SshTarget kjg@192.168.1.74 -RemoteDir /home/kjg/work/english-starry-sky -Port 8092
```

Linux 服务器需要 Bash、Node.js、PM2、Python 3、`curl`、`tar` 和 `flock`。SSH 用户需要能写入部署目录，默认目录是 `/home/kjg/work/english-starry-sky`。发布后，同一网络的设备可访问 `http://192.168.1.74:8091/`。如服务器有防火墙，需允许局域网访问所选 TCP 端口。

增量发布需要服务器已有一次完整发布。脚本按文件内容比对，复用未改动的 MP3、图片等文件，上传新增和修改的文件，并从新版本中移除本次构建已删除的文件。服务器在同一文件系统内通过硬链接复用文件，请通过重新发布更新内容。若比对期间服务器切换了版本，重新运行增量命令即可。

发布脚本会在暂存目录组装完整站点，再切换 `english-starry-sky` PM2 进程。确认首页、版本标记和课文音频分段请求通过后，写入 `current-release`。切换后检查失败会尝试恢复上一版。服务器会保留各版本，完整发布约占 530 MiB，增量版本可共享未变动文件的磁盘空间。可通过 `pm2 status` 和 `pm2 logs english-starry-sky` 查看状态。如需开机自动恢复，首次以部署用户运行 `pm2 startup` 并按提示完成系统配置。

### 启用局域网账号和学习同步

首次启用时，将 `scripts/lan_sync.py` 和 `scripts/setup-lan-sync.py` 放到 Linux 发布服务器上同一个临时目录。从该目录运行以下命令。数据库地址默认为 `192.168.1.74:3306`，应用使用独立的 `english_starry_sky` 数据库。

```bash
root=/home/kjg/work/english-starry-sky
umask 077
mkdir -p "$root"
uv venv "$root/.sync-venv"
uv pip install --python "$root/.sync-venv/bin/python" 'PyMySQL[rsa]>=1.1,<2'
"$root/.sync-venv/bin/python" setup-lan-sync.py --config "$root/mysql-sync.json"
```

初始化脚本会提示输入 MySQL 管理员密码，创建表和专用应用用户。应用用户仅有本数据库的读写权限，连接配置保存在发布目录下、静态站点之外的 `mysql-sync.json` 中。没有 `uv` 时，可以用 `python3 -m venv` 和虚拟环境内的 `python -m pip` 安装同一依赖。

配置完成后运行 `.\scripts\deploy-lan.ps1 -Incremental`，首次完整发布则运行 `.\scripts\deploy-lan.ps1`。以后发布沿用同一个数据库和配置，发布检查会验证 `/api/health` 能访问 MySQL。通过 HTTPS 反向代理访问时，代理需保留原始 `Host` 并将页面和 API 转发到同一服务。

游客继续在当前浏览器学习。「我的」里的「注册 / 登录」可将当前学习记录随注册保存到服务器。同一账号在其他设备登录、页面重新显示或恢复网络时会同步，前台还会定时检查更新。本机暂时离线时，学习记录保留在浏览器。局域网账号与腾讯云账号使用各自的数据库。

启用同步后，使用 `-DeployOnly` 前先用新版代码运行一次 `-BuildOnly`，生成包含同步服务的发布包。

## 有什么
- **今日**：每天的新词和复习（FSRS 算法安排），学习路线按课本 10 个单元排列。
- **图鉴 / 星图**：285 个课本词条（不含人名），按单元和类型（课标重点词、一般词汇、短语、地名与专名）浏览；星图里每学会一个词点亮一颗星。
- **课本**：每个单元先是「课文与对话」点读（课本原声，点一句读一句，也能整段播放），再是 28 个语法、句型考点，149 道练习题，带解析和错题重练。
- **练习**：单词听写、短句听写和中文听写均可在线作答、自动判分。错题会进入错词本，并按间隔加入到期复习。
- 词卡和考点页底部的「!」提示条：在真题里出现过几次，点开看原句。

## 内容放在哪里
| 位置 | 内容 | 怎么更新 |
|---|---|---|
| `public/atlas/` | 词库（词光格式） | 运行 `python3 scripts/build_atlas.py`，从 `../app/public/data/7a.json` 和课本录音生成 |
| `public/data/7a-lessons.json`、`public/lessons/7a/` | 课文点读：逐句文字和时间、课本录音 | 见下面「课文点读」 |
| `public/data/7a-points.json` | 考点讲解和练习题 | 直接改文字、加题 |
| `src/data/essays/7a.ts` | 七年级上册写作范文 | 在数组中追加文章，保留唯一的 `id` 和至少一个正文版本。新增其他册数时，以册号命名 `.ts` 文件并默认导出同结构的数组 |
| `public/data/7a-exams.json` | 真题提示 | 在 `../app` 里运行 `scripts/build_exams.py` 后复制过来 |

词表、录音切分、真题统计这些脚本还在 `../app/scripts/`，说明见 `../app/README.md`。

## 换插画和封面
1. 按 `../插画/插画生成清单.md` 生成图片，文件名用清单里的（如 `make-friends.png`），放进 `../插画/新图/`；
2. 运行 `python3 scripts/build_atlas.py <ffmpeg路径>`，新图会自动转成网页用的大小，优先于词光的插画；封面（hero、og、topic-key 等）也一样。

## 课文点读
1. 课本录音逐词识别（Python 3.12 + faster-whisper，很慢，可断点续跑）：`../app/scripts/transcribe_book_audio.py ffmpeg 模型目录 录音目录 ../app/scripts/build/book_audio_words.json`
2. `python3 scripts/build_lessons.py ../app/scripts/build/book_audio_words.json 课本全文.txt`：逐词对齐课本原文，生成 `public/data/7a-lessons.json`。听错的人名在脚本里的 `FIX` 表补。
3. 对不上课本、保留识别文字的句子列在 `课文点读_待核对.md`。
4. 参考译文在 `scripts/lessons_zh.tsv`（每行「英文<Tab>中文」，老师可直接改中文），改完重跑第 2 步。点读页默认只显示英文，学生点「显示中文」才出现。

## 朗读
- 单词发音：课本原声。
- 单词卡例句（`scripts/examples7a.json`，课本句 + 中考句，老师可直接改文字）和考点朗读：微软神经网络英音（Sonia、Ryan、Libby 三个声音轮流，对话句每行换人），见 `scripts/neural_tts.py`。需要 Python 3.12 的 `edge-tts`，用环境变量 `EDGE_TTS` 指定它的路径。
- 改了例句后：`python3 scripts/build_example_audio.py <ffmpeg路径>`，再 `python3 scripts/build_atlas.py <ffmpeg路径>`；只会重录改过的句子。
- 改了考点题目后：`python3 scripts/build_points_audio.py <ffmpeg路径>`，只补录新句子；改过的句子要先删掉 `public/audio/points/` 里对应的 mp3。

## 环境音乐
- 列表在 `src/lib/ambience.ts`（`db` 是每首的音量微调）；能从宝箱开出的在 `src/store/gameState.ts` 的 `MUSIC` 里。
- 专注棕噪声、八音盒、古筝小调是程序合成的：`python3 scripts/make_ambience.py <ffmpeg路径> [只重做某几首]`。
- 其余新加的二十首来自 Pixabay（Pixabay 许可，可免费使用、免署名），原始文件和来源清单在 `../音乐素材/pixabay/`。加新素材：把 mp3 放进那个文件夹，运行 `python3 scripts/import_ambience.py <ffmpeg路径> ../音乐素材/pixabay 名字…`，会自动截长度、做无缝循环、统一音量。

## 署名与版权
- 课本单词、音标、释义和录音来自人教版《英语》七年级上册，仅供本班学习使用，不要公开发布。
- 界面代码来自词光 Word Atlas（MIT 授权，见 LICENSE）；插画、美音、例句来自词光词库（CC BY 4.0，署名 Word Atlas contributors，见 CONTENT_LICENSE.md）。「关于」页面里写了署名，不要删掉。


## 新加一册（七下、八下就是这样做的，册号 7b / 8b）
在 `../app` 里：
1. `python3 scripts/parse_vocab.py 课本.pdf 词表首页 词表末页 scripts/build/vocab<册号>.json`（页码从 0 数）
2. `python3 scripts/build_book.py scripts/build/vocab<册号>.json public/data/<册号>.json`：人名、地名、书名的归类和词光词义对不上的词（`ATLAS_SKIP_BOOK`）都在这个脚本顶部。
3. 单词原声：`align_whisper.py`（低分项人工核对，写进 `OVERRIDES`）→ `cut_audio.py`；词光素材：`fetch_word_atlas.py`；再跑一次 build_book.py 带上对齐结果和词光对照。
4. 例句：`python3 scripts/build/ex_pick.py show <册号> 起始 个数` 看候选，挑好写进文本后 `ex_pick.py save <册号> 挑选.txt`，存到 `web/scripts/examples<册号>.json`。
5. 考点：`scripts/points/points<册号>.py` 生成 `public/data/<册号>-points.json`；真题提示：`build_exams.py`。
6. 课文点读：`transcribe_book_audio.py` 转文字。

在 `web` 里：
7. `build_example_audio.py ffmpeg <册号>`、`build_points_audio.py ffmpeg <册号>` 录朗读。
8. 没有插画的词：在 `scripts/fill_pics.tsv` 给每个词挑一两个表情，`python3 scripts/make_fill_pics.py ffmpeg` 画补位图（存 `../插画/补位图/`）。
9. `python3 scripts/build_atlas.py ffmpeg <册号>` 生成图鉴；`build_lessons.py` + `copy_lesson_audio.py` 做课文点读。
10. `src/lib/books.ts` 里把这一册标 `ready: true`，`public/sw.js` 的 VERSION 升一级。

### 重新生成 PEP 六上（6a）

把原始课本 PDF 和出版社的 50 条 MP3 放在 `scripts/build/pep6a/`。沿用下载工具的目录和三位数录音编号。Python 需要 `pypdf`，命令行需要 `ffmpeg` 和 `ffprobe`。

```powershell
python -X utf8 scripts/import_pep6a.py scripts/build/pep6a "G:\opensoure\word-atlas" --transcript scripts/build/pep6a/transcript.json
```

传入逐词识别结果时，导入器会为与课本原文对齐的句子生成点读时间。识别 JSON 可用 `pipeline/transcribe_book_audio.py` 生成。省略 `--transcript` 可生成整段播放数据。导入器同时切出单词原声，从词光匹配插画、美音和例句。语法与句型练习在 `public/data/6a-points.json` 维护。

### 重新生成外研版九年级（fltrp9a）

当前教材素材来自九年级上册。将平台的 `relation_audios.json` 和按清单顺序编号的 50 条 MP3 放入 `scripts/build/fltrp9a/`，MP3 存在其 `mp3/` 子目录。需要 Python 3.11+、`pypdf`、`ffmpeg` 和 `ffprobe`。

```powershell
python -X utf8 scripts/import_fltrp9a.py scripts/build/fltrp9a "G:\opensoure\word-atlas"
```

脚本先比对平台 MP3 的校验值，再按词表切分单词原声并导入全册录音。词表在 `scripts/fltrp9a_vocab.tsv`，练习在 `public/data/fltrp9a-points.json`。同一目录若有 `ocr-lessons.json` 和 `transcript.json`，脚本还会生成课文点读。前者按 `lesson-009` 这类 PDF 零基页号存放 OCR 行，后者按 `001` 这类音频编号存放文字与起止秒数。

六个单元的原创写作范文在 `src/data/essays/fltrp9a.ts` 维护。
