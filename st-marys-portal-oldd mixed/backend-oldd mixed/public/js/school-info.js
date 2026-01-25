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

    // ========== PRINT BUTTON ==========
    document.getElementById('print-details-btn').addEventListener('click', printUserDetails);

    // ========== EXCEL IMPORT ==========
    document.getElementById('excel-import-btn').addEventListener('click', () => {
        document.getElementById('excel-format-note').style.display = 'block';
    });
    document.getElementById('close-excel-note').addEventListener('click', () => {
        document.getElementById('excel-format-note').style.display = 'none';
    });
    document.getElementById('download-template').addEventListener('click', downloadExcelTemplate);
    document.getElementById('excel-file-input').addEventListener('change', handleExcelUpload);

    // Click Import Excel opens file picker after viewing instructions
    document.getElementById('excel-format-note').addEventListener('click', (e) => {
        if (e.target.id === 'download-template' || e.target.id === 'close-excel-note') return;
        if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Import')) {
            document.getElementById('excel-file-input').click();
        }
    });

    // Add "Choose File" button in note
    const importBtn = document.createElement('button');
    importBtn.textContent = '📤 Choose Excel File';
    importBtn.style.cssText = 'margin-top:10px; margin-left:10px; padding:6px 12px; background:#1976d2; color:white; border:none; border-radius:4px; cursor:pointer;';
    importBtn.addEventListener('click', () => document.getElementById('excel-file-input').click());
    document.getElementById('excel-format-note').appendChild(importBtn);

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
        const gender = document.getElementById('new-gender').value;
        const joinDate = document.getElementById('new-join-date').value;

        if (!name || !email || !phone || !password || !role) {
            alert('Please fill all required fields');
            return;
        }

        const userData = { name, email, phone, password, role, gender, joinDate: joinDate || undefined };

        if (role === 'student') {
            const cls = document.getElementById('new-class').value.trim();
            const sec = document.getElementById('new-section').value.trim();
            const roll = document.getElementById('new-roll').value.trim();
            const admissionNo = document.getElementById('new-admission-no').value.trim();

            if (!cls || !sec || !roll || !admissionNo) {
                alert('Please fill Class, Section, Roll Number, and Admission Number');
                return;
            }

            if (!/^\d+$/.test(admissionNo)) {
                alert('Admission Number must contain only digits');
                return;
            }
            userData.studentInfo = {
                class: cls,
                section: sec,
                rollNumber: roll,
                admissionNumber: admissionNo,
                guardianName: document.getElementById('new-guardian').value.trim(),
                fatherGuardianPhone: document.getElementById('new-guardian-phone').value.trim() || phone,
                motherName: document.getElementById('new-mother-name').value.trim(),
                motherPhone: document.getElementById('new-mother-phone').value.trim(),
                address: document.getElementById('new-address').value.trim(),
                dateOfBirth: document.getElementById('new-dob').value || null,
                dateOfLeaving: document.getElementById('new-dol').value || null,
                religion: document.getElementById('new-religion').value.trim(),
                caste: document.getElementById('new-caste').value.trim(),
                subCaste: document.getElementById('new-subcaste').value.trim(),
                identificationMark1: document.getElementById('new-id-mark1').value.trim(),
                identificationMark2: document.getElementById('new-id-mark2').value.trim()
            };

            const totalFee = document.getElementById('new-total-fee').value;
            if (totalFee) {
                userData.totalFee = parseInt(totalFee);
            }
        } else if (role === 'teacher') {
            userData.teacherInfo = {
                subjects: document.getElementById('new-subjects').value.split(',').map(s => s.trim()).filter(s => s),
                classTeacher: {
                    class: document.getElementById('new-ct-class').value.trim(),
                    section: document.getElementById('new-ct-section').value.trim()
                },
                salary: parseInt(document.getElementById('new-salary').value) || 0
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
    window.showUserDetails = async function (index) {
        const user = window.currentUsers[index];
        if (!user) return;

        document.getElementById('modal-title').textContent = user.name || 'User Details';
        document.getElementById('modal-body').innerHTML = '<div class="no-data">Loading...</div>';
        document.getElementById('user-modal').classList.add('active');

        let html = `
            <div class="section-title">Basic Information</div>
            <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${escapeHtml(user.name)}</span></div>
            <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${escapeHtml(user.email)}</span></div>
            <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${escapeHtml(user.phone) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Gender:</span><span class="detail-value">${escapeHtml(user.gender) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Role:</span><span class="detail-value"><span class="role-badge ${user.role}">${user.role}</span></span></div>
            <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">${user.isActive !== false ? '✅ Active' : '❌ Inactive'}</span></div>
        `;

        if (user.role === 'student' && user.studentInfo) {
            const i = user.studentInfo;
            html += `
                <div class="section-title">Student Information</div>
                <div class="detail-row"><span class="detail-label">Admission Number:</span><span class="detail-value">${i.admissionNumber || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Roll Number:</span><span class="detail-value">${i.rollNumber || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Class:</span><span class="detail-value">${i.class || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Section:</span><span class="detail-value">${i.section || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Date of Birth:</span><span class="detail-value">${formatDate(i.dateOfBirth)}</span></div>
                <div class="detail-row"><span class="detail-label">Religion:</span><span class="detail-value">${escapeHtml(i.religion) || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Caste:</span><span class="detail-value">${escapeHtml(i.caste) || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Sub-Caste:</span><span class="detail-value">${escapeHtml(i.subCaste) || 'N/A'}</span></div>
                <div class="section-title">Parent/Guardian Details</div>
                <div class="detail-row"><span class="detail-label">Father/Guardian:</span><span class="detail-value">${escapeHtml(i.guardianName) || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Father/Guardian Phone:</span><span class="detail-value">${i.fatherGuardianPhone || i.guardianPhone || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Mother's Name:</span><span class="detail-value">${escapeHtml(i.motherName) || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Mother's Phone:</span><span class="detail-value">${i.motherPhone || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Address:</span><span class="detail-value">${escapeHtml(i.address) || 'N/A'}</span></div>
                <div class="section-title">Identification</div>
                <div class="detail-row"><span class="detail-label">ID Mark 1:</span><span class="detail-value">${escapeHtml(i.identificationMark1) || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">ID Mark 2:</span><span class="detail-value">${escapeHtml(i.identificationMark2) || 'N/A'}</span></div>
                ${i.dateOfLeaving ? `<div class="detail-row"><span class="detail-label">Date of Leaving:</span><span class="detail-value" style="color:#c62828">${formatDate(i.dateOfLeaving)}</span></div>` : ''}
            `;

            // Fetch fee details for student
            try {
                const feeResponse = await fetch(`/api/admin/fees/student/${user._id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const feeData = await feeResponse.json();

                // API returns { student, feeStructure, payments } without success field
                if (feeResponse.ok && feeData.feeStructure) {
                    const totalFromStructure = feeData.feeStructure?.totalFee || 0;
                    const discount = feeData.student?.discount || user.discount || 0;

                    // Calculate total paid from payments array
                    let amountPaid = 0;
                    if (feeData.payments && feeData.payments.length > 0) {
                        amountPaid = feeData.payments.reduce((sum, p) => sum + (p.totalPaid || 0), 0);
                    }

                    const remaining = (totalFromStructure - discount) - amountPaid;

                    html += `
                        <div class="section-title">Fee Details</div>
                        <div class="detail-row"><span class="detail-label">Fee (Structure):</span><span class="detail-value" style="font-weight:600">${formatCurrency(totalFromStructure)}</span></div>
                        <div class="detail-row"><span class="detail-label">Discount Given:</span><span class="detail-value" style="color:#4caf50">${formatCurrency(discount)}</span></div>
                        <div class="detail-row"><span class="detail-label">Amount Paid:</span><span class="detail-value" style="color:#1976d2">${formatCurrency(amountPaid)}</span></div>
                        <div class="detail-row"><span class="detail-label">Remaining:</span><span class="detail-value" style="color:${remaining > 0 ? '#c62828' : '#2e7d32'}; font-weight:600">${formatCurrency(remaining)}</span></div>
                    `;
                } else if (feeData.error) {
                    console.error('Fee API error:', feeData.error);
                }
            } catch (err) {
                console.error('Error fetching fee details:', err);
            }
        }

        if (user.role === 'teacher' && user.teacherInfo) {
            const i = user.teacherInfo;
            html += `<div class="section-title">Teacher Information</div>`;
            if (i.subjects?.length) html += `<div class="detail-row"><span class="detail-label">Subjects:</span><span class="detail-value">${i.subjects.join(', ')}</span></div>`;
            if (i.classTeacher) html += `<div class="detail-row"><span class="detail-label">Class Teacher:</span><span class="detail-value">${i.classTeacher.class || ''} ${i.classTeacher.section || ''}</span></div>`;
            html += `<div class="detail-row"><span class="detail-label">Salary:</span><span class="detail-value" style="color:#1976d2; font-weight:600">${formatCurrency(i.salary || 0)}</span></div>`;
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

        // Show/Hide Certificate Button
        const certBtn = document.getElementById('certificate-btn');
        if (certBtn) {
            if (user.role === 'student') {
                certBtn.style.display = 'block';
                certBtn.onclick = () => generateCertificate(user);
            } else {
                certBtn.style.display = 'none';
            }
        }
    };

    // Print user details function
    function printUserDetails() {
        const modalBody = document.getElementById('modal-body');
        const title = document.getElementById('modal-title').textContent;

        // Create print-friendly content (exclude fee details)
        let content = modalBody.innerHTML;
        // Remove fee details section if present
        const feeStart = content.indexOf('<div class="section-title">Fee Details');
        if (feeStart !== -1) {
            const nextSection = content.indexOf('<div class="section-title">', feeStart + 1);
            if (nextSection !== -1) {
                content = content.substring(0, feeStart) + content.substring(nextSection);
            } else {
                content = content.substring(0, feeStart);
            }
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} - Print</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; max-width: 800px; margin: auto; }
                    .section-title { font-weight: 700; color: #1976d2; margin: 20px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #e3f2fd; font-size: 1.1rem; }
                    .section-title:first-child { margin-top: 0; }
                    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
                    .detail-label { font-weight: 600; color: #555; min-width: 180px; }
                    .detail-value { color: #222; flex: 1; }
                    .role-badge { padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 500; text-transform: capitalize; }
                    .role-badge.student { background-color: #e8f5e9; color: #2e7d32; }
                    .role-badge.teacher { background-color: #fff3e0; color: #e65100; }
                    .role-badge.admin { background-color: #e3f2fd; color: #1565c0; }
                    h1 { text-align: center; color: #333; margin-bottom: 30px; }
                    .header-info { text-align: center; color: #666; margin-bottom: 30px; }
                    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                <h1>St. Mary's School</h1>
                <div class="header-info">User Details: ${title}</div>
                ${content}
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // Generate Study Certificate
    function generateCertificate(user) {
        if (!user || user.role !== 'student') return;

        const info = user.studentInfo || {};
        const dob = info.dateOfBirth ? new Date(info.dateOfBirth).toLocaleDateString('en-GB') : '__________';
        const admissionNo = info.admissionNumber || '__________';
        const fatherName = info.guardianName || '__________';
        const className = info.class || '__________';
        const logoUrl = window.location.origin + '/images/logo.jpg';

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Study Certificate - ${user.name}</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #eee; 
                        font-family: 'Times New Roman', serif; 
                        display: flex;
                        justify-content: center;
                    }
                    .certificate-border {
                        width: 750px;
                        height: 530px;
                        border: 5px double #1a237e;
                        padding: 30px;
                        position: relative;
                        background: #fff;
                        background-image: radial-gradient(#e8eaf6 1px, transparent 1px);
                        background-size: 20px 20px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                        box-sizing: border-box;
                    }
                    .header { text-align: center; color: #1a237e; margin-bottom: 20px; position: relative; }
                    .logo-placeholder { 
                        position: absolute; 
                        left: 10px; 
                        top: -5px; 
                        width: 80px; 
                        height: 80px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                    }
                    .logo-placeholder img { width: 100%; height: 100%; object-fit: contain; }
                    .school-name { font-size: 32px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px; color: #1a237e; }
                    .medium { font-size: 14px; font-weight: bold; margin: 2px 0; }
                    .address { font-size: 13px; font-weight: bold; }
                    .title-box {
                        border: 3px solid #1a237e;
                        display: inline-block;
                        padding: 5px 30px;
                        margin: 15px 0;
                        font-size: 22px;
                        font-weight: 900;
                        color: #1a237e;
                        text-transform: uppercase;
                        background: #fff;
                        box-shadow: 4px 4px 0px rgba(26, 35, 126, 0.2);
                    }
                    .content { 
                        line-height: 2.4; 
                        font-size: 16px; 
                        color: #1a237e; 
                        margin-top: 15px; 
                        text-align: justify; 
                        font-style: italic;
                        font-weight: 500;
                        padding: 0 10px;
                    }
                    .fill-blank {
                        border-bottom: 2px dotted #1a237e;
                        display: inline-block;
                        min-width: 60px;
                        text-align: center;
                        font-weight: bold;
                        color: #000;
                        padding: 0 5px;
                        font-style: normal;
                    }
                    .footer { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px; }
                    .footer-item { text-align: center; font-weight: bold; color: #1a237e; min-width: 120px; font-size: 14px; }
                    .sign-line { margin-top: 30px; border-top: 1px solid #1a237e; width: 100%; display: block; }
                    
                    .print-btn {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #1976d2;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: sans-serif;
                        font-weight: bold;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    }
                    .print-btn:hover { background: #1565c0; }

                    @media print {
                        body { margin: 0; padding: 0; background: none; display:block; }
                        .certificate-border { 
                            margin: 10mm auto;
                            box-shadow: none; 
                            border: 5px double #1a237e !important;
                            height: auto;
                            width: 80%;
                            page-break-inside: avoid;
                        }
                        .print-btn { display: none; }
                        @page { margin: 0; size: landscape; }
                    }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">🖨️ Print Certificate</button>
                <div class="certificate-border">
                    <div class="header">
                        <div class="logo-placeholder"><img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'"></div>
                        <h1 class="school-name">ST. MARY'S HIGH SCHOOL</h1>
                        <div class="medium">(ENGLISH MEDIUM)</div>
                        <div class="address">HASANPARTHY - 506371, Warangal (Dist.) - T.S.</div>
                        <div class="title-box">STUDY CERTIFICATE</div>
                    </div>
                    
                    <div class="content">
                        This is to certify that <span class="fill-blank" style="min-width:200px">${user.name}</span><br>
                        D/o. / S/o. Sri <span class="fill-blank" style="min-width:200px">${fatherName}</span>
                        was / is a student of this Institution Studying in Classes <span class="fill-blank" style="padding-left: 17px">${className}</span>
                        from <span class="fill-blank">20&nbsp;&nbsp;&nbsp;&nbsp;-20&nbsp;&nbsp;&nbsp;&nbsp;</span> to <span class="fill-blank">20&nbsp;&nbsp;&nbsp;&nbsp;-20&nbsp;&nbsp;&nbsp;&nbsp;</span>.
                        His / Her Admission Number is <span class="fill-blank">${admissionNo}</span>
                        and Date of Birth according to our school record is <span class="fill-blank" style="min-width:120px">${dob}</span>.<br>
                        During the period his / her character and conduct have been satisfactory.
                    </div>
                    
                    <div class="footer">
                        <div class="footer-item" style="text-align:left">
                            Date: <span style="text-decoration:none">${new Date().toLocaleDateString('en-GB')}</span>
                        </div>
                        <div class="footer-item">
                            <span class="sign-line"></span>        
                            Admission Incharge
                        </div>
                        <div class="footer-item">
                            <span class="sign-line"></span>
                            Principal
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        // printWindow.document.close();
    }

    // Download Excel template
    function downloadExcelTemplate() {
        // CSV format template
        const studentHeaders = 'name,email,phone,password,role,gender,joinDate,class,section,admissionNumber,rollNumber,totalFee,guardianName,fatherGuardianPhone,motherName,motherPhone,address,dateOfBirth,religion,caste,subCaste,identificationMark1,identificationMark2';
        const teacherHeaders = 'name,email,phone,password,role,gender,joinDate,subjects,salary,classTeacherClass,classTeacherSection';

        const templateContent = `STUDENT TEMPLATE\n${studentHeaders}\nJohn Doe,john@example.com,9876543210,password123,student,Male,2024-01-01,X,A,ADM001,STU001,50000,Father Name,9876543210,Mother Name,9876543211,123 Main Street,2010-05-15,Hindu,General,,Mole on left arm,\n\nTEACHER TEMPLATE\n${teacherHeaders}\nJane Teacher,jane@example.com,9876543212,password123,teacher,Female,2024-01-01,"Math,Science",50000,X,A`;

        const blob = new Blob([templateContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Handle Excel upload
    async function handleExcelUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Check if SheetJS is loaded
        if (typeof XLSX === 'undefined') {
            // Load SheetJS dynamically
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => processExcelFile(file);
            document.head.appendChild(script);
        } else {
            processExcelFile(file);
        }
    }

    function excelDateToISO(value) {
        if (!value) return null;
        // Case 1: Excel serial number
        if (typeof value === 'number') {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const date = new Date(excelEpoch.getTime() + value * 86400000);
            return date.toISOString();
        }

        // Case 2: dd-mm-yy OR dd-mm-yyyy string OR yyyy-mm-dd
        if (typeof value === 'string') {
            const parts = value.split(/[-/]/);
            if (parts.length === 3) {
                let dd, mm, yy;
                if (parts[0].length === 4) {
                    // yyyy-mm-dd
                    [yy, mm, dd] = parts;
                } else {
                    // dd-mm-yy
                    [dd, mm, yy] = parts;
                    // Convert 2-digit year → 4-digit year
                    if (yy.length === 2) {
                        yy = Number(yy) > 30 ? `19${yy}` : `20${yy}`;
                    }
                }

                const date = new Date(Date.UTC(yy, mm - 1, dd));
                return date.toISOString();
            }
        }

        // Case 3: JS Date object
        if (value instanceof Date) {
            return value.toISOString();
        }

        return null;
    }


    async function processExcelFile(file) {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                alert('No data found in the Excel file');
                return;
            }

            // Confirm import
            if (!confirm(`Found ${jsonData.length} rows. Proceed with import?`)) return;

            // Send to backend
            const transformedUsers = jsonData.map(row => ({
                ...row,
                dateOfBirth: excelDateToISO(row.dateOfBirth),
                joinDate: excelDateToISO(row.joinDate)
            }));

            const response = await fetch('/api/admin/users/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ users: transformedUsers })
            });

            const result = await response.json();

            if (result.success) {
                let msg = `Import Complete!\n✅ ${result.results.success} users added\n❌ ${result.results.failed} failed`;
                if (result.results.errors.length > 0) {
                    msg += '\n\nErrors:\n' + result.results.errors.slice(0, 5).map(e => `Row ${e.row}: ${e.error}`).join('\n');
                    if (result.results.errors.length > 5) msg += `\n... and ${result.results.errors.length - 5} more`;
                }
                alert(msg);
                fetchAllUsers();
            } else {
                alert('Import failed: ' + result.message);
            }
        } catch (error) {
            alert('Error processing file: ' + error.message);
        }

        // Reset file input
        document.getElementById('excel-file-input').value = '';
        document.getElementById('excel-format-note').style.display = 'none';
    }
};
