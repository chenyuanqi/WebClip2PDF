#!/bin/bash

# WebClip2PDF 宣传素材生成脚本
# 用途：在浏览器中打开 HTML 模板以便截图

echo "🎨 WebClip2PDF 宣传素材生成工具"
echo "================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEMPLATES_DIR="$SCRIPT_DIR/templates"
IMAGES_DIR="$SCRIPT_DIR/images"

# 创建 images 目录（如果不存在）
if [ ! -d "$IMAGES_DIR" ]; then
  echo "📁 创建 images 目录..."
  mkdir -p "$IMAGES_DIR"
fi

echo "📂 模板目录: $TEMPLATES_DIR"
echo "💾 输出目录: $IMAGES_DIR"
echo ""

# 检查模板文件
if [ ! -f "$TEMPLATES_DIR/small-promo-tile.html" ]; then
  echo "❌ 错误: 找不到小型宣传图块模板"
  exit 1
fi

if [ ! -f "$TEMPLATES_DIR/large-promo-tile.html" ]; then
  echo "❌ 错误: 找不到大型宣传图块模板"
  exit 1
fi

echo "✅ 模板文件检查完成"
echo ""

# 显示菜单
echo "请选择要打开的模板:"
echo ""
echo "  1) 小型宣传图块 (440 x 280)"
echo "  2) 大型宣传图块 (920 x 680)"
echo "  3) 打开所有模板"
echo "  4) 查看使用说明"
echo "  0) 退出"
echo ""
read -p "请输入选项 [0-4]: " choice

case $choice in
  1)
    echo ""
    echo "🌐 打开小型宣传图块模板..."
    echo "📐 目标尺寸: 440 x 280 像素"
    echo ""
    echo "截图步骤:"
    echo "  1. 浏览器打开后，按 F12 打开开发者工具"
    echo "  2. 按 Cmd+Shift+M (Mac) 或 Ctrl+Shift+M (Windows) 进入响应式模式"
    echo "  3. 设置设备尺寸为 440 x 280"
    echo "  4. 截取整个图块区域"
    echo "  5. 保存为: $IMAGES_DIR/small-promo-tile.png"
    echo ""
    open "$TEMPLATES_DIR/small-promo-tile.html"
    ;;
  2)
    echo ""
    echo "🌐 打开大型宣传图块模板..."
    echo "📐 目标尺寸: 920 x 680 像素"
    echo ""
    echo "截图步骤:"
    echo "  1. 浏览器打开后，按 F12 打开开发者工具"
    echo "  2. 按 Cmd+Shift+M (Mac) 或 Ctrl+Shift+M (Windows) 进入响应式模式"
    echo "  3. 设置设备尺寸为 920 x 680"
    echo "  4. 截取整个图块区域"
    echo "  5. 保存为: $IMAGES_DIR/large-promo-tile.png"
    echo ""
    open "$TEMPLATES_DIR/large-promo-tile.html"
    ;;
  3)
    echo ""
    echo "🌐 打开所有模板..."
    echo ""
    open "$TEMPLATES_DIR/small-promo-tile.html"
    sleep 1
    open "$TEMPLATES_DIR/large-promo-tile.html"
    echo "✅ 已在浏览器中打开所有模板"
    echo ""
    echo "💡 提示: 按照每个页面的控制台提示截取正确尺寸"
    ;;
  4)
    echo ""
    echo "📖 使用说明"
    echo "=========================================="
    echo ""
    echo "方法 1: 使用浏览器响应式模式"
    echo "  1. 在浏览器中打开模板 HTML 文件"
    echo "  2. 打开开发者工具 (F12)"
    echo "  3. 启用设备模拟模式 (Cmd+Shift+M / Ctrl+Shift+M)"
    echo "  4. 设置精确的尺寸"
    echo "  5. 使用系统截图工具截取"
    echo ""
    echo "方法 2: 使用 Chrome 扩展"
    echo "  1. 安装截图扩展（如 Awesome Screenshot）"
    echo "  2. 在浏览器中打开模板"
    echo "  3. 使用扩展的区域截图功能"
    echo "  4. 手动选择要截取的区域"
    echo ""
    echo "方法 3: 使用 Chrome DevTools 命令"
    echo "  1. 打开模板页面"
    echo "  2. 按 Cmd+Shift+P (Mac) 或 Ctrl+Shift+P (Windows)"
    echo "  3. 输入 'Capture screenshot'"
    echo "  4. 选择合适的截图模式"
    echo ""
    echo "图片保存位置:"
    echo "  $IMAGES_DIR/"
    echo ""
    echo "文件命名规范:"
    echo "  - small-promo-tile.png   (440x280)"
    echo "  - large-promo-tile.png   (920x680)"
    echo "  - screenshot-1.png       (1280x800)"
    echo "  - screenshot-2.png       (1280x800)"
    echo "  - screenshot-3.png       (1280x800)"
    echo "  - screenshot-4.png       (1280x800)"
    echo "  - screenshot-5.png       (1280x800)"
    echo ""
    echo "更多详细信息，请查看:"
    echo "  - README.md"
    echo "  - PROMOTIONAL_GUIDE.md"
    echo "  - generate-screenshots.md"
    echo ""
    ;;
  0)
    echo ""
    echo "👋 再见！"
    exit 0
    ;;
  *)
    echo ""
    echo "❌ 无效的选项"
    exit 1
    ;;
esac

echo ""
echo "✨ 完成！"
echo ""
echo "📝 接下来的步骤:"
echo "  1. 在浏览器中调整窗口到正确尺寸"
echo "  2. 截取图块区域"
echo "  3. 保存到 images/ 目录"
echo "  4. 使用 TinyPNG 或 Squoosh 压缩图片"
echo ""
echo "💡 提示: 查看 generate-screenshots.md 了解如何制作功能截图"
echo ""
