# YTPro 签名证书制作与云端 Release 发布方案（小白版）

> 目标：自建签名证书，只产出**已签名的 Release APK**（不产出 Debug 包），并保证安装包在多系统（Android 5.0+，各 CPU 架构）正常运行。
>
> ⚠️ 本方案所有命令均为 **Windows PowerShell** 下的**单行命令**，直接整行复制执行即可，**不要手动换行**。

---

## 0. 现状与结论

| 项 | 现状 | 处理 |
|---|---|---|
| 签名私钥 | 原仓库把作者私钥提交进了 Git（已泄露） | **弃用**，已删除，重新生成只属于你的密钥 |
| 构建类型 | 原 CI 先出未签名包再二次签名 | 改为 Gradle 直接产出**已签名** `app-release.apk` |
| Debug 包 | 易与正式包混淆 | CI 只跑 `assembleRelease`，只上传签名 Release |
| 多系统 | 纯 Java/WebView，无原生 `.so` | 单 APK 全架构通用；签名启用 v1+v2+v3 |

---

## 1. 安全红线（必读）

1. **私钥绝不提交 Git**。密钥文件、`keystore.properties`、含密码的文件都被 `.gitignore` 排除（已配好）。
2. 原仓库的 `apkeasytool.pk8` 是**公开泄露的私钥**，任何用它签名的包都可能被伪造替换，必须弃用。
3. 密钥和密码**离线备份一份**（U 盘/加密盘）。丢失后无法找回，也无法再覆盖安装升级。

---

## 2. 本地生成签名证书（Windows）

用 JDK 自带的 `keytool`（本机 `C:\Program Files\Java\jdk-17\bin` 已可用）。

在仓库目录（`D:\21186\Documents\GitHub\YTPro`）执行**这一整行**：

```powershell
keytool -genkeypair -v -keystore ytpro-release.jks -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10950 -alias ytpro -dname "CN=YTPro Release, OU=Personal, O=Personal, L=Beijing, ST=Beijing, C=CN"
```

随后按提示输入（输入密码时屏幕**不显示任何字符**，这是正常的）：

| 提示 | 你的操作 |
|---|---|
| `输入密钥库口令:` | 输入一个 ≥6 位密码，回车（**务必记下**） |
| `再次输入新口令:` | 再输一遍，回车 |
| `Is CN=YTPro Release ... correct? [no]:` | 输入 `yes`，回车 |
| `为 <ytpro> 输入密钥口令 (如果和密钥库口令相同, 按回车):` | **直接回车** |

完成后，仓库目录会多出一个 `ytpro-release.jks`（已被 `.gitignore` 忽略，不会提交）。

### 备份

把 `ytpro-release.jks` + 你的密钥库口令一起离线备份。丢失后同一个包名无法覆盖安装。

---

## 3. 本地配置与验证

### 3.1 新建 `keystore.properties`（仓库根目录）

在仓库根目录新建文本文件 `keystore.properties`，内容如下（把密码替换成你刚设的）：

```properties
storeFile=ytpro-release.jks
storePassword=你刚设的密码
keyAlias=ytpro
keyPassword=你刚设的密码
```

> 此文件已被 `.gitignore` 忽略，不会提交。

### 3.2 本地构建

```powershell
.\gradlew.bat assembleRelease
```

产物：`app\build\outputs\apk\release\app-release.apk`（已签名）。

### 3.3 校验签名

```powershell
java -jar signer\apksigner.jar verify --print-certs app\build\outputs\apk\release\app-release.apk
```

看到 `Verified using v1/v2/v3 scheme...` 即成功。

---

## 4. 云端（GitHub Actions）签名编译

### 4.1 把密钥转成 Base64 文本

在仓库目录执行（会把结果写到 `keystore_base64.txt`）：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ytpro-release.jks")) | Set-Content -NoNewline keystore_base64.txt
```

用记事本打开 `keystore_base64.txt`，**Ctrl+A 全选 → Ctrl+C 复制**整段内容备用。

### 4.2 添加 4 个 GitHub Secrets

打开 `https://github.com/youzhiqingw/YTPro` → **Settings → Secrets and variables → Actions → New repository secret**，逐个添加：

| Secret 名 | 值 |
|---|---|
| `KEYSTORE_BASE64` | 粘贴 4.1 复制的那段 Base64 |
| `STORE_PASSWORD` | 你设的密钥库口令 |
| `KEY_ALIAS` | `ytpro` |
| `KEY_PASSWORD` | 你设的密钥库口令（若上一步没单独设 key 密码，就是同一个） |

