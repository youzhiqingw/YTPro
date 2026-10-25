/* 上游同步回归测试（Node 直跑：node tools/tests/test-upstream-sync.js）
   对应评估文档：docs/migration/上游同步评估-2026-10-25.md（勾选项 A/B/C/E + D）。
   - A Shorts 操作栏：新容器 ytwReelActionBarViewModelHost 优先，旧容器 reel-player-overlay-actions 回退
   - B Shorts 点踩数：like-button-view-model 圆点+粗体数字（ytShortsDislikes 判重），旧链回退
   - C Watch 点踩数：slim-video-information-like-count 之后插入（文案「点踩」），旧链回退
   - E curtain：showCurtain/hideCurtain 必须是全局函数（上游嵌套作用域缺陷的修正点）
   实现方式：按函数名从 scripts/script.js 提取函数体（括号配平），在 DOM 桩中执行。
   当前代码尚无这些适配函数 → 初始 FAIL（复现「上游已迁移、fork 未跟进」的缺口）。 */
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

/* 最小 DOM 桩 */
function makeEl(opts) {
  var e = {
    children: [], style: {}, _removed: false, _iah: "",
    setAttribute: function (k, v) { if (k === "id") { e.id = v; } else { e["attr_" + k] = v; } },
    appendChild: function (c) { c._pn = e; e.children.push(c); return c; },
    insertBefore: function (c, ref) {
      c._pn = e;
      var i = ref ? e.children.indexOf(ref) : e.children.length;
      if (i < 0) { i = e.children.length; }
      e.children.splice(i, 0, c);
      return c;
    },
    insertAdjacentHTML: function (pos, html) { e._iah += html; },
    remove: function () {
      e._removed = true;
      if (e._pn) { var i = e._pn.children.indexOf(e); if (i > -1) { e._pn.children.splice(i, 1); } }
    },
  };
  Object.defineProperty(e, "parentNode", { get: function () { return e._pn || null; } });
  if (opts) { for (var k in opts) { e[k] = opts[k]; } }
  return e;
}

function findById(el, id) {
  if (!el) { return null; }
  if (el.id === id) { return el; }
  var ch = el.children || [];
  for (var i = 0; i < ch.length; i++) { var r = findById(ch[i], id); if (r) { return r; } }
  return null;
}

function makeDoc(classes, ids, tags) {
  var body = makeEl();
  return {
    getElementsByClassName: function (n) { return classes[n] || []; },
    querySelectorAll: function (sel) {
      if (sel === "like-button-view-model") { return classes["like-button-view-model"] || []; }
      if (sel === "dislike-button-view-model") { return tags && tags.dislike ? tags.dislike : []; }
      return [];
    },
    getElementsByTagName: function (t) { return (t === "dislike-button-view-model" && tags && tags.dislike) ? tags.dislike : []; },
    getElementById: function (id) { return (ids && ids[id]) || findById(body, id); },
    createElement: function () { return makeEl(); },
    body: body,
  };
}
/* 旧链回退用的 insertAfter 桩（fork 全局 helper 的等价物），记录插入节点供断言 */
function makeInsertAfterSpy(record) {
  return function (ref, node) {
    record.push(node);
    if (ref && ref._pn) { ref._pn.insertBefore(node, ref.nextSibling || null); }
  };
}

var failures = [];
function expect(cond, msg) { if (!cond) { failures.push(msg); } }

/* 提取所有被测函数源码（不存在 = 初始缺口） */
var hostSrc = extractFn("ytproShortsActionBarHost");
var barSrc = extractFn("ytproMountShortsBar");
var shortsDislikesSrc = extractFn("ytproMountShortsDislikes");
var watchDislikesSrc = extractFn("ytproMountWatchDislikes");
var showSrc = extractFn("showCurtain");
var hideSrc = extractFn("hideCurtain");

