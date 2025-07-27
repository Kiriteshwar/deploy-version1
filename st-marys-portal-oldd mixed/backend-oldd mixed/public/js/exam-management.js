// Get authentication token and user role
const token = localStorage.getItem('auth_token');
const userRole = localStorage.getItem('user_role');

// Check authentication
if (!token) {
    window.location.href = 'login.html';
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load user profile
    loadUserProfile();
    
    // Setup tabs based on user role
    setupTabs();

    // Load initial data
    loadInitialData();

    // Setup event listeners
    setupEventListeners();
});

// Load user profile
async function loadUserProfile() {
    try {
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            // Update profile information
            document.getElementById('dropdown-name').textContent = data.name || 'N/A';
            document.getElementById('dropdown-role').textContent = data.role || 'N/A';
            
            if (data.roleData) {
                document.getElementById('dropdown-class').textContent = data.roleData.classTeacherOf || 'N/A';
                document.getElementById('dropdown-section').textContent = data.roleData.subjects?.join(', ') || 'N/A';
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showAlert('Failed to load profile', 'error');
    }
}

// Setup tabs based on user role
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Show/hide tabs based on user role
    if (userRole === 'admin') {
        document.querySelector('[data-tab="manage"]').style.display = 'block';
        document.querySelector('[data-tab="stats"]').style.display = 'block';
        document.querySelector('[data-tab="grade"]').style.display = 'none';
    } else if (userRole === 'teacher') {
        document.querySelector('[data-tab="manage"]').style.display = 'none';
        document.querySelector('[data-tab="grade"]').style.display = 'block';
        document.querySelector('[data-tab="stats"]').style.display = 'block';
        // Switch to grade tab for teachers
        switchTab('grade');
    }

    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            switchTab(tab);
        });
    });
}

// Switch between tabs
function switchTab(tab) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });

    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
    });

    // Load tab-specific data
    if (tab === 'manage') {
        loadAllExams();
    } else if (tab === 'grade') {
        loadTeacherExams();
    } else if (tab === 'stats') {
        loadExamsForStats();
    }
}

// Load initial data based on user role
function loadInitialData() {
    if (userRole === 'admin') {
        loadAllExams();
        setupExamForm();
    } else if (userRole === 'teacher') {
        loadTeacherExams();
    }
}

