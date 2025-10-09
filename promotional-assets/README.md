# WebClip2PDF 宣传素材

这个目录包含了用于 Chrome Web Store 发布的所有宣传素材。

## 📁 目录结构

```
promotional-assets/
├── README.md                      # 本文件
├── PROMOTIONAL_GUIDE.md           # 完整的宣传素材制作指南
├── templates/                     # HTML 模板文件
│   ├── small-promo-tile.html     # 小型宣传图块模板 (440x280)
│   └── large-promo-tile.html     # 大型宣传图块模板 (920x680)
└── images/                        # 生成的宣传图片 (待创建)
    ├── small-promo-tile.png
    ├── large-promo-tile.png
    ├── screenshot-1.png
    ├── screenshot-2.png
    ├── screenshot-3.png
    ├── screenshot-4.png
    └── screenshot-5.png
```

## 🚀 快速开始

### 方法 1: 使用 HTML 模板生成宣传图块

1. 用浏览器打开 `templates/small-promo-tile.html`
2. 使用浏览器的截图工具或扩展截图（确保尺寸为 440x280）
3. 保存为 `images/small-promo-tile.png`
4. 重复以上步骤处理 `large-promo-tile.html` (920x680)

### 方法 2: 使用实际扩展截图

1. 在浏览器中安装并运行 WebClip2PDF 扩展
2. 打开一个示例网页（建议使用有丰富内容的页面）
3. 按照以下场景截图：

#### Screenshot 1: 自定义区域截图
- 点击"开始截取"
- 在页面上拖拽选择一个区域
- 截取展示选择框和光标的画面

#### Screenshot 2: 控制面板
- 点击扩展图标打开弹窗
- 截取完整的弹窗界面（包含所有按钮）

#### Screenshot 3: 截图管理
- 添加 3-4 张截图后
- 截取显示截图列表的弹窗界面

#### Screenshot 4: PDF 生成过程
- 勾选几张截图
- 点击"生成 PDF"
- 截取生成过程或结果

#### Screenshot 5: 整页截图
- 在长页面上使用"截取整页"功能
- 展示完整网页的截图效果

## 📐 图片规格要求

| 类型 | 尺寸 | 格式 | 必需性 |
|------|------|------|--------|
| 小型宣传图块 | 440 x 280 | PNG/JPEG | ✅ 必需 |
| 大型宣传图块 | 920 x 680 | PNG/JPEG | 推荐 |
| 截图 | 1280 x 800 | PNG/JPEG | 强烈推荐 3-5 张 |
| 应用图标 | 128 x 128 | PNG | ✅ 已有 |

## 🎨 设计建议

### 颜色方案
- 主色: `#667eea` (渐变蓝紫)
- 辅助色: `#764ba2` (深紫)
- 背景: 白色或浅灰

### 文字说明
每张截图可以添加简短的功能说明：
1. "拖拽选择任意区域，精准截图"
2. "简洁直观的操作界面"
3. "轻松管理多张截图"
4. "一键生成 PDF，保持原始质量"
5. "支持整页截图，长页面无压力"

## 🛠️ 推荐工具

### 截图工具
- **Chrome 扩展**: [Full Page Screen Capture](https://chrome.google.com/webstore/detail/full-page-screen-capture/fdpohaocaechififmbbbbbknoalclacl)
- **macOS**: `Cmd + Shift + 4` (区域截图)
- **Windows**: `Win + Shift + S` (截图工具)
- **在线工具**: [screenshot.guru](https://screenshot.guru/)

### 图片编辑
- **在线**: [Figma](https://figma.com/) (免费，推荐)
- **在线**: [Canva](https://canva.com/) (模板丰富)
- **桌面**: Photoshop, Sketch, Affinity Photo

### 图片压缩
- [TinyPNG](https://tinypng.com/) - 在线压缩
- [Squoosh](https://squoosh.app/) - Google 出品
- 目标: 保持清晰度的同时控制在 200KB 以内

## ✅ 检查清单

上传前请确认：

- [ ] 所有图片尺寸正确
- [ ] 图片格式为 PNG 或 JPEG
- [ ] 图片内容清晰，无模糊或锯齿
- [ ] 文字大小适中，易于阅读
- [ ] 展示的是实际功能，无误导性内容
- [ ] 未使用 Chrome 品牌相关元素
- [ ] 图片大小合理（<200KB 每张）
- [ ] 至少准备 3 张高质量截图

## 📝 上传到 Chrome Web Store

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 登录你的开发者账户
3. 选择 WebClip2PDF 扩展（或创建新扩展）
4. 进入 "Store listing" 标签页
5. 上传宣传素材：
   - **Icon**: 已在 extension/assets/ 目录
   - **Small promo tile**: `images/small-promo-tile.png` ✅ 必需
   - **Screenshots**: `images/screenshot-1~5.png` 推荐 3-5 张
   - **Large promo tile**: `images/large-promo-tile.png` (可选)
6. 填写描述信息
7. 保存并提交审核

## 💡 提示

- 使用真实的使用场景截图更有说服力
- 可以添加箭头、标注来突出关键功能
- 保持设计风格统一
- 定期更新截图以反映新功能
- 参考热门扩展的宣传图片获取灵感

## 🔗 相关资源

- [Chrome Web Store 图片规范](https://developer.chrome.com/docs/webstore/images/)
- [Chrome Web Store 最佳实践](https://developer.chrome.com/docs/webstore/best_practices/)
- [完整发布指南](../docs/chrome-webstore-publish-guide.md)

## 📞 需要帮助？

如有问题，请查看 `PROMOTIONAL_GUIDE.md` 获取详细的设计指南和建议。