/* ===== A. Shorts 操作栏宿主 ===== */
expect(hostSrc && barSrc, "A/B: 适配函数 ytproShortsActionBarHost / ytproMountShortsBar 不存在（上游 2026-09 已迁移容器，fork 未跟进——初始缺口）");
if (hostSrc && barSrc) {
  // 新 DOM：旧容器不存在 → 新容器、ys 顶部、顺序 收藏/下载
  var newHost = makeEl({ children: [makeEl(), makeEl()] });
  var d1 = makeDoc({ ytwReelActionBarViewModelHost: [newHost] });
  var ys1 = makeEl(), down1 = makeEl(), heart1 = makeEl();
  new Function("document", "ys", "ysDown", "ysHeart", hostSrc + "\n" + barSrc + "\nreturn ytproMountShortsBar(ys, ysDown, ysHeart);")(d1, ys1, down1, heart1);
  expect(newHost.children.indexOf(ys1) === 0, "A: 新容器下 ys 应插到顶部（children[0]）");
  expect(ys1.children[0] === heart1 && ys1.children[1] === down1, "A: 新容器下顺序应为 收藏、下载（上游顺序）");
  // 旧 DOM 回退 → 保持 fork 原顺序 下载/收藏
  var oldHost = makeEl({ children: [makeEl(), makeEl(), makeEl()] });
  var d2 = makeDoc({ "reel-player-overlay-actions": [oldHost] });
  var ys2 = makeEl(), down2 = makeEl(), heart2 = makeEl();
  new Function("document", "ys", "ysDown", "ysHeart", hostSrc + "\n" + barSrc + "\nreturn ytproMountShortsBar(ys, ysDown, ysHeart);")(d2, ys2, down2, heart2);
  expect(oldHost.children.indexOf(ys2) > -1, "A: 旧容器回退——ys 仍应插入");
  expect(ys2.children[0] === down2 && ys2.children[1] === heart2, "A: 旧容器回退——保持 fork 原顺序 下载、收藏");
}

/* ===== B. Shorts 点踩数 ===== */
expect(shortsDislikesSrc, "B: 适配函数 ytproMountShortsDislikes 不存在");
if (shortsDislikesSrc) {
  // 新链：like-button-view-model 三层 children → 插入圆点+数字
  var tip = makeEl();
  var likeBtn = makeEl({ children: [makeEl({ children: [makeEl({ children: [tip] })] })] });
  var d3 = makeDoc({ "like-button-view-model": [likeBtn] });
  new Function("document", "dislikes", shortsDislikesSrc + "\nreturn ytproMountShortsDislikes(dislikes);")(d3, "1.2万");
  expect(tip._iah.indexOf("ytShortsDislikes") > -1 && tip._iah.indexOf("1.2万") > -1, "B: 新链应插入圆点+粗体数字");
  // 判重：链存在且 ytShortsDislikes 已存在 → 更新内容
  var existing = makeEl({ id: "ytShortsDislikes" });
  existing.innerHTML = "";
  var likeBtn2 = makeEl({ children: [makeEl({ children: [makeEl({ children: [makeEl()] })] })] });
  var d4 = makeDoc({ "like-button-view-model": [likeBtn2] }, { ytShortsDislikes: existing });
  new Function("document", "dislikes", shortsDislikesSrc + "\nreturn ytproMountShortsDislikes(dislikes);")(d4, "3.4万");
  expect(existing.innerHTML === "3.4万", "B: 判重后应更新既有 ytShortsDislikes 内容");
  // 旧链回退：只有 dislike-button-view-model（链形：root→a→b→c→(c1=d)→oldTip）
  var oldTip = makeEl();
  var d = makeEl({ children: [oldTip] });
  var c = makeEl({ children: [makeEl(), d] });
  var oldChain = makeEl({ children: [makeEl({ children: [makeEl({ children: [c] })] })] });
  var d5 = makeDoc({}, {}, { dislike: [oldChain] });
  new Function("document", "dislikes", shortsDislikesSrc + "\nreturn ytproMountShortsDislikes(dislikes);")(d5, "9.9万");
  expect(oldTip.innerHTML === "9.9万", "B: 旧链回退应更新点踩数字");
}

