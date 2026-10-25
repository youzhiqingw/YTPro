/* 下载按钮交接链路回归测试（Node 直跑：node tools/tests/test-download-default.js）
   目标行为（项目所有者 2026-10-25 指令，台账 P1 执行记录）：
   1) 有 YTDLnis → 直接 Android.sendToDownloader；
   2) 没有 → 走 Android.shareText 弹系统选择器，用户自选其他第三方；
   3) 内置面板（#download hash）绝不作为默认路径，仅 chooser 桥缺失（旧 APK）时兜底。
   实现方式：从 scripts/script.js 提取真实的 ytproSendToDownloader() 函数体，
   在桩 Android/window 环境中执行并断言。 */
var fs = require("fs");
var path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "..", "scripts", "script.js"), "utf8");
var start = src.indexOf("function ytproSendToDownloader(){");
var end = src.indexOf("/*Download Button*/", start);
if (start < 0 || end < 0) { console.log("FAIL: 无法提取 ytproSendToDownloader"); process.exit(1); }
var fnCode = src.slice(start, end);

function run(hasYtdlnis, shareTextThrows) {
  var calls = { send: 0, share: 0 };
  var Android = {
    hasThirdPartyDownloader: function () { return hasYtdlnis; },
    sendToDownloader: function () { calls.send++; },
    shareText: function () {
      if (shareTextThrows) { throw new Error("bridge missing (old APK)"); }
      calls.share++;
    },
  };
  var win = { location: { href: "https://m.youtube.com/watch?v=abc&si=xyz", hash: "" } };
  var fn = new Function("Android", "window", fnCode + "\nreturn ytproSendToDownloader;");
  fn(Android, win)();
  return { calls: calls, hash: win.location.hash };
}

var failures = [];
var r1 = run(true, false);
if (!(r1.calls.send === 1 && r1.calls.share === 0 && r1.hash === "")) {
  failures.push("用例1: 有 YTDLnis 应直接 sendToDownloader（got send=" + r1.calls.send + " share=" + r1.calls.share + " hash=" + JSON.stringify(r1.hash) + "）");
}
var r2 = run(false, false);
if (!(r2.calls.share === 1 && r2.calls.send === 0 && r2.hash === "")) {
  failures.push("用例2: 无 YTDLnis 应弹系统 chooser 自选第三方（got share=" + r2.calls.share + " hash=" + JSON.stringify(r2.hash) + "）");
}
var r3 = run(false, true);
if (r3.hash !== "download") {
  failures.push("用例3: chooser 桥缺失（旧 APK）时才回退内置面板（got hash=" + JSON.stringify(r3.hash) + "）");
}

if (failures.length) {
  console.log("FAIL：");
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
console.log("PASS：下载链路三条分支均符合目标行为");
