const startCaptureBtn = document.getElementById('startCapture');
const generatePdfBtn = document.getElementById('generatePdf');
const clearClipsBtn = document.getElementById('clearClips');
const statusEl = document.getElementById('status');
const clipListEl = document.getElementById('clipList');

const state = {
  clips: [],
  selected: new Set()
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
      item.appendChild(thumbnail);

      const meta = document.createElement('div');
      meta.className = 'clip-meta';

      const title = document.createElement('div');
      title.className = 'title';
      const displayTitle = clip.title || clip.filename;
      title.textContent = displayTitle;
      title.title = displayTitle;
      meta.appendChild(title);

      const detail = document.createElement('div');
      detail.className = 'detail';
      const detailText = `${clip.filename} · ${formatTime(clip.createdAt)}`;
      detail.textContent = detailText;
      detail.title = detailText;
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
    renderClips();
    setStatus('已删除截图');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    setWorking(false);
  }
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
