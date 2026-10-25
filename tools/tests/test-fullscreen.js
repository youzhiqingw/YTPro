/* 全屏方向/画面自愈回归测试（Node 直跑：node tools/tests/test-fullscreen.js）
   所有者 2026-10-25 报告：详情页横屏转全屏竖屏时大小/位置/方向未自动匹配。
   根因（台账 P9）：ytproFullscreenIsPortrait 在视频元数据未就绪（videoWidth=0）时
   回退到播放器盒子尺寸——9:16 视频在 16:9 详情盒子中被判成横屏，方向/大小/位置全错；
   且 fullscreenchange 不重放方向与画面比例，进入全屏后无自愈路径。
   修复判据：
   1) ytproSyncFullscreen 存在：重报 Android.fullScreen + 重放 applyAspect；
   2) 元数据未就绪时挂 loadedmetadata 一次性重同步（自愈）；
   3) ytproFullscreenIsPortrait：videoWidth 可用时按真实分辨率判定；
   4) seekSwipe/curtain 等既有行为不受影响（由各自测试文件覆盖）。 */
var fs = require("fs");
var path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "..", "scripts", "script.js"), "utf8");

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

function makeEl(opts) {
  var e = { children: [], style: {}, _listeners: {} };
  if (opts) { for (var k in opts) { e[k] = opts[k]; } }
  e.addEventListener = function (type, fn) { (e._listeners[type] = e._listeners[type] || []).push(fn); };
  return e;
}

var failures = [];
function expect(cond, msg) { if (!cond) { failures.push(msg); } }

var portraitFn = extractFn("ytproFullscreenIsPortrait");
var syncFn = extractFn("ytproSyncFullscreen");

expect(portraitFn, "ytproFullscreenIsPortrait 缺失");
expect(syncFn, "ytproSyncFullscreen 缺失（全屏方向/画面无自愈路径——初始缺口）");

if (portraitFn) {
  function runIsPortrait(videoW, videoH, rectW, rectH) {
    var v = makeEl({ videoWidth: videoW, videoHeight: videoH });
    v.getBoundingClientRect = function () { return { width: rectW, height: rectH }; };
    var doc = { getElementsByClassName: function (n) { return n === "video-stream" ? [v] : []; } };
    return new Function("document", portraitFn + "\nreturn ytproFullscreenIsPortrait;")(doc)();
  }
  expect(runIsPortrait(720, 1280, 1280, 720) === true, "竖屏视频（元数据就绪）应判为竖屏");
  expect(runIsPortrait(1280, 720, 720, 1280) === false, "横屏视频（元数据就绪）应判为横屏");
  /* 元数据未就绪 + 详情页 16:9 盒子：现状回退误判为横屏——这是已记录的限制（P9 H1），
     由 ytproSyncFullscreen 的 loadedmetadata 重同步自愈；此处固定该行为防回归。 */
  expect(runIsPortrait(0, 0, 1280, 720) === false, "元数据未就绪时回退盒子判定（限制行为，自愈由重同步承担）");
  expect(runIsPortrait(0, 0, 720, 1280) === true, "元数据未就绪且盒子为竖屏时判为竖屏");
}

if (syncFn) {
  /* 场景 1：元数据就绪 → 立即重报方向 + 重放画面比例（组合体需含 IsPortrait 源） */
  var calls = [];
  var v1 = makeEl({ videoWidth: 720, videoHeight: 1280 });
  var d1 = { getElementsByClassName: function (n) { return n === "video-stream" ? [v1] : []; } };
  new Function("document", "Android", "applyAspect", portraitFn + "\n" + syncFn + "\nreturn ytproSyncFullscreen;")(
    d1,
    { fullScreen: function (b) { calls.push(b); } },
    function () { calls.push("aspect"); }
  )();
  expect(calls.indexOf(true) > -1, "ytproSyncFullscreen 应按视频真实分辨率重报方向");
  expect(calls.indexOf("aspect") > -1, "ytproSyncFullscreen 应重放 applyAspect（全屏大小匹配）");
  expect((v1._listeners["loadedmetadata"] || []).length === 0, "ytproSyncFullscreen 不应再逐次挂 loadedmetadata（已改为全局捕获）");
}

/* ===== E2. loadedmetadata 全局捕获（2026-10-25 二次强化） =====
   全屏中自动连播换片/元数据晚到时重报方向：ytproOnLoadedMetadata 仅在
   全屏激活时触发 ytproSyncFullscreen（非全屏换片由导航时机处理）。 */
var onMetaFn = extractFn("ytproOnLoadedMetadata");
expect(onMetaFn, "ytproOnLoadedMetadata 缺失（全屏中换片/元数据晚到无重报路径——初始缺口）");
if (onMetaFn && syncFn && portraitFn) {
  /* 全屏激活：应触发重同步 */
  var calls3 = [];
  var d3 = {
    fullscreenElement: makeEl(),
    getElementsByClassName: function (n) { return n === "video-stream" ? [makeEl({ videoWidth: 720, videoHeight: 1280 })] : []; },
  };
  new Function("document", "Android", "applyAspect", portraitFn + "\n" + syncFn + "\n" + onMetaFn + "\nreturn ytproOnLoadedMetadata;")(
    d3,
    { fullScreen: function (b) { calls3.push(b); } },
    function () { calls3.push("aspect"); }
  )();
  expect(calls3.length === 2, "全屏激活时 loadedmetadata 应触发重报方向+重放比例");
  /* 非全屏：不应触发（换片适配由 yt-navigate-finish 时机负责） */
  var calls4 = [];
  var d4 = {
    fullscreenElement: null,
    webkitFullscreenElement: null,
    getElementsByClassName: function (n) { return n === "video-stream" ? [makeEl({ videoWidth: 720, videoHeight: 1280 })] : []; },
  };
  new Function("document", "Android", "applyAspect", portraitFn + "\n" + syncFn + "\n" + onMetaFn + "\nreturn ytproOnLoadedMetadata;")(
    d4,
    { fullScreen: function (b) { calls4.push(b); } },
    function () { calls4.push("aspect"); }
  )();
  expect(calls4.length === 0, "非全屏时 loadedmetadata 不应触发重同步");
}

if (failures.length) {
  console.log("FAIL：");
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
console.log("PASS：全屏方向/画面自愈行为符合预期");