### 4.3 触发编译

推送到 `main` 分支，或在 Actions 页面手动 **Run workflow**。

> ⚠️ 顺序：**先建好 4 个 Secret 再推送**，否则 CI 解码步骤会失败。

### 4.4 下载产物

Actions 运行成功后 → 打开该次 run → 底部 **Artifacts → YTPRO-release** 下载已签名 APK。

---

## 5. 避免 Debug 包 & 多系统兼容

**只产 Release**：
- CI 只执行 `assembleRelease`，绝不执行 `assembleDebug`；
- Release 已开 `minifyEnabled true`（R8 混淆）+ ProGuard keep 规则 + 正式签名；
- 上传的 artifact 只有 `app-release.apk` 一个文件。

**多系统兼容**：
- `minSdkVersion 21` → Android 5.0 及以上全部可用；
- 纯 Java + WebView，**无原生 `.so`**，一个 APK 通吃所有 CPU 架构（arm64-v8a / armeabi-v7a / x86 / x86_64）；
- 签名同时启用 `v1`（Android 5/6）、`v2`（Android 7+）、`v3`（Android 9+，支持密钥轮换）；
- `targetSdkVersion 35`，兼容 Android 15 边缘到边缘新规。

---

## 6. 完整执行清单（Checklist）

- [ ] 1. 删除/忽略旧泄露密钥（已完成：`signer/apkeasytool.pk8`、`.pem` 已删）
- [ ] 2. 执行 §2 的单行 `keytool` 命令生成 `ytpro-release.jks`
- [ ] 3. 离线备份 keystore + 口令
- [ ] 4. 新建 `keystore.properties`（本地用，勿提交）
- [ ] 5. `.\gradlew.bat assembleRelease` 出已签名 APK，`apksigner verify` 验证
- [ ] 6. 用 §4.1 生成 `KEYSTORE_BASE64`
- [ ] 7. 在 GitHub 添加 4 个 Secrets
- [ ] 8. 推送 `main`（或手动 Run workflow）
- [ ] 9. Actions 成功 → 下载 `YTPRO-release`
- [ ] 10. 在 Android 5.0 真机/模拟器 + 高版本真机各安装验证一次

---

## 附录 A：keytool 速查（单行命令）

```powershell
# 生成（小白直接复制这行）
keytool -genkeypair -v -keystore ytpro-release.jks -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10950 -alias ytpro -dname "CN=YTPro Release, OU=Personal, O=Personal, L=Beijing, ST=Beijing, C=CN"

# 查看证书指纹/有效期
keytool -list -v -keystore ytpro-release.jks -alias ytpro

# 修改密钥库口令
keytool -storepasswd -keystore ytpro-release.jks

# 修改密钥口令
keytool -keypasswd -keystore ytpro-release.jks -alias ytpro
```

## 附录 B：`app/build.gradle` 签名片段（已写入）

```groovy
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile rootProject.file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
        }
    }
}
buildTypes {
    release {
        minifyEnabled true
        if (keystorePropertiesFile.exists()) {
            signingConfig signingConfigs.release
        }
    }
}
```

## 附录 C：为什么不用 Debug 包发布

- Debug 包用**公开的调试密钥**签名，任何人都能重签/替换；
- Debug 包未混淆、日志全开，体积大、易被反编译；
- Debug 包在部分机型上行为与 Release 不同（性能、权限提示等）。
因此发布必须用**自建 Release 密钥**签名。

## 常见问题（FAQ）

**Q1：`gradlew.bat` 提示「不是可识别的 cmdlet/命令」？**
PowerShell 默认不加载当前目录的命令，需加 `.\` 前缀，运行：
`.\gradlew.bat assembleRelease`

**Q2：命令报 `非法选项: \` 或 `-keystore 不是 cmdlet`？**
因为命令被分行了。请复制**一整行**（中间不要回车、不要加 `\`）。

**Q3：`keytool` 提示不是内部或外部命令？**
先确认 JDK 在 PATH：`keytool -version`。若不行，用全路径：
`"C:\Program Files\Java\jdk-17\bin\keytool.exe" -genkeypair ...`

**Q4：忘了密钥库口令怎么办？**
无法找回。只能删除 `ytpro-release.jks` 重新生成一个，并用新密钥重新构建（旧包需卸载重装）。
