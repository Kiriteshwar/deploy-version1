// Global variables
let token;

document.addEventListener('DOMContentLoaded', function() {
    // Get token from localStorage
    token = localStorage.getItem('auth_token');
    
    // Check if token exists
    if (!token) {
        // Redirect to login page if no token
        window.location.href = 'login.html';
        return;
    }
    
    // Verify token validity
    fetch('/api/auth/verify', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Token invalid or expired');
        }
        return response.json();
    })
    .then(data => {
        if (!data.valid) {
            throw new Error('Token validation failed');
        }
        
        // Check if user is admin
        if (data.role !== 'admin') {
            throw new Error('Unauthorized access');
        }
        
        // Initialize the page
        initializePage();
    })
    .catch(error => {
        console.error('Authentication error:', error);
        // Clear token and redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
    });
});

// Initialize the page after authentication
function initializePage() {
    // Load user profile
    loadUserProfile();
    
    // Initialize filters
    initializeFilters();
    
    // Add event listeners
    document.getElementById('exam-select').addEventListener('change', handleExamChange);
    document.getElementById('class-select').addEventListener('change', handleClassChange);
    document.getElementById('section-select').addEventListener('change', loadResults);
    document.getElementById('academic-year-select').addEventListener('change', loadResults);
    document.getElementById('status-select').addEventListener('change', loadResults);
    
    // Admin action buttons
    document.getElementById('declare-all-btn').addEventListener('click', handleDeclareAllResults);
    document.getElementById('export-results-btn').addEventListener('click', handleExportResults);
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        });
    }
}

// Check if user is authenticated and is admin
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Verify token and check role
    fetch('/api/auth/profile', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Not authorized');
        }
        return response.json();
    })
    .then(data => {
        // Check if user is admin
        if (data.role !== 'admin') {
            window.location.href = 'dashboard.html';
        }
    })
    .catch(error => {
        console.error('Auth error:', error);
        window.location.href = 'login.html';
    });
}