// Load all exams (Admin view)
async function loadAllExams() {
    try {
        const response = await fetch('/api/exams', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();

        if (data.success) {
            displayExams(data.data);
        } else {
            showAlert('Error loading exams', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load exams', 'error');
    }
}

// Display exams in table
function displayExams(exams) {
    const tableBody = document.getElementById('exam-table-body');
    tableBody.innerHTML = '';

    exams.forEach(exam => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${exam.name}</td>
            <td>${exam.examType}</td>
            <td>${exam.class}-${exam.section}</td>
            <td>${new Date(exam.startDate).toLocaleDateString()} - ${new Date(exam.endDate).toLocaleDateString()}</td>
            <td>${exam.resultDeclared ? 'Declared' : 'Pending'}</td>
            <td>
                ${userRole === 'admin' ? `
                    <button onclick="editExam('${exam._id}')" class="btn btn-primary">Edit</button>
                    <button onclick="deleteExam('${exam._id}')" class="btn btn-danger">Delete</button>
                    ${!exam.resultDeclared ? `
                        <button onclick="declareResult('${exam._id}')" class="btn btn-success">Declare Result</button>
                    ` : ''}
                ` : ''}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Setup exam form (Admin only)
function setupExamForm() {
    const form = document.getElementById('exam-form');
    if (!form) return;

    // Load classes and sections
    loadClassesAndSections();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const examData = {
            name: formData.get('name'),
            examType: formData.get('examType'),
            class: formData.get('class'),
            section: formData.get('section'),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            subjects: getSubjectsFromForm()
        };

        try {
            const response = await fetch('/api/exams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(examData)
            });

            const data = await response.json();
            if (data.success) {
                showAlert('Exam created successfully', 'success');
                form.reset();
                loadAllExams();
            } else {
                showAlert(data.message || 'Failed to create exam', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Failed to create exam', 'error');
        }
    });
}

// Load classes and sections for the form
async function loadClassesAndSections() {
    try {
        const response = await fetch('/api/classes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            const classSelect = document.getElementById('class');
            const sectionSelect = document.getElementById('section');

            // Populate class dropdown
            data.data.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.class;
                option.textContent = cls.class;
                classSelect.appendChild(option);
            });

            // Update sections when class changes
            classSelect.addEventListener('change', () => {
                const selectedClass = data.data.find(c => c.class === classSelect.value);
                sectionSelect.innerHTML = '<option value="">Select Section</option>';
                
                if (selectedClass) {
                    selectedClass.sections.forEach(section => {
                        const option = document.createElement('option');
                        option.value = section;
                        option.textContent = section;
                        sectionSelect.appendChild(option);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load classes', 'error');
    }
}

// Get subjects from form
function getSubjectsFromForm() {
    const subjectRows = document.querySelectorAll('.subject-row');
    return Array.from(subjectRows).map(row => ({
        name: row.querySelector('[name="subject-name"]').value,
        maxMarks: parseInt(row.querySelector('[name="max-marks"]').value),
        passingMarks: parseInt(row.querySelector('[name="passing-marks"]').value)
    }));
}

// Edit exam
async function editExam(examId) {
    try {
        const response = await fetch(`/api/exams/${examId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();

        if (data.success) {
            const form = document.getElementById('exam-form');
            form.name.value = data.data.name;
            form.examType.value = data.data.examType;
            form.class.value = data.data.class;
            form.section.value = data.data.section;
            form.startDate.value = data.data.startDate.split('T')[0];
            form.endDate.value = data.data.endDate.split('T')[0];

            // Update subjects
            const container = document.getElementById('subjects-container');
            container.innerHTML = '';
            data.data.subjects.forEach(subject => {
                const row = document.createElement('div');
                row.className = 'subject-row';
                row.innerHTML = `
                    <input type="text" name="subject-name" class="form-control" value="${subject.name}" required>
                    <input type="number" name="max-marks" class="form-control" value="${subject.maxMarks}" required>
                    <input type="number" name="passing-marks" class="form-control" value="${subject.passingMarks}" required>
                    <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">Remove</button>
                `;
                container.appendChild(row);
            });

            // Scroll to form
            form.scrollIntoView({ behavior: 'smooth' });
        } else {
            showAlert('Error loading exam details', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load exam details', 'error');
    }
}

// Delete exam
async function deleteExam(examId) {
    if (!confirm('Are you sure you want to delete this exam?')) return;

    try {
        const response = await fetch(`/api/exams/${examId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            showAlert('Exam deleted successfully', 'success');
            loadAllExams();
        } else {
            showAlert(data.message || 'Failed to delete exam', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to delete exam', 'error');
    }
}

// Declare result
async function declareResult(examId) {
    if (!confirm('Are you sure you want to declare the results? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/results/declare/${examId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            showAlert('Results declared successfully', 'success');
            loadAllExams();
        } else {
            showAlert(data.message || 'Failed to declare results', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to declare results', 'error');
    }
}

// Load teacher's exams
async function loadTeacherExams() {
    try {
        const response = await fetch('/api/exams/teacher', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            const examSelect = document.getElementById('exam-select');
            examSelect.innerHTML = '<option value="">Select Exam</option>';
            
            data.data.forEach(exam => {
                const option = document.createElement('option');
                option.value = exam._id;
                option.textContent = `${exam.name} (${exam.examType})`;
                examSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load exams', 'error');
    }
}

// Load classes for selected exam
async function loadClasses(examId) {
    try {
        const response = await fetch(`/api/exams/${examId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            const classSelect = document.getElementById('class-select');
            const sectionSelect = document.getElementById('section-select');
            const subjectSelect = document.getElementById('subject-select');
            
            // Reset dropdowns
            classSelect.innerHTML = '<option value="">Select Class</option>';
            sectionSelect.innerHTML = '<option value="">Select Section</option>';
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            
            // Add class option
            const option = document.createElement('option');
            option.value = data.data.class;
            option.textContent = data.data.class;
            classSelect.appendChild(option);
            
            // Add section option
            const sectionOption = document.createElement('option');
            sectionOption.value = data.data.section;
            sectionOption.textContent = data.data.section;
            sectionSelect.appendChild(sectionOption);
            
            // Add subject options
            data.data.subjects.forEach(subject => {
                const subjectOption = document.createElement('option');
                subjectOption.value = subject.name;
                subjectOption.textContent = `${subject.name} (Max: ${subject.maxMarks})`;
                subjectSelect.appendChild(subjectOption);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load class details', 'error');
    }
}

// Load students for selected class and section
async function loadStudents() {
    const examId = document.getElementById('exam-select').value;
    const className = document.getElementById('class-select').value;
    const section = document.getElementById('section-select').value;
    const subject = document.getElementById('subject-select').value;

    if (!examId || !className || !section || !subject) {
        return;
    }

    try {
        // Show loading spinner
        document.getElementById('loading-spinner').style.display = 'flex';
        document.getElementById('student-table').style.display = 'none';
        document.getElementById('no-data').style.display = 'none';

        const response = await fetch(`/api/students/class/${className}/${section}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            // Get existing results
            const resultsResponse = await fetch(`/api/results/exam/${examId}?class=${className}&section=${section}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const resultsData = await resultsResponse.json();
            const results = resultsData.success ? resultsData.data : [];

            displayStudents(data.data, results, subject);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load students', 'error');
    } finally {
        document.getElementById('loading-spinner').style.display = 'none';
    }
}

// Display students in table
function displayStudents(students, results, subject) {
    const tableBody = document.getElementById('student-list-body');
    const table = document.getElementById('student-table');
    const noData = document.getElementById('no-data');

    if (!students || students.length === 0) {
        table.style.display = 'none';
        noData.style.display = 'block';
        noData.innerHTML = '<p>No students found in this class</p>';
        return;
    }

    tableBody.innerHTML = '';
    students.forEach(student => {
        const result = results.find(r => r.student._id === student._id);
        const subjectResult = result?.subjects.find(s => s.name === subject);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.rollNumber || 'N/A'}</td>
            <td>${student.name}</td>
            <td>
                <input type="number" 
                       class="marks-input" 
                       data-student-id="${student._id}"
                       value="${subjectResult ? subjectResult.obtainedMarks : ''}"
                       min="0"
                       max="${getMaxMarks()}"
                       ${result?.exam.resultDeclared ? 'disabled' : ''}>
                <div class="error-text" style="display: none;"></div>
            </td>
            <td>
                <button class="btn btn-success" 
                        onclick="saveMarks('${student._id}')"
                        ${result?.exam.resultDeclared ? 'disabled' : ''}>
                    Save
                </button>
                <span class="success-text" style="display: none;">Saved!</span>
            </td>
        `;
        tableBody.appendChild(row);
    });

    table.style.display = 'table';
    noData.style.display = 'none';
}

// Get max marks for selected subject
function getMaxMarks() {
    const subjectSelect = document.getElementById('subject-select');
    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const maxMarks = selectedOption.textContent.match(/Max: (\d+)/);
    return maxMarks ? maxMarks[1] : 100;
}

// Save marks for a student
async function saveMarks(studentId) {
    const examId = document.getElementById('exam-select').value;
    const subject = document.getElementById('subject-select').value;
    const marksInput = document.querySelector(`input[data-student-id="${studentId}"]`);
    const errorText = marksInput.nextElementSibling;
    const saveBtn = marksInput.parentElement.nextElementSibling.querySelector('.btn-success');
    const successText = saveBtn.nextElementSibling;

    const marks = parseInt(marksInput.value);
    const maxMarks = parseInt(marksInput.max);

    // Validate marks
    if (isNaN(marks)) {
        errorText.textContent = 'Please enter a valid number';
        errorText.style.display = 'block';
        return;
    }

    if (marks < 0 || marks > maxMarks) {
        errorText.textContent = `Marks must be between 0 and ${maxMarks}`;
        errorText.style.display = 'block';
        return;
    }

    try {
        saveBtn.disabled = true;
        errorText.style.display = 'none';

        const response = await fetch('/api/results/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                examId,
                studentId,
                subjects: [{
                    name: subject,
                    obtainedMarks: marks
                }]
            })
        });

        const data = await response.json();
        if (data.success) {
            successText.style.display = 'inline';
            setTimeout(() => {
                successText.style.display = 'none';
            }, 3000);
        } else {
            throw new Error(data.message || 'Failed to save marks');
        }
    } catch (error) {
        console.error('Error:', error);
        errorText.textContent = error.message;
        errorText.style.display = 'block';
    } finally {
        saveBtn.disabled = false;
    }
}

// Load exams for statistics
async function loadExamsForStats() {
    try {
        const response = await fetch('/api/exams', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success) {
            const examSelect = document.getElementById('stats-exam-select');
            examSelect.innerHTML = '<option value="">Select Exam</option>';
            
            data.data.filter(exam => exam.resultDeclared).forEach(exam => {
                const option = document.createElement('option');
                option.value = exam._id;
                option.textContent = `${exam.name} (${exam.examType})`;
                examSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load exams', 'error');
    }
}

// Load exam statistics
async function loadExamStats() {
    const examId = document.getElementById('stats-exam-select').value;
    const className = document.getElementById('stats-class-select').value;
    const section = document.getElementById('stats-section-select').value;

    if (!examId || !className || !section) {
        return;
    }

    try {
        const response = await fetch(`/api/results/class/${examId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                class: className,
                section: section
            })
        });

        const data = await response.json();
        if (data.success) {
            displayStats(data.data);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load statistics', 'error');
    }
}

// Display exam statistics
function displayStats(data) {
    // Update overview stats
    document.getElementById('total-students').textContent = data.statistics.totalStudents;
    document.getElementById('pass-percentage').textContent = `${data.statistics.passPercentage.toFixed(1)}%`;
    document.getElementById('class-average').textContent = `${data.results.reduce((sum, r) => sum + r.percentage, 0) / data.results.length}%`;
    document.getElementById('highest-score').textContent = `${Math.max(...data.results.map(r => r.percentage))}%`;

    // Update grade distribution
    const gradeBars = document.getElementById('grade-bars');
    const grades = ['A+', 'A', 'B', 'C', 'D', 'F'];
    const distribution = data.statistics.gradeDistribution;
    const maxCount = Math.max(...Object.values(distribution));

    gradeBars.innerHTML = grades.map(grade => `
        <div class="grade-bar">
            <div class="grade-label">${grade}</div>
            <div class="grade-progress">
                <div class="grade-fill" style="width: ${(distribution[grade] / maxCount) * 100}%"></div>
            </div>
            <div class="grade-value">${distribution[grade]}</div>
        </div>
    `).join('');

    // Update subject-wise stats
    const subjectStats = document.getElementById('subject-stats');
    const subjects = new Set(data.results.flatMap(r => r.subjects.map(s => s.name)));
    
    subjectStats.innerHTML = Array.from(subjects).map(subject => {
        const subjectResults = data.results.map(r => r.subjects.find(s => s.name === subject)?.obtainedMarks || 0);
        const average = subjectResults.reduce((a, b) => a + b, 0) / subjectResults.length;
        const highest = Math.max(...subjectResults);
        const passing = subjectResults.filter(marks => marks >= data.results[0].subjects.find(s => s.name === subject).passingMarks).length;
        const passPercentage = (passing / subjectResults.length) * 100;

        return `
            <div class="stats-grid">
                <h4>${subject}</h4>
                <div class="stat-item">
                    <div class="stat-value">${average.toFixed(1)}</div>
                    <div class="stat-label">Average Marks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${highest}</div>
                    <div class="stat-label">Highest Marks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${passPercentage.toFixed(1)}%</div>
                    <div class="stat-label">Pass Percentage</div>
                </div>
            </div>
        `;
    }).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Add subject button
    const addSubjectBtn = document.getElementById('add-subject-btn');
    if (addSubjectBtn) {
        addSubjectBtn.addEventListener('click', () => {
            const container = document.getElementById('subjects-container');
            const row = document.createElement('div');
            row.className = 'subject-row';
            row.innerHTML = `
                <input type="text" name="subject-name" class="form-control" placeholder="Subject Name" required>
                <input type="number" name="max-marks" class="form-control" placeholder="Max Marks" required>
                <input type="number" name="passing-marks" class="form-control" placeholder="Passing Marks" required>
                <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">Remove</button>
            `;
            container.appendChild(row);
        });
    }

    // Exam selection change for grading
    const examSelect = document.getElementById('exam-select');
    if (examSelect) {
        examSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadClasses(e.target.value);
            }
        });
    }

    // Class, section, or subject selection change for grading
    ['class-select', 'section-select', 'subject-select'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', loadStudents);
        }
    });

    // Stats filters change
    ['stats-exam-select', 'stats-class-select', 'stats-section-select'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', loadExamStats);
        }
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        window.location.href = 'login.html';
    });

    // Profile menu items
    ['change-password', 'update-info', 'upload-photo'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            e.preventDefault();
            alert('This functionality will be available soon!');
        });
    });
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = message;
    
    const container = document.querySelector('.alert-container');
    container.appendChild(alertDiv);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
} 