const state = {
  priority: 'all',
  tasks: [],
};

const PRIORITY_CSS = { '高': 'badge--high', '中': 'badge--medium', '低': 'badge--low' };

const form = document.getElementById('add-form');
const titleInput = document.getElementById('task-title');
const prioritySelect = document.getElementById('task-priority');
const submitBtn = form.querySelector('.add-form__submit');
const listEl = document.getElementById('task-list');
const emptyEl = document.getElementById('empty-state');
const filtersEl = document.getElementById('filters');
const modeEl = document.getElementById('data-mode');
const countEl = document.getElementById('task-count');
const toastEl = document.getElementById('toast');

let toastTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2600);
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.error) || '请求失败（' + response.status + '）');
  }
  return data;
}

function renderList() {
  listEl.innerHTML = '';

  if (state.tasks.length === 0) {
    emptyEl.hidden = false;
    countEl.textContent = '';
    return;
  }

  emptyEl.hidden = true;
  countEl.textContent =
    '共 ' + state.tasks.length + ' 条 · 已完成 ' +
    state.tasks.filter((t) => t.completed).length + ' 条';

  state.tasks.forEach((task) => {
    const item = document.createElement('article');
    item.className = 'task' + (task.completed ? ' is-done' : '');
    item.dataset.id = task.id;

    const main = document.createElement('div');
    main.className = 'task__main';

    const title = document.createElement('div');
    title.className = 'task__title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task__meta';

    const badge = document.createElement('span');
    badge.className = 'badge ' + (PRIORITY_CSS[task.priority] || 'badge--medium');
    badge.textContent = task.priority;

    const status = document.createElement('span');
    status.className = 'status' + (task.completed ? ' status--done' : '');
    status.textContent = task.completed ? '已完成' : '未完成';

    const time = document.createElement('span');
    time.textContent = formatTime(task.created_at);

    meta.append(badge, status, time);
    main.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'task__actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn' + (task.completed ? '' : ' btn--done');
    toggleBtn.dataset.action = 'toggle';
    toggleBtn.textContent = task.completed ? '标记未完成' : '标记完成';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn--danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = '删除';

    actions.append(toggleBtn, deleteBtn);
    item.append(main, actions);
    listEl.append(item);
  });
}

async function loadTasks() {
  try {
    const query =
      state.priority === 'all' ? '' : '?priority=' + encodeURIComponent(state.priority);
    const tasks = await request('/api/tasks' + query);
    state.tasks = Array.isArray(tasks) ? tasks : [];
    renderList();
  } catch (err) {
    showToast('加载任务失败：' + err.message);
  }
}

async function loadMode() {
  try {
    const health = await request('/api/health');
    modeEl.textContent =
      health.mode === 'supabase'
        ? '数据源：Supabase 数据库'
        : '数据源：本地演示模式（配置 .env 后可切换到 Supabase）';
  } catch (err) {
    modeEl.textContent = '数据源：未知';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  if (!title) {
    showToast('请先输入任务内容');
    return;
  }

  submitBtn.disabled = true;
  try {
    await request('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority: prioritySelect.value }),
    });
    titleInput.value = '';
    titleInput.focus();
    await loadTasks();
    showToast('已添加任务');
  } catch (err) {
    showToast('添加失败：' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

filtersEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.filter');
  if (!btn) return;

  state.priority = btn.dataset.priority;
  Array.from(filtersEl.querySelectorAll('.filter')).forEach((el) => {
    el.classList.toggle('is-active', el === btn);
  });
  loadTasks();
});

listEl.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const item = btn.closest('.task');
  const id = item?.dataset.id;
  if (!id) return;

  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  btn.disabled = true;
  try {
    if (btn.dataset.action === 'toggle') {
      await request('/api/tasks/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
      await loadTasks();
    } else if (btn.dataset.action === 'delete') {
      await request('/api/tasks/' + encodeURIComponent(id), { method: 'DELETE' });
      await loadTasks();
      showToast('已删除任务');
    }
  } catch (err) {
    showToast('操作失败：' + err.message);
  } finally {
    btn.disabled = false;
  }
});

loadMode();
loadTasks();
