// School Info Page JavaScript
// Fetches and displays all users from the database

window.onload = () => {
    const token = localStorage.getItem("auth_token");
    const userRole = localStorage.getItem("user_role");

    // Authentication check
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Admin-only access
    if (userRole !== 'admin') {
        alert("Access denied. Admin only.");
        window.location.href = "dashboard.html";
        return;
    }

    // Store all users for filtering
    let allUsers = [];

    // Fetch all users
    fetchAllUsers();

    // Setup filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterAndDisplayUsers();
        });
    });

    // Setup search
    document.getElementById('search-input').addEventListener('input', () => {
        filterAndDisplayUsers();
    });

    async function fetchAllUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            allUsers = data.users || [];

            updateStats();
            filterAndDisplayUsers();
        } catch (error) {
            console.error('Error fetching users:', error);
            document.getElementById('users-table-body').innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">Failed to load users. Please try again.</td>
                </tr>
            `;
        }
    }

    function updateStats() {
        const students = allUsers.filter(u => u.role === 'student').length;
        const teachers = allUsers.filter(u => u.role === 'teacher').length;
        const admins = allUsers.filter(u => u.role === 'admin').length;

        document.getElementById('total-count').textContent = allUsers.length;
        document.getElementById('students-count').textContent = students;
        document.getElementById('teachers-count').textContent = teachers;
        document.getElementById('admins-count').textContent = admins;
    }

    function filterAndDisplayUsers() {
        const activeFilter = document.querySelector('.filter-btn.active').dataset.role;
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();

        let filteredUsers = allUsers;

        // Filter by role
        if (activeFilter !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === activeFilter);
        }

        // Filter by search term
        if (searchTerm) {
            filteredUsers = filteredUsers.filter(u =>
                u.name?.toLowerCase().includes(searchTerm) ||
                u.email?.toLowerCase().includes(searchTerm) ||
                u.phone?.toLowerCase().includes(searchTerm)
            );
        }

        displayUsers(filteredUsers);
    }

    function displayUsers(users) {
        const tbody = document.getElementById('users-table-body');

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">No users found.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${escapeHtml(user.name || 'N/A')}</strong></td>
                <td>${escapeHtml(user.email || 'N/A')}</td>
                <td>${escapeHtml(user.phone || 'N/A')}</td>
                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                <td class="info-cell">${getRoleDetails(user)}</td>
            </tr>
        `).join('');
    }

    function getRoleDetails(user) {
        if (user.role === 'student' && user.studentInfo) {
            const info = user.studentInfo;
            const parts = [];
            if (info.class) parts.push(`<strong>Class:</strong> ${info.class}`);
            if (info.section) parts.push(`<strong>Section:</strong> ${info.section}`);
            if (info.rollNumber) parts.push(`<strong>Roll:</strong> ${info.rollNumber}`);
            if (info.guardianName) parts.push(`<strong>Guardian:</strong> ${escapeHtml(info.guardianName)}`);
            return parts.join(' | ') || '-';
        }

        if (user.role === 'teacher' && user.teacherInfo) {
            const info = user.teacherInfo;
            const parts = [];
            if (info.subjects && info.subjects.length > 0) {
                parts.push(`<strong>Subjects:</strong> ${info.subjects.join(', ')}`);
            }
            if (info.classTeacher) {
                const ct = info.classTeacher;
                if (ct.class || ct.section) {
                    parts.push(`<strong>Class Teacher:</strong> ${ct.class || ''} ${ct.section || ''}`);
                }
            }
            return parts.join(' | ') || '-';
        }

        if (user.role === 'admin' && user.adminInfo) {
            const info = user.adminInfo;
            if (info.designation) {
                return `<strong>Designation:</strong> ${escapeHtml(info.designation)}`;
            }
        }

        return '-';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
