const startCaptureBtn = document.getElementById('startCapture');
const generatePdfBtn = document.getElementById('generatePdf');
const clearClipsBtn = document.getElementById('clearClips');
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
  previewingId: null
};

startCaptureBtn.addEventListener('click', handleStartCapture);
generatePdfBtn.addEventListener('click', handleGeneratePdf);
clearClipsBtn.addEventListener('click', handleClearClips);

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
    setStatus('已触发 PDF 下载');
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
      });
      item.appendChild(selection);

      const thumbnail = document.createElement('img');
      thumbnail.src = clip.dataUrl;
      thumbnail.alt = clip.title || `截图 ${index + 1}`;
      thumbnail.classList.add('clip-thumbnail');
      thumbnail.addEventListener('click', () => handlePreviewClip(clip.id));
      item.appendChild(thumbnail);

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
  startCaptureBtn.disabled = working;
  generatePdfBtn.disabled = working;
  clearClipsBtn.disabled = working;
}