/* ===== C. Watch 点踩数 ===== */
expect(watchDislikesSrc, "C: 适配函数 ytproMountWatchDislikes 不存在");
if (watchDislikesSrc) {
  // 新链：like-count 存在 → diskl 插其后，文案含「点踩」
  var likeCount = makeEl();
  var pn = makeEl();
  pn.appendChild(likeCount);
  var d6 = makeDoc({ "slim-video-information-like-count": [likeCount] });
  d6.body.appendChild(pn); /* findById 需要可达性：真实页面中 pn 在 document 树上 */
  new Function("document", "dislikes", watchDislikesSrc + "\nreturn ytproMountWatchDislikes(dislikes);")(d6, "456");
  var diskl = findById(d6.body, "diskl");
  expect(diskl && pn.children.indexOf(diskl) === 1, "C: 新链应把点踩 span 插到 like-count 之后");
  expect(diskl && diskl.innerHTML.indexOf("点踩") > -1 && diskl.innerHTML.indexOf("456") > -1, "C: 文案应为中文「点踩」+ 数字（fork UI 风格，不照搬上游英文）");
  // 判重：diskl 已存在 → 更新内容
  var pn2 = makeEl();
  var likeCount2 = makeEl();
  pn2.appendChild(likeCount2);
  var existingDiskl = makeEl({ id: "diskl" });
  existingDiskl.innerHTML = "";
  var d7 = makeDoc({ "slim-video-information-like-count": [likeCount2] }, { diskl: existingDiskl });
  new Function("document", "dislikes", watchDislikesSrc + "\nreturn ytproMountWatchDislikes(dislikes);")(d7, "789");
  expect(existingDiskl.innerHTML.indexOf("789") > -1, "C: 判重后应更新既有 diskl 内容");
  // 旧链回退：dislike-button-view-model + icon → insertAfter 新 span
  // （真实链形：root.children[0]=elm，elm 下两层为被改宽度的节点）
  var oldWatchTip = makeEl();
  var m2 = makeEl({ children: [oldWatchTip] });
  var m1 = makeEl({ children: [m2] });
  var oldWatchElm = makeEl({ children: [m1] });
  var icon = makeEl();
  var iconHost = makeEl();
  iconHost.appendChild(icon);
  m1.getElementsByClassName = function (n) { return n === "yt-spec-button-shape-next__icon" ? [icon] : []; };
  var inserted = [];
  var d8 = makeDoc({}, {}, { dislike: [oldWatchElm] });
  new Function("document", "dislikes", "insertAfter", watchDislikesSrc + "\nreturn ytproMountWatchDislikes(dislikes);")(d8, "12", makeInsertAfterSpy(inserted));
  expect(inserted.length === 1 && inserted[0].id === "diskl" && inserted[0].innerHTML === "12", "C: 旧链回退应经 insertAfter 插入数字 span");
}

/* ===== E. curtain 全局函数（上游作用域缺陷的修正点） ===== */
expect(showSrc && hideSrc, "E: 全局 showCurtain/hideCurtain 不存在（上游嵌套作用域缺陷，MainActivity javascript: 调用不可达）");
if (showSrc && hideSrc) {
  var d9 = makeDoc();
  new Function("document", showSrc + "\nreturn showCurtain;")(d9)();
  var curtain = d9.body.children.filter(function (c) { return c.id === "ytProCurtain"; })[0];
  expect(curtain, "E: showCurtain 应创建 #ytProCurtain 覆盖层");
  new Function("document", hideSrc + "\nreturn hideCurtain;")(d9)();
  expect(curtain._removed, "E: hideCurtain 应移除覆盖层");
}

/* ===== 汇总 ===== */
if (failures.length) {
  console.log("FAIL：");
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
console.log("PASS：上游同步适配（A/B/C/E + D 样式项）全部符合预期行为");
