window.adminDashboardInit = true;
let studentCache = [];
let teacherCache = [];

function getNavItem(section) {
    const items = document.querySelectorAll('.sidebar nav ul li');
    if (section === 'studentsSection') return items[1];
    if (section === 'teachersSection') return items[2];
    return items[0];
}

function setActiveNav(section) {
    document.querySelectorAll('.sidebar nav ul li').forEach(item => item.classList.remove('active'));
    if (section === 'profile') return;
    const navItem = getNavItem(section);
    if (navItem) navItem.classList.add('active');
}

function navigateToState(state) {
    if (!state || state.section === 'dashboardSection') {
        showSection('dashboardSection', getNavItem('dashboardSection'), false);
        return;
    }
    if (state.section === 'studentsSection') {
        showSection('studentsSection', getNavItem('studentsSection'), false);
        return;
    }
    if (state.section === 'teachersSection') {
        showSection('teachersSection', getNavItem('teachersSection'), false);
        return;
    }
    if (state.section === 'profile' && state.id && state.role) {
        showProfile(state.id, state.role, false);
        return;
    }
    showSection('dashboardSection', getNavItem('dashboardSection'), false);
}

(async function() {
    const user = await AuthManager.verifyAuth('admin');
    if (!user) return;
    AuthManager.updateUI();
    history.replaceState({ section: 'dashboardSection' }, '', '');
})();

window.addEventListener('popstate', event => {
    navigateToState(event.state);
});

// 🔄 SECTION SWITCH
window.showSection = function(section, navItem, pushState = true) {
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('studentsSection').classList.add('hidden');
    document.getElementById('teachersSection').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');

    document.getElementById(section).classList.remove('hidden');

    if (navItem) {
        document.querySelectorAll('.sidebar nav ul li').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');
    } else {
        setActiveNav(section);
    }

    if (pushState) {
        history.pushState({ section }, '', '');
    }
};

window.goBack = function() {
    if (window.history.state && window.history.state.section === 'profile') {
        window.history.back();
        return;
    }
    showSection('dashboardSection', getNavItem('dashboardSection'));
};

// 🔓 LOGOUT
window.logout = function() {
    AuthManager.logout();
};

async function fetchUsers() {
    return API.getUsers();
}

async function fetchAttendance() {
    return API.getAttendance();
}

