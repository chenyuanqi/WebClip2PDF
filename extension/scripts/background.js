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
});

async function capturePart(message, windowId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const { part } = message;

  // 计算在视口中的实际裁剪区域
  const viewportLeft = Math.max(0, message.rect.left - part.scrollX);
  const viewportTop = Math.max(0, message.rect.top - part.scrollY);
  const viewportWidth = Math.min(message.viewport.width - viewportLeft, part.width);
  const viewportHeight = Math.min(message.viewport.height - viewportTop, part.height);

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

  // 拼接每个部分
  for (const part of parts) {
    const response = await fetch(part.dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // 计算源区域和目标区域
    const sx = Math.round(part.viewportLeft * dpr);
    const sy = Math.round(part.viewportTop * dpr);
    const sw = Math.round(part.viewportWidth * dpr);
    const sh = Math.round(part.viewportHeight * dpr);

    const dx = Math.round(part.offsetX * dpr);
    const dy = Math.round(part.offsetY * dpr);

    // 绘制到画布上
    ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, sw, sh);
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

  // 拼接每个部分
  for (const part of parts) {
    const response = await fetch(part.dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // 计算源区域和目标区域
    const sx = Math.round(part.viewportLeft * dpr);
    const sy = Math.round(part.viewportTop * dpr);
    const sw = Math.round(part.viewportWidth * dpr);
    const sh = Math.round(part.viewportHeight * dpr);

    const dx = Math.round(part.offsetX * dpr);
    const dy = Math.round(part.offsetY * dpr);

    // 绘制到画布上
    ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, sw, sh);
  }

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
  const clip = {
    id: crypto.randomUUID(),
    filename,
    title,
    url,
    createdAt: timestamp,
    dataUrl
  };

  clips.push(clip);
  await chrome.storage.local.set({ clips, clipCounter: nextCounter });

  await chrome.downloads.download({
    url: dataUrl,
    filename: `${CLIP_DOWNLOAD_FOLDER}/${filename}`,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  return clip;
}

async function removeClip(id) {
  const { clips = [] } = await chrome.storage.local.get({ clips: [] });
  const updated = clips.filter((clip) => clip.id !== id);
  await chrome.storage.local.set({ clips: updated });
  chrome.runtime.sendMessage({ type: 'CLIPS_UPDATED', clips: updated });
}

async function clearClips() {
  await chrome.storage.local.set({ clips: [], clipCounter: 0 });
  chrome.runtime.sendMessage({ type: 'CLIPS_UPDATED', clips: [] });
}

async function generatePdf(clipIds) {
  const { clips = [] } = await chrome.storage.local.get({ clips: [] });
  const selected = clipIds && clipIds.length ? clips.filter((clip) => clipIds.includes(clip.id)) : clips;
  if (!selected.length) {
    throw new Error('没有可用的截图');
  }

  const pdfBuffer = await createPdf(selected);
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
}

async function createPdf(clips) {
  const images = [];
  for (let index = 0; index < clips.length; index += 1) {
    images.push(await clipToPdfImage(clips[index], index));
  }
  return buildPdfDocument(images);
}

async function clipToPdfImage(clip, index) {
  const response = await fetch(clip.dataUrl);
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
