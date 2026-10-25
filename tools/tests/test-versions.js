/* 版本三源一致性回归测试（Node 直跑：node tools/tests/test-versions.js）
   台账：docs/git历史遗留问题核查.md P6。
   约束：app/build.gradle versionName === scripts/script.js YTProVer；
        scripts/package.json version 以 versionName 为前缀（semver 三段）；
        npm-publish 工作流保持禁用（workflow_dispatch，无 push 触发）——
        package.json 变更不得触发向 npm 的误发布。 */
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..", "..");

var gradle = fs.readFileSync(path.join(root, "app", "build.gradle"), "utf8");
var scriptJs = fs.readFileSync(path.join(root, "scripts", "script.js"), "utf8");
var pkg = JSON.parse(fs.readFileSync(path.join(root, "scripts", "package.json"), "utf8"));
var workflow = fs.readFileSync(path.join(root, ".github", "workflows", "npm-publish.yml"), "utf8");

var versionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
var versionCode = (gradle.match(/versionCode\s+(\d+)/) || [])[1];
var ytproVer = (scriptJs.match(/var YTProVer="([^"]+)"/) || [])[1];

var failures = [];
if (!versionName) { failures.push("app/build.gradle 未找到 versionName"); }
if (!ytproVer) { failures.push("scripts/script.js 未找到 YTProVer"); }
if (versionName && ytproVer && versionName !== ytproVer) {
  failures.push("版本脱同步：versionName=" + versionName + "，YTProVer=" + ytproVer + "（更新横幅 checkUpdates 比较这两者，脱同步即失效）");
}
if (versionName && pkg.version.indexOf(versionName) !== 0) {
  failures.push("scripts/package.json version=" + pkg.version + " 与 versionName=" + versionName + " 不对齐（npm 僵尸版本，见台账 P6 H3）");
}
if (!versionCode) { failures.push("app/build.gradle 未找到 versionCode"); }
if (workflow.indexOf("workflow_dispatch") < 0) {
  failures.push("npm-publish.yml 未保持禁用态（应为 workflow_dispatch 手动档，见规范文档第二节）");
}
if (/\n\s*on:\s*\n\s*push:/.test(workflow)) {
  failures.push("npm-publish.yml 出现 push 自动触发——package.json 变更会误发布，需先恢复三源对齐流程");
}

if (failures.length) {
  console.log("FAIL：");
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
console.log("PASS：版本三源一致（versionCode " + versionCode + " / versionName " + versionName + " / package " + pkg.version + "），npm 链保持禁用");
