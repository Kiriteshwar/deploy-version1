// manage-users.js

console.log("manage-users.js loaded");
let currentRole = 'student'; // <-- Move this here, at the top

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded");
    // Tab switching
    const tabs = document.querySelectorAll('.user-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.id === 'tab-students') currentRole = 'student';
            else if (tab.id === 'tab-teachers') currentRole = 'teacher';
            else if (tab.id === 'tab-admins') currentRole = 'admin';
            fetchAndRenderUsers();
        });
    });

    // Add User button
    document.getElementById('addUserBtn').addEventListener('click', () => {
        showAddUserModal();
    });

    // Initial load
    fetchAndRenderUsers();
});

console.log("Calling fetchAndRenderUsers")
async function fetchAndRenderUsers() {
    console.log("Calling fetchAndRenderUsers");
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;
    try {
        console.log("Fetching:", `/api/admin/users?role=${currentRole}`);
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/admin/users?role=${currentRole}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        const data = await response.json();
        if (!data.success || !Array.isArray(data.users) || data.users.length === 0) {
            tbody.innerHTML = `<tr class="no-users"><td colspan="7">No users to display.</td></tr>`;
            renderBulkDeleteButton();
            return;
        }
        tbody.innerHTML = '';
        data.users.forEach(user => {
            tbody.appendChild(renderUserRow(user));
        });
        renderBulkDeleteButton();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7">Failed to load users.</td></tr>`;
        renderBulkDeleteButton();
    }
}

