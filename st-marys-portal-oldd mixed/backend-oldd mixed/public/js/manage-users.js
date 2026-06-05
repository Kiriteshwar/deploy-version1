// manage-users.js

console.log("manage-users.js loaded");
let currentRole = 'student';

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded");
    const tabs = document.querySelectorAll('.user-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.id === 'tab-students') {
                currentRole = 'student';
                showStudentFilters();
            } else if (tab.id === 'tab-teachers') {
                currentRole = 'teacher';
                hideFilters();
            } else if (tab.id === 'tab-admins') {
                currentRole = 'admin';
                hideFilters();
            }
            fetchAndRenderUsers();
        });
    });

    document.getElementById('addUserBtn').addEventListener('click', () => {
        showAddUserModal();
    });

    setupFilterListeners();

    // Initial load
    showStudentFilters();
    // Trigger initial data load
    setTimeout(() => fetchAndRenderUsers(), 100);
});

async function fetchAndRenderUsers() {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = `<tr><td colspan="20">Loading...</td></tr>`;
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/admin/users?role=${currentRole}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        const data = await response.json();
        if (!data.success || !Array.isArray(data.users) || data.users.length === 0) {
            tbody.innerHTML = `<tr class="no-users"><td colspan="20">No users to display.</td></tr>`;
            renderBulkButton();
            return;
        }
        tbody.innerHTML = '';
        data.users.forEach(user => {
            tbody.appendChild(renderUserRow(user));
        });
        renderBulkButton();
    } catch (error) {
        console.error('Failed to fetch users:', error);
        tbody.innerHTML = `<tr><td colspan="20">Failed to load users.</td></tr>`;
        renderBulkButton();
    }
}

