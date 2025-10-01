(() => {
  let overlay = null;
  let selectionBox = null;
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let currentRect = null;
  let autoScrollInterval = null;
  let isCapturingFullPage = false;
  let elementMode = false;
  let elementHighlight = null;
  let modeIndicator = null;
  let hoveredElement = null;

  const onMouseDown = (event) => {
    if (!overlay || event.button !== 0) {
      return;
    }

    // 元素选择模式：点击直接选择元素
    if (elementMode && hoveredElement) {
      event.preventDefault();
      event.stopPropagation();
      selectElement(hoveredElement);
      return;
    }

    // 手动绘制模式
    isSelecting = true;
    startX = event.clientX + window.scrollX;
    startY = event.clientY + window.scrollY;
    currentRect = {
      left: startX,
      top: startY,
      width: 0,
      height: 0
    };
    updateSelectionBox(currentRect);
  };

  const onMouseMove = (event) => {
    // 元素选择模式：高亮鼠标下的元素
    if (elementMode && !isSelecting) {
      highlightElementUnderCursor(event);
      return;
    }

    if (!isSelecting || !selectionBox) {
      return;
    }
    const x = event.clientX + window.scrollX;
    const y = event.clientY + window.scrollY;

    const left = Math.min(x, startX);
    const top = Math.min(y, startY);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);

    currentRect = { left, top, width, height };
    updateSelectionBox(currentRect);

    // 自动滚动逻辑
    handleAutoScroll(event.clientX, event.clientY);
  };

  const handleAutoScroll = (clientX, clientY) => {
    const scrollMargin = 50;
    const scrollSpeed = 10;
    let scrollX = 0;
    let scrollY = 0;

    if (clientY < scrollMargin) {
      scrollY = -scrollSpeed;
    } else if (clientY > window.innerHeight - scrollMargin) {
      scrollY = scrollSpeed;
    }

    if (clientX < scrollMargin) {
      scrollX = -scrollSpeed;
    } else if (clientX > window.innerWidth - scrollMargin) {
      scrollX = scrollSpeed;
    }

    if (scrollX !== 0 || scrollY !== 0) {
      if (!autoScrollInterval) {
        autoScrollInterval = setInterval(() => {
          window.scrollBy(scrollX, scrollY);
        }, 16);
      }
    } else {
      stopAutoScroll();
    }
  };

  const stopAutoScroll = () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  };

  const onMouseUp = (event) => {
    if (!isSelecting || event.button !== 0) {
      return;
    }
    isSelecting = false;
    stopAutoScroll();
    if (currentRect && currentRect.width > 5 && currentRect.height > 5) {
      finishSelection();
    } else {
      cancelSelection();
    }
  };

  const removeOverlay = () => {
    stopAutoScroll();
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
    hideElementHighlight();
    hideModeIndicator();

    // 清理 window 级别的事件监听
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('click', preventDefaultHandler, true);
    window.removeEventListener('contextmenu', preventDefaultHandler, true);
    window.removeEventListener('keydown', keydownHandler, true);

    isSelecting = false;
    elementMode = false;
    currentRect = null;
  };

  const cancelSelection = () => {
    removeOverlay();
    chrome.runtime.sendMessage({ type: 'SELECTION_CANCELLED' });
  };

  const captureWindowRect = async (rect, dpr) => {
    const { left, top, width, height } = rect;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return [];
    }

    const viewportHeight = Math.max(1, window.innerHeight);
    const viewportWidth = Math.max(1, window.innerWidth);
    const maxX = left + width;
    const maxY = top + height;
    const screenshots = [];

    let currentY = top;
    while (currentY < maxY) {
      let currentX = left;
      while (currentX < maxX) {
        const partWidth = Math.max(0, Math.min(viewportWidth, maxX - currentX));
        const partHeight = Math.max(0, Math.min(viewportHeight, maxY - currentY));
        if (partWidth > 0 && partHeight > 0) {
          screenshots.push({
            scrollX: currentX,
            scrollY: currentY,
            offsetX: currentX - left,
            offsetY: currentY - top,
            width: partWidth,
            height: partHeight
          });
        }
        currentX += viewportWidth;
      }
      currentY += viewportHeight;
    }

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    const capturedParts = [];

    try {
      for (let i = 0; i < screenshots.length; i++) {
        const shot = screenshots[i];

        console.log(`Capturing part ${i + 1}/${screenshots.length}`);

        window.scrollTo(shot.scrollX, shot.scrollY);

        // 等待滚动和渲染完成
        await new Promise((resolve) => setTimeout(resolve, 400));

        // 确保滚动到位
        const actualScrollX = window.scrollX;
        const actualScrollY = window.scrollY;

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'CAPTURE_PART',
            rect,
            part: {
              scrollX: actualScrollX,
              scrollY: actualScrollY,
              offsetX: shot.offsetX,
              offsetY: shot.offsetY,
              width: shot.width,
              height: shot.height
            },
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              scrollX: actualScrollX,
              scrollY: actualScrollY,
              dpr
            }
          });

          if (response && response.dataUrl) {
            capturedParts.push(response);
            console.log(`Part ${i + 1} captured successfully`);
          } else {
            console.warn(`Part ${i + 1} failed: no dataUrl in response`);
          }
        } catch (error) {
          console.error(`Part ${i + 1} failed:`, error);
        }

        // Chrome 限制每秒最多 2 次 captureVisibleTab 调用
        // 所以每次截图后等待至少 600ms (1000ms / 2 = 500ms，留点余量)
        if (i < screenshots.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    } finally {
      window.scrollTo(originalScrollX, originalScrollY);
    }

    return capturedParts;
  };

  const finishSelection = async () => {
    if (!currentRect) {
      cancelSelection();
      return;
    }

    const { left, top, width, height } = currentRect;
    const rect = { left, top, width, height };
    const dpr = window.devicePixelRatio || 1;

    // 检测选择区域内的可滚动容器
    const scrollableContainer = findScrollableContainer(left, top, width, height);

    if (scrollableContainer && scrollableContainer !== document.documentElement && scrollableContainer !== document.body) {
      await captureScrollableElement(scrollableContainer, rect, dpr);
      removeOverlay();
      return;
    }

    removeOverlay();

    const capturedParts = await captureWindowRect(rect, dpr);

    chrome.runtime.sendMessage({
      type: 'STITCH_SCREENSHOTS',
      rect,
      parts: capturedParts,
      url: window.location.href,
      title: document.title,
      dpr
    });
  };

  const preventDefaultHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const keydownHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelSelection();
    }
    // 按 E 键切换元素选择模式
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      toggleElementMode();
    }
  };

  const toggleElementMode = () => {
    elementMode = !elementMode;
    if (overlay) {
      if (elementMode) {
        overlay.classList.add('element-mode');
        showModeIndicator();
      } else {
        overlay.classList.remove('element-mode');
        hideModeIndicator();
        hideElementHighlight();
      }
    }
  };

  const showModeIndicator = () => {
    if (!modeIndicator) {
      modeIndicator = document.createElement('div');
      modeIndicator.className = 'webclip2pdf-mode-indicator';
      modeIndicator.innerHTML = '🎯 元素选择模式 - 点击选择元素 | 按 <kbd>E</kbd> 切换手动模式';
      document.body.appendChild(modeIndicator);
    }
  };

  const hideModeIndicator = () => {
    if (modeIndicator) {
      modeIndicator.remove();
      modeIndicator = null;
    }
  };

  const highlightElementUnderCursor = (event) => {
    // 临时隐藏遮罩层和高亮框，以便获取真实的目标元素
    const overlayDisplay = overlay ? overlay.style.display : '';
    const highlightDisplay = elementHighlight ? elementHighlight.style.display : '';
    const indicatorDisplay = modeIndicator ? modeIndicator.style.display : '';

    if (overlay) overlay.style.display = 'none';
    if (elementHighlight) elementHighlight.style.display = 'none';
    if (modeIndicator) modeIndicator.style.display = 'none';

    const target = document.elementFromPoint(event.clientX, event.clientY);

    // 恢复显示
    if (overlay) overlay.style.display = overlayDisplay;
    if (elementHighlight) elementHighlight.style.display = highlightDisplay;
    if (modeIndicator) modeIndicator.style.display = indicatorDisplay;

    if (!target) {
      return;
    }

    // 避免选择 body 或 html
    if (target === document.body || target === document.documentElement) {
      return;
    }

    // 避免选择插件自己的元素
    if (target.classList && (
      target.classList.contains('webclip2pdf-overlay') ||
      target.classList.contains('webclip2pdf-element-highlight') ||
      target.classList.contains('webclip2pdf-mode-indicator')
    )) {
      return;
    }

    hoveredElement = target;
    const rect = target.getBoundingClientRect();

    // 如果元素太小，尝试选择其父元素
    if (rect.width < 20 || rect.height < 20) {
      let parent = target.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.width >= 20 && parentRect.height >= 20) {
          hoveredElement = parent;
          updateHighlight(parent);
          return;
        }
        parent = parent.parentElement;
      }
    }

    updateHighlight(target);
  };

  const updateHighlight = (element) => {
    const rect = element.getBoundingClientRect();

    if (!elementHighlight) {
      elementHighlight = document.createElement('div');
      elementHighlight.className = 'webclip2pdf-element-highlight';
      document.body.appendChild(elementHighlight);
    }

    elementHighlight.style.left = `${rect.left + window.scrollX}px`;
    elementHighlight.style.top = `${rect.top + window.scrollY}px`;
    elementHighlight.style.width = `${rect.width}px`;
    elementHighlight.style.height = `${rect.height}px`;
    elementHighlight.style.display = 'block';
  };

  const hideElementHighlight = () => {
    if (elementHighlight) {
      elementHighlight.remove();
      elementHighlight = null;
    }
    hoveredElement = null;
  };

  const selectElement = async (element) => {
    const rect = element.getBoundingClientRect();
    const selectionRect = {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };

    console.log('Element selected:', {
      tagName: element.tagName,
      className: element.className,
      rect: selectionRect
    });

    // 检查元素是否有效
    if (selectionRect.width <= 0 || selectionRect.height <= 0) {
      console.error('Invalid element dimensions');
      removeOverlay();
      return;
    }

    // 清理 UI
    if (overlay) overlay.style.display = 'none';
    hideElementHighlight();
    hideModeIndicator();

    // 使用新的元素截图方案
    await captureElementDirectly(element, selectionRect);

    removeOverlay();
  };

  const captureElementDirectly = async (element, rect) => {
    const dpr = window.devicePixelRatio || 1;
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    try {
      // 检查元素高度，决定使用哪种方案
      const viewportHeight = window.innerHeight;

      if (rect.height <= viewportHeight) {
        // 元素在一个视口内，使用简单的单次截图
        await captureSingleElement(rect, dpr);
      } else {
        // 元素超过一个视口，使用分段截图方案
        await captureElementInParts(rect, dpr);
      }
    } finally {
      // 恢复原始滚动位置
      window.scrollTo(originalScrollX, originalScrollY);
    }
  };

  const captureSingleElement = async (rect, dpr) => {
    // 滚动到元素顶部
    window.scrollTo(rect.left, rect.top);

    // 等待渲染
    await new Promise(resolve => setTimeout(resolve, 500));

    // 获取实际滚动位置
    const actualScrollX = window.scrollX;
    const actualScrollY = window.scrollY;

    // 截图
    const response = await chrome.runtime.sendMessage({
      type: 'SELECTION_DONE',
      rect: {
        left: rect.left,
        top: rect.top,
        width: Math.min(rect.width, window.innerWidth),
        height: Math.min(rect.height, window.innerHeight)
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: actualScrollX,
        scrollY: actualScrollY,
        dpr
      },
      title: document.title,
      url: window.location.href
    });

    if (!response || !response.success) {
      console.error('Screenshot failed');
    }
  };

  const captureElementInParts = async (rect, dpr) => {
    console.log('Capturing large element in parts');

    // 使用固定的视口高度，避免部分重叠
    const viewportHeight = window.innerHeight;
    const segments = [];

    // 重要：每段完全不重叠，精确对齐
    for (let y = 0; y < rect.height; y += viewportHeight) {
      const segmentHeight = Math.min(viewportHeight, rect.height - y);

      segments.push({
        scrollY: rect.top + y,  // 滚动到的绝对位置
        offsetY: y,              // 在最终图片中的 Y 偏移
        height: segmentHeight    // 段的高度
      });
    }

    console.log(`Total segments: ${segments.length}`);

    const capturedParts = [];

    // 逐段截图
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      console.log(`Capturing segment ${i + 1}/${segments.length}:`, {
        scrollY: segment.scrollY,
        offsetY: segment.offsetY,
        height: segment.height
      });

      // 滚动到该段的顶部
      window.scrollTo(rect.left, segment.scrollY);

      // 等待渲染和滚动完成
      await new Promise(resolve => setTimeout(resolve, 500));

      const actualScrollX = window.scrollX;
      const actualScrollY = window.scrollY;

      console.log(`Actual scroll position: ${actualScrollY}, expected: ${segment.scrollY}`);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CAPTURE_PART',
          rect: rect,
          part: {
            scrollX: actualScrollX,
            scrollY: actualScrollY,
            offsetX: 0,
            offsetY: segment.offsetY,
            width: rect.width,
            height: segment.height
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: actualScrollX,
            scrollY: actualScrollY,
            dpr
          }
        });

        if (response && response.dataUrl) {
          capturedParts.push(response);
          console.log(`Segment ${i + 1} captured successfully`);
        } else {
          console.warn(`Segment ${i + 1} returned no data`);
        }
      } catch (error) {
        console.error(`Segment ${i + 1} failed:`, error);
      }

      // API 限制等待
      if (i < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    console.log(`Captured ${capturedParts.length}/${segments.length} segments`);

    // 发送拼接请求
    chrome.runtime.sendMessage({
      type: 'STITCH_SCREENSHOTS',
      rect: rect,
      parts: capturedParts,
      url: window.location.href,
      title: document.title,
      dpr
    });
  };

  const updateSelectionBox = (rect) => {
    if (!selectionBox) {
      selectionBox = document.createElement('div');
      selectionBox.className = 'webclip2pdf-selection-box';
      document.body.appendChild(selectionBox);
    }

    selectionBox.style.left = `${rect.left}px`;
    selectionBox.style.top = `${rect.top}px`;
    selectionBox.style.width = `${rect.width}px`;
    selectionBox.style.height = `${rect.height}px`;
  };

  const ensureOverlay = () => {
    if (overlay) {
      return;
    }
    overlay = document.createElement('div');
    overlay.className = 'webclip2pdf-overlay';
    overlay.tabIndex = -1;

    // 在 window 上监听事件，确保能捕获到所有元素
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('click', preventDefaultHandler, true);
    window.addEventListener('contextmenu', preventDefaultHandler, true);
    window.addEventListener('keydown', keydownHandler, true);

    document.body.appendChild(overlay);

    // 默认启动元素选择模式
    setTimeout(() => {
      elementMode = true;
      overlay.classList.add('element-mode');
      showModeIndicator();
    }, 100);
  };

  // 查找选择区域内的可滚动容器
  const findScrollableContainer = (left, top, width, height) => {
    // 获取选择区域中心点的元素
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    let element = document.elementFromPoint(centerX - window.scrollX, centerY - window.scrollY);

    while (element && element !== document.body) {
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;

      // 检查是否可滚动
      if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) {
        return element;
      }
      if ((overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  };

  // 捕获可滚动元素的内容
  const captureScrollableElement = async (element, rect, dpr) => {
    const elementRect = element.getBoundingClientRect();
    const originalScrollTop = element.scrollTop;
    const originalScrollLeft = element.scrollLeft;

    // 计算需要截取的区域相对于容器的位置
    const relativeTop = Math.max(0, rect.top - (elementRect.top + window.scrollY));
    const relativeLeft = Math.max(0, rect.left - (elementRect.left + window.scrollX));
    const captureWidth = Math.min(rect.width, element.scrollWidth - relativeLeft);
    const captureHeight = Math.min(rect.height, element.scrollHeight - relativeTop);

    // 计算需要截取的段数
    const viewportHeight = element.clientHeight;
    const viewportWidth = element.clientWidth;
    const screenshots = [];

    let currentY = relativeTop;
    while (currentY < relativeTop + captureHeight) {
      let currentX = relativeLeft;
      while (currentX < relativeLeft + captureWidth) {
        // 滚动容器到指定位置
        element.scrollTo(currentX, currentY);

        // 等待滚动和渲染完成
        await new Promise(resolve => setTimeout(resolve, 200));

        screenshots.push({
          scrollX: element.scrollLeft,
          scrollY: element.scrollTop,
          offsetX: currentX - relativeLeft,
          offsetY: currentY - relativeTop,
          width: Math.min(viewportWidth, relativeLeft + captureWidth - currentX),
          height: Math.min(viewportHeight, relativeTop + captureHeight - currentY),
          elementRect: element.getBoundingClientRect()
        });

        currentX += viewportWidth;
      }
      currentY += viewportHeight;
    }

    // 依次截取每个部分
    const capturedParts = [];
    for (const shot of screenshots) {
      // 滚动到指定位置
      element.scrollTo(shot.scrollX, shot.scrollY);
      await new Promise(resolve => setTimeout(resolve, 200));

      // 发送截图请求
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_SCROLLABLE_PART',
        rect: rect,
        containerRect: shot.elementRect,
        part: shot,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          dpr
        }
      });

      if (response && response.dataUrl) {
        capturedParts.push(response);
      }
    }

    // 恢复原始滚动位置
    element.scrollTo(originalScrollLeft, originalScrollTop);

    // 发送所有截图部分进行拼接
    chrome.runtime.sendMessage({
      type: 'STITCH_SCROLLABLE_SCREENSHOTS',
      rect: {
        left: 0,
        top: 0,
        width: captureWidth,
        height: captureHeight
      },
      parts: capturedParts,
      url: window.location.href,
      title: document.title,
      dpr
    });
  };

  const captureFullPage = async () => {
    if (isCapturingFullPage) {
      return;
    }
    isCapturingFullPage = true;
    stopAutoScroll();

    const dpr = window.devicePixelRatio || 1;

    try {
      removeOverlay();

      const doc = document.documentElement;
      const body = document.body;
      const totalWidth = Math.max(
        doc.scrollWidth,
        doc.offsetWidth,
        body ? body.scrollWidth : 0,
        body ? body.offsetWidth : 0,
        window.innerWidth
      );
      const totalHeight = Math.max(
        doc.scrollHeight,
        doc.offsetHeight,
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        window.innerHeight
      );

      if (!Number.isFinite(totalWidth) || !Number.isFinite(totalHeight) || totalWidth <= 0 || totalHeight <= 0) {
        console.warn('Full page capture skipped due to invalid dimensions.', totalWidth, totalHeight);
        return;
      }

      const rect = {
        left: 0,
        top: 0,
        width: totalWidth,
        height: totalHeight
      };

      const parts = await captureWindowRect(rect, dpr);

      chrome.runtime.sendMessage({
        type: 'STITCH_SCREENSHOTS',
        rect,
        parts,
        url: window.location.href,
        title: document.title,
        dpr
      });
    } catch (error) {
      console.error('Failed to capture full page.', error);
    } finally {
      isCapturingFullPage = false;
    }
  };

  const captureWebpage = async () => {
    try {
      // 获取整个页面的 HTML 内容
      const htmlContent = document.documentElement.outerHTML;

      // 获取所有内联样式和外部样式表
      const styles = Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            // 跨域样式表无法访问
            return '';
          }
        })
        .filter(s => s)
        .join('\n');

      // 发送到后台脚本保存
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WEBPAGE',
        htmlContent,
        styles,
        url: window.location.href,
        title: document.title
      });

      return response;
    } catch (error) {
      console.error('Failed to capture webpage.', error);
      return { success: false, error: error.message };
    }
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }
    if (message.type === 'START_SELECTION') {
      if (overlay) {
        removeOverlay();
      }
      ensureOverlay();
    }
    if (message.type === 'CANCEL_SELECTION') {
      cancelSelection();
    }
    if (message.type === 'CAPTURE_FULL_PAGE') {
      captureFullPage();
    }
    if (message.type === 'CAPTURE_WEBPAGE') {
      captureWebpage().then(response => sendResponse(response));
      return true;
    }
  });
})();
