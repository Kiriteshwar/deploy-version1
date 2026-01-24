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

    // Setup search button
    document.getElementById('search-btn').addEventListener('click', () => {
        filterAndDisplayUsers();
    });

    // Search on Enter key
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            filterAndDisplayUsers();
        }
    });

    // Setup modal close for View Details
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('user-modal').addEventListener('click', (e) => {
        if (e.target.id === 'user-modal') {
            closeModal();
        }
    });

    // Setup Add User modal
    document.getElementById('add-user-btn').addEventListener('click', openAddUserModal);
    document.getElementById('add-modal-close').addEventListener('click', closeAddUserModal);
    document.getElementById('add-user-modal').addEventListener('click', (e) => {
        if (e.target.id === 'add-user-modal') {
            closeAddUserModal();
        }
    });

    // Role selection - show/hide relevant fields
    document.getElementById('new-role').addEventListener('change', (e) => {
        const role = e.target.value;
        document.querySelectorAll('.role-fields').forEach(el => el.classList.remove('active'));
        if (role === 'student') {
            document.getElementById('student-fields').classList.add('active');
        } else if (role === 'teacher') {
            document.getElementById('teacher-fields').classList.add('active');
        } else if (role === 'admin') {
            document.getElementById('admin-fields').classList.add('active');
        }
    });

    // Handle form submission
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewUser();
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
                    <td colspan="6" class="no-data">Failed to load users. Please try again.</td>
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

        // Filter by search term (name, email, phone, or roll number)
        if (searchTerm) {
            filteredUsers = filteredUsers.filter(u =>
                u.name?.toLowerCase().includes(searchTerm) ||
                u.email?.toLowerCase().includes(searchTerm) ||
                u.phone?.toLowerCase().includes(searchTerm) ||
                u.studentInfo?.rollNumber?.toLowerCase().includes(searchTerm)
            );
        }

        displayUsers(filteredUsers);
    }

    function displayUsers(users) {
        const tbody = document.getElementById('users-table-body');

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">No users found.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map((user, index) => `
            <tr>
                <td>${getRollNumber(user)}</td>
                <td><strong>${escapeHtml(user.name || 'N/A')}</strong></td>
                <td>${escapeHtml(user.email || 'N/A')}</td>
                <td>${escapeHtml(user.phone || 'N/A')}</td>
                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                <td><button class="view-btn" onclick="showUserDetails(${index})">View Details</button></td>
            </tr>
        `).join('');

        // Store users globally for modal access
        window.currentUsers = users;
    }

    function getRollNumber(user) {
        if (user.role === 'student' && user.studentInfo?.rollNumber) {
            return user.studentInfo.rollNumber;
        }
        return '-';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Format date as DD/MM/YYYY
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function closeModal() {
        document.getElementById('user-modal').classList.remove('active');
    }

    function openAddUserModal() {
        document.getElementById('add-user-form').reset();
        document.querySelectorAll('.role-fields').forEach(el => el.classList.remove('active'));
        document.getElementById('add-user-modal').classList.add('active');
    }

    function closeAddUserModal() {
        document.getElementById('add-user-modal').classList.remove('active');
    }

    async function addNewUser() {
        const role = document.getElementById('new-role').value;
        const userData = {
            name: document.getElementById('new-name').value.trim(),
            email: document.getElementById('new-email').value.trim(),
            phone: document.getElementById('new-phone').value.trim(),
            password: document.getElementById('new-password').value,
            role: role
        };

        // Add role-specific data
        if (role === 'student') {
            userData.studentInfo = {
                class: document.getElementById('new-class').value.trim(),
                section: document.getElementById('new-section').value.trim(),
                rollNumber: document.getElementById('new-roll').value.trim(),
                guardianName: document.getElementById('new-guardian').value.trim(),
                guardianPhone: document.getElementById('new-guardian-phone').value.trim(),
                address: document.getElementById('new-address').value.trim()
            };
        } else if (role === 'teacher') {
            const subjects = document.getElementById('new-subjects').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
            userData.teacherInfo = {
                subjects: subjects,
                classTeacher: {
                    class: document.getElementById('new-ct-class').value.trim(),
                    section: document.getElementById('new-ct-section').value.trim()
                }
            };
        } else if (role === 'admin') {
            userData.adminInfo = {
                designation: document.getElementById('new-designation').value.trim()
            };
        }

        try {
            document.getElementById('submit-user-btn').disabled = true;
            document.getElementById('submit-user-btn').textContent = 'Adding...';

            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert('User added successfully!');
                closeAddUserModal();
                fetchAllUsers(); // Refresh the list
            } else {
                alert(result.message || 'Failed to add user');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            alert('Failed to add user. Please try again.');
        } finally {
            document.getElementById('submit-user-btn').disabled = false;
            document.getElementById('submit-user-btn').textContent = 'Add User';
        }
    }

    // Make showUserDetails globally accessible
    window.showUserDetails = function (index) {
        const user = window.currentUsers[index];
        if (!user) return;

        document.getElementById('modal-title').textContent = user.name || 'User Details';

        let html = `
            <div class="section-title">Basic Information</div>
            <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${escapeHtml(user.name) || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${escapeHtml(user.email) || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">${escapeHtml(user.phone) || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Role:</span>
                <span class="detail-value"><span class="role-badge ${user.role}">${user.role}</span></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">${user.isActive !== false ? '✅ Active' : '❌ Inactive'}</span>
            </div>
        `;

        // Student-specific info
        if (user.role === 'student' && user.studentInfo) {
            const info = user.studentInfo;
            html += `
                <div class="section-title">Student Information</div>
                <div class="detail-row">
                    <span class="detail-label">Roll Number:</span>
                    <span class="detail-value">${escapeHtml(info.rollNumber) || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Class:</span>
                    <span class="detail-value">${escapeHtml(info.class) || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Section:</span>
                    <span class="detail-value">${escapeHtml(info.section) || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Guardian Name:</span>
                    <span class="detail-value">${escapeHtml(info.guardianName) || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Guardian Phone:</span>
                    <span class="detail-value">${escapeHtml(info.guardianPhone) || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${escapeHtml(info.address) || 'N/A'}</span>
                </div>
            `;
        }

        // Teacher-specific info
        if (user.role === 'teacher' && user.teacherInfo) {
            const info = user.teacherInfo;
            html += `
                <div class="section-title">Teacher Information</div>
            `;
            if (info.subjects && info.subjects.length > 0) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">Subjects:</span>
                        <span class="detail-value">${info.subjects.join(', ')}</span>
                    </div>
                `;
            }
            if (info.classTeacher) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">Class Teacher:</span>
                        <span class="detail-value">${info.classTeacher.class || ''} ${info.classTeacher.section || ''}</span>
                    </div>
                `;
            }
            if (info.qualifications && info.qualifications.length > 0) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">Qualifications:</span>
                        <span class="detail-value">${info.qualifications.map(q => q.degree).join(', ')}</span>
                    </div>
                `;
            }
        }

        // Admin-specific info
        if (user.role === 'admin' && user.adminInfo) {
            const info = user.adminInfo;
            html += `
                <div class="section-title">Admin Information</div>
                <div class="detail-row">
                    <span class="detail-label">Designation:</span>
                    <span class="detail-value">${escapeHtml(info.designation) || 'N/A'}</span>
                </div>
            `;
            if (info.permissions && info.permissions.length > 0) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">Permissions:</span>
                        <span class="detail-value">${info.permissions.join(', ')}</span>
                    </div>
                `;
            }
        }

        // Additional info
        html += `<div class="section-title">Additional Information</div>`;

        if (user.dateOfBirth) {
            html += `
                <div class="detail-row">
                    <span class="detail-label">Date of Birth:</span>
                    <span class="detail-value">${formatDate(user.dateOfBirth)}</span>
                </div>
            `;
        }
        if (user.gender) {
            html += `
                <div class="detail-row">
                    <span class="detail-label">Gender:</span>
                    <span class="detail-value">${escapeHtml(user.gender)}</span>
                </div>
            `;
        }
        html += `
            <div class="detail-row">
                <span class="detail-label">Join Date:</span>
                <span class="detail-value">${formatDate(user.joinDate)}</span>
            </div>
        `;

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('user-modal').classList.add('active');
    };
};