// Load user profile
function loadUserProfile() {
    // Check if token exists
    if (!token) {
        console.error('No authentication token found');
        showAlert('Authentication error. Please login again.', 'error');
        setTimeout(() => {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    fetch('/api/users/profile?' + new Date().getTime(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Update dropdown info if elements exist
        const dropdownName = document.getElementById('dropdown-name');
        if (dropdownName) dropdownName.textContent = data.name;
        
        const dropdownRole = document.getElementById('dropdown-role');
        if (dropdownRole) dropdownRole.textContent = data.role;
        
        const dropdownClass = document.getElementById('dropdown-class');
        if (dropdownClass) {
            dropdownClass.textContent = data.class || 'N/A';
        }
        
        const dropdownSection = document.getElementById('dropdown-section');
        if (dropdownSection) {
            dropdownSection.textContent = data.section || 'N/A';
        }
        
        // Set avatar if available
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar && data.avatar) {
            userAvatar.src = data.avatar;
        }
    })
    .catch(error => {
        console.error('Error loading profile:', error);
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading profile: ${error.message}`, 'error');
        }
    });
}

// Initialize filters
function initializeFilters() {
    // Check if token exists
    if (!token) {
        console.error('No authentication token found');
        showAlert('Authentication error. Please login again.', 'error');
        setTimeout(() => {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    // Load exams
    fetch('/api/exams?' + new Date().getTime(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(exams => {
        const examSelect = document.getElementById('exam-select');
        examSelect.innerHTML = '<option value="">Select Exam</option>';
        
        exams.forEach(exam => {
            const option = document.createElement('option');
            option.value = exam._id;
            option.textContent = exam.name;
            examSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error loading exams:', error);
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading exams: ${error.message}`, 'error');
        }
    });
    
    // Load classes
    fetch('/api/classes?' + new Date().getTime(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(classes => {
        const classSelect = document.getElementById('class-select');
        classSelect.innerHTML = '<option value="">Select Class</option>';
        
        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            classSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error loading classes:', error);
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading classes: ${error.message}`, 'error');
        }
    });
    
    // Load academic years
    fetch('/api/academic-years?' + new Date().getTime(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(years => {
        const yearSelect = document.getElementById('academic-year-select');
        yearSelect.innerHTML = '<option value="">Academic Year</option>';
        
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
        
        // Set current academic year as default
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}-${currentYear + 1}`;
        
        if (years.includes(academicYear)) {
            yearSelect.value = academicYear;
        }
        
        // Load initial results after filters are set up
        loadResults();
    })
    .catch(error => {
        console.error('Error loading academic years:', error);
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading academic years: ${error.message}`, 'error');
        }
    });
}

// Handle exam change
function handleExamChange() {
    const examId = document.getElementById('exam-select').value;
    
    if (examId) {
        loadResults();
        loadClassPerformance(examId);
    } else {
        // Clear class performance chart
        document.getElementById('performance-chart').innerHTML = `
            <div class="chart-placeholder">
                <i class="fas fa-chart-bar"></i>
                <p>Select an exam to view class performance</p>
            </div>
        `;
    }
}

// Handle class change
function handleClassChange() {
    const classValue = document.getElementById('class-select').value;
    
    if (!classValue) {
        const sectionSelect = document.getElementById('section-select');
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        sectionSelect.disabled = true;
        loadResults(); // Still load results with current filters
        return;
    }
    
    // Check if token exists
    if (!token) {
        console.error('No authentication token found');
        showAlert('Authentication error. Please login again.', 'error');
        setTimeout(() => {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    // Load sections for selected class
    const timestamp = new Date().getTime();
    fetch(`/api/sections?class=${classValue}&_=${timestamp}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(sections => {
        const sectionSelect = document.getElementById('section-select');
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionSelect.appendChild(option);
        });
        
        sectionSelect.disabled = false;
        
        // Load results after sections are loaded
        loadResults();
    })
    .catch(error => {
        console.error('Error loading sections:', error);
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading sections: ${error.message}`, 'error');
            loadResults(); // Still try to load results with current filters
        }
    });
}

// Load results
function loadResults() {
    const examId = document.getElementById('exam-select').value;
    const classValue = document.getElementById('class-select').value;
    const section = document.getElementById('section-select').value;
    const academicYear = document.getElementById('academic-year-select').value;
    const status = document.getElementById('status-select').value;
    
    // Show loading spinner and hide other elements
    document.getElementById('loading-spinner').style.display = 'flex';
    document.getElementById('no-data').style.display = 'none';
    document.getElementById('results-table').style.display = 'none';
    
    // Get token from global variable
    if (!token) {
        console.error('No authentication token found');
        showAlert('Authentication error. Please login again.', 'error');
        setTimeout(() => {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    let url = '/api/results/admin';
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (examId) params.append('examId', examId);
    if (classValue) params.append('class', classValue);
    if (section) params.append('section', section);
    if (academicYear) params.append('academicYear', academicYear);
    if (status) params.append('status', status);
    
    // Add cache prevention parameter
    params.append('_', new Date().getTime());
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Hide loading spinner
        document.getElementById('loading-spinner').style.display = 'none';
        
        if (!data.results || data.results.length === 0) {
            document.getElementById('no-data').style.display = 'flex';
            document.getElementById('results-table').style.display = 'none';
            return;
        }
        
        // Update school statistics
        updateSchoolStatistics(data.stats);
        
        // Display results in table
        displayResults(data.results);
        
        document.getElementById('results-table').style.display = 'table';
    })
    .catch(error => {
        console.error('Error loading results:', error);
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('no-data').style.display = 'flex';
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading results: ${error.message}`, 'error');
        }
    });
}

