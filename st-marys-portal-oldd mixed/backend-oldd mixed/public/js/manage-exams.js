// Get authentication token and user role
const token = localStorage.getItem('auth_token');
const userRole = localStorage.getItem('user_role');
const userId = localStorage.getItem('user_id'); 

// Initialize global variables
let currentExamId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    if (token) {
        try {
            const { exp } = JSON.parse(atob(token.split('.')[1]));
            if (Date.now() / 1000 > exp) {
                alert("Session expired! Please log in again.");
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                localStorage.removeItem('user_name');
                localStorage.removeItem('user_role');
                window.location.href = "/login.html";
                return;
            }
        } catch (e) {
            // If token is malformed, treat as invalid
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_role');
            window.location.href = "/login.html";
            return;
        }
    }

    if (!token) {
        showAlert('Please log in to continue', 'error');
        window.location.href = '/login.html';
        return;
    } else if (userRole !== 'admin' && userRole !== 'teacher') {
        showAlert('Access denied. Only admins and teachers can manage exams.', 'error');
        window.location.href = '/dashboard.html';
        return;
    }
    
    loadClassSectionGrid();
    setupSubjectsSection();
    setupDateInputs();
    setupExamTypeOptions();
    await loadSubjects();
    addSubjectRow();
    await loadExamList();
    // Set academic year field if present
    const academicYearInput = document.getElementById('academicYear');
    if (academicYearInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        if (month >= 4) {
            academicYearInput.value = `${year}-${year + 1}`;
        } else {
            academicYearInput.value = `${year - 1}-${year}`;
        }
    }
});