function renderUserRow(user) {
    const tr = document.createElement('tr');
    // For students, show class/section; for teachers, show subjects; for admins, leave blank
    let classSection = '';
    let subjects = '';
    if (user.role === 'student' && user.studentInfo) {
        classSection = `${user.studentInfo.class || ''} ${user.studentInfo.section || ''}`.trim();
    }
    if (user.role === 'teacher' && user.teacherInfo) {
        subjects = Array.isArray(user.teacherInfo.subjects) ? user.teacherInfo.subjects.join(', ') : user.teacherInfo.subjects || '';
    }
    tr.innerHTML = `
        <td><input type="checkbox" class="user-select-checkbox" data-id="${user._id}"></td>
        <td>${user.name || ''}</td>
        <td>${user.email || ''}</td>
        <td>${capitalize(user.role)}</td>
        <td>${classSection}</td>
        <td>${subjects}</td>
        <td class="user-actions">
            <button class="user-action-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="user-action-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
    `;
    // Edit event
    tr.querySelector('.edit').addEventListener('click', () => {
        showEditUserModal(user);
    });
    // Delete event
    tr.querySelector('.delete').addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete ${user.name}?`)) {
            await deleteUser(user._id);
            showAlert('User deleted successfully!', 'success');
            fetchAndRenderUsers();
        }
    });
    return tr;
}

// Render or update the bulk delete button
function renderBulkDeleteButton() {
    let bulkBtn = document.getElementById('bulkDeleteBtn');
    if (!bulkBtn) {
        const container = document.querySelector('.user-header-row');
        bulkBtn = document.createElement('button');
        bulkBtn.id = 'bulkDeleteBtn';
        bulkBtn.textContent = 'Delete Selected';
        bulkBtn.style.background = '#dc3545';
        bulkBtn.style.color = '#fff';
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
    bulkBtn.onclick = async function() {
        const checked = Array.from(document.querySelectorAll('.user-select-checkbox:checked'));
        if (checked.length === 0) {
            showAlert('No users selected.', 'error');
            return;
        }
        if (!confirm(`Are you sure you want to delete ${checked.length} user(s)?`)) return;
        for (const cb of checked) {
            await deleteUser(cb.getAttribute('data-id'));
        }
        showAlert('Selected users deleted successfully!', 'success');
        fetchAndRenderUsers();
    };
}

async function deleteUser(userId) {
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (!data.success) alert(data.message || 'Failed to delete user');
    } catch (e) {
        alert('Failed to delete user');
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showAddUserModal() {
    const modal = document.getElementById('addUserModal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div style="background: #fff; padding: 2rem; border-radius: 12px; max-width: 400px; margin: 2rem auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h2>Add User</h2>
            <form id="addUserForm">
                <div style="margin-bottom:1rem;">
                    <label>Name:</label><br>
                    <input type="text" name="name" required style="width:100%;padding:0.5rem;">
                </div>
                <div style="margin-bottom:1rem;">
                    <label>Email:</label><br>
                    <input type="email" name="email" required style="width:100%;padding:0.5rem;">
                </div>
                <div style="margin-bottom:1rem;">
                    <label>Password:</label><br>
                    <input type="password" name="password" required style="width:100%;padding:0.5rem;">
                </div>
                <div style="margin-bottom:1rem;">
                    <label>Role:</label><br>
                    <select name="role" id="roleSelect" required style="width:100%;padding:0.5rem;">
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div id="studentFields" style="display:none;">
                    <div style="margin-bottom:1rem;">
                        <label>Class:</label><br>
                        <input type="text" name="class" style="width:100%;padding:0.5rem;">
                    </div>
                    <div style="margin-bottom:1rem;">
                        <label>Section:</label><br>
                        <input type="text" name="section" style="width:100%;padding:0.5rem;">
                    </div>
                </div>
                <div id="teacherFields" style="display:none;">
                    <div style="margin-bottom:1rem;">
                        <label>Subjects (comma separated):</label><br>
                        <input type="text" name="subjects" style="width:100%;padding:0.5rem;">
                    </div>
                </div>
                <div id="phoneField" style="display:none;margin-bottom:1rem;">
                    <label>Phone:</label><br>
                    <input type="text" name="phone" style="width:100%;padding:0.5rem;">
                </div>
                <button type="submit" style="background:#28a745;color:#fff;padding:0.5rem 1.5rem;border:none;border-radius:4px;">Add</button>
                <button type="button" onclick="document.getElementById('addUserModal').style.display='none'" style="margin-left:1rem;">Cancel</button>
            </form>
        </div>
    `;
    // Show/hide fields based on role
    const roleSelect = document.getElementById('roleSelect');
    const studentFields = document.getElementById('studentFields');
    const teacherFields = document.getElementById('teacherFields');
    const phoneField = document.getElementById('phoneField');
    function updateFields() {
        if (roleSelect.value === 'student') {
            studentFields.style.display = '';
            teacherFields.style.display = 'none';
            phoneField.style.display = '';
        } else if (roleSelect.value === 'teacher') {
            studentFields.style.display = 'none';
            teacherFields.style.display = '';
            phoneField.style.display = '';
        } else {
            studentFields.style.display = 'none';
            teacherFields.style.display = 'none';
            phoneField.style.display = 'none';
        }
    }
    roleSelect.addEventListener('change', updateFields);
    updateFields(); // Initial call

    document.getElementById('addUserForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const user = {
            name: form.name.value,
            email: form.email.value,
            password: form.password.value,
            role: form.role.value
        };
        if (form.role.value === 'student') {
            user.studentInfo = {
                class: form.class.value,
                section: form.section.value
            };
            user.phone = form.phone.value;
        } else if (form.role.value === 'teacher') {
            user.teacherInfo = {
                subjects: form.subjects.value.split(',').map(s => s.trim()).filter(Boolean)
            };
            user.phone = form.phone.value;
        }
        // For admin, no extra fields
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(user)
        });
        const data = await res.json();
        if (data.success) {
            modal.style.display = 'none';
            fetchAndRenderUsers();
        } else {
            alert(data.message || 'Failed to add user');
        }
    };
}