// Update school statistics
function updateSchoolStatistics(stats) {
    if (!stats) return;
    
    document.getElementById('total-students').textContent = stats.totalStudents || 0;
    document.getElementById('school-average').textContent = stats.averagePercentage ? `${stats.averagePercentage.toFixed(2)}%` : '0%';
    document.getElementById('highest-score').textContent = stats.highestPercentage ? `${stats.highestPercentage.toFixed(2)}%` : '0%';
    document.getElementById('pass-percentage').textContent = stats.passPercentage ? `${stats.passPercentage.toFixed(2)}%` : '0%';
}

// Display results in table
function displayResults(results) {
    const tableBody = document.getElementById('results-table-body');
    tableBody.innerHTML = '';
    
    // Group results by class and exam
    const groupedResults = {};
    
    results.forEach(result => {
        const key = `${result.class}-${result.section}-${result.exam._id}`;
        
        if (!groupedResults[key]) {
            groupedResults[key] = {
                class: result.class,
                section: result.section,
                exam: result.exam,
                students: [],
                totalPercentage: 0,
                isDeclared: result.declaredBy !== null
            };
        }
        
        groupedResults[key].students.push(result);
        groupedResults[key].totalPercentage += result.percentage;
    });
    
    // Calculate average percentage for each group
    Object.values(groupedResults).forEach(group => {
        group.averagePercentage = group.totalPercentage / group.students.length;
        
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${group.class}-${group.section}</td>
            <td>${group.exam.name}</td>
            <td>${group.students.length}</td>
            <td>${group.averagePercentage.toFixed(2)}%</td>
            <td>
                <span class="status-badge ${group.isDeclared ? 'status-declared' : 'status-pending'}">
                    ${group.isDeclared ? 'Declared' : 'Pending'}
                </span>
            </td>
            <td>
                <button class="action-btn view-btn" data-class="${group.class}" data-section="${group.section}" data-exam="${group.exam._id}">
                    <i class="fas fa-eye"></i>
                </button>
                ${!group.isDeclared ? `
                    <button class="action-btn declare-btn" data-class="${group.class}" data-section="${group.section}" data-exam="${group.exam._id}">
                        <i class="fas fa-bullhorn"></i>
                    </button>
                ` : ''}
                <button class="action-btn export-btn" data-class="${group.class}" data-section="${group.section}" data-exam="${group.exam._id}">
                    <i class="fas fa-file-export"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to action buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const classValue = btn.dataset.class;
            const section = btn.dataset.section;
            const examId = btn.dataset.exam;
            
            viewClassResults(classValue, section, examId);
        });
    });
    
    document.querySelectorAll('.declare-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const classValue = btn.dataset.class;
            const section = btn.dataset.section;
            const examId = btn.dataset.exam;
            
            declareClassResults(classValue, section, examId);
        });
    });
    
    document.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const classValue = btn.dataset.class;
            const section = btn.dataset.section;
            const examId = btn.dataset.exam;
            
            exportClassResults(classValue, section, examId);
        });
    });
}

