const isFileAccess = window.location.protocol === 'file:';
const API_URL = isFileAccess ? 'http://localhost:5000/api' : window.location.origin + '/api';

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user'));
let tasks = [];
let currentFilter = 'all';
let currentView = 'tasks';
let editingTaskId = null;
let charts = {};
let tempSubtasks = [];

// Timer State
let timerInterval;
let timerSeconds = 1500;
let timerRunning = false;

// Calendar State
let currentCalDate = new Date();

// Timeline State
let missionLog = []; // Local history for the session

// Theme Initialization
const getInitialTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'theme-dark' : 'theme-light';
};
document.body.className = getInitialTheme();

function toggleTheme() {
    const newTheme = document.body.classList.contains('theme-light') ? 'theme-dark' : 'theme-light';
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    updateChartColors();
}

// CMD+K Launcher
window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCmdBar();
    }
    if (e.key === 'Escape') closeCmdBar();
});

function openCmdBar() {
    const bar = document.getElementById('command-bar');
    bar.classList.remove('hidden');
    document.getElementById('cmd-input').focus();
    renderCmdResults('');
    gsap.fromTo('.cmd-inner', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 });
}

function closeCmdBar() {
    document.getElementById('command-bar').classList.add('hidden');
}

const cmdActions = [
    { name: 'New Directive', icon: 'ph-plus', action: () => openModal() },
    { name: 'Go to Calendar', icon: 'ph-calendar-blank', action: () => switchView('calendar') },
    { name: 'Go to Analytics', icon: 'ph-chart-polar', action: () => switchView('analytics') },
    { name: 'Go to Mission Log', icon: 'ph-activity', action: () => switchView('timeline') },
    { name: 'Switch Theme', icon: 'ph-swatches', action: () => toggleTheme() },
    { name: 'Logout', icon: 'ph-sign-out', action: () => handleLogout() }
];

document.getElementById('cmd-input').addEventListener('input', e => renderCmdResults(e.target.value));

function renderCmdResults(query) {
    const res = document.getElementById('cmd-results');
    res.innerHTML = '';
    const filtered = cmdActions.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
    filtered.forEach(a => {
        const div = document.createElement('div');
        div.className = 'cmd-item';
        div.innerHTML = `<i class="ph ${a.icon}"></i> <span>${a.name}</span>`;
        div.onclick = () => { a.action(); closeCmdBar(); };
        res.appendChild(div);
    });
}

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
    authView.classList.remove('active');
    dashView.classList.add('active');
    
    // Update User Info
    document.getElementById('user-greeting').textContent = user.name;
    document.getElementById('user-role-badge').textContent = user.role === 'superadmin' ? 'Super Admin' : 'Agent';
    document.getElementById('p-name').textContent = user.name;
    document.getElementById('p-email').textContent = user.email;
    document.getElementById('update-name').value = user.name;

    // Admin visibility
    const adminArea = document.getElementById('admin-nav-area');
    if(user.role === 'superadmin') adminArea.classList.remove('hidden');
    else adminArea.classList.add('hidden');

    switchView(currentView);
}

function switchView(viewName) {
    currentView = viewName;
    
    // Hide all main views
    const views = ['tasks-content', 'admin-content', 'analytics-content', 'profile-content'];
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    // Activate selected
    const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (activeNav) activeNav.classList.add('active');

    const targetView = document.getElementById(`${viewName}-content`);
    targetView.classList.remove('hidden');

    // Transitions
    gsap.fromTo(targetView, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });

    if (viewName === 'tasks') fetchTasks();
    if (viewName === 'analytics') initAnalytics();
    if (viewName === 'calendar') renderCalendar();
    if (viewName === 'timeline') renderTimeline();
    if (viewName === 'admin') fetchAdminUsers();
}

// Focus Mode Logic
document.getElementById('timer-start').onclick = () => {
    if (timerRunning) {
        clearInterval(timerInterval);
        document.getElementById('timer-start').innerHTML = '<i class="ph ph-play-circle"></i>';
    } else {
        timerInterval = setInterval(() => {
            timerSeconds--;
            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play();
                showToast('Focus Session Complete!');
                timerSeconds = 1500;
            }
            updateTimerDisplay();
        }, 1000);
        document.getElementById('timer-start').innerHTML = '<i class="ph ph-pause-circle"></i>';
    }
    timerRunning = !timerRunning;
};

document.getElementById('timer-reset').onclick = () => {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = 1500;
    updateTimerDisplay();
    document.getElementById('timer-start').innerHTML = '<i class="ph ph-play-circle"></i>';
};

function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    document.getElementById('timer-display').textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Subtask Logic
function addSubtask() {
    const input = document.getElementById('subtask-input');
    const val = input.value.trim();
    if (!val) return;
    tempSubtasks.push({ title: val, completed: false });
    input.value = '';
    renderSubtaskList();
}

