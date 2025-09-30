(() => {
  let overlay = null;
  let selectionBox = null;
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let currentRect = null;
  let autoScrollInterval = null;
  let isCapturingFullPage = false;

  const onMouseDown = (event) => {
    if (!overlay || event.button !== 0) {
      return;
    }
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
      overlay.removeEventListener('mousedown', onMouseDown, true);
      overlay.removeEventListener('click', preventDefaultHandler, true);
      overlay.removeEventListener('contextmenu', preventDefaultHandler, true);
      overlay.removeEventListener('keydown', keydownHandler, true);
      overlay.remove();
      overlay = null;
    }
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    isSelecting = false;
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
      for (const shot of screenshots) {
        window.scrollTo(shot.scrollX, shot.scrollY);

        await new Promise((resolve) => setTimeout(resolve, 150));

        const response = await chrome.runtime.sendMessage({
          type: 'CAPTURE_PART',
          rect,
          part: {
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            offsetX: shot.offsetX,
            offsetY: shot.offsetY,
            width: shot.width,
            height: shot.height
          },
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
    overlay.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
    overlay.addEventListener('click', preventDefaultHandler, true);
    overlay.addEventListener('contextmenu', preventDefaultHandler, true);
    overlay.addEventListener('keydown', keydownHandler, true);

    document.body.appendChild(overlay);
    overlay.focus({ preventScroll: true });
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