window.downloadReport = async function(type) {
    try {
        const token = AuthManager.getToken();
        if (!token) {
            throw new Error('Unauthorized');
        }

        const res = await fetch(`${API_BASE}/attendance/export/${type}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Export failed');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = type === 'pdf' ? 'attendance-report.pdf' : 'attendance.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert(error.message || 'Unable to download report');
    }
};

function renderAttendanceChart(stats) {
    const canvas = document.getElementById('attendanceChart');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const labels = ['Students', 'Teachers', 'Records', "Today's Marked"];
    const values = [stats.totalStudents, stats.totalTeachers, stats.totalRecords, stats.todayMarked];
    const colors = ['#1f8a70', '#2d6a99', '#f39c12', '#e74c3c'];

    const padding = 58;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxValue = Math.max(...values, 1);
    const barWidth = chartWidth / values.length * 0.58;
    const animationDuration = 950;
    const startTime = performance.now();

    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    const drawFrame = time => {
        const progress = Math.min((time - startTime) / animationDuration, 1);
        const eased = easeOutCubic(progress);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bg.addColorStop(0, 'rgba(255,255,255,0.96)');
        bg.addColorStop(1, 'rgba(237,244,251,0.98)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#33495f';
        ctx.font = '700 18px Inter, Arial';
        ctx.fillText('Attendance metrics', padding, 36);

        ctx.strokeStyle = 'rgba(49, 95, 143, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();

        values.forEach((value, index) => {
            const x = padding + index * (chartWidth / values.length) + (chartWidth / values.length - barWidth) / 2;
            const targetBarHeight = (value / maxValue) * (chartHeight - 40);
            const barHeight = targetBarHeight * eased;
            const y = canvas.height - padding - barHeight;

            const gradient = ctx.createLinearGradient(x, y, x, canvas.height - padding);
            gradient.addColorStop(0, colors[index]);
            gradient.addColorStop(1, 'rgba(255,255,255,0.4)');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);

            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.shadowColor = colors[index];
            ctx.shadowBlur = 24;
            ctx.fillRect(x, y, barWidth, barHeight);
            ctx.restore();

            ctx.fillStyle = '#172331';
            ctx.font = '700 18px Inter, Arial';
            ctx.fillText(value, x + 4, y - 14);

            ctx.fillStyle = '#566a7b';
            ctx.font = '14px Inter, Arial';
            const label = labels[index];
            const labelWidth = ctx.measureText(label).width;
            ctx.fillText(label, x + (barWidth - labelWidth) / 2, canvas.height - padding + 26);
        });

        if (progress < 1) {
            requestAnimationFrame(drawFrame);
        }
    };

    requestAnimationFrame(drawFrame);
}

// 📊 LOAD DASHBOARD
async function loadDashboard() {
    try {
        const [data, attendance, stats] = await Promise.all([fetchUsers(), fetchAttendance(), API.getStats()]);

        const students = data.filter(u => u.role === 'student');
        const teachers = data.filter(u => u.role === 'teacher');
        const today = new Date().toISOString().split('T')[0];

        document.getElementById('totalStudents').innerText = stats.totalStudents;
        document.getElementById('totalTeachers').innerText = stats.totalTeachers;
        document.getElementById('totalAttendanceRecords').innerText = stats.totalRecords;
        document.getElementById('todayAttendanceRecords').innerText = stats.todayMarked;

        renderAttendanceChart(stats);
        renderDashboardPeople(students, teachers);
        renderRecentAttendance(attendance);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderDashboardPeople(students, teachers) {
    renderPersonCards('dashboardStudentsList', students, 'student');
    renderPersonCards('dashboardTeachersList', teachers, 'teacher');
}

function renderPersonCards(containerId, people, role) {
    const container = document.getElementById(containerId);
    const visiblePeople = people.slice(0, 5);
    container.innerHTML = '';

    if (visiblePeople.length === 0) {
        container.innerHTML = `<div class="empty-state">No ${role}s found</div>`;
        return;
    }

    visiblePeople.forEach(person => {
        const item = document.createElement('div');
        item.className = 'person-card';
        item.onclick = () => showProfile(person._id, role);

        const initials = (person.name || person.username || role)
            .split(' ')
            .map(part => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

        const meta = role === 'student'
            ? `Roll ${person.rollNumber || '-'} | ${person.class || '-'} | ${person.branch || '-'}-${person.section || '-'}`
            : `${person.subject || 'Subject not assigned'} | ${person.email || '-'}`;

        item.innerHTML = `
            <div class="person-avatar ${role === 'student' ? 'avatar-student' : 'avatar-teacher'}">${initials}</div>
            <div>
                <h4>${person.name || person.username || '-'}</h4>
                <p>${meta}</p>
                <span class="mini-role ${role === 'student' ? 'mini-student' : 'mini-teacher'}">${role}</span>
            </div>
        `;

        container.appendChild(item);
    });

    if (people.length > visiblePeople.length) {
        const more = document.createElement('div');
        more.className = 'more-row';
        more.textContent = `+${people.length - visiblePeople.length} more ${role}s`;
        more.onclick = () => {
            if (role === 'student') {
                showSection('studentsSection', getNavItem('studentsSection'));
            } else {
                showSection('teachersSection', getNavItem('teachersSection'));
            }
        };
        container.appendChild(more);
    }
}

function renderRecentAttendance(records) {
    const tbody = document.getElementById('recentAttendanceTableBody');
    tbody.innerHTML = '';

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No attendance records yet</td></tr>';
        return;
    }

    records
        .slice()
        .sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date))
        .slice(0, 8)
        .forEach(record => {
            const student = record.studentId || {};
            const status = String(record.status || '').toLowerCase();
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${record.date || '-'}</td>
                <td>${student.name || '-'}</td>
                <td>${student.rollNumber || '-'}</td>
                <td>${student.class || '-'} ${student.branch ? `(${student.branch}-${student.section || '-'})` : ''}</td>
                <td><span class="status-badge ${status === 'present' ? 'status-present' : 'status-absent'}">${status || '-'}</span></td>
                <td>${record.markedBy?.name || '-'}</td>
            `;
        });
}

// 📋 LOAD STUDENTS
async function loadStudents() {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';

    try {
        const data = await fetchUsers();
        studentCache = data.filter(s => s.role === 'student');
        renderStudents();
    } catch (error) {
        console.error('Error loading students:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Unable to load students</td></tr>';
    }
}

function renderStudents() {
    const tbody = document.getElementById('studentTableBody');
    const search = document.getElementById('studentSearch').value.toLowerCase().trim();
    const students = studentCache.filter(s => {
        const value = `${s.rollNumber || ''} ${s.name || ''} ${s.class || ''} ${s.branch || ''} ${s.section || ''} ${s.username || ''}`.toLowerCase();
        return value.includes(search);
    });

    document.getElementById('studentCount').innerText = `${students.length} student${students.length === 1 ? '' : 's'}`;
    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No students found</td></tr>';
        return;
    }

    students.forEach(s => {
        const row = tbody.insertRow();
        row.className = 'clickable-row';
        row.onclick = () => showProfile(s._id, 'student');
        row.innerHTML = `
            <td>${s.rollNumber || '-'}</td>
            <td>${s.name || '-'}</td>
            <td>${s.class || '-'}</td>
            <td>${s.branch || '-'}</td>
            <td>${s.section || '-'}</td>
            <td>${s.username || '-'}</td>
        `;
    });
}

