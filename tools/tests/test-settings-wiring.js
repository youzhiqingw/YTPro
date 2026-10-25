/* 设置面板开关接线审计（Node 直跑：node tools/tests/test-settings-wiring.js）
   目标（所有者 2026-10-25 指令）：YT PRO Settings 中不得存在「打开也无任何行为」的死开关。
   方法：从 script.js 面板 HTML 提取全部 sttCnf 开关键；统计 script.js 内全部 getItem 键的
   读取次数——面板可见但读取数为 0 即死开关（只有写入，无行为消费方）。
   已知死开关：ytpro_seekSwipe（台账 P2，holdTimer 竞态导致开启后无触发路径）。 */
var fs = require("fs");
var path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "..", "scripts", "script.js"), "utf8");

/* 静态正则收集 script.js 内全部 getItem 键的读取次数（match 返回完整串，去壳取键名） */
var getItemMatches = src.match(/getItem\(["'][^"']*["']\)/g) || [];
var counts = {};
getItemMatches.forEach(function (full) {
  var k = full.slice(8, -1); /* 去掉 getItem( 与 ) */
  if (k.length > 1 && (k.charAt(0) === '"' || k.charAt(0) === "'") && k.charAt(k.length - 1) === k.charAt(0)) {
    k = k.slice(1, -1);
  }
  counts[k] = (counts[k] || 0) + 1;
});

/* 1) 面板 sttCnf 开关键清单 */
var keyPrefix = 'data-action="sttCnf" data-value="';
var keyMatches = src.match(/data-action="sttCnf" data-value="[^"]*"/g) || [];
var keys = [];
keyMatches.forEach(function (full) {
  var k = full.slice(keyPrefix.length, -1);
  if (keys.indexOf(k) < 0) { keys.push(k); }
});

/* 2) 已知例外：无（修复后应无死开关）。新开关入面板时若暂无行为方，须在此登记并留 TODO */
var knownDead = [];

var dead = keys.filter(function (k) { return !(counts[k] > 0); });
var undocumented = dead.filter(function (k) { return knownDead.indexOf(k) < 0; });

if (undocumented.length) {
  console.log("FAIL：存在未登记的死开关（面板可见但无任何行为读取方）：");
  undocumented.forEach(function (k) { console.log("  - " + k); });
  process.exit(1);
}
if (dead.length) {
  console.log("WARN：登记在案的死开关（等待修复）：");
  dead.forEach(function (k) { console.log("  - " + k); });
}
if (!dead.length && !undocumented.length) {
  console.log("PASS：面板 " + keys.length + " 个开关全部有真实行为读取方");
}

/* ===== 行为级检查：读取方存在 ≠ 功能可用（P2：seekSwipe 逻辑死锁） ===== */
var failures2 = [];
/* seekSwipeEligible 引用 localStorage/holdActive/holdTimer/document/isHoldTarget 全局，
   以参数注入桩；断言「默认开启的长按倍速不再压死横滑候选」（台账 P2 修复判据）。 */
function extractFn(name) {
  var marker = "function " + name + "(";
  var i = src.indexOf(marker);
  if (i < 0) { return null; }
  var d = 0, j = src.indexOf("{", i);
  for (var k = j; k < src.length; k++) {
    if (src[k] === "{") { d++; }
    else if (src[k] === "}") { d--; if (d === 0) { return src.slice(i, k + 1); } }
  }
  return null;
}
var eligibleSrc = extractFn("seekSwipeEligible");
if (!eligibleSrc) {
  console.log("FAIL：找不到 seekSwipeEligible（横滑跳转开关的行为体）");
  process.exit(1);
}
function runEligible(holdActive, holdTimer) {
  var ls = { getItem: function (k) { return k === "ytpro_seekSwipe" ? "true" : null; } };
  var doc = { fullscreenElement: {}, webkitFullscreenElement: null };
  var isHoldTarget = function () { return true; };
  var fn = new Function("localStorage", "holdActive", "holdTimer", "document", "isHoldTarget", eligibleSrc + "\nreturn seekSwipeEligible;");
  return fn(ls, holdActive, holdTimer, doc, isHoldTarget)({ touches: [{}] });
}
if (!(runEligible(false, "pending-timer") === true)) {
  failures2.push("P2: 长按计时未到期（pending holdTimer）时横滑候选应可用（默认 holdSpeed 下 seekSwipe 曾因此永不激活）");
}
if (!(runEligible(true, null) === false)) {
  failures2.push("P2: 2X 已生效（holdActive）时横滑仍应退出");
}
if (!(runEligible(false, null) === true)) {
  failures2.push("P2: 无长按干扰时横滑候选应可用");
}
if (failures2.length) {
  console.log("FAIL：行为级检查未通过：");
  failures2.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
console.log("PASS：开关接线与行为级检查全部通过（seekSwipe 在默认 holdSpeed 下可用）");
