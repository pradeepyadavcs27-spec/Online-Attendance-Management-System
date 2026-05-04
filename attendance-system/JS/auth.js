const AUTH_API_BASE = 'http://localhost:5000/api';

const AuthManager = {

    login: async function (username, password, role) {
        try {
            const res = await fetch(`${AUTH_API_BASE}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password, role })
            });

            const data = await res.json();
            if (data && data.success) {
                const loggedInUser = data.user || {
                    id: data.id,
                    username,
                    name: username,
                    role
                };

                localStorage.setItem("token", data.token || "");
                localStorage.setItem("user", JSON.stringify({
                    id: loggedInUser._id || loggedInUser.id || loggedInUser.id || "",
                    username: loggedInUser.username || username,
                    name: loggedInUser.name || username,
                    role: loggedInUser.role || role
                }));
            }
            return data;

        } catch (error) {
            return {
                success: false,
                message: "Server error"
            };
        }
    },

    getToken: function () {
        return localStorage.getItem("token");
    },

    getCurrentUser: function () {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch (error) {
            localStorage.removeItem("user");
            return null;
        }
    },

    checkAuth: function () {
        const token = this.getToken();
        const user = this.getCurrentUser();
        return token && user ? user : null;
    },

    requireAuth: function (requiredRole) {
        const user = this.checkAuth();
        if (!user || (requiredRole && user.role !== requiredRole)) {
            this.logout();
            return null;
        }
        return user;
    },

    verifyAuth: async function (requiredRole) {
        const user = this.checkAuth();
        if (!user) {
            this.logout();
            return null;
        }

        try {
            const res = await fetch(`${AUTH_API_BASE}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${this.getToken()}`
                }
            });

            if (!res.ok) {
                this.logout();
                return null;
            }

            const data = await res.json();
            if (!data.success || !data.user) {
                this.logout();
                return null;
            }

            if (requiredRole && data.user.role !== requiredRole) {
                this.logout();
                return null;
            }

            localStorage.setItem("user", JSON.stringify({
                id: data.user._id || data.user.id || "",
                username: data.user.username,
                name: data.user.name || data.user.username,
                role: data.user.role
            }));

            return data.user;
        } catch (error) {
            console.warn('Auth verification failed:', error);
            this.logout();
            return null;
        }
    },

    updateUI: function () {
        const user = this.getCurrentUser();
        if (!user) return;

        const userName = document.getElementById("userName");
        const userRole = document.getElementById("userRole");

        if (userName) userName.textContent = user.name || user.username || "User";
        if (userRole) userRole.textContent = user.role || "";
    },

    logout: function () {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("token");

        const target = 'login.html';
        const base = window.location.href.replace(/[^/]*$/, '');
        window.location.replace(base + target);
    }
};

// Expose auth helper to inline handlers and global page scripts.
window.AuthManager = AuthManager;
window.logout = AuthManager.logout.bind(AuthManager);

window.addEventListener('DOMContentLoaded', () => {
    const logoutButtons = document.querySelectorAll('.logout-btn, [data-action="logout"]');
    logoutButtons.forEach(button => {
        button.removeEventListener('click', AuthManager.logout);
        button.addEventListener('click', event => {
            event.preventDefault();
            AuthManager.logout();
        });
    });
});

