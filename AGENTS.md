# AGENTS.md

## 项目是什么

YTPro 是一个**纯 Java Android 应用**（无 Kotlin、无原生 `.so`），用 WebView 包裹 YouTube，通过注入 JavaScript 实现去广告、后台播放、下载、截图、倍速等功能。App 本体只是壳，功能几乎全在注入的 JS 里。

## 工作约束（必读）

- **禁止重构**：不得在不改功能的前提下大改既有代码结构；优化只允许针对性微调，默认保持现有实现不动。
- **禁止更改技术栈/依赖体系**：保持纯 Java + WebView + 注入 JS + 仅 `androidx.webkit` 的架构，不引入 Kotlin、新框架、新依赖或原生 `.so`。
- **新增功能必须先能落地**：若某个新增功能的计划在本架构下无法真正实现（如受 WebView/API 限制、与注入链冲突），**必须拒绝用户并说明原因**，不能给出无法跑通的伪实现。
- **UI/UX 必须与项目一致**：新增按钮/图标等可视化元素必须沿用现有注入元素的定位与事件机制，禁止引入会导致图标位置偏移或点击无效果的方案；实现前先弄清目标元素在 `scripts/script.js` 中的挂载点与现有样式约定。
- 禁止未请求直接编译的行为，禁止自动编译，禁止自动编译。

## 架构要点

- **`scripts/` 是 JS 的唯一真源**：`script.js`（主功能，约 91KB）、`bgplay.js`（后台播放）、`innertube.js`（ES module，YouTube 内部 API）。Gradle 任务 `syncYtproScripts` 在 `preBuild` 时拷贝到 `app/src/main/assets/ytpro/`——该目录是**生成产物且被 gitignore**，禁止直接改它，改 JS 一律改 `scripts/` 后重新构建。
- **注入链**：`YTProWebViewClient.shouldInterceptRequest` 拦截 m.youtube.com/www.youtube.com 主框架 HTML，在 `<head>` 后注入 `BOOTSTRAP_JS`（建宽松 trustedTypes policy + 劫持 fetch/XHR 拦广告请求），并把 `youtube.com/ytpro_cdn/npm/ytpro@latest` 请求指向本地 assets。
- **JS↔Java 桥**：`WebAppInterface` 以 `@JavascriptInterface` 暴露 `Android.*` 方法；靠 `app/proguard-rules.pro` 的 keep 规则在 R8 缩混淆后存活。`BinaryStreamManager` 用 androidx.webkit WebMessagePort 做二进制流。
- 依赖极少：仅 `androidx.webkit`。

## 构建与验证（Windows）

- 构建：`.\gradlew.bat assembleRelease`（产物 `app\build\outputs\apk\release\app-release.apk`）或 `assembleDebug`。
- 需要 JDK 17+（wrapper 为 Gradle 8.13 / AGP 8.13.2，CI 用 JDK 21 + SDK 35 + build-tools 36.1.0）。
- **无单元测试 / 无 instrumentation 测试，无 lint/typecheck 配置**。验证方式 = 构建 + 装到模拟器/真机（本地教程见 `docs/安卓模拟器测试教程.md`，已 gitignore，勿提交）。
- Release 签名：本地可选，读取根目录 `keystore.properties`（gitignore）；缺省则产出未签名包。CI 用 GitHub Secrets（KEYSTORE_BASE64 / STORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD）签名。

## 发布与约定

- `.github/workflows/gradle.yml`：push 到 `main` 即构建签名 Release 并自动发 GitHub Release，tag 为 `v{versionName}-{YYYYMMDD-HHMMSS}`。
- 发版时在 `app/build.gradle` 同时改 `versionCode` 和 `versionName`（当前 4.09 / 12），提交信息带"Bump version"。
- 提交信息用 Conventional Commits 前缀 + 中文正文（`feat:`/`fix:`/`refactor:`/`chore:`/`i18n:`；`i18n:` 表示 UI 文案中文化）。默认只跑 `assembleRelease`，不出 debug 包。
- **永不提交**（均已被 gitignore）：`app/src/main/assets/ytpro/`、`keystore.properties`、`*.jks`、`keystore_base64.txt`、`remote_gradle_b64.txt`，以及 `docs/` 下的本地工作笔记（wizestream-assessment / scene24_* / 倍速播放完整方案 / 模拟器测试教程）。

## 坑

- `BOOTSTRAP_JS` 必须保持 **ASCII-only 且不含字面 `</script>`**，否则内联注入会破坏 HTML。
- 拦截器会剥掉主框架 HTML 的 CSP header/`<meta>`，所以 bootstrap 才建 trustedTypes policy——动这里要小心。
- 兼容 minSdk 21（Android 5.0+，targetSdk 35）：老路径用 `TextUtils.join` 而非 `String.join`（`YTProWebViewClient` 里有注释）。
- `.github/workflows/npm-publish.yml`：`scripts/package.json` 变更推 `main` 会触发 npm 发布；该文件 `repository` 目前仍指向上游 `prateek-chaubey/YTPro`。