// ➕ ADD STUDENT
async function loadTeachers() {
    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '';

    try {
        const data = await fetchUsers();
        teacherCache = data.filter(t => t.role === 'teacher');
        renderTeachers();
    } catch (error) {
        console.error('Error loading teachers:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Unable to load teachers</td></tr>';
    }
}

function renderTeachers() {
    const tbody = document.getElementById('teacherTableBody');
    const search = document.getElementById('teacherSearch').value.toLowerCase().trim();
    const teachers = teacherCache.filter(t => {
        const value = `${t.name || ''} ${t.username || ''} ${t.email || ''} ${t.subject || ''}`.toLowerCase();
        return value.includes(search);
    });

    document.getElementById('teacherCount').innerText = `${teachers.length} teacher${teachers.length === 1 ? '' : 's'}`;
    tbody.innerHTML = '';

    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No teachers found</td></tr>';
        return;
    }

    teachers.forEach(t => {
        const row = tbody.insertRow();
        row.className = 'clickable-row';
        row.onclick = () => showProfile(t._id, 'teacher');
        row.innerHTML = `
            <td>${t.name || '-'}</td>
            <td>${t.username || '-'}</td>
            <td>${t.email || '-'}</td>
        `;
    });
}

async function showProfile(id, role, pushState = true) {
    const person = role === 'student'
        ? studentCache.find(student => student._id === id)
        : teacherCache.find(teacher => teacher._id === id);

    if (!person) {
        alert('Profile not found. Please refresh the page.');
        return;
    }

    showSection('profileSection', null, false);
    if (pushState) {
        history.pushState({ section: 'profile', id, role }, '', '');
    }
    const content = document.getElementById('profileContent');
    content.innerHTML = '<div class="profile-card"><p>Loading profile...</p></div>';

    try {
        const attendance = await fetchAttendance();
        const records = role === 'student'
            ? attendance.filter(record => record.studentId?._id === id)
            : attendance.filter(record => record.markedBy?._id === id);

        content.innerHTML = role === 'student'
            ? renderStudentProfile(person, records)
            : renderTeacherProfile(person, records);
    } catch (error) {
        console.error('Error loading profile:', error);
        content.innerHTML = '<div class="profile-card"><p>Unable to load profile details.</p></div>';
    }
}

function renderStudentProfile(student, records) {
    const present = records.filter(record => record.status === 'Present').length;
    const absent = records.filter(record => record.status === 'Absent').length;
    const total = records.length;
    const percentage = total ? Math.round((present / total) * 100) : 0;

    return `
        ${profileHero(student, 'student', `Roll ${student.rollNumber || '-'}`)}
        <div class="profile-grid">
            ${detailCard('Academic Details', [
                ['Roll Number', student.rollNumber],
                ['Class', student.class],
                ['Branch', student.branch],
                ['Section', student.section]
            ])}
            ${detailCard('Account Details', [
                ['Username', student.username],
                ['Email', student.email],
                ['Role', student.role],
                ['Created', formatDate(student.createdAt)]
            ])}
            <div class="profile-card">
                <h3>Attendance Summary</h3>
                <div class="mini-stats">
                    <div><strong>${total}</strong><span>Total</span></div>
                    <div><strong>${present}</strong><span>Present</span></div>
                    <div><strong>${absent}</strong><span>Absent</span></div>
                    <div><strong>${percentage}%</strong><span>Average</span></div>
                </div>
            </div>
        </div>
        ${recordsTable(records, 'student')}
    `;
}

function renderTeacherProfile(teacher, records) {
    const present = records.filter(record => record.status === 'Present').length;
    const absent = records.filter(record => record.status === 'Absent').length;
    const uniqueDates = new Set(records.map(record => record.date)).size;

    return `
        ${profileHero(teacher, 'teacher', teacher.subject || 'Teacher')}
        <div class="profile-grid">
            ${detailCard('Teacher Details', [
                ['Name', teacher.name],
                ['Subject', teacher.subject],
                ['Role', teacher.role],
                ['Created', formatDate(teacher.createdAt)]
            ])}
            ${detailCard('Account Details', [
                ['Username', teacher.username],
                ['Email', teacher.email],
                ['User ID', teacher._id]
            ])}
            <div class="profile-card">
                <h3>Marked Attendance</h3>
                <div class="mini-stats">
                    <div><strong>${records.length}</strong><span>Records</span></div>
                    <div><strong>${uniqueDates}</strong><span>Dates</span></div>
                    <div><strong>${present}</strong><span>Present</span></div>
                    <div><strong>${absent}</strong><span>Absent</span></div>
                </div>
            </div>
        </div>
        ${recordsTable(records, 'teacher')}
    `;
}

