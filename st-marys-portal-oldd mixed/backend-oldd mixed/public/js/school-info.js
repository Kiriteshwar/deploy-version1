// School Info Page JavaScript
// Handles Users and Fee Analytics tabs

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

    // Store data
    let allUsers = [];
    let currentFeeFilters = { period: 'all', class: '', section: '' };

    // Initialize
    fetchAllUsers();

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            if (tabId === 'fees') {
                fetchFeeAnalytics();
            }
        });
    });

    // ========== USERS TAB ==========

    // Filter buttons
    document.querySelectorAll('.filters-container .filter-btn[data-role]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filters-container .filter-btn[data-role]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterAndDisplayUsers();
        });
    });

    // Search
    document.getElementById('search-btn').addEventListener('click', filterAndDisplayUsers);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterAndDisplayUsers();
    });

    // View Details modal
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('user-modal').classList.remove('active');
    });
    document.getElementById('user-modal').addEventListener('click', (e) => {
        if (e.target.id === 'user-modal') document.getElementById('user-modal').classList.remove('active');
    });

    // Add User modal
    document.getElementById('add-user-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAddUserModal();
    });
    document.getElementById('add-modal-close').addEventListener('click', (e) => {
        e.preventDefault();
        closeAddUserModal();
    });
    document.getElementById('add-user-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('add-user-modal')) closeAddUserModal();
    });
    document.querySelector('#add-user-modal .modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Role selection
    document.getElementById('new-role').addEventListener('change', (e) => {
        document.querySelectorAll('.role-fields').forEach(el => el.classList.remove('active'));
        const role = e.target.value;
        if (role === 'student') document.getElementById('student-fields').classList.add('active');
        else if (role === 'teacher') document.getElementById('teacher-fields').classList.add('active');
        else if (role === 'admin') document.getElementById('admin-fields').classList.add('active');
    });

    // Form submission
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewUser();
    });

    // ========== FEES TAB ==========

    // Period filter buttons
    document.querySelectorAll('#fee-filters .filter-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#fee-filters .filter-btn[data-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFeeFilters.period = btn.dataset.period;
            fetchFeeAnalytics();
        });
    });

    // Class filter dropdown
    document.getElementById('class-filter').addEventListener('change', (e) => {
        currentFeeFilters.class = e.target.value;
        fetchFeeAnalytics();
    });

    // Section filter dropdown
    document.getElementById('section-filter').addEventListener('change', (e) => {
        currentFeeFilters.section = e.target.value;
        fetchFeeAnalytics();
    });

    // ========== FUNCTIONS ==========

    async function fetchAllUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            allUsers = data.users || [];
            updateUserStats();
            filterAndDisplayUsers();
        } catch (error) {
            console.error('Error fetching users:', error);
            document.getElementById('users-table-body').innerHTML = '<tr><td colspan="6" class="no-data">Failed to load users.</td></tr>';
        }
    }

    function updateUserStats() {
        document.getElementById('total-count').textContent = allUsers.length;
        document.getElementById('students-count').textContent = allUsers.filter(u => u.role === 'student').length;
        document.getElementById('teachers-count').textContent = allUsers.filter(u => u.role === 'teacher').length;
        document.getElementById('admins-count').textContent = allUsers.filter(u => u.role === 'admin').length;
    }

    function filterAndDisplayUsers() {
        const roleFilter = document.querySelector('.filters-container .filter-btn[data-role].active')?.dataset.role || 'all';
        const search = document.getElementById('search-input').value.toLowerCase().trim();

        let filtered = allUsers;
        if (roleFilter !== 'all') filtered = filtered.filter(u => u.role === roleFilter);
        if (search) {
            filtered = filtered.filter(u =>
                u.name?.toLowerCase().includes(search) ||
                u.email?.toLowerCase().includes(search) ||
                u.phone?.toLowerCase().includes(search) ||
                u.studentInfo?.rollNumber?.toLowerCase().includes(search)
            );
        }
        displayUsers(filtered);
    }

    function displayUsers(users) {
        const tbody = document.getElementById('users-table-body');
        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No users found.</td></tr>';
            return;
        }
        tbody.innerHTML = users.map((u, i) => `
            <tr>
                <td>${u.studentInfo?.rollNumber || '-'}</td>
                <td><strong>${escapeHtml(u.name)}</strong></td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.phone || '-')}</td>
                <td><span class="role-badge ${u.role}">${u.role}</span></td>
                <td><button class="view-btn" onclick="showUserDetails(${i})">View Details</button></td>
            </tr>
        `).join('');
        window.currentUsers = users;
    }

    async function fetchFeeAnalytics() {
        try {
            const params = new URLSearchParams();
            if (currentFeeFilters.period && currentFeeFilters.period !== 'all') params.append('period', currentFeeFilters.period);
            if (currentFeeFilters.class) params.append('class', currentFeeFilters.class);
            if (currentFeeFilters.section) params.append('section', currentFeeFilters.section);

            const response = await fetch(`/api/admin/fee-analytics?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                updateFeeStats(data.summary);
                displayFeeBreakdown(data.breakdown);
                populateClassFilter(data.availableClasses);
                populateSectionFilter(data.availableSections);
            } else {
                console.error('Fee analytics error:', data.message);
            }
        } catch (error) {
            console.error('Error fetching fee analytics:', error);
            document.getElementById('fee-table-body').innerHTML = '<tr><td colspan="6" class="no-data">Failed to load fee data.</td></tr>';
        }
    }

    function updateFeeStats(summary) {
        document.getElementById('fee-expected').textContent = formatCurrency(summary.totalExpected);
        document.getElementById('fee-collected').textContent = formatCurrency(summary.periodCollected);
        document.getElementById('fee-balance').textContent = formatCurrency(summary.totalBalance);
        document.getElementById('fee-discounts').textContent = formatCurrency(summary.totalDiscounts);
    }

    function displayFeeBreakdown(breakdown) {
        const tbody = document.getElementById('fee-table-body');
        if (!breakdown.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No fee data available.</td></tr>';
            return;
        }
        tbody.innerHTML = breakdown.map(row => `
            <tr>
                <td><strong>${row.class}</strong></td>
                <td>${row.section}</td>
                <td>${row.studentCount}</td>
                <td class="currency">${formatCurrency(row.totalToBePaid)}</td>
                <td class="currency" style="color:#2e7d32">${formatCurrency(row.totalCollected)}</td>
                <td class="currency" style="color:#c62828">${formatCurrency(row.balance)}</td>
            </tr>
        `).join('');
    }

    function populateClassFilter(classes) {
        const select = document.getElementById('class-filter');
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Classes</option>' +
            (classes || []).map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
    }

    function populateSectionFilter(sections) {
        const select = document.getElementById('section-filter');
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Sections</option>' +
            (sections || []).map(s => `<option value="${s}" ${s === currentValue ? 'selected' : ''}>${s}</option>`).join('');
    }

    function formatCurrency(amount) {
        return '₹' + (amount || 0).toLocaleString('en-IN');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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
        const name = document.getElementById('new-name').value.trim();
        const email = document.getElementById('new-email').value.trim();
        const phone = document.getElementById('new-phone').value.trim();
        const password = document.getElementById('new-password').value;

        if (!name || !email || !phone || !password || !role) {
            alert('Please fill all required fields');
            return;
        }

        const userData = { name, email, phone, password, role };

        if (role === 'student') {
            const cls = document.getElementById('new-class').value.trim();
            const sec = document.getElementById('new-section').value.trim();
            const roll = document.getElementById('new-roll').value.trim();
            if (!cls || !sec || !roll) {
                alert('Please fill Class, Section, and Roll Number');
                return;
            }
            userData.studentInfo = {
                class: cls, section: sec, rollNumber: roll,
                guardianName: document.getElementById('new-guardian').value.trim(),
                guardianPhone: document.getElementById('new-guardian-phone').value.trim() || phone,
                address: document.getElementById('new-address').value.trim()
            };
        } else if (role === 'teacher') {
            userData.teacherInfo = {
                subjects: document.getElementById('new-subjects').value.split(',').map(s => s.trim()).filter(s => s),
                classTeacher: {
                    class: document.getElementById('new-ct-class').value.trim(),
                    section: document.getElementById('new-ct-section').value.trim()
                }
            };
        } else if (role === 'admin') {
            userData.adminInfo = { designation: document.getElementById('new-designation').value.trim() };
        }

        try {
            document.getElementById('submit-user-btn').disabled = true;
            document.getElementById('submit-user-btn').textContent = 'Adding...';

            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(userData)
            });
            const result = await response.json();

            if (result.success) {
                alert('User added successfully!');
                closeAddUserModal();
                fetchAllUsers();
            } else {
                alert('Error: ' + (result.message || result.error || 'Failed to add user'));
            }
        } catch (error) {
            alert('Failed to add user: ' + error.message);
        } finally {
            document.getElementById('submit-user-btn').disabled = false;
            document.getElementById('submit-user-btn').textContent = 'Add User';
        }
    }

    // Global function for View Details
    window.showUserDetails = function (index) {
        const user = window.currentUsers[index];
        if (!user) return;

        document.getElementById('modal-title').textContent = user.name || 'User Details';

        let html = `
            <div class="section-title">Basic Information</div>
            <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${escapeHtml(user.name)}</span></div>
            <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${escapeHtml(user.email)}</span></div>
            <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${escapeHtml(user.phone) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Role:</span><span class="detail-value"><span class="role-badge ${user.role}">${user.role}</span></span></div>
            <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">${user.isActive !== false ? '✅ Active' : '❌ Inactive'}</span></div>
        `;

        if (user.role === 'student' && user.studentInfo) {
            const i = user.studentInfo;
            html += `
                <div class="section-title">Student Information</div>
                <div class="detail-row"><span class="detail-label">Roll Number:</span><span class="detail-value">${i.rollNumber || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Class:</span><span class="detail-value">${i.class || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Section:</span><span class="detail-value">${i.section || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Guardian:</span><span class="detail-value">${escapeHtml(i.guardianName) || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Guardian Phone:</span><span class="detail-value">${i.guardianPhone || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Address:</span><span class="detail-value">${escapeHtml(i.address) || 'N/A'}</span></div>
            `;
        }

        if (user.role === 'teacher' && user.teacherInfo) {
            const i = user.teacherInfo;
            html += `<div class="section-title">Teacher Information</div>`;
            if (i.subjects?.length) html += `<div class="detail-row"><span class="detail-label">Subjects:</span><span class="detail-value">${i.subjects.join(', ')}</span></div>`;
            if (i.classTeacher) html += `<div class="detail-row"><span class="detail-label">Class Teacher:</span><span class="detail-value">${i.classTeacher.class || ''} ${i.classTeacher.section || ''}</span></div>`;
        }

        if (user.role === 'admin' && user.adminInfo) {
            html += `
                <div class="section-title">Admin Information</div>
                <div class="detail-row"><span class="detail-label">Designation:</span><span class="detail-value">${escapeHtml(user.adminInfo.designation) || 'N/A'}</span></div>
            `;
        }

        html += `
            <div class="section-title">Additional Information</div>
            <div class="detail-row"><span class="detail-label">Join Date:</span><span class="detail-value">${formatDate(user.joinDate)}</span></div>
        `;

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('user-modal').classList.add('active');
    };
};
