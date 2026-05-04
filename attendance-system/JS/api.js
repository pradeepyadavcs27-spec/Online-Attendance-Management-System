const API_BASE = 'http://localhost:5000/api';

async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = typeof AuthManager !== 'undefined' ? AuthManager.getToken() : localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(`${API_BASE}${endpoint}`, options);
    } catch (error) {
        console.error('Network error calling API:', endpoint, error);
        throw new Error('Unable to connect to the backend API. Make sure the server is running.');
    }

    let data;
    try {
        data = await res.json();
    } catch (_) {
        data = {};
    }

    if (!res.ok) {
        const message = data.message || `Request failed (${res.status})`;
        if (res.status === 401 || res.status === 403) {
            if (typeof AuthManager !== 'undefined') {
                AuthManager.logout();
            }
            throw new Error(message || 'Unauthorized. Redirecting to login.');
        }
        throw new Error(message);
    }

    return data;
}

const API = {
    getUsers: async function () {
        return apiRequest('/users');
    },

    getStudents: async function () {
        const users = await this.getUsers();
        return users.filter(user => user.role === 'student');
    },

    getTeachers: async function () {
        const users = await this.getUsers();
        return users.filter(user => user.role === 'teacher');
    },

    addTeacher: async function (teacher) {
        return apiRequest('/users/add-teacher', 'POST', teacher);
    },

    markAttendance: async function (record) {
        return apiRequest('/attendance/mark', 'POST', record);
    },

    bulkMarkAttendance: async function (date, records) {
        return apiRequest('/attendance/bulk', 'POST', {
            date,
            records
        });
    },

    getAttendance: async function (filters = {}) {
        const params = new URLSearchParams(filters);
        const query = params.toString() ? `?${params.toString()}` : '';
        return apiRequest(`/attendance${query}`);
    },

    getStudentStats: async function (studentId) {
        return apiRequest(`/attendance/student/${studentId}/stats`);
    },

    getStats: async function () {
        return apiRequest('/attendance/stats');
    }
};