// Setup subjects section
function setupSubjectsSection() {
    const form = document.getElementById('exam-form');
    if (!form) return;

    // Remove any existing subjects sections first
    const existingSubjectsSections = form.querySelectorAll('.subjects-section');
    existingSubjectsSections.forEach(section => section.remove());

    // Create subjects section container
    const subjectsSection = document.createElement('div');
    subjectsSection.className = 'form-section subjects-section';
    subjectsSection.innerHTML = `
        <div class="section-header">
            <h3>Subjects</h3>
        </div>
        <div id="subjectsContainer" class="subjects-container">
            <!-- Subject rows will be added here -->
        </div>
        <button type="button" class="btn btn-primary mt-3" onclick="addSubjectRow()">
            <i class="fas fa-plus"></i> Add Subject
        </button>
    `;

    // Add some CSS for the subjects section
    const style = document.createElement('style');
    style.textContent = `
        .form-section {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .section-header {
            margin-bottom: 15px;
        }
        .subjects-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 15px;
        }
        .subject-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr auto;
            gap: 10px;
            align-items: center;
            padding: 10px;
            background-color: white;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .subject-row input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .subject-row button {
            padding: 8px;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);

    // Find the dates section and insert subjects section after it
    const datesSection = form.querySelector('.dates-section') || form.lastElementChild;
    if (datesSection.nextSibling) {
        form.insertBefore(subjectsSection, datesSection.nextSibling);
    } else {
        form.appendChild(subjectsSection);
    }

    // Add initial subject row
    // addSubjectRow(); // This line is removed as per the edit hint
}

// Add a new subject row
function addSubjectRow(subject = null) {
    const container = document.getElementById('subjectsContainer');
    if (!container) return;

    // Build subject dropdown options
    let options = '';
    if (window.allSubjects && Array.isArray(window.allSubjects)) {
        options = window.allSubjects.map(subj => {
            const selected = subject && subject.name === subj.name ? 'selected' : '';
            return `<option value="${subj.name}" ${selected}>${subj.name}</option>`;
        }).join('');
    }

    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
        <select name="subjectName" class="form-control" required>
            <option value="">Select Subject</option>
            ${options}
        </select>
        <input type="number" name="maxMarks" class="form-control" placeholder="Max Marks" min="1" value="${subject ? subject.maxMarks : ''}" required>
        <input type="number" name="passingMarks" class="form-control" placeholder="Passing Marks" min="1" value="${subject ? subject.passingMarks : ''}" required>
        <button type="button" class="btn btn-danger" onclick="removeSubjectRow(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;

    // Add validation listeners
    const maxMarksInput = row.querySelector('input[name="maxMarks"]');
    const passingMarksInput = row.querySelector('input[name="passingMarks"]');

    maxMarksInput.addEventListener('change', () => {
        const maxMarks = parseInt(maxMarksInput.value) || 0;
        passingMarksInput.max = maxMarks;
        if (parseInt(passingMarksInput.value) > maxMarks) {
            passingMarksInput.value = maxMarks;
        }
    });

    container.appendChild(row);
}

// Remove a subject row
function removeSubjectRow(button) {
    const container = document.getElementById('subjectsContainer');
    const rows = container.getElementsByClassName('subject-row');
    if (rows.length > 1) {
        button.closest('.subject-row').remove();
    } else {
        showAlert('At least one subject is required', 'error');
    }
}

// Setup exam type options based on user role
function setupExamTypeOptions() {
    const examTypeSelect = document.getElementById('examType');
    if (!examTypeSelect) return;

    // Clear existing options
    examTypeSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Exam Type';
    examTypeSelect.appendChild(defaultOption);

    // Define exam types based on role
    const examTypes = userRole === 'admin' ? 
        [
            { value: 'unit_test', label: 'Unit Test' },
            { value: 'mid_term', label: 'Mid Term' },
            { value: 'final_term', label: 'Final Term' },
            { value: 'practical', label: 'Practical' }
        ] : 
        [
            { value: 'unit_test', label: 'Unit Test' },
            { value: 'practical', label: 'Practical' }
        ];

    // Add exam type options
    examTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.value;
        option.textContent = type.label;
        examTypeSelect.appendChild(option);
    });
}

// Add Select All / Clear All functionality for class-section grid
function setupClassSectionGridActions() {
    const selectAllBtn = document.getElementById('selectAllClassSections');
    const clearAllBtn = document.getElementById('clearAllClassSections');
    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            document.querySelectorAll('#classesContainer input[type="checkbox"]').forEach(cb => cb.checked = true);
        };
    }
    if (clearAllBtn) {
        clearAllBtn.onclick = () => {
            document.querySelectorAll('#classesContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
        };
    }
}

// Update loadClassSectionGrid to call setupClassSectionGridActions after rendering
async function loadClassSectionGrid() {
    try {
        const response = await fetch('/api/teacher/classes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch classes');
        const data = await response.json();
        const classes = data.classes;
        const classesContainer = document.getElementById('classesContainer');
        if (!classesContainer) return;
        classesContainer.innerHTML = '<div>Loading sections...</div>';

        // Fetch all sections for each class in parallel
        const sectionPromises = classes.map(cls =>
            fetch(`/api/teacher/sections/${cls}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(sections => ({ class: cls, sections }))
        );
        const classSections = await Promise.all(sectionPromises);

        // Build the grid
        let gridHtml = '<table class="class-section-grid"><thead><tr><th>Class</th><th>Sections</th></tr></thead><tbody>';
        classSections.forEach(cs => {
            gridHtml += `<tr><td>${cs.class}</td><td>`;
            if (cs.sections.length === 0) {
                gridHtml += '<span style="color:#888">No sections</span>';
            } else {
                cs.sections.forEach(section => {
                    const id = `cs_${cs.class}_${section}`;
                    gridHtml += `
                        <label style="margin-right:12px;">
                            <input type="checkbox" name="classSection" value="${cs.class}-${section}" id="${id}">
                            ${section}
                        </label>
                    `;
                });
            }
            gridHtml += '</td></tr>';
        });
        gridHtml += '</tbody></table>';
        classesContainer.innerHTML = gridHtml;
        setupClassSectionGridActions();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// Helper to get all selected class-section pairs
function getSelectedClassSections() {
    return Array.from(document.querySelectorAll('input[name="classSection"]:checked')).map(cb => cb.value);
}