function renderUserRow(user) {
    const tr = document.createElement('tr');
    const isActive = user.isActive !== false;
    const statusText = isActive ? 'Active' : 'Left';
    const statusColor = isActive ? '#2e7d32' : '#c62828';
    const info = user.studentInfo || {};
    const dateOfLeaving = info.dateOfLeaving ? new Date(info.dateOfLeaving).toLocaleDateString('en-GB') : '';

    if (currentRole === 'student') {
        // Student row: Name, Roll Number, Admission Number, Class, Section, Gender, Status, Actions
        tr.innerHTML = `
            <td><input type="checkbox" class="user-select-checkbox" data-id="${user._id}"></td>
            <td>${user.name || ''}</td>
            <td>${info.rollNumber || '-'}</td>
            <td>${info.admissionNumber || '-'}</td>
            <td>${info.class || '-'}</td>
            <td>${info.section || '-'}</td>
            <td>${user.gender || '-'}</td>
            <td style="color:${statusColor}; font-weight:500;">
                <span class="status-badge" style="background:${isActive ? '#e8f5e9' : '#fce4ec'}; color:${statusColor}; padding:2px 8px; border-radius:10px; font-size:0.85rem;">
                    ${statusText}${dateOfLeaving ? ' (' + dateOfLeaving + ')' : ''}
                </span>
            </td>
            <td class="user-actions">
                <button class="user-action-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
                ${isActive 
                    ? `<button class="user-action-btn mark-left" title="Mark as Left" style="background:#ff9800;"><i class="fas fa-user-times"></i></button>`
                    : `<button class="user-action-btn restore" title="Restore" style="background:#4caf50;"><i class="fas fa-user-check"></i></button>`
                }
            </td>
        `;
    } else if (currentRole === 'teacher') {
        let subjects = user.teacherInfo?.subjects ? user.teacherInfo.subjects.join(', ') : '';
        let classTeacher = user.teacherInfo?.classTeacher?.class || '';
        let sectionTeacher = user.teacherInfo?.classTeacher?.section || '';
        tr.innerHTML = `
            <td><input type="checkbox" class="user-select-checkbox" data-id="${user._id}"></td>
            <td>${user.name || ''}</td>
            <td>${user.email || ''}</td>
            <td>${user.phone || '-'}</td>
            <td>${subjects}</td>
            <td>${classTeacher} ${sectionTeacher}</td>
            <td>${user.gender || '-'}</td>
            <td class="user-actions">
                <button class="user-action-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="user-action-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
    } else {
        // Admin row
        tr.innerHTML = `
            <td><input type="checkbox" class="user-select-checkbox" data-id="${user._id}"></td>
            <td>${user.name || ''}</td>
            <td>${user.email || ''}</td>
            <td>${user.phone || '-'}</td>
            <td>${user.adminInfo?.designation || '-'}</td>
            <td>${user.gender || '-'}</td>
            <td class="user-actions">
                <button class="user-action-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="user-action-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
    }

    // Edit event
    tr.querySelector('.edit').addEventListener('click', () => {
        showEditUserModal(user);
    });

    // Mark as Left (students only)
    const markLeftBtn = tr.querySelector('.mark-left');
    if (markLeftBtn) {
        markLeftBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to mark ${user.name} as LEFT?`)) {
                await updateUserStatus(user._id, false);
                showAlert(`${user.name} marked as left`, 'success');
                fetchAndRenderUsers();
            }
        });
    }

    // Restore (students only)
    const restoreBtn = tr.querySelector('.restore');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', async () => {
            if (confirm(`Restore ${user.name}?`)) {
                await updateUserStatus(user._id, true);
                showAlert(`${user.name} restored`, 'success');
                fetchAndRenderUsers();
            }
        });
    }

    // Delete (teachers/admins only)
    const deleteBtn = tr.querySelector('.delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`Delete ${user.name}?`)) {
                await deleteUser(user._id);
                showAlert('User deleted', 'success');
                fetchAndRenderUsers();
            }
        });
    }

    return tr;
}

// ========== BULK ACTION BUTTON ==========

function renderBulkButton() {
    let bulkBtn = document.getElementById('bulkActionBtn');
    if (!bulkBtn) {
        const container = document.querySelector('.user-header-row');
        if (!container) return;
        bulkBtn = document.createElement('button');
        bulkBtn.id = 'bulkActionBtn';
        bulkBtn.style.border = 'none';
        bulkBtn.style.borderRadius = '4px';
        bulkBtn.style.padding = '0.5rem 1.5rem';
        bulkBtn.style.fontSize = '1rem';
        bulkBtn.style.fontWeight = '500';
        bulkBtn.style.cursor = 'pointer';
        bulkBtn.style.marginLeft = '1rem';
        bulkBtn.style.display = 'inline-block';
        container.appendChild(bulkBtn);
    }

    if (currentRole === 'student') {
        bulkBtn.textContent = 'Mark Selected as Left';
        bulkBtn.style.background = '#ff9800';
        bulkBtn.style.color = '#fff';
        bulkBtn.onclick = async function () {
            const checked = Array.from(document.querySelectorAll('.user-select-checkbox:checked'));
            if (checked.length === 0) {
                showAlert('No students selected.', 'error');
                return;
            }
            if (!confirm(`Mark ${checked.length} student(s) as LEFT?`)) return;
            for (const cb of checked) {
                await updateUserStatus(cb.getAttribute('data-id'), false);
            }
            showAlert('Selected students marked as left!', 'success');
            fetchAndRenderUsers();
        };
    } else {
        bulkBtn.textContent = 'Delete Selected';
        bulkBtn.style.background = '#dc3545';
        bulkBtn.style.color = '#fff';
        bulkBtn.onclick = async function () {
            const checked = Array.from(document.querySelectorAll('.user-select-checkbox:checked'));
            if (checked.length === 0) {
                showAlert('No users selected.', 'error');
                return;
            }
            if (!confirm(`Delete ${checked.length} user(s)?`)) return;
            for (const cb of checked) {
                await deleteUser(cb.getAttribute('data-id'));
            }
            showAlert('Selected users deleted!', 'success');
            fetchAndRenderUsers();
        };
    }
}

async function updateUserStatus(userId, isActive) {
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ isActive })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed');
        return data;
    } catch (e) {
        alert('Failed: ' + e.message);
        throw e;
    }
}

async function deleteUser(userId) {
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (!data.success) alert(data.message || 'Failed to delete');
    } catch (e) {
        alert('Failed to delete user');
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========== ADD USER MODAL ==========

function showAddUserModal() {
    const modal = document.getElementById('addUserModal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
            <div class="modal-content" style="background:#fff;border-radius:12px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 5px 25px rgba(0,0,0,0.2);">
                <div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <h2 style="margin:0;font-size:1.3rem;">Add User</h2>
                    <button class="modal-close-btn" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;">&times;</button>
                </div>
                <div style="padding:20px 24px;">
                    <form id="addUserForm">
                        <div style="margin-bottom:1rem;">
                            <label>Name:</label><br>
                            <input type="text" name="name" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label>Email:</label><br>
                            <input type="email" name="email" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label>Password:</label><br>
                            <input type="password" name="password" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label>Phone:</label><br>
                            <input type="text" name="phone" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label>Gender:</label><br>
                            <select name="gender" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label>Role:</label><br>
                            <select name="role" id="roleSelect" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div id="studentFields" style="display:none;">
                            <div style="margin-bottom:1rem;">
                                <label>Class:</label><br>
                                <input type="text" name="class" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label>Section:</label><br>
                                <input type="text" name="section" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label>Roll Number:</label><br>
                                <input type="text" name="rollNumber" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label>Admission Number:</label><br>
                                <input type="text" name="admissionNumber" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label>Parent Email:</label><br>
                                <input type="email" name="parentEmail" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" placeholder="parent@example.com">
                            </div>
                        </div>
                        <div id="teacherFields" style="display:none;">
                            <div style="margin-bottom:1rem;">
                                <label>Subjects (comma separated):</label><br>
                                <input type="text" name="subjects" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                            </div>
                            <div style="margin-bottom:1rem;">
                                <label>Personal Email:</label><br>
                                <input type="email" name="personalEmail" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" placeholder="teacher@personal.com">
                            </div>
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label>Date of Joining:</label><br>
                            <input type="date" name="joinDate" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                        </div>
                        <div style="text-align:right;margin-top:20px;">
                            <button type="button" class="modal-close-btn" style="padding:8px 20px;border:1px solid #ddd;background:white;cursor:pointer;margin-right:10px;border-radius:4px;">Cancel</button>
                            <button type="submit" style="background:#28a745;color:#fff;padding:8px 20px;border:none;border-radius:4px;cursor:pointer;">Add User</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Close handlers
    modal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
    });
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) { modal.style.display = 'none'; modal.innerHTML = ''; }
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { modal.style.display = 'none'; modal.innerHTML = ''; document.removeEventListener('keydown', escHandler); }
    });

    // Role toggle
    const roleSelect = modal.querySelector('#roleSelect');
    const studentFields = modal.querySelector('#studentFields');
    const teacherFields = modal.querySelector('#teacherFields');
    function updateFields() {
        const val = roleSelect.value;
        studentFields.style.display = val === 'student' ? '' : 'none';
        teacherFields.style.display = val === 'teacher' ? '' : 'none';
    }
    roleSelect.addEventListener('change', updateFields);
    updateFields();

    // Form submit
    modal.querySelector('#addUserForm').onsubmit = async function (e) {
        e.preventDefault();
        const form = e.target;
        const userData = {
            name: form.name.value,
            email: form.email.value,
            password: form.password.value,
            role: form.role.value,
            phone: form.phone.value,
            gender: form.gender.value,
            joinDate: form.joinDate.value || undefined
        };
        if (form.role.value === 'student') {
            userData.studentInfo = {
                class: form.class.value,
                section: form.section.value,
                rollNumber: form.rollNumber.value,
                admissionNumber: form.admissionNumber.value,
                parentEmail: form.parentEmail.value
            };
        } else if (form.role.value === 'teacher') {
            userData.teacherInfo = {
                subjects: form.subjects.value.split(',').map(s => s.trim()).filter(Boolean),
                personalEmail: form.personalEmail.value
            };
        }
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(userData)
        });
        const data = await res.json();
        if (data.success) {
            modal.style.display = 'none';
            modal.innerHTML = '';
            fetchAndRenderUsers();
        } else {
            alert(data.message || 'Failed to add user');
        }
    };
}

// ========== EDIT USER MODAL ==========

function showEditUserModal(user) {
    // Remove existing edit modal if any
    const existing = document.getElementById('editUserModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'editUserModal';
    document.body.appendChild(modal);

    const isStudent = user.role === 'student';
    const isTeacher = user.role === 'teacher';
    const info = user.studentInfo || {};

    const formatDate = (d) => {
        if (!d) return '';
        try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return ''; }
    };
    const dobVal = formatDate(info.dateOfBirth);
    const dolVal = formatDate(info.dateOfLeaving);

    // Case-insensitive gender selection
    const genderVal = user.gender || '';
    const genderLower = genderVal.toLowerCase();

    let formContent = `
        <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Basic Info</div>
        <div><label>Name</label><input type="text" name="name" value="${(user.name || '').replace(/"/g, '"')}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Email</label><input type="email" name="email" value="${(user.email || '').replace(/"/g, '"')}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Phone</label><input type="text" name="phone" value="${(user.phone || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Role</label><input type="text" value="${user.role}" disabled style="width:100%;padding:8px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Gender</label>
            <select name="gender" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                <option value="">Select</option>
                <option value="Male" ${genderLower === 'male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${genderLower === 'female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${genderLower === 'other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div><label>Date of Joining</label><input type="date" name="joinDate" value="${formatDate(user.joinDate)}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
    `;

    if (isStudent) {
        formContent += `
            <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Academic Info</div>
            <div><label>Class</label><input type="text" name="class" value="${info.class || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Section</label><input type="text" name="section" value="${info.section || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Roll Number</label><input type="text" name="rollNumber" value="${info.rollNumber || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Admission Number</label><input type="text" name="admissionNumber" value="${info.admissionNumber || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Demographics</div>
            <div><label>Religion</label><input type="text" name="religion" value="${(info.religion || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Caste</label><input type="text" name="caste" value="${(info.caste || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Sub-Caste</label><input type="text" name="subCaste" value="${(info.subCaste || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Identification Marks</div>
            <div><label>ID Mark 1</label><input type="text" name="identificationMark1" value="${(info.identificationMark1 || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>ID Mark 2</label><input type="text" name="identificationMark2" value="${(info.identificationMark2 || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Dates</div>
            <div><label>Date of Birth</label><input type="date" name="dateOfBirth" value="${dobVal}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label style="color:#c62828;">Date of Leaving</label><input type="date" name="dateOfLeaving" value="${dolVal}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Parent/Guardian</div>
            <div><label>Father/Guardian Name</label><input type="text" name="guardianName" value="${(info.guardianName || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Father/Guardian Phone</label><input type="text" name="fatherGuardianPhone" value="${(info.fatherGuardianPhone || info.guardianPhone || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Parent Email</label><input type="email" name="parentEmail" value="${(info.parentEmail || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" placeholder="parent@example.com"></div>
            <div><label>Mother Name</label><input type="text" name="motherName" value="${(info.motherName || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Mother Phone</label><input type="text" name="motherPhone" value="${(info.motherPhone || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div style="grid-column: span 2;"><label>Address</label><input type="text" name="address" value="${(info.address || '').replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        `;
    }

    if (isTeacher) {
        const subjects = user.teacherInfo?.subjects?.join(', ') || '';
        formContent += `
            <div style="grid-column: span 2; font-weight:bold; margin-top:10px; border-bottom:1px solid #f0f0f0;">Teacher Info</div>
            <div style="grid-column: span 2;"><label>Subjects (comma separated)</label><input type="text" name="subjects" value="${subjects.replace(/"/g, '"')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
            <div><label>Salary</label><input type="number" name="salary" value="${user.teacherInfo?.salary || 0}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        `;
    }

    modal.innerHTML = `
        <div class="modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
            <div class="modal-content" style="background:#fff;border-radius:12px;max-width:800px;width:92%;max-height:90vh;overflow-y:auto;box-shadow:0 5px 25px rgba(0,0,0,0.2);padding:0;">
                <div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#fff;z-index:1;">
                    <h2 style="margin:0;font-size:1.3rem;">Edit: ${user.name}</h2>
                    <button class="modal-close-btn" style="background:none;border:none;font-size:1.8rem;cursor:pointer;color:#999;line-height:1;">&times;</button>
                </div>
                <div style="padding:20px 24px;">
                    <form id="editUserForm" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                        ${formContent}
                        <div style="grid-column: span 2; margin-top:15px; padding-top:15px; border-top:1px solid #eee; text-align:right;">
                            <button type="button" class="modal-close-btn" style="padding:10px 24px; border:1px solid #ddd; background:white; cursor:pointer; margin-right:10px; border-radius:4px;">Cancel</button>
                            <button type="submit" style="background:#007bff;color:#fff;padding:10px 24px;border:none;border-radius:4px;cursor:pointer;">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Close handlers
    modal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) modal.remove();
    });
    const escHandler = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    // Save handler
    document.getElementById('editUserForm').onsubmit = async function (e) {
        e.preventDefault();
        const form = e.target;
        const updatedUser = {
            name: form.name.value,
            email: form.email.value,
            phone: form.phone.value,
            gender: form.gender.value,
            joinDate: form.joinDate.value
        };

        if (isStudent) {
            updatedUser.studentInfo = {
                class: form.class.value,
                section: form.section.value,
                rollNumber: form.rollNumber.value,
                admissionNumber: form.admissionNumber.value,
                dateOfBirth: form.dateOfBirth.value,
                dateOfLeaving: form.dateOfLeaving.value,
                guardianName: form.guardianName.value,
                fatherGuardianPhone: form.fatherGuardianPhone.value,
                motherName: form.motherName.value,
                motherPhone: form.motherPhone.value,
                address: form.address.value,
                religion: form.religion.value,
                caste: form.caste.value,
                subCaste: form.subCaste.value,
                identificationMark1: form.identificationMark1.value,
                identificationMark2: form.identificationMark2.value
            };
        } else if (isTeacher) {
            updatedUser.teacherInfo = {
                subjects: form.subjects.value.split(',').map(s => s.trim()).filter(Boolean),
                salary: form.salary.value
            };
        }

        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`/api/admin/users/${user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(updatedUser)
            });
            const data = await res.json();
            if (data.success) {
                modal.remove();
                showAlert('User updated!', 'success');
                fetchAndRenderUsers();
            } else {
                alert(data.message || 'Failed to update');
            }
        } catch (err) {
            alert('Error updating user');
        }
    };
}

// ========== ALERT ==========

function showAlert(message, type = 'success') {
    const alertContainer = document.querySelector('.alert-container');
    if (!alertContainer) return;
    alertContainer.innerHTML = `<div class="alert alert-${type}" style="background:${type === 'success' ? '#d4edda' : '#f8d7da'};color:${type === 'success' ? '#155724' : '#721c24'};padding:1rem;border-radius:6px;margin-bottom:1rem;">${message}</div>`;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 3000);
}

// ========== FILTERS ==========

function showStudentFilters() {
    const filterControls = document.querySelector('.filter-controls');
    if (filterControls) filterControls.style.display = 'block';
    loadClassOptions();
}

function hideFilters() {
    const filterControls = document.querySelector('.filter-controls');
    if (filterControls) filterControls.style.display = 'none';
}

function setupFilterListeners() {
    document.getElementById('classFilter').addEventListener('change', () => {
        loadSectionOptions();
        applyFilters();
    });
    document.getElementById('sectionFilter').addEventListener('change', applyFilters);
    document.getElementById('searchFilter').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

async function loadClassOptions() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/teacher/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const classFilter = document.getElementById('classFilter');
        classFilter.innerHTML = '<option value="">All Classes</option>';
        if (data.classes && Array.isArray(data.classes)) {
            data.classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = `Class ${cls}`;
                classFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load classes:', error);
    }
}

async function loadSectionOptions() {
    const selectedClass = document.getElementById('classFilter').value;
    const sectionFilter = document.getElementById('sectionFilter');
    sectionFilter.innerHTML = '<option value="">All Sections</option>';
    if (!selectedClass) return;
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/teacher/sections/${selectedClass}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sections = await response.json();
        if (Array.isArray(sections)) {
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = `Section ${section}`;
                sectionFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load sections:', error);
    }
}

async function applyFilters() {
    const className = document.getElementById('classFilter')?.value || '';
    const section = document.getElementById('sectionFilter')?.value || '';
    const search = document.getElementById('searchFilter')?.value || '';

    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = `<tr><td colspan="20">Loading...</td></tr>`;

    try {
        const token = localStorage.getItem('auth_token');
        const params = new URLSearchParams({ role: currentRole });
        if (className) params.append('class', className);
        if (section) params.append('section', section);
        if (search) params.append('search', search);

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        });
        const data = await response.json();

        if (!data.success || !Array.isArray(data.users) || data.users.length === 0) {
            tbody.innerHTML = `<tr class="no-users"><td colspan="20">No users found.</td></tr>`;
            return;
        }
        tbody.innerHTML = '';
        data.users.forEach(user => tbody.appendChild(renderUserRow(user)));
    } catch (error) {
        console.error('Filter error:', error);
        tbody.innerHTML = `<tr><td colspan="20">Failed to load users.</td></tr>`;
    }
}

function clearFilters() {
    document.getElementById('classFilter').value = '';
    document.getElementById('sectionFilter').value = '';
    document.getElementById('searchFilter').value = '';
    loadSectionOptions();
    applyFilters();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}