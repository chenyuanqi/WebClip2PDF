const CLIP_DOWNLOAD_FOLDER = 'WebClip2PDF';

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get({ clips: [], clipCounter: 0 });
  if (!Array.isArray(existing.clips)) {
    await chrome.storage.local.set({ clips: [], clipCounter: 0 });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === 'CAPTURE_PART') {
    if (!sender.tab || sender.tab.windowId === undefined) {
      sendResponse({ success: false, error: '无法定位选项卡' });
      return;
    }
    capturePart(message, sender.tab.windowId)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error(error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'CAPTURE_SCROLLABLE_PART') {
    if (!sender.tab || sender.tab.windowId === undefined) {
      sendResponse({ success: false, error: '无法定位选项卡' });
      return;
    }
    captureScrollablePart(message, sender.tab.windowId)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error(error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'STITCH_SCROLLABLE_SCREENSHOTS') {
    if (!sender.tab) {
      sendResponse({ success: false, error: '无法定位选项卡' });
      return;
    }
    stitchScrollableScreenshots(message)
      .then((clip) => sendResponse({ success: true, clip }))
      .catch((error) => {
        console.error(error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'STITCH_SCREENSHOTS') {
    if (!sender.tab) {
      sendResponse({ success: false, error: '无法定位选项卡' });
      return;
    }
    stitchAndSaveScreenshots(message)
      .then((clip) => sendResponse({ success: true, clip }))
      .catch((error) => {
        console.error(error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'SELECTION_DONE') {
    if (!sender.tab || sender.tab.windowId === undefined) {
      sendResponse({ success: false, error: '无法定位选项卡' });
      return;
    }
    handleSelection(message, sender.tab.windowId)
      .then((clip) => sendResponse({ success: true, clip }))
      .catch((error) => {
        console.error(error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'REMOVE_CLIP') {
    removeClip(message.id)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }

  if (message.type === 'CLEAR_CLIPS') {
    clearClips()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }

  if (message.type === 'RESOLVE_CLIP_DOWNLOAD_ID') {
    resolveClipDownloadId(message.id)
      .then((downloadId) => sendResponse({ success: true, downloadId }))
      .catch((error) => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }

  if (message.type === 'REQUEST_CLIPS') {
    chrome.storage.local.get({ clips: [] }).then((result) => {
      sendResponse({ success: true, clips: result.clips });
    });
    return true;
  }

  if (message.type === 'GENERATE_PDF') {
    generatePdf(message.clipIds)
      .then((pdfInfo) => sendResponse({ success: true, pdf: pdfInfo }))
      .catch((error) => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }

  if (message.type === 'SAVE_WEBPAGE') {
    saveWebpage(message)
      .then((clip) => sendResponse({ success: true, clip }))
      .catch((error) => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }
});

async function capturePart(message, windowId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const { rect, viewport, part } = message;

  console.log('capturePart called:', {
    rect: rect,
    part: part,
    viewport: { scrollX: viewport.scrollX, scrollY: viewport.scrollY }
  });

  // 如果 part 已经明确指定了 offsetX/Y，直接使用
  if (part.offsetX !== undefined && part.offsetY !== undefined) {
    // 元素截图模式：使用明确的偏移量
    // content-script 已经滚动到正确位置，我们要截取的部分应该在视口顶部
    const viewportLeft = Math.max(0, rect.left - viewport.scrollX);
    const viewportTop = Math.max(0, rect.top - viewport.scrollY);

    // 计算要截取的区域大小（不能超出视口边界）
    const viewportWidth = Math.min(part.width, viewport.width - viewportLeft);
    const viewportHeight = Math.min(part.height, viewport.height - viewportTop);

    const result = {
      dataUrl,
      offsetX: part.offsetX,
      offsetY: part.offsetY,
      viewportLeft: viewportLeft,
      viewportTop: viewportTop,
      viewportWidth: viewportWidth,
      viewportHeight: viewportHeight,
      scale: viewport.dpr || 1
    };

    console.log('capturePart result:', {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport: { scrollX: viewport.scrollX, scrollY: viewport.scrollY, width: viewport.width, height: viewport.height },
      part: { offsetX: part.offsetX, offsetY: part.offsetY, width: part.width, height: part.height },
      calculated: { viewportLeft, viewportTop, viewportWidth, viewportHeight }
    });
    return result;
  }

  // 原有的自动计算逻辑（用于手动绘制模式）
  const viewportScrollX = viewport.scrollX || 0;
  const viewportScrollY = viewport.scrollY || 0;
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;

  const selectionRight = rect.left + rect.width;
  const selectionBottom = rect.top + rect.height;
  const viewportRight = viewportScrollX + viewportWidth;
  const viewportBottom = viewportScrollY + viewportHeight;

  const intersectLeft = Math.max(rect.left, viewportScrollX);
  const intersectTop = Math.max(rect.top, viewportScrollY);
  const intersectRight = Math.min(selectionRight, viewportRight);
  const intersectBottom = Math.min(selectionBottom, viewportBottom);

  const viewportLeft = Math.max(0, intersectLeft - viewportScrollX);
  const viewportTop = Math.max(0, intersectTop - viewportScrollY);
  const offsetX = Math.max(0, intersectLeft - rect.left);
  const offsetY = Math.max(0, intersectTop - rect.top);

  let width = Math.max(0, intersectRight - intersectLeft);
  let height = Math.max(0, intersectBottom - intersectTop);

  if (Number.isFinite(part.width)) {
    width = Math.min(width, part.width);
  }
  if (Number.isFinite(part.height)) {
    height = Math.min(height, part.height);
  }

  width = Math.max(0, Math.min(width, rect.width - offsetX));
  height = Math.max(0, Math.min(height, rect.height - offsetY));

  return {
    dataUrl,
    offsetX,
    offsetY,
    viewportLeft,
    viewportTop,
    viewportWidth: width,
    viewportHeight: height,
    scale: viewport.dpr || 1
  };
}

async function captureScrollablePart(message, windowId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const { containerRect, part } = message;

  // 计算容器在视口中的裁剪区域
  const viewportLeft = Math.max(0, containerRect.left);
  const viewportTop = Math.max(0, containerRect.top);
  const viewportWidth = Math.min(message.viewport.width - viewportLeft, containerRect.width);
  const viewportHeight = Math.min(message.viewport.height - viewportTop, containerRect.height);

  return {
    dataUrl,
    offsetX: part.offsetX,
    offsetY: part.offsetY,
    viewportLeft,
    viewportTop,
    viewportWidth,
    viewportHeight,
    scale: message.viewport.dpr || 1
  };
}

async function stitchScrollableScreenshots(message) {
  const { rect, parts, title, url, dpr } = message;

  // 创建画布来拼接所有部分
  const canvas = new OffscreenCanvas(
    Math.round(rect.width * dpr),
    Math.round(rect.height * dpr)
  );
  const ctx = canvas.getContext('2d');

  // 填充白色背景，避免透明区域
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 拼接每个部分
  for (const part of parts) {
    const response = await fetch(part.dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    if (!part.viewportWidth || !part.viewportHeight) {
      continue;
    }

    // 计算源区域和目标区域
    const sx = Math.max(0, Math.round(part.viewportLeft * dpr));
    const sy = Math.max(0, Math.round(part.viewportTop * dpr));
    const sw = Math.round(part.viewportWidth * dpr);
    const sh = Math.round(part.viewportHeight * dpr);

    if (sw <= 0 || sh <= 0) {
      continue;
    }

    const clampedSw = Math.max(0, Math.min(sw, bitmap.width - sx));
    const clampedSh = Math.max(0, Math.min(sh, bitmap.height - sy));

    if (clampedSw <= 0 || clampedSh <= 0) {
      continue;
    }

    const dx = Math.max(0, Math.round(part.offsetX * dpr));
    const dy = Math.max(0, Math.round(part.offsetY * dpr));

    // 绘制到画布上
    ctx.drawImage(bitmap, sx, sy, clampedSw, clampedSh, dx, dy, clampedSw, clampedSh);
  }

  // 转换为 PNG
  const finalBlob = await canvas.convertToBlob({ type: 'image/png' });
  const finalDataUrl = await blobToDataUrl(finalBlob);

  // 保存截图
  const clip = await persistClip(finalDataUrl, title, url);
  chrome.runtime.sendMessage({ type: 'CLIP_ADDED', clip });
  return clip;
}

async function stitchAndSaveScreenshots(message) {
  const { rect, parts, title, url, dpr } = message;

  // 创建画布来拼接所有部分
  const canvas = new OffscreenCanvas(
    Math.round(rect.width * dpr),
    Math.round(rect.height * dpr)
  );
  const ctx = canvas.getContext('2d');

  // 填充白色背景，避免透明区域
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  console.log('Stitching full page:', { totalParts: parts.length, canvasSize: { width: canvas.width, height: canvas.height } });

  // 拼接每个部分
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const response = await fetch(part.dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    if (!part.viewportWidth || !part.viewportHeight) {
      console.warn(`Part ${i}: skipped due to invalid dimensions`, part);
      continue;
    }

    // 计算源区域和目标区域
    const sx = Math.max(0, Math.round(part.viewportLeft * dpr));
    const sy = Math.max(0, Math.round(part.viewportTop * dpr));
    const sw = Math.round(part.viewportWidth * dpr);
    const sh = Math.round(part.viewportHeight * dpr);

    if (sw <= 0 || sh <= 0) {
      console.warn(`Part ${i}: skipped due to zero size`, { sw, sh });
      continue;
    }

    const clampedSw = Math.max(0, Math.min(sw, bitmap.width - sx));
    const clampedSh = Math.max(0, Math.min(sh, bitmap.height - sy));

    if (clampedSw <= 0 || clampedSh <= 0) {
      console.warn(`Part ${i}: skipped due to clamped zero size`, { clampedSw, clampedSh });
      continue;
    }

    const dx = Math.max(0, Math.round(part.offsetX * dpr));
    const dy = Math.max(0, Math.round(part.offsetY * dpr));

    console.log(`Part ${i}: drawing`, {
      source: { sx, sy, sw: clampedSw, sh: clampedSh },
      dest: { dx, dy, dw: clampedSw, dh: clampedSh },
      bitmapSize: { width: bitmap.width, height: bitmap.height }
    });

    // 绘制到画布上
    ctx.drawImage(bitmap, sx, sy, clampedSw, clampedSh, dx, dy, clampedSw, clampedSh);
  }

  console.log('Stitching completed');

  // 转换为 PNG
  const finalBlob = await canvas.convertToBlob({ type: 'image/png' });
  const finalDataUrl = await blobToDataUrl(finalBlob);

  // 保存截图
  const clip = await persistClip(finalDataUrl, title, url);
  chrome.runtime.sendMessage({ type: 'CLIP_ADDED', clip });
  return clip;
}

async function handleSelection(message, windowId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const croppedDataUrl = await cropAreaFromDataUrl(dataUrl, message.rect, message.viewport);
  const clip = await persistClip(croppedDataUrl, message.title, message.url);
  chrome.runtime.sendMessage({ type: 'CLIP_ADDED', clip });
  return clip;
}

async function cropAreaFromDataUrl(dataUrl, rect, viewport) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const scaleX = imageBitmap.width / viewport.width;
  const scaleY = imageBitmap.height / viewport.height;

  // 现在页面已经滚动到选择区域的起始位置
  // rect.left 和 rect.top 是绝对坐标
  // viewport.scrollX 和 viewport.scrollY 是新的滚动位置（等于或接近 rect.left 和 rect.top）
  // 所以裁剪起始点应该是 0 或很小的值
  const viewportLeft = rect.left - viewport.scrollX;
  const viewportTop = rect.top - viewport.scrollY;

  // 确保坐标不为负数
  const sx = Math.max(0, Math.round(viewportLeft * scaleX));
  const sy = Math.max(0, Math.round(viewportTop * scaleY));

  // 确保不超出图片边界
  const maxWidth = imageBitmap.width - sx;
  const maxHeight = imageBitmap.height - sy;
  const sWidth = Math.min(Math.round(rect.width * scaleX), maxWidth);
  const sHeight = Math.min(Math.round(rect.height * scaleY), maxHeight);

  const canvas = new OffscreenCanvas(sWidth, sHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(croppedBlob);
}

async function blobToDataUrl(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return `data:${blob.type};base64,${base64}`;
}

async function persistClip(dataUrl, title, url) {
  const { clips = [], clipCounter = 0 } = await chrome.storage.local.get({ clips: [], clipCounter: 0 });
  const nextCounter = clipCounter + 1;
  const indexLabel = String(nextCounter).padStart(3, '0');

  // 使用页面标题作为文件名，清理非法字符
  const sanitizedTitle = (title || 'clip').replace(/[<>:"/\\|?*]/g, '-').substring(0, 100);
  const filename = `${sanitizedTitle}-${indexLabel}.png`;

  const timestamp = new Date().toISOString();

  // 生成缩略图（最大 200x200）用于预览
  const thumbnailDataUrl = await createThumbnail(dataUrl, 200, 200);

  const clip = {
    id: crypto.randomUUID(),
    filename,
    title,
    url,
    createdAt: timestamp,
    thumbnailDataUrl  // 只保存缩略图到 storage，不保存完整图片
  };

  // 下载完整图片到文件系统
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: `${CLIP_DOWNLOAD_FOLDER}/${filename}`,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  clip.downloadId = downloadId;

  clips.push(clip);
  await chrome.storage.local.set({ clips, clipCounter: nextCounter });

  return clip;
}

async function createThumbnail(dataUrl, maxWidth, maxHeight) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // 计算缩放比例
    let width = bitmap.width;
    let height = bitmap.height;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

    if (ratio < 1) {
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // 创建缩略图
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    // 使用 JPEG 压缩减小体积
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    return blobToDataUrl(thumbnailBlob);
  } catch (error) {
    console.error('Failed to create thumbnail:', error);
    // 如果缩略图创建失败，返回空字符串
    return '';
  }
}

async function removeClip(id) {
  const { clips = [] } = await chrome.storage.local.get({ clips: [] });
  const removed = clips.find((clip) => clip.id === id);
  const updated = clips.filter((clip) => clip.id !== id);
  await chrome.storage.local.set({ clips: updated });
  chrome.runtime.sendMessage({ type: 'CLIPS_UPDATED', clips: updated });
  await cleanupClipDownloads([removed]);
}

async function clearClips() {
  const { clips = [] } = await chrome.storage.local.get({ clips: [], clipCounter: 0 });
  await chrome.storage.local.set({ clips: [], clipCounter: 0 });
  chrome.runtime.sendMessage({ type: 'CLIPS_UPDATED', clips: [] });
  await cleanupClipDownloads(clips);
}

async function cleanupClipDownloads(clips) {
  if (!Array.isArray(clips) || clips.length === 0) {
    return;
  }

  await Promise.all(
    clips.map(async (clip) => {
      if (!clip) {
        return;
      }

      const downloadId = await resolveDownloadId(clip).catch((error) => {
        console.warn('Failed to resolve download ID for cleanup', clip?.filename, error);
        return null;
      });

      if (downloadId === null) {
        return;
      }

      try {
        await chrome.downloads.removeFile(downloadId);
      } catch (error) {
        console.warn('Failed to remove downloaded file', downloadId, error);
      }
      try {
        await chrome.downloads.erase({ id: downloadId });
      } catch (error) {
        console.warn('Failed to erase download history', downloadId, error);
      }
    })
  );
}

async function findDownloadIdByFilename(filename) {
  if (!filename) {
    return null;
  }

  const baseName = filename.replace(/\.[^.]+$/, '');
  const escapedFolder = escapeRegex(CLIP_DOWNLOAD_FOLDER);
  const escapedBase = escapeRegex(baseName);
  const escapedExt = escapeRegex(filename.split('.').pop() || '');
  const regex = `${escapedFolder}[\\\\/].*${escapedBase}.*\\.${escapedExt}$`;

  const results = await chrome.downloads.search({ filenameRegex: regex });
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  results.sort((a, b) => {
    const timeA = Date.parse(a.startTime || '') || 0;
    const timeB = Date.parse(b.startTime || '') || 0;
    return timeB - timeA;
  });

  return results[0]?.id ?? null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveClipDownloadId(id) {
  const clip = await findClipById(id);
  if (!clip) {
    throw new Error('未找到指定的截图');
  }
  const downloadId = await resolveDownloadId(clip);
  if (downloadId === null) {
    throw new Error('找不到对应的本地文件');
  }
  return downloadId;
}

async function resolveDownloadId(clip) {
  if (!clip) {
    return null;
  }

  if (typeof clip.downloadId === 'number') {
    const existing = await chrome.downloads.search({ id: clip.downloadId });
    if (Array.isArray(existing) && existing.length > 0) {
      return clip.downloadId;
    }
  }

  const foundId = await findDownloadIdByFilename(clip.filename);
  if (foundId !== null) {
    clip.downloadId = foundId;
    const { clips = [] } = await chrome.storage.local.get({ clips: [] });
    const index = clips.findIndex((stored) => stored.id === clip.id);
    if (index >= 0) {
      clips[index] = { ...clips[index], downloadId: foundId };
      await chrome.storage.local.set({ clips });
    }
  }
  return foundId;
}

async function findClipById(id) {
  if (!id) {
    return null;
  }
  const { clips = [] } = await chrome.storage.local.get({ clips: [] });
  return clips.find((clip) => clip.id === id) || null;
}

async function saveWebpage(message) {
  const { htmlContent, styles, title, url } = message;
  const { clips = [], clipCounter = 0 } = await chrome.storage.local.get({ clips: [], clipCounter: 0 });
  const nextCounter = clipCounter + 1;
  const indexLabel = String(nextCounter).padStart(3, '0');

  // 创建完整的 HTML 文档
  const completeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title || 'Saved Webpage'}</title>
  <style>${styles}</style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  // 使用页面标题作为文件名，清理非法字符
  const sanitizedTitle = (title || 'webpage').replace(/[<>:"/\\|?*]/g, '-').substring(0, 100);
  const filename = `${sanitizedTitle}-${indexLabel}.html`;

  const timestamp = new Date().toISOString();
  const clip = {
    id: crypto.randomUUID(),
    filename,
    title,
    url,
    createdAt: timestamp,
    type: 'webpage',
    htmlContent: completeHtml
  };

  // 保存 HTML 文件
  const htmlBlob = new Blob([completeHtml], { type: 'text/html' });
  const htmlDataUrl = await blobToDataUrl(htmlBlob);

  const downloadId = await chrome.downloads.download({
    url: htmlDataUrl,
    filename: `${CLIP_DOWNLOAD_FOLDER}/${filename}`,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  clip.downloadId = downloadId;

  clips.push(clip);
  await chrome.storage.local.set({ clips, clipCounter: nextCounter });

  chrome.runtime.sendMessage({ type: 'CLIP_ADDED', clip });
  return clip;
}

async function generatePdf(clipIds) {
  const { clips = [] } = await chrome.storage.local.get({ clips: [] });
  const selected = clipIds && clipIds.length ? clips.filter((clip) => clipIds.includes(clip.id)) : clips;
  if (!selected.length) {
    throw new Error('没有可用的截图');
  }

  // 分离截图和网页类型
  const imageClips = selected.filter(clip => clip.type !== 'webpage');
  const webpageClips = selected.filter(clip => clip.type === 'webpage');

  if (webpageClips.length > 0 && imageClips.length === 0) {
    // 仅网页类型，使用浏览器的打印功能生成 PDF
    return await generateWebpagePdf(webpageClips);
  } else if (imageClips.length > 0) {
    // 有截图类型，使用原有的图片 PDF 生成方式
    const pdfBuffer = await createPdf(imageClips);
    const base64Pdf = arrayBufferToDataUrl(pdfBuffer, 'application/pdf');

    const indexLabel = String(Date.now());
    const filename = `WebClip-${indexLabel}.pdf`;
    await chrome.downloads.download({
      url: base64Pdf,
      filename: `${CLIP_DOWNLOAD_FOLDER}/${filename}`,
      saveAs: true,
      conflictAction: 'uniquify'
    });

    return { filename, url: base64Pdf };
  } else {
    throw new Error('没有可用的内容');
  }
}

async function generateWebpagePdf(webpageClips) {
  // 创建合并的 HTML 内容
  const combinedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WebClip2PDF Export</title>
  <style>
    @page {
      margin: 1cm;
      size: A4;
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7;
    }
    .clip-page {
      background: white;
      padding: 30px;
      margin-bottom: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .page-break {
      page-break-after: always;
      margin: 40px 0;
      border-bottom: 2px dashed #ccc;
    }
    .print-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      margin: -20px -20px 20px -20px;
      border-radius: 8px 8px 0 0;
    }
    .print-instruction {
      background: #fff3cd;
      border: 2px solid #ffc107;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #856404;
    }
    @media print {
      body {
        background: white;
      }
      .print-instruction {
        display: none;
      }
      .clip-page {
        box-shadow: none;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="print-instruction">
    📄 <strong>提示：</strong>按 <kbd>Ctrl+P</kbd> (Windows) 或 <kbd>Cmd+P</kbd> (Mac) 打开打印对话框，选择"另存为 PDF"即可保存为 PDF 文件。
  </div>
${webpageClips.map((clip, index) => `
  <div class="clip-page">
    <div class="print-header">
      <h2 style="margin: 0; font-size: 20px;">
        ${clip.title || 'Saved Webpage'}
      </h2>
      <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">
        URL: ${clip.url}<br>
        保存时间: ${new Date(clip.createdAt).toLocaleString('zh-CN')}
      </div>
    </div>
    <div style="margin-top: 20px;">
      ${clip.htmlContent || ''}
    </div>
  </div>
  ${index < webpageClips.length - 1 ? '<div class="page-break"></div>' : ''}
`).join('\n')}
</body>
</html>`;

  const htmlBlob = new Blob([combinedHtml], { type: 'text/html' });
  const htmlDataUrl = await blobToDataUrl(htmlBlob);

  const indexLabel = String(Date.now());
  const filename = `WebClip-${indexLabel}.html`;

  // 下载 HTML 文件
  await chrome.downloads.download({
    url: htmlDataUrl,
    filename: `${CLIP_DOWNLOAD_FOLDER}/${filename}`,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  // 在新标签页中打开，方便用户直接打印
  await chrome.tabs.create({ url: htmlDataUrl, active: true });

  return {
    filename,
    url: htmlDataUrl,
    note: '网页已在新标签页打开，请按 Ctrl+P (Cmd+P) 打印为 PDF'
  };
}

async function createPdf(clips) {
  const images = [];
  for (let index = 0; index < clips.length; index += 1) {
    images.push(await clipToPdfImage(clips[index], index));
  }
  return buildPdfDocument(images);
}

async function clipToPdfImage(clip, index) {
  let dataUrl = clip.dataUrl;

  // 如果没有 dataUrl，尝试从文件系统读取
  if (!dataUrl && clip.downloadId) {
    const downloads = await chrome.downloads.search({ id: clip.downloadId });
    if (downloads.length > 0 && downloads[0].exists) {
      // 读取文件内容
      const filePath = downloads[0].filename;
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        dataUrl = await blobToDataUrl(blob);
      } catch (error) {
        console.error('Failed to read file:', error);
        // 如果读取失败，使用缩略图
        dataUrl = clip.thumbnailDataUrl;
      }
    } else {
      // 文件不存在，使用缩略图
      dataUrl = clip.thumbnailDataUrl;
    }
  }

  if (!dataUrl) {
    throw new Error(`No image data for clip ${clip.filename}`);
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const buffer = await jpegBlob.arrayBuffer();
  return {
    name: `Im${index}`,
    width: bitmap.width,
    height: bitmap.height,
    data: new Uint8Array(buffer)
  };
}

function buildPdfDocument(images) {
  const encoder = new TextEncoder();
  const chunks = [];
  const xref = [0];
  let offset = 0;

  const push = (data) => {
    chunks.push(data);
    offset += data.length;
  };

  const write = (text) => {
    push(encoder.encode(text));
  };

  write('%PDF-1.4\n');

  const totalPages = images.length;
  const totalObjects = 2 + totalPages * 3;

  const recordOffset = () => {
    xref.push(offset);
  };

  // Catalog object 1
  recordOffset();
  write('1 0 obj\n');
  write('<< /Type /Catalog /Pages 2 0 R >>\n');
  write('endobj\n');

  // Pages object 2
  recordOffset();
  write('2 0 obj\n');
  const kids = [];
  for (let i = 0; i < totalPages; i += 1) {
    const pageId = 3 + i * 3;
    kids.push(`${pageId} 0 R`);
  }
  write(`<< /Type /Pages /Count ${totalPages} /Kids [${kids.join(' ')}] >>\n`);
  write('endobj\n');

  for (let i = 0; i < totalPages; i += 1) {
    const image = images[i];
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    // Page object
    recordOffset();
    write(`${pageId} 0 obj\n`);
    write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Resources << /XObject << /${image.name} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
    write('endobj\n');

    // Content stream
    const contentStream = `q\n${image.width} 0 0 ${image.height} 0 0 cm\n/${image.name} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    recordOffset();
    write(`${contentId} 0 obj\n`);
    write(`<< /Length ${contentBytes.length} >>\n`);
    write('stream\n');
    push(contentBytes);
    write('\nendstream\n');
    write('endobj\n');

    // Image object
    recordOffset();
    write(`${imageId} 0 obj\n`);
    write(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\n`);
    write('stream\n');
    push(image.data);
    write('\nendstream\n');
    write('endobj\n');
  }

  const startXref = offset;
  write(`xref\n0 ${totalObjects + 1}\n`);
  write('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjects; i += 1) {
    const position = xref[i];
    write(`${String(position).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\n`);
  write(`startxref\n${startXref}\n%%EOF`);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result.buffer;
}

function arrayBufferToDataUrl(buffer, mime) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return `data:${mime};base64,${base64}`;
}
