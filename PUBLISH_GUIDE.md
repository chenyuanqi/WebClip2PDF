# Chrome Web Store 发布指南

本文档详细说明如何将 WebClip2PDF 扩展发布到 Chrome Web Store。

## 📋 准备工作

### 1. 检查扩展完整性

确保以下文件都已准备好：

- [x] `manifest.json` - 扩展配置文件
- [x] `popup.html` - 弹出窗口界面
- [x] `scripts/` - 所有脚本文件
- [x] `styles/` - 所有样式文件
- [x] `icons/` - 图标文件（需要准备）

### 2. 准备图标资源

Chrome Web Store 需要多个尺寸的图标：

**必需的图标：**
- `icon16.png` - 16x16px（扩展栏图标）
- `icon32.png` - 32x32px（扩展管理页面）
- `icon48.png` - 48x48px（扩展管理页面）
- `icon128.png` - 128x128px（Chrome Web Store 和安装界面）

**商店页面所需图片：**
- **应用图标** - 128x128px（必需）
- **宣传图片（小）** - 440x280px（必需）
- **宣传图片（大）** - 920x680px（可选但推荐）
- **宣传图片（侯爵）** - 1400x560px（可选）
- **屏幕截图** - 1280x800px 或 640x400px（至少 1 张，最多 5 张）

### 3. 创建图标文件夹

```bash
cd /Users/yuanqi/www/mine/WebClip2PDF/extension
mkdir -p icons
```