function renderSubtaskList() {
    const list = document.getElementById('subtask-list');
    list.innerHTML = '';
    tempSubtasks.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'subtask-item';
        div.innerHTML = `<span>${escapeHTML(s.title)}</span> <button type="button" class="icon-btn sm" onclick="removeSubtask(${i})"><i class="ph ph-trash"></i></button>`;
        list.appendChild(div);
    });
}

function removeSubtask(i) {
    tempSubtasks.splice(i, 1);
    renderSubtaskList();
}

function openModal(taskId = null) {
    editingTaskId = taskId;
    taskModal.classList.remove('hidden');
    tempSubtasks = [];
    if (taskId) {
        document.getElementById('modal-title').textContent = 'Edit Directive';
        const task = tasks.find(t => t.id === taskId);
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-category').value = task.category || 'General';
        document.getElementById('task-priority').value = task.priority || 'Medium';
        document.getElementById('task-favorite').checked = task.favorite;
        if(task.due_date) document.getElementById('task-date').value = task.due_date.split('T')[0];
        
        try {
            tempSubtasks = task.subtasks ? JSON.parse(task.subtasks) : [];
        } catch(e) { tempSubtasks = []; }
        renderSubtaskList();
    } else {
        document.getElementById('modal-title').textContent = 'New Directive';
        document.getElementById('task-form').reset();
        renderSubtaskList();
    }
}

function closeModal() {
    gsap.to(taskModal, { opacity: 0, scale: 0.95, duration: 0.2, onComplete: () => {
        taskModal.classList.add('hidden');
        taskModal.style.opacity = 1;
        taskModal.style.transform = 'scale(1)';
        document.getElementById('task-form').reset();
        tempSubtasks = [];
        editingTaskId = null;
    }});
}

// Global Shortcuts
window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 't' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (token) document.getElementById('timer-start').click();
    }
});

function switchTab(mode) {
    authMode = mode;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab')[mode === 'login' ? 0 : 1].classList.add('active');
    document.getElementById('name-group').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('auth-submit').textContent = mode === 'register' ? 'Initialize' : 'Grant Access';
}

// Calendar Engine
function renderCalendar() {
    const daysContainer = document.getElementById('calendar-days');
    const header = document.getElementById('calendar-month-year');
    daysContainer.innerHTML = '';
    
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    header.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentCalDate);
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    // Padding
    for(let i=0; i<firstDay; i++) daysContainer.appendChild(document.createElement('div'));
    
    for(let d=1; d<=lastDate; d++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.textContent = d;
        
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const hasTasks = tasks.some(t => t.due_date && t.due_date.startsWith(dateStr));
        if (hasTasks) {
            const dot = document.createElement('div');
            dot.className = 'day-dot';
            dayDiv.appendChild(dot);
        }
        
        const today = new Date();
        if(d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) dayDiv.classList.add('today');
        
        dayDiv.onclick = () => { currentFilter = 'all'; document.getElementById('task-date').value = dateStr; switchView('tasks'); openModal(); };
        daysContainer.appendChild(dayDiv);
    }
}

function changeMonth(dir) {
    currentCalDate.setMonth(currentCalDate.getMonth() + dir);
    renderCalendar();
}

// Mission Log (Timeline)
function logMission(status, title) {
    missionLog.unshift({ status, title, time: new Date().toLocaleTimeString() });
}

