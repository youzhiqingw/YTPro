/* P1 回归测试（Node 直跑：node tools/tests/test-manifest-queries.js）
   manifest 必须声明 <queries>（com.deniscerri.ytdl），否则 Android 11+ 包可见性
   过滤使 hasThirdPartyDownloader() 恒为 false，「默认 YTDLnis」结构性失效。
   台账：docs/git历史遗留问题核查.md P1。 */
var fs = require("fs");
var path = require("path");
var mf = fs.readFileSync(path.join(__dirname, "..", "..", "app", "src", "main", "AndroidManifest.xml"), "utf8");

var failures = [];
if (mf.indexOf("<queries>") < 0) {
  failures.push("manifest 缺少 <queries> 元素");
}
if (mf.indexOf("com.deniscerri.ytdl") < 0) {
  failures.push("manifest 未声明 com.deniscerri.ytdl 包可见性");
}
if (mf.indexOf("QUERY_ALL_PACKAGES") > -1) {
  failures.push("不应使用 QUERY_ALL_PACKAGES（过宽；单包 <queries> 即可）");
}

if (failures.length) {
  console.log("FAIL：");
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
console.log("PASS：manifest 包可见性声明满足「默认 YTDLnis」检测前提");