// Load class performance for a specific exam
function loadClassPerformance(examId) {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // Validate token
    if (!token) {
        console.error('No authentication token found');
        showAlert('Authentication error. Please login again.', 'error');
        setTimeout(() => {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    // Add cache prevention parameter
    const cacheBuster = new Date().getTime();
    
    fetch(`/api/results/performance/${examId}?_=${cacheBuster}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please login again.');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data || !data.classPerformance || data.classPerformance.length === 0) {
            document.getElementById('performance-chart').innerHTML = `
                <div class="chart-placeholder">
                    <i class="fas fa-chart-bar"></i>
                    <p>No performance data available for this exam</p>
                </div>
            `;
            return;
        }
        
        // Render class performance chart
        renderClassPerformanceChart(data.classPerformance);
    })
    .catch(error => {
        console.error('Error loading class performance:', error);
        document.getElementById('performance-chart').innerHTML = `
            <div class="chart-placeholder">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading performance data</p>
            </div>
        `;
        
        if (error.message.includes('Authentication failed')) {
            showAlert(error.message, 'error');
            setTimeout(() => {
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(`Error loading class performance: ${error.message}`, 'error');
        }
    });
}

// Render class performance chart
function renderClassPerformanceChart(classPerformance) {
    const chartContainer = document.getElementById('performance-chart');
    chartContainer.innerHTML = '';
    
    // Sort classes by average percentage
    classPerformance.sort((a, b) => b.averagePercentage - a.averagePercentage);
    
    // Create chart bars
    classPerformance.forEach(cls => {
        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar-container';
        
        const label = document.createElement('div');
        label.className = 'chart-label';
        label.textContent = `${cls.class}-${cls.section}`;
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'chart-bar-wrapper';
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.width = `${cls.averagePercentage}%`;
        
        const value = document.createElement('div');
        value.className = 'chart-value';
        value.textContent = `${cls.averagePercentage.toFixed(2)}%`;
        
        barWrapper.appendChild(bar);
        barContainer.appendChild(label);
        barContainer.appendChild(barWrapper);
        barContainer.appendChild(value);
        
        chartContainer.appendChild(barContainer);
    });
}

// View class results
function viewClassResults(classValue, section, examId) {
    // Redirect to teacher-results page with class, section, and exam parameters
    window.location.href = `teacher-results.html?class=${classValue}&section=${section}&exam=${examId}`;
}

// Declare class results
function declareClassResults(classValue, section, examId) {
    if (!confirm(`Are you sure you want to declare results for Class ${classValue}-${section}?`)) {
        return;
    }
    
    const token = localStorage.getItem('token');
    
    fetch(`/api/results/declare/${examId}?class=${classValue}&section=${section}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        showAlert(data.message || 'Results declared successfully', 'success');
        loadResults();
    })
    .catch(error => {
        console.error('Error declaring results:', error);
        showAlert('Error declaring results', 'error');
    });
}

// Export class results
function exportClassResults(classValue, section, examId) {
    const token = localStorage.getItem('token');
    const academicYear = document.getElementById('academic-year-select').value;
    
    let url = `/api/results/export?class=${classValue}&exam=${examId}`;
    
    if (section) {
        url += `&section=${section}`;
    }
    
    if (academicYear) {
        url += `&academicYear=${academicYear}`;
    }
    
    // Create a hidden form to submit the request
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = url;
    form.target = '_blank';
    
    // Add token to headers
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token';
    tokenInput.value = token;
    form.appendChild(tokenInput);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

// Handle declare all results
function handleDeclareAllResults() {
    const examId = document.getElementById('exam-select').value;
    
    if (!examId) {
        showAlert('Please select an exam', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to declare ALL results for this exam? This action cannot be undone.')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    
    fetch(`/api/results/declare/${examId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        showAlert(data.message || 'All results declared successfully', 'success');
        loadResults();
    })
    .catch(error => {
        console.error('Error declaring results:', error);
        showAlert('Error declaring all results', 'error');
    });
}

// Handle export results
function handleExportResults() {
    const examId = document.getElementById('exam-select').value;
    const classValue = document.getElementById('class-select').value;
    const section = document.getElementById('section-select').value;
    const academicYear = document.getElementById('academic-year-select').value;
    
    if (!examId && !classValue) {
        showAlert('Please select at least an exam or class', 'error');
        return;
    }
    
    const token = localStorage.getItem('token');
    let url = '/api/results/export';
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (examId) params.append('exam', examId);
    if (classValue) params.append('class', classValue);
    if (section) params.append('section', section);
    if (academicYear) params.append('academicYear', academicYear);
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    // Create a hidden form to submit the request
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = url;
    form.target = '_blank';
    
    // Add token to headers
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token';
    tokenInput.value = token;
    form.appendChild(tokenInput);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

// Show alert
function showAlert(message, type = 'info') {
    const alertContainer = document.querySelector('.alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.appendChild(alert);
    
    // Remove alert after 3 seconds
    setTimeout(() => {
        alert.classList.add('fade-out');
        setTimeout(() => {
            alertContainer.removeChild(alert);
        }, 500);
    }, 3000);
}