您需要使用设计工具（如 Figma、Photoshop、Canva）创建这些图标。建议：
- 使用简洁的设计，清晰可辨
- 主色调可以使用插件的紫色渐变 (#667eea 到 #764ba2)
- 图标主题：截图/PDF/网页相关

### 4. 更新 manifest.json

确保 `manifest.json` 包含正确的图标路径：

```json
{
  "name": "WebClip2PDF",
  "version": "1.0.0",
  "description": "网页截图和 PDF 生成工具，支持元素选择、整页截取、网页保存",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

## 🎨 创建宣传资料

### 屏幕截图建议

拍摄 3-5 张展示核心功能的屏幕截图：

1. **元素选择截图** - 展示鼠标悬停元素高亮的界面
2. **弹出窗口** - 展示主界面，包含截图列表
3. **编辑标题** - 展示编辑功能
4. **PDF预览** - 展示生成的 PDF 包含目录页
5. **整页截取** - 展示长页面截取效果

截图技巧：
- 使用 1280x800px 的浏览器窗口
- 选择干净、美观的测试页面
- 可以添加箭头、高亮等标注说明功能

### 商店描述文案

准备好中文和英文描述（Chrome Web Store 支持多语言）：

**简短描述（132 字符以内）：**
```
强大的网页截图和 PDF 生成工具。支持元素选择、整页截取、自定义标题、PDF 目录生成。
```

**详细描述：**
```markdown
# WebClip2PDF - 专业的网页截图与 PDF 工具

## ✨ 核心功能

### 📸 智能截图
- **元素选择模式** - 鼠标悬停自动识别 HTML 元素，一键截取
- **自定义区域** - 手动绘制选择框，精确控制截图范围
- **整页截取** - 自动滚动拼接，完美捕获长页面内容
- **高清输出** - 支持高 DPI 屏幕，保证截图清晰

### 📄 网页保存
- **HTML 保存** - 完整保存网页内容和样式
- **一键打印** - 保存后自动打开，方便转换为 PDF

### 🎯 智能管理
- **可编辑标题** - 随时修改截图标题和文件名
- **批量选择** - 全选、反选，灵活管理截图列表
- **预览功能** - 点击缩略图快速预览完整截图
- **文件定位** - 一键在文件夹中显示已保存的截图

### 📚 PDF 生成
- **自动目录** - 生成精美的 PDF 目录页，展示所有截图标题
- **自定义文件名** - PDF 文件名使用截图标题，便于识别
- **批量转换** - 选中多张截图，一键合并为 PDF

## 🎨 现代化设计
- 紫色渐变主题，视觉优雅
- 毛玻璃效果，界面精致
- 流畅动画，操作舒适

## 🔒 隐私保护
- 所有数据本地存储
- 不上传任何信息到服务器
- 开源透明

## 💡 使用场景
- 📖 技术文档收集
- 🎓 网课笔记整理
- 🛍️ 购物记录保存
- 📰 新闻文章存档
- 🎨 设计灵感收集
- 💼 工作汇报准备

## 🚀 快速开始
1. 点击扩展图标打开面板
2. 选择截图模式（元素选择/自定义区域/整页）
3. 编辑标题，管理截图
4. 选中截图，生成 PDF

享受高效的网页内容收集体验！
```

## 📦 打包扩展

### 1. 清理开发文件

删除不需要发布的文件：
```bash
cd /Users/yuanqi/www/mine/WebClip2PDF/extension
# 删除开发工具相关文件
rm -rf .git .gitignore node_modules .DS_Store
```

### 2. 创建 ZIP 包

**方法 A：使用命令行**
```bash
cd /Users/yuanqi/www/mine/WebClip2PDF
zip -r webclip2pdf-v1.0.0.zip extension/ -x "*.DS_Store" "*.git*" "*node_modules*"
```

**方法 B：使用 Finder**
1. 右键点击 `extension` 文件夹
2. 选择"压缩"
3. 重命名为 `webclip2pdf-v1.0.0.zip`

### 3. 验证 ZIP 包

解压到新文件夹测试，确保：
- 所有文件都在
- 没有多余的开发文件
- 图标文件存在且正确

## 🏪 发布到 Chrome Web Store

### 第一步：注册开发者账号

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 使用 Google 账号登录
3. 支付 **$5 USD** 一次性注册费（使用信用卡）
4. 填写开发者信息
5. 同意开发者协议

### 第二步：上传扩展

1. 在 Developer Dashboard 点击 **"New Item"**
2. 点击 **"Choose file"** 上传 ZIP 包
3. 上传成功后会自动跳转到商店信息页面

### 第三步：填写商店信息

#### 基本信息
- **扩展名称**: WebClip2PDF
- **简短描述**: 强大的网页截图和 PDF 生成工具。支持元素选择、整页截取、自定义标题、PDF 目录生成。
- **详细描述**: （粘贴上面准备的详细描述）
- **类别**: Productivity（生产力工具）
- **语言**: Chinese (Simplified) - 中文（简体）

#### 图标和宣传图片
- **应用图标**: 上传 128x128px 图标
- **宣传图片**:
  - 上传至少 1 张 1280x800px 或 640x400px 的屏幕截图
  - 建议上传 3-5 张展示不同功能
- **宣传横幅**: 上传 440x280px 小图（必需）
- **宣传大图**: 上传 920x680px 大图（推荐）

#### 其他信息
- **官方网站**: （如果有）
- **支持页面**: （可以用 GitHub Issues 页面）
  ```
  https://github.com/yourusername/WebClip2PDF/issues
  ```
- **隐私政策**: （必需，见下方模板）

### 第四步：隐私政策

Chrome Web Store 要求提供隐私政策。您可以创建一个简单的 HTML 页面：

**privacy-policy.html:**
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>WebClip2PDF - 隐私政策</title>
  <style>
    body {
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
    }
    h1 { color: #667eea; }
    h2 { color: #764ba2; margin-top: 30px; }
  </style>
</head>
<body>
  <h1>隐私政策</h1>
  <p>最后更新：2025年10月1日</p>

  <h2>数据收集</h2>
  <p>WebClip2PDF 不会收集、存储或传输您的任何个人信息或浏览数据。</p>

  <h2>本地存储</h2>
  <p>所有截图、网页内容和设置均存储在您的本地计算机上，通过 Chrome 的本地存储 API。这些数据不会上传到任何服务器。</p>

  <h2>权限使用</h2>
  <ul>
    <li><strong>activeTab</strong> - 用于截取当前标签页的可见内容</li>
    <li><strong>scripting</strong> - 用于注入选择层脚本，实现元素选择功能</li>
    <li><strong>storage</strong> - 用于在本地保存截图缩略图和设置</li>
    <li><strong>downloads</strong> - 用于保存截图和 PDF 文件到本地</li>
  </ul>

  <h2>第三方服务</h2>
  <p>WebClip2PDF 不使用任何第三方服务或分析工具。</p>

  <h2>联系我们</h2>
  <p>如有任何隐私相关问题，请联系：your-email@example.com</p>
</body>
</html>
```

将此文件：
1. 上传到 GitHub Pages 或您的个人网站
2. 或使用 Gist（https://gist.github.com）托管
3. 在商店信息页面填写隐私政策 URL

### 第五步：设置定价和分发

- **定价**: 选择"Free"（免费）
- **分发区域**: 选择"All regions"（所有地区）或指定国家/地区
- **可见性**:
  - **Public** - 任何人都能搜索到（推荐）
  - **Unlisted** - 只有知道链接的人可以安装
  - **Private** - 仅限指定用户

### 第六步：提交审核

1. 检查所有信息是否完整
2. 点击页面底部 **"Submit for Review"**
3. 确认提交

## ⏰ 审核流程

### 审核时间
- **初次提交**: 通常需要 1-3 个工作日
- **后续更新**: 通常需要几小时到 1 天

### 审核标准

Chrome 会检查：
- ✅ 扩展功能与描述一致
- ✅ 没有恶意代码
- ✅ 遵守内容政策
- ✅ 隐私政策完整
- ✅ 请求的权限合理
- ✅ 图标和截图符合规范

### 可能被拒原因

常见拒绝原因：
1. **权限过度** - 请求了不必要的权限
2. **描述误导** - 功能描述与实际不符
3. **缺少隐私政策** - 必须提供隐私政策 URL
4. **图片不合规** - 图标或截图质量差、尺寸不对
5. **代码质量问题** - 代码混淆、包含恶意逻辑

### 审核通过后

收到通过邮件后：
1. 扩展会立即在 Chrome Web Store 上线
2. 用户可以搜索和安装
3. 您会获得一个商店页面链接，例如：
   ```
   https://chrome.google.com/webstore/detail/your-extension-id
   ```

## 🔄 后续更新

### 发布新版本

1. 修改 `manifest.json` 中的 `version` 号
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. 重新打包 ZIP

3. 在 Developer Dashboard 找到您的扩展

4. 点击 **"Package"** → **"Upload Updated Package"**

5. 上传新的 ZIP 文件

6. 更新"What's new in this version"（更新说明）

7. 提交审核

### 版本号规则

遵循语义化版本（Semantic Versioning）：
- **主版本号** (1.0.0 → 2.0.0) - 重大更新，可能不兼容
- **次版本号** (1.0.0 → 1.1.0) - 新功能，向后兼容
- **修订号** (1.0.0 → 1.0.1) - Bug 修复，小改进

## 📊 监控和反馈

### 查看统计数据

在 Developer Dashboard 可以看到：
- 安装次数
- 活跃用户数
- 评分和评论
- 崩溃报告

### 回复用户评论

- 及时回复用户评论和反馈
- 解决用户报告的 Bug
- 考虑用户的功能建议

### 监控错误

建议添加错误日志：
```javascript
// 在 background.js 添加全局错误处理
chrome.runtime.onInstalled.addListener(() => {
  console.log('WebClip2PDF installed');
});

// 监听错误
self.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});
```

## ⚠️ 注意事项

### 商店政策

务必遵守：
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program_policies/)