function renderTimeline() {
    const container = document.getElementById('timeline-list');
    container.innerHTML = '';
    if (missionLog.length === 0) {
        container.innerHTML = '<p class="text-muted">No tactical updates recorded in this session.</p>';
        return;
    }
    missionLog.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <span class="timeline-time">${log.time}</span>
                <p class="timeline-title">${log.status}</p>
                <p class="text-muted">${escapeHTML(log.title)}</p>
            </div>
        `;
        container.appendChild(item);
    });
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
        due_date: document.getElementById('task-date').value,
        subtasks: JSON.stringify(tempSubtasks)
    };

    try {
        if (editingTaskId) {
            await apiCall(`/tasks/${editingTaskId}`, 'PUT', payload);
            showToast('Directive synchronized.');
            logMission('Directive Synchronized', payload.title);
        } else {
            await apiCall('/tasks', 'POST', payload);
            showToast('New directive active.');
            logMission('New Directive Initialized', payload.title);
        }
        closeModal();
        fetchTasks();
    } catch(err) {}
});

async function toggleTask(id, currentStatus) {
    try { 
        await apiCall(`/tasks/${id}`, 'PUT', { completed: !currentStatus }); 
        logMission(!currentStatus ? 'Directive Completed' : 'Directive Reactivated', tasks.find(t=>t.id===id).title);
        fetchTasks(); 
    } catch (err) {}
}

async function toggleSubtask(taskId, subIndex) {
    const task = tasks.find(t => t.id === taskId);
    let subs = JSON.parse(task.subtasks || '[]');
    subs[subIndex].completed = !subs[subIndex].completed;
    try {
        await apiCall(`/tasks/${taskId}`, 'PUT', { subtasks: JSON.stringify(subs) });
        fetchTasks();
    } catch (err) {}
}

async function toggleFavorite(id, currentFav) {
    try { await apiCall(`/tasks/${id}`, 'PUT', { favorite: !currentFav }); fetchTasks(); } catch (err) {}
}

async function deleteTask(id) {
    if (!confirm('Obliterate this directive?')) return;
    try { await apiCall(`/tasks/${id}`, 'DELETE'); showToast('Purged.'); fetchTasks(); } catch (err) {}
}

// Interactivity
document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', e => {
        const view = e.currentTarget.dataset.view;
        if (e.currentTarget.dataset.filter) {
            currentFilter = e.currentTarget.dataset.filter;
            document.getElementById('current-view-title').textContent = e.currentTarget.textContent.trim();
        }
        switchView(view);
    });
});

document.querySelectorAll('.nav-item[data-filter]:not([data-view])').forEach(btn => {
    btn.addEventListener('click', e => {
        currentFilter = e.currentTarget.dataset.filter;
        document.getElementById('current-view-title').textContent = e.currentTarget.textContent.trim();
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        if (currentView !== 'tasks') switchView('tasks');
        else fetchTasks();
    });
});

// Profile Update Handler
document.getElementById('profile-update-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('update-name').value.trim();
    const password = document.getElementById('update-password').value;
    
    try {
        const payload = { name };
        if (password) payload.password = password;
        
        const res = await apiCall('/auth/profile', 'PUT', payload);
        user = res.user;
        localStorage.setItem('user', JSON.stringify(user));
        showToast('Configuration Synchronized');
        showDashboard();
    } catch (err) {}
});

// Analytics Implementation
async function initAnalytics() {
    try {
        const allTasks = await apiCall('/tasks'); // Get all for analytics
        const ctxP = document.getElementById('productivityChart').getContext('2d');
        const ctxC = document.getElementById('categoryChart').getContext('2d');

        if (charts.prod) charts.prod.destroy();
        if (charts.cat) charts.cat.destroy();

        const completed = allTasks.filter(t => t.completed).length;
        const pending = allTasks.length - completed;
        const categories = [...new Set(allTasks.map(t => t.category || 'General'))];
        const catData = categories.map(c => allTasks.filter(t => (t.category || 'General') === c).length);

        const isDark = document.body.classList.contains('theme-dark');
        const textColor = isDark ? '#BCAAA4' : '#8D6E63';

        charts.prod = new Chart(ctxP, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [completed, pending],
                    backgroundColor: ['#43A047', '#E53935'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '80%', plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
        });

        charts.cat = new Chart(ctxC, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Directives',
                    data: catData,
                    backgroundColor: '#795548',
                    borderRadius: 10
                }]
            },
            options: { 
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: textColor } },
                    x: { grid: { display: false }, ticks: { color: textColor } }
                },
                plugins: { legend: { display: false } }
            }
        });
    } catch (err) {}
}

function updateChartColors() {
    if (currentView === 'analytics') initAnalytics();
}

function exportData(format) {
    if (tasks.length === 0) return showToast('No data to export', 'error');
    
    let content, type, filename;
    
    if (format === 'json') {
        content = JSON.stringify(tasks, null, 2);
        type = 'application/json';
        filename = `Manplanner_Export_${new Date().toISOString().split('T')[0]}.json`;
    } else {
        const headers = ['ID', 'Title', 'Description', 'Category', 'Priority', 'Completed', 'Favorite', 'Due Date'];
        const rows = tasks.map(t => [t.id, t.title, t.description, t.category, t.priority, t.completed, t.favorite, t.due_date]);
        content = [headers, ...rows].map(r => r.join(',')).join('\n');
        type = 'text/csv';
        filename = `Manplanner_Export_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export Successful');
}

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
        tasks.forEach((task, index) => {
            const card = document.createElement('div');
            card.className = `task-card ${task.completed ? 'completed' : ''}`;
            card.style.animationDelay = `${index * 0.05}s`;
            
            const descHtml = task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : '';
            const dueHtml = task.due_date ? `<span class="badge"><i class="ph ph-calendar"></i> ${task.due_date.split('T')[0]}</span>` : '';
            
            let subs = [];
            try { subs = JSON.parse(task.subtasks || '[]'); } catch(e) {}
            const subsHtml = subs.length > 0 ? `
                <div class="card-subtasks">
                    ${subs.map((s, i) => `
                        <div class="card-subtask ${s.completed ? 'done' : ''}" onclick="event.stopPropagation(); toggleSubtask(${task.id}, ${i})">
                            <i class="ph ${s.completed ? 'ph-check-square-offset' : 'ph-square'}"></i>
                            <span>${escapeHTML(s.title)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

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
                ${subsHtml}
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
