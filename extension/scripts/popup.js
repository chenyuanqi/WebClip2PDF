const startCaptureBtn = document.getElementById('startCapture');
const captureFullPageBtn = document.getElementById('captureFullPage');
const captureWebpageBtn = document.getElementById('captureWebpage');
const generatePdfBtn = document.getElementById('generatePdf');
const clearClipsBtn = document.getElementById('clearClips');
const selectAllClipsBtn = document.getElementById('selectAllClips');
const deselectAllClipsBtn = document.getElementById('deselectAllClips');
const clipToolbarEl = document.querySelector('.clip-toolbar');
const statusEl = document.getElementById('status');
const clipListEl = document.getElementById('clipList');
const previewOverlayEl = document.getElementById('previewOverlay');
const previewImageEl = document.getElementById('previewImage');
const previewTitleEl = document.getElementById('previewTitle');
const previewMetaEl = document.getElementById('previewMeta');
const previewCloseBtn = document.getElementById('previewClose');

const state = {
  clips: [],
  selected: new Set(),
  previewingId: null,
  working: false
};

startCaptureBtn.addEventListener('click', handleStartCapture);
if (captureFullPageBtn) {
  captureFullPageBtn.addEventListener('click', handleCaptureFullPage);
}
if (captureWebpageBtn) {
  captureWebpageBtn.addEventListener('click', handleCaptureWebpage);
}
generatePdfBtn.addEventListener('click', handleGeneratePdf);
clearClipsBtn.addEventListener('click', handleClearClips);
if (selectAllClipsBtn) {
  selectAllClipsBtn.addEventListener('click', handleSelectAllClips);
}
if (deselectAllClipsBtn) {
  deselectAllClipsBtn.addEventListener('click', handleDeselectAllClips);
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) {
    return;
  }
  if (message.type === 'CLIP_ADDED') {
    state.clips.push(message.clip);
    state.selected.add(message.clip.id);
    renderClips();
    setStatus('已保存截图');
  }
  if (message.type === 'CLIPS_UPDATED') {
    state.clips = message.clips || [];
    state.selected = new Set(state.clips.map((clip) => clip.id));
    renderClips();
    setStatus('列表已更新');
  }
});

init();

if (previewOverlayEl && previewCloseBtn) {
  previewOverlayEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.previewDismiss !== undefined || target === previewOverlayEl) {
      closePreview();
    }
  });

  previewCloseBtn.addEventListener('click', closePreview);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && previewOverlayEl.classList.contains('visible')) {
      closePreview();
    }
  });
}

async function init() {
  await loadClips();
}

async function loadClips() {
  const { clips = [] } = await chrome.storage.local.get({ clips: [] });
  state.clips = clips;
  state.selected = new Set(clips.map((clip) => clip.id));
  renderClips();
}

async function handleStartCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('无法获取当前标签页', true);
    return;
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' }).catch((error) => {
    console.error(error);
    setStatus('无法在此页面注入选择层，请检查权限', true);
  });
  window.close();
}

async function handleCaptureFullPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('无法获取当前标签页', true);
    return;
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FULL_PAGE' }).catch((error) => {
    console.error(error);
    setStatus('无法执行整页截取，请检查权限', true);
  });
  window.close();
}

async function handleCaptureWebpage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('无法获取当前标签页', true);
    return;
  }
  setWorking(true);
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_WEBPAGE' });
    if (!response?.success) {
      throw new Error(response?.error || '无法捕获网页内容');
    }
    setStatus('网页内容已保存');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    setWorking(false);
  }
}

async function handleGeneratePdf() {
  if (!state.selected.size) {
    setStatus('请至少选择一张截图', true);
    return;
  }
  setWorking(true);
  try {
    const clipIds = Array.from(state.selected);
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PDF',
      clipIds
    });
    if (!response?.success) {
      throw new Error(response?.error || '生成 PDF 失败');
    }
    if (response.pdf?.note) {
      setStatus(response.pdf.note);
    } else {
      setStatus('已触发 PDF 下载');
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    setWorking(false);
  }
}

async function handleClearClips() {
  if (!state.clips.length) {
    return;
  }
  if (!confirm('确定要清空所有截图吗？')) {
    return;
  }
  setWorking(true);
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CLIPS' });
    if (!response?.success) {
      throw new Error(response?.error || '清空失败');
    }
    state.clips = [];
    state.selected.clear();
    closePreview();
    renderClips();
    setStatus('已清空截图');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    setWorking(false);
  }
}

