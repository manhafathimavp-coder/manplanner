// const API_URL = window.location.origin + '/api'; // Use for production
const API_URL = 'http://localhost:5000/api'; // Use for local development

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user'));
let tasks = [];
let currentFilter = 'all';
let editingTaskId = null;

const authView = document.getElementById('auth-view');
const dashView = document.getElementById('dashboard-view');
const tasksContent = document.getElementById('tasks-content');
const adminContent = document.getElementById('admin-content');
const taskModal = document.getElementById('task-modal');
const loadingSpinner = document.getElementById('loading-spinner');
const toastContainer = document.getElementById('toast-container');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const authForm = document.getElementById('auth-form');
let authMode = 'login';

// Init
function init() {
    if (token && user) showDashboard();
    else showAuth();
    
    const today = new Date();
    document.getElementById('date-display').textContent = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Navigation & View changes
function showAuth() { authView.classList.add('active'); dashView.classList.remove('active'); }
function showDashboard() {
    authView.classList.remove('active'); dashView.classList.add('active');
    document.getElementById('user-greeting').textContent = user.name;
    document.getElementById('user-role-badge').textContent = user.role === 'superadmin' ? 'Super Admin' : 'Agent';
    
    // Show admin controls if superadmin
    if(user.role === 'superadmin') {
        document.getElementById('admin-nav-area').classList.remove('hidden');
    } else {
        document.getElementById('admin-nav-area').classList.add('hidden');
    }

    showTasksPanel();
}

function showTasksPanel() {
    tasksContent.classList.remove('hidden');
    adminContent.classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('.nav-item[data-filter="all"]').classList.add('active');
    currentFilter = 'all';
    fetchTasks();
}

function showAdminPanel() {
    tasksContent.classList.add('hidden');
    adminContent.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-admin').classList.add('active');
    fetchAdminUsers();
}

function switchTab(mode) {
    authMode = mode;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab')[mode === 'login' ? 0 : 1].classList.add('active');
    document.getElementById('name-group').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('auth-submit').textContent = mode === 'register' ? 'Initialize' : 'Grant Access';
}

function openModal(taskId = null) {
    editingTaskId = taskId;
    taskModal.classList.remove('hidden');
    if (taskId) {
        document.getElementById('modal-title').textContent = 'Edit Directive';
        const task = tasks.find(t => t.id === taskId);
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-category').value = task.category || 'General';
        document.getElementById('task-priority').value = task.priority || 'Medium';
        document.getElementById('task-favorite').checked = task.favorite;
        if(task.due_date) document.getElementById('task-date').value = task.due_date.split('T')[0];
    } else {
        document.getElementById('modal-title').textContent = 'New Directive';
        document.getElementById('task-form').reset();
    }
}

function closeModal() {
    taskModal.classList.add('hidden');
    document.getElementById('task-form').reset();
    editingTaskId = null;
}

// Toasts & API
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle text-danger';
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideInX 0.3s reverse forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function apiCall(endpoint, method = 'GET', body = null) {
    loadingSpinner.classList.remove('hidden');
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);
        
        const res = await fetch(`${API_URL}${endpoint}`, options);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Request failed');
        loadingSpinner.classList.add('hidden');
        return data;
    } catch (err) {
        loadingSpinner.classList.add('hidden');
        showToast(err.message, 'error');
        if (err.message.includes('token') || err.message.includes('credentials') || err.message.includes('Access denied')) handleLogout();
        throw err; // Propagate error for other catches
    }
}

// Auth Handlers
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        let data;
        
        if (authMode === 'login') {
            data = await apiCall('/auth/login', 'POST', { email, password });
            showToast('Authorization Granted');
        } else {
            const name = document.getElementById('name').value.trim();
            data = await apiCall('/auth/register', 'POST', { name, email, password });
            showToast('Core systems initialized.');
        }
        
        token = data.token; user = data.user;
        localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
        authForm.reset(); showDashboard();
    } catch (err) {}
});

function handleLogout() {
    token = null; user = null; localStorage.clear(); showAuth();
}
document.getElementById('logout-btn').addEventListener('click', handleLogout);