关键要点：
- 不能包含恶意软件
- 不能误导用户
- 不能侵犯版权
- 权限必须有明确用途
- 必须保护用户隐私

### 开发者账号维护

- 保持联系邮箱有效
- 及时响应 Chrome 团队的邮件
- 定期更新扩展，修复 Bug
- 遵守新的 API 和政策变更

### 备份

- 保留所有版本的源代码
- 保存商店资料（图片、描述）
- 定期导出用户统计数据

## 🎯 发布检查清单

提交前确认：

- [ ] manifest.json 版本号正确
- [ ] 所有图标文件已创建并添加到 extension/icons/
- [ ] 准备了 3-5 张高质量屏幕截图
- [ ] 准备了宣传图片（440x280px 和 920x680px）
- [ ] 编写了详细的功能描述（中英文）
- [ ] 创建了隐私政策页面
- [ ] 测试了所有功能正常工作
- [ ] 打包成 ZIP 文件
- [ ] 注册了 Chrome Web Store 开发者账号
- [ ] 支付了 $5 注册费
- [ ] 上传了 ZIP 包
- [ ] 填写了所有商店信息
- [ ] 提交了审核

## 📚 相关资源

- [Chrome Web Store 开发者文档](https://developer.chrome.com/docs/webstore/)
- [Chrome Extensions 官方文档](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole)
- [扩展开发最佳实践](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)

## 💬 获取帮助

如遇问题：
1. 查看 [Chrome Web Store FAQ](https://developer.chrome.com/docs/webstore/faq/)
2. 访问 [Chromium Extensions Google Group](https://groups.google.com/a/chromium.org/g/chromium-extensions)
3. 在 Stack Overflow 搜索相关问题（标签：google-chrome-extension）

---

祝您发布顺利！🚀