function showEditUserModal(user) {
    const modal = document.getElementById('addUserModal');
    modal.style.display = 'block';
    // Determine fields based on role
    const isStudent = user.role === 'student';
    const isTeacher = user.role === 'teacher';
    const isAdmin = user.role === 'admin';
    const classVal = isStudent && user.studentInfo ? user.studentInfo.class || '' : '';
    const sectionVal = isStudent && user.studentInfo ? user.studentInfo.section || '' : '';
    const subjectsVal = isTeacher && user.teacherInfo ? (Array.isArray(user.teacherInfo.subjects) ? user.teacherInfo.subjects.join(', ') : user.teacherInfo.subjects || '') : '';
    const phoneVal = user.phone || '';
    modal.innerHTML = `
        <div style="background: #fff; padding: 2rem; border-radius: 12px; max-width: 400px; margin: 2rem auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h2>Edit User</h2>
            <form id="editUserForm">
                <div style="margin-bottom:1rem;">
                    <label>Name:</label><br>
                    <input type="text" name="name" value="${user.name || ''}" required style="width:100%;padding:0.5rem;">
                </div>
                <div style="margin-bottom:1rem;">
                    <label>Email:</label><br>
                    <input type="email" name="email" value="${user.email || ''}" required style="width:100%;padding:0.5rem;">
                </div>
                <div style="margin-bottom:1rem;">
                    <label>Role:</label><br>
                    <select name="role" id="editRoleSelect" required style="width:100%;padding:0.5rem;" disabled>
                        <option value="student" ${isStudent ? 'selected' : ''}>Student</option>
                        <option value="teacher" ${isTeacher ? 'selected' : ''}>Teacher</option>
                        <option value="admin" ${isAdmin ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div id="editStudentFields" style="display:${isStudent ? '' : 'none'};">
                    <div style="margin-bottom:1rem;">
                        <label>Class:</label><br>
                        <input type="text" name="class" value="${classVal}" style="width:100%;padding:0.5rem;">
                    </div>
                    <div style="margin-bottom:1rem;">
                        <label>Section:</label><br>
                        <input type="text" name="section" value="${sectionVal}" style="width:100%;padding:0.5rem;">
                    </div>
                </div>
                <div id="editTeacherFields" style="display:${isTeacher ? '' : 'none'};">
                    <div style="margin-bottom:1rem;">
                        <label>Subjects (comma separated):</label><br>
                        <input type="text" name="subjects" value="${subjectsVal}" style="width:100%;padding:0.5rem;">
                    </div>
                </div>
                <div id="editPhoneField" style="display:${isStudent || isTeacher ? '' : 'none'};margin-bottom:1rem;">
                    <label>Phone:</label><br>
                    <input type="text" name="phone" value="${phoneVal}" style="width:100%;padding:0.5rem;">
                </div>
                <button type="submit" style="background:#007bff;color:#fff;padding:0.5rem 1.5rem;border:none;border-radius:4px;">Save</button>
                <button type="button" onclick="document.getElementById('addUserModal').style.display='none'" style="margin-left:1rem;">Cancel</button>
            </form>
        </div>
    `;
    // No need to show/hide fields on role change since role is disabled
    document.getElementById('editUserForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const updatedUser = {
            name: form.name.value,
            email: form.email.value,
            // role: user.role // role is not editable
        };
        if (isStudent) {
            updatedUser.studentInfo = {
                class: form.class.value,
                section: form.section.value
            };
            updatedUser.phone = form.phone.value;
        } else if (isTeacher) {
            updatedUser.teacherInfo = {
                subjects: form.subjects.value.split(',').map(s => s.trim()).filter(Boolean)
            };
            updatedUser.phone = form.phone.value;
        }
        // For admin, no extra fields
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/users/${user._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(updatedUser)
        });
        const data = await res.json();
        if (data.success) {
            modal.style.display = 'none';
            showAlert('User updated successfully!', 'success');
            fetchAndRenderUsers();
        } else {
            alert(data.message || 'Failed to update user');
        }
    };
}

// Helper to show alerts
function showAlert(message, type = 'success') {
    const alertContainer = document.querySelector('.alert-container');
    if (!alertContainer) return;
    alertContainer.innerHTML = `<div class="alert alert-${type}" style="background:${type==='success'?'#d4edda':'#f8d7da'};color:${type==='success'?'#155724':'#721c24'};padding:1rem;border-radius:6px;margin-bottom:1rem;">${message}</div>`;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 3000);
} 