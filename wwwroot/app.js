const elements = {
  list: document.querySelector('#task-list'),
  search: document.querySelector('#search'),
  dialog: document.querySelector('#task-dialog'),
  form: document.querySelector('#task-form'),
  title: document.querySelector('#task-title'),
  category: document.querySelector('#task-category'),
  completed: document.querySelector('#task-completed'),
  pageError: document.querySelector('#page-error'),
  formError: document.querySelector('#form-error')
};

let tasks = [];
let filter = 'all';
let editingId = null;
let busy = false;

function renderIcons() {
  globalThis.lucide?.createIcons();
}

function setConnection(online) {
  const connection = document.querySelector('#connection');
  connection.className = `connection ${online ? 'online' : 'offline'}`;
  connection.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  connection.append(dot, online ? 'API connected' : 'API unavailable');
}

async function request(method, path, body) {
  const started = performance.now();
  document.querySelector('#request-method').textContent = method;
  document.querySelector('#request-path').textContent = path;
  const status = document.querySelector('#response-status');
  status.textContent = 'Pending';
  status.classList.remove('failed');

  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error('The server returned an unexpected response. Try refreshing.'); }
    status.textContent = `${response.status} ${response.statusText}`.trim();
    status.classList.toggle('failed', !response.ok);
    document.querySelector('#response-body').textContent = data === null ? '(no response body)' : JSON.stringify(data, null, 2);
    document.querySelector('#request-time').textContent = `${Math.round(performance.now() - started)} ms`;
    setConnection(true);

    if (!response.ok) {
      const message = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.title;
      throw new Error(message || `Request failed (${response.status}). Refresh and try again.`);
    }
    return data;
  } catch (error) {
    if (error.name === 'TypeError' || error.name === 'TimeoutError') {
      setConnection(false);
      status.textContent = 'Connection failed';
      status.classList.add('failed');
      document.querySelector('#response-body').textContent = 'The API could not be reached.';
      throw new Error('Cannot reach the API. Check that the application is running, then refresh.');
    }
    throw error;
  }
}

function showError(element, error) {
  element.textContent = error.message;
  element.hidden = false;
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('#new-task, #refresh, .task-actions button, .task-checkbox, #save-task, #task-title, #task-category, #task-completed').forEach(element => { element.disabled = value; });
  elements.list.setAttribute('aria-busy', String(value));
}

function makeIconButton(icon, label, action, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button${danger ? ' danger' : ''}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  const image = document.createElement('i');
  image.dataset.lucide = icon;
  image.setAttribute('aria-hidden', 'true');
  button.append(image);
  button.addEventListener('click', action);
  return button;
}

function render() {
  const completed = tasks.filter(task => task.isComplete).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#active-count').textContent = tasks.length - completed;
  document.querySelector('#complete-count').textContent = completed;
  document.querySelector('#progress-label').textContent = `${progress}%`;
  document.querySelector('#progress').value = progress;

  const query = elements.search.value.trim().toLowerCase();
  const visible = tasks.filter(task =>
    (filter === 'all' || (filter === 'completed' ? task.isComplete : !task.isComplete)) &&
    task.title.toLowerCase().includes(query));

  document.querySelector('#visible-count').textContent = visible.length;
  document.querySelector('#list-summary').textContent = `${visible.length} of ${tasks.length} tasks`;
  elements.list.replaceChildren();

  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? 'No matching tasks.' : tasks.length ? 'No tasks in this view.' : 'Your workspace is clear. Add your first task.';
    elements.list.append(empty);
  }

  visible.forEach(task => {
    const row = document.createElement('article');
    row.className = `task-row${task.isComplete ? ' completed' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.isComplete;
    checkbox.setAttribute('aria-label', `Mark ${task.title} as ${task.isComplete ? 'in progress' : 'completed'}`);
    checkbox.addEventListener('change', () => updateCompletion(task, checkbox.checked));

    const content = document.createElement('div');
    content.className = 'task-content';
    const title = document.createElement('h3');
    title.className = 'task-title';
    title.textContent = task.title;
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const category = document.createElement('span');
    category.className = `category ${task.category.toLowerCase()}`;
    category.textContent = task.category;
    const identifier = document.createElement('span');
    identifier.textContent = `#${String(task.id).padStart(3, '0')}`;
    meta.append(category, identifier);
    content.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(
      makeIconButton('pencil', `Edit ${task.title}`, () => openDialog(task)),
      makeIconButton('trash-2', `Delete ${task.title}`, () => deleteTask(task), true));
    row.append(checkbox, content, actions);
    elements.list.append(row);
  });
  renderIcons();
  setBusy(busy);
}