function profileHero(person, role, subtitle) {
    const initials = (person.name || person.username || role)
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return `
        <div class="profile-hero">
            <div class="person-avatar profile-avatar ${role === 'student' ? 'avatar-student' : 'avatar-teacher'}">${initials}</div>
            <div>
                <span class="role-label ${role === 'student' ? 'role-student' : 'role-teacher'}">${role}</span>
                <h2>${person.name || person.username || '-'}</h2>
                <p>${subtitle}</p>
            </div>
        </div>
    `;
}

function detailCard(title, rows) {
    return `
        <div class="profile-card">
            <h3>${title}</h3>
            <div class="detail-list">
                ${rows.map(([label, value]) => `
                    <div>
                        <span>${label}</span>
                        <strong>${value || '-'}</strong>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function recordsTable(records, profileRole) {
    const sorted = records.slice().sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

    if (!sorted.length) {
        return '<div class="profile-card"><h3>Attendance Records</h3><p>No attendance records found.</p></div>';
    }

    return `
        <div class="profile-card">
            <h3>${profileRole === 'student' ? 'Attendance History' : 'Marked Records'}</h3>
            <div class="data-table profile-table">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Roll No</th>
                            <th>Status</th>
                            <th>Marked By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(record => {
                            const status = String(record.status || '').toLowerCase();
                            return `
                                <tr>
                                    <td>${record.date || '-'}</td>
                                    <td>${record.studentId?.name || '-'}</td>
                                    <td>${record.studentId?.rollNumber || '-'}</td>
                                    <td><span class="status-badge ${status === 'present' ? 'status-present' : 'status-absent'}">${status || '-'}</span></td>
                                    <td>${record.markedBy?.name || '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
}

window.importUsers = async function(role) {
    const input = document.getElementById(role === 'student' ? 'studentImportFile' : 'teacherImportFile');
    const file = input.files[0];

    if (!file) {
        alert('Please select an Excel file first');
        return;
    }

    try {
        const buffer = await file.arrayBuffer();
        const token = AuthManager.getToken();
        const res = await fetch(`${API_BASE}/users/import/${role}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-File-Name': file.name,
                Authorization: `Bearer ${token}`
            },
            body: buffer
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || 'Import failed');
            return;
        }

        const message = [
            `Import complete`,
            `New: ${data.imported}`,
            `Updated: ${data.updated}`,
            `Skipped: ${data.skipped}`
        ].join('\n');

        alert(data.errors && data.errors.length > 0
            ? `${message}\n\nIssues:\n${data.errors.slice(0, 5).join('\n')}`
            : message);

        input.value = '';
        await Promise.all([loadStudents(), loadTeachers(), loadDashboard()]);
    } catch (error) {
        console.error('Import error:', error);
        alert('Import failed. Please make sure the backend is running and the file is a valid Excel sheet.');
    }
};

document.getElementById('addStudentForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('studName').value.trim();
    const rollNumber = document.getElementById('studRoll').value.trim();
    const className = document.getElementById('studClass').value.trim();
    const branch = document.getElementById('studBranch').value.trim();
    const section = document.getElementById('studSection').value.trim();
    const username = document.getElementById('studUsername').value.trim();
    const password = document.getElementById('studPassword').value;

    try {
        const token = AuthManager.getToken();
        const res = await fetch(`${API_BASE}/users/add-student`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                rollNumber,
                className,
                branch,
                section,
                username,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || 'Failed to add student');
            return;
        }

        alert("Student Added ✅");

        this.reset();
        await Promise.all([loadStudents(), loadDashboard()]);
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Backend is not reachable. Please make sure the server is running on port 5000.');
    }
});

// 🚀 INITIAL LOAD
document.getElementById('addTeacherForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('teacherName').value.trim();
    const username = document.getElementById('teacherUsername').value.trim();
    const password = document.getElementById('teacherPassword').value;

    try {
        const token = AuthManager.getToken();
        const res = await fetch(`${API_BASE}/users/add-teacher`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                username,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || 'Failed to add teacher');
            return;
        }

        alert("Teacher Added");

        this.reset();
        await Promise.all([loadTeachers(), loadDashboard()]);
    } catch (error) {
        console.error('Error adding teacher:', error);
        alert('Backend is not reachable. Please make sure the server is running on port 5000.');
    }
});

document.getElementById('studentSearch').addEventListener('input', renderStudents);
document.getElementById('teacherSearch').addEventListener('input', renderTeachers);

loadDashboard();
loadStudents();
loadTeachers();