// Tasks
async function fetchTasks() {
    try {
        const search = document.getElementById('search-input').value.trim();
        let query = `/tasks?filter=${currentFilter}`;
        if (search) query += `&search=${encodeURIComponent(search)}`;
        
        tasks = await apiCall(query);
        renderStats();
        renderTasks();
    } catch (err) {}
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('task-title').value.trim(),
        description: document.getElementById('task-desc').value.trim(),
        category: document.getElementById('task-category').value,
        priority: document.getElementById('task-priority').value,
        favorite: document.getElementById('task-favorite').checked,
        due_date: document.getElementById('task-date').value
    };

    try {
        if (editingTaskId) {
            await apiCall(`/tasks/${editingTaskId}`, 'PUT', payload);
            showToast('Directive synchronized.');
        } else {
            await apiCall('/tasks', 'POST', payload);
            showToast('New directive active.');
        }
        closeModal();
        fetchTasks();
    } catch(err) {}
});

async function toggleTask(id, currentStatus) {
    try { await apiCall(`/tasks/${id}`, 'PUT', { completed: !currentStatus }); fetchTasks(); } catch (err) {}
}

async function toggleFavorite(id, currentFav) {
    try { await apiCall(`/tasks/${id}`, 'PUT', { favorite: !currentFav }); fetchTasks(); } catch (err) {}
}

async function deleteTask(id) {
    if (!confirm('Obliterate this directive?')) return;
    try { await apiCall(`/tasks/${id}`, 'DELETE'); showToast('Purged.'); fetchTasks(); } catch (err) {}
}

// Interactivity
document.querySelectorAll('.nav-item[data-filter]').forEach(btn => {
    btn.addEventListener('click', e => {
        tasksContent.classList.remove('hidden');
        adminContent.classList.add('hidden');

        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentFilter = e.currentTarget.dataset.filter;
        document.getElementById('current-view-title').textContent = e.currentTarget.textContent.trim();
        fetchTasks();
    });
});
let searchTimer;
document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fetchTasks, 400);
});

// Admin Features
async function fetchAdminUsers() {
    try {
        const users = await apiCall('/admin/users');
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${u.id}</td>
                <td>${escapeHTML(u.name)}</td>
                <td>${escapeHTML(u.email)}</td>
                <td><span class="badge priority-Low">${u.taskCount}</span></td>
                <td><span class="badge ${u.role==='superadmin'?'priority-High':'priority-Low'}">${u.role.toUpperCase()}</span></td>
                <td>
                    ${u.role !== 'superadmin' ? `<button class="t-btn delete text-danger" onclick="deleteUser(${u.id})"><i class="ph ph-trash"></i></button>` : 'System Root'}
                </td>
            `;
            list.appendChild(tr);
        });
    } catch (err) {}
}

async function deleteUser(id) {
    if(!confirm("Permanently erase user and all their tasks?")) return;
    try {
        await apiCall(`/admin/users/${id}`, 'DELETE');
        showToast("User eradicated");
        fetchAdminUsers();
    } catch (err) {}
}

// Rendering
function renderStats() {
    const completed = tasks.filter(t => t.completed).length;
    const urgent = tasks.filter(t => t.priority === 'High' && !t.completed).length;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-urgent').textContent = urgent;
    document.getElementById('stat-total').textContent = tasks.length;
}

function renderTasks() {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card ${task.completed ? 'completed' : ''}`;
            
            const descHtml = task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : '';
            const dueHtml = task.due_date ? `<span class="badge"><i class="ph ph-calendar"></i> ${task.due_date.split('T')[0]}</span>` : '';
            const favClass = task.favorite ? 'fav text-yellow' : '';
            const favIcon = task.favorite ? 'ph-star-fill' : 'ph-star';
            
            card.innerHTML = `
                <div class="card-header">
                    <input type="checkbox" class="status-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id}, ${task.completed})">
                    <div class="task-title-wrap">
                        <h3 class="task-title">${escapeHTML(task.title)}</h3>
                    </div>
                    <div class="card-actions">
                        <button class="star-btn ${favClass}" onclick="toggleFavorite(${task.id}, ${task.favorite})"><i class="ph ${favIcon}"></i></button>
                        <button onclick="openModal(${task.id})"><i class="ph ph-pencil-simple"></i></button>
                        <button onclick="deleteTask(${task.id})"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                ${descHtml}
                <div class="card-footer">
                    <div class="badges">
                        <span class="badge cat-badge">${escapeHTML(task.category || 'General')}</span>
                        <span class="badge priority-${task.priority}"><i class="ph ph-warning-circle"></i> ${task.priority}</span>
                        ${dueHtml}
                    </div>
                </div>
            `;
            taskList.appendChild(card);
        });
    }
}

function escapeHTML(str) { return (str || '').replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)); }
init();