async function loadTasks() {
  if (busy) return;
  setBusy(true);
  elements.pageError.hidden = true;
  try {
    tasks = await request('GET', '/api/tasks');
    render();
  } catch (error) {
    showError(elements.pageError, error);
    if (!tasks.length) {
      elements.list.replaceChildren();
      const message = document.createElement('p');
      message.className = 'empty';
      message.textContent = 'Tasks could not be loaded.';
      elements.list.append(message);
      document.querySelector('#list-summary').textContent = 'Connection unavailable';
    }
  } finally { setBusy(false); }
}

function openDialog(task = null) {
  if (busy) return;
  editingId = task?.id ?? null;
  elements.form.reset();
  elements.title.value = task?.title ?? '';
  elements.category.value = task?.category ?? 'Learning';
  elements.completed.checked = task?.isComplete ?? false;
  elements.formError.hidden = true;
  document.querySelector('#dialog-title').textContent = task ? 'Edit task' : 'New task';
  elements.dialog.showModal();
  elements.title.focus();
}

async function updateCompletion(task, isComplete) {
  if (busy) return;
  setBusy(true);
  elements.pageError.hidden = true;
  try {
    const updated = await request('PUT', `/api/tasks/${task.id}`, { title: task.title, category: task.category, isComplete });
    tasks = tasks.map(existing => existing.id === task.id ? updated : existing);
  } catch (error) { showError(elements.pageError, error); }
  finally { render(); setBusy(false); }
}

async function deleteTask(task) {
  if (busy || !confirm(`Delete "${task.title}"?`)) return;
  setBusy(true);
  elements.pageError.hidden = true;
  try {
    await request('DELETE', `/api/tasks/${task.id}`);
    tasks = tasks.filter(existing => existing.id !== task.id);
    render();
  } catch (error) { showError(elements.pageError, error); }
  finally { setBusy(false); }
}

elements.form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const title = elements.title.value.trim();
  if (!title) { showError(elements.formError, new Error('Enter a task title.')); elements.title.focus(); return; }
  const input = { title, category: elements.category.value, isComplete: elements.completed.checked };
  setBusy(true);
  elements.formError.hidden = true;
  elements.pageError.hidden = true;
  try {
    const saved = await request(editingId === null ? 'POST' : 'PUT', editingId === null ? '/api/tasks' : `/api/tasks/${editingId}`, input);
    tasks = editingId === null ? [...tasks, saved] : tasks.map(task => task.id === editingId ? saved : task);
    elements.dialog.close();
    render();
  } catch (error) { showError(elements.formError, error); }
  finally { setBusy(false); }
});

document.querySelector('#new-task').addEventListener('click', () => openDialog());
document.querySelector('#refresh').addEventListener('click', loadTasks);
elements.search.addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(option => {
      option.classList.toggle('selected', option === button);
      option.setAttribute('aria-pressed', String(option === button));
    });
    render();
  });
});
for (const selector of ['#close-dialog', '#cancel-dialog']) {
  document.querySelector(selector).addEventListener('click', () => { if (!busy) elements.dialog.close(); });
}
elements.dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
document.querySelector('#today').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
renderIcons();
loadTasks();