function renderClips() {
  clipListEl.innerHTML = '';
  if (!state.clips.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '暂时没有截图，可以点击“开始截取”来添加。';
    clipListEl.appendChild(empty);
    updateSelectionControls();
    return;
  }

  state.clips
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((clip, index) => {
      const item = document.createElement('div');
      item.className = 'clip-item';

      const selection = document.createElement('input');
      selection.type = 'checkbox';
      selection.className = 'clip-select';
      selection.checked = state.selected.has(clip.id);
      selection.addEventListener('change', () => {
        if (selection.checked) {
          state.selected.add(clip.id);
        } else {
          state.selected.delete(clip.id);
        }
        updateSelectionControls();
      });
      item.appendChild(selection);

      if (clip.type === 'webpage') {
        // 网页类型，显示一个文档图标或者文本标识
        const webpageIcon = document.createElement('div');
        webpageIcon.classList.add('clip-thumbnail', 'webpage-icon');
        webpageIcon.innerHTML = '📄';
        webpageIcon.title = '网页内容';
        item.appendChild(webpageIcon);
      } else {
        // 截图类型，显示缩略图
        const thumbnail = document.createElement('img');
        thumbnail.src = clip.dataUrl;
        thumbnail.alt = clip.title || `截图 ${index + 1}`;
        thumbnail.classList.add('clip-thumbnail');
        thumbnail.addEventListener('click', () => handlePreviewClip(clip.id));
        item.appendChild(thumbnail);
      }

      const meta = document.createElement('div');
      meta.className = 'clip-meta';

      const title = document.createElement('button');
      title.type = 'button';
      title.className = 'title clip-link';
      const displayTitle = clip.title || clip.filename;
      title.textContent = displayTitle;
      title.title = displayTitle;
      title.addEventListener('click', () => handleRevealClip(clip.id));
      meta.appendChild(title);

      const detail = document.createElement('button');
      detail.type = 'button';
      detail.className = 'detail clip-link';
      const detailText = `${clip.filename} · ${formatTime(clip.createdAt)}`;
      detail.textContent = detailText;
      detail.title = detailText;
      detail.addEventListener('click', () => handleRevealClip(clip.id));
      meta.appendChild(detail);

      const actions = document.createElement('div');
      actions.className = 'clip-actions';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.innerHTML = '🗑️';
      removeBtn.title = '删除';
      removeBtn.addEventListener('click', () => handleRemoveClip(clip.id));
      actions.appendChild(removeBtn);

      item.appendChild(meta);
      item.appendChild(actions);

      clipListEl.appendChild(item);
    });

  updateSelectionControls();
}

function handleSelectAllClips() {
  state.clips.forEach((clip) => {
    state.selected.add(clip.id);
  });
  renderClips();
  setStatus(`已全选 ${state.selected.size} 张截图`);
}

function handleDeselectAllClips() {
  state.selected.clear();
  renderClips();
  setStatus('已取消所有截图的选择');
}

async function handleRemoveClip(id) {
  setWorking(true);
  try {
    const response = await chrome.runtime.sendMessage({ type: 'REMOVE_CLIP', id });
    if (!response?.success) {
      throw new Error(response?.error || '删除失败');
    }
    state.clips = state.clips.filter((clip) => clip.id !== id);
    state.selected.delete(id);
    if (state.previewingId === id) {
      closePreview();
    }
    renderClips();
    setStatus('已删除截图');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    setWorking(false);
  }
}

function handlePreviewClip(id) {
  const clip = state.clips.find((item) => item.id === id);
  if (!clip) {
    setStatus('找不到对应的截图', true);
    return;
  }
  if (clip.type === 'webpage') {
    setStatus('网页类型不支持预览', true);
    return;
  }
  openPreview(clip);
  setStatus('已打开截图预览');
}

async function handleRevealClip(id) {
  const clip = state.clips.find((item) => item.id === id);
  if (!clip) {
    setStatus('找不到对应的截图', true);
    return;
  }

  try {
    let downloadId = typeof clip.downloadId === 'number' ? clip.downloadId : null;

    if (downloadId !== null) {
      const matches = await chrome.downloads.search({ id: downloadId });
      if (!Array.isArray(matches) || matches.length === 0) {
        downloadId = null;
      }
    }

    if (downloadId === null) {
      const response = await chrome.runtime.sendMessage({ type: 'RESOLVE_CLIP_DOWNLOAD_ID', id });
      if (!response?.success || typeof response.downloadId !== 'number') {
        throw new Error(response?.error || '无法定位文件');
      }
      downloadId = response.downloadId;
      clip.downloadId = downloadId;
    }

    chrome.downloads.show(downloadId);
    setStatus('已在文件夹中定位截图');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  }
}

function openPreview(clip) {
  if (!previewOverlayEl || !previewImageEl || !previewTitleEl || !previewMetaEl) {
    return;
  }

  state.previewingId = clip.id;
  previewImageEl.src = clip.dataUrl;
  previewImageEl.alt = clip.title || clip.filename;
  previewTitleEl.textContent = clip.title || clip.filename;
  previewMetaEl.textContent = `${clip.filename} · ${formatTime(clip.createdAt)}`;

  previewOverlayEl.hidden = false;
  previewOverlayEl.classList.add('visible');

  if (previewCloseBtn) {
    previewCloseBtn.focus({ preventScroll: true });
  }
}

function closePreview() {
  if (!previewOverlayEl || !previewImageEl) {
    return;
  }
  state.previewingId = null;
  previewOverlayEl.classList.remove('visible');
  previewOverlayEl.hidden = true;
  previewImageEl.src = '';
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message || '';
  statusEl.style.color = isError ? '#ff3b30' : '#3a3a3c';
}

function setWorking(working) {
  state.working = working;
  startCaptureBtn.disabled = working;
  if (captureFullPageBtn) {
    captureFullPageBtn.disabled = working;
  }
  if (captureWebpageBtn) {
    captureWebpageBtn.disabled = working;
  }
  generatePdfBtn.disabled = working;
  updateSelectionControls();
}

function updateSelectionControls() {
  const hasClips = state.clips.length > 0;
  const allSelected = hasClips && state.selected.size === state.clips.length;
  const noneSelected = state.selected.size === 0;

  if (clipToolbarEl) {
    clipToolbarEl.hidden = !hasClips;
  }

  if (clearClipsBtn) {
    clearClipsBtn.disabled = state.working || !hasClips;
  }

  if (selectAllClipsBtn) {
    selectAllClipsBtn.disabled = state.working || !hasClips || allSelected;
  }

  if (deselectAllClipsBtn) {
    deselectAllClipsBtn.disabled = state.working || noneSelected;
  }

  if (generatePdfBtn) {
    generatePdfBtn.disabled = state.working || noneSelected;
  }
}