// Load subjects for the school
async function loadSubjects() {
    try {
        const response = await fetch('/api/subjects/all', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch subjects');
        const subjectData = await response.json();
        // You can use subjectData to prefill subject rows or for validation
        window.allSubjects = subjectData;
    } catch (error) {
        // Fallback to default subjects
        window.allSubjects = [
            { name: 'Mathematics' }, { name: 'Science' }, { name: 'English' },
            { name: 'History' }, { name: 'Geography' }, { name: 'Hindi' },
            { name: 'Physics' }, { name: 'Chemistry' }, { name: 'Biology' },
            { name: 'Computer Science' }, { name: 'Physical Education' }
        ];
    }
}

// Setup date inputs with proper format and validation
function setupDateInputs() {
    const examDateInput = document.getElementById('examDate');
    if (examDateInput) {
        // Set min date as today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minDate = today.toISOString().split('T')[0];
        examDateInput.min = minDate;
    }
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.alert-container');
    container.innerHTML = '';
    container.appendChild(alertDiv);
    
    setTimeout(() => alertDiv.remove(), 5000);
}

// Update exam list rendering to show class-section pairs
async function loadExamList() {
    const container = document.getElementById('examListContainer');
    container.innerHTML = '<div>Loading exams...</div>';
    try {
        const response = await fetch('/api/exams', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch exams');
        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            container.innerHTML = '<div>No exams found.</div>';
            return;
        }
        let html = '<table class="exam-list-table"><thead><tr><th>Name</th><th>Type</th><th>Class-Section(s)</th><th>Start Date</th><th>End Date</th></tr></thead><tbody>';
        data.data.forEach(exam => {
            html += `<tr>
                <td>${exam.name}</td>
                <td>${exam.examType}</td>
                <td>${(exam.classSections || []).map(cs => `${cs.class}-${cs.section}`).join(', ')}</td>
                <td>${exam.startDate ? new Date(exam.startDate).toLocaleDateString() : ''}</td>
                <td>${exam.endDate ? new Date(exam.endDate).toLocaleDateString() : ''}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<div style="color:red;">Failed to load exams: ${error.message}</div>`;
    }
}

(function addExamListTableStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .exam-list-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .exam-list-table th, .exam-list-table td {
            padding: 10px 14px;
            text-align: left;
        }
        .exam-list-table th {
            background: #f5f7fa;
            font-weight: 600;
            border-bottom: 2px solid #e0e0e0;
        }
        .exam-list-table tr:nth-child(even) {
            background: #f9f9f9;
        }
        .exam-list-table tr:hover {
            background: #eaf4ff;
        }
        .exam-list-table td {
            border-bottom: 1px solid #f0f0f0;
        }
    `;
    document.head.appendChild(style);
})();

document.getElementById('examForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const selectedClassSections = getSelectedClassSections();
    if (selectedClassSections.length === 0) {
        showAlert('Please select at least one class and section', 'error');
        return;
    }
    // Build array of { class, section } objects
    const classSections = selectedClassSections.map(cs => {
        const [cls, sec] = cs.split('-');
        return { class: cls, section: sec };
    });
    const subjects = [];
    document.querySelectorAll('.subject-row').forEach(row => {
        const subjectName = row.querySelector('select[name="subjectName"]').value;
        const maxMarks = parseInt(row.querySelector('[name="maxMarks"]').value);
        const passingMarks = parseInt(row.querySelector('[name="passingMarks"]').value);
        if (subjectName && !isNaN(maxMarks) && !isNaN(passingMarks)) {
            subjects.push({
                name: subjectName,
                maxMarks: maxMarks,
                passingMarks: passingMarks
            });
        }
    });
    if (subjects.length === 0) {
        showAlert('Please add at least one subject', 'error');
        return;
    }
    // Auto-detect academic year (e.g., 2024-2025) based on current date
    let academicYear = formData.get('academicYear');
    if (!academicYear) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        if (month >= 4) {
            academicYear = `${year}-${year + 1}`;
        } else {
            academicYear = `${year - 1}-${year}`;
        }
        document.getElementById('academicYear').value = academicYear;
    }
    const examData = {
        name: formData.get('examName'),
        examType: formData.get('examType'),
        classSections: classSections,
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        subjects: subjects,
        createdBy: userId,
        academicYear: academicYear
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
        if (!response.ok) {
            throw new Error('Failed to create exam');
        }
        showAlert('Exam created successfully', 'success');
        e.target.reset();
        document.getElementById('subjectsContainer').innerHTML = '';
        document.querySelectorAll('input[name="classSection"]:checked').forEach(cb => cb.checked = false);
        addSubjectRow(); // Add a fresh subject row
        await loadExamList();
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to create exam: ' + error.message, 'error');
    }
});