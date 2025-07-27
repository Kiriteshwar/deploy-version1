// Get authentication token
const token = localStorage.getItem('auth_token');

// Check authentication
if (!token) {
    window.location.href = 'login.html';
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load user profile
    loadUserProfile();
    
    // Load initial data
    loadExams();

    // Setup event listeners
    setupEventListeners();

    // Attach Save All button event listener here (after DOM is loaded)
    const saveAllBtn = document.getElementById('save-all-btn');
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', saveAllMarks);
    }
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

// Load exams for the teacher
async function loadExams() {
    try {
        const response = await fetch('/api/exams', {
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
            // Store all exam data for later use
            window.allExams = data.data;
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load exams', 'error');
    }
}

// Load classes for selected exam
function loadClassesForExam(examId) {
            const classSelect = document.getElementById('class-select');
            const sectionSelect = document.getElementById('section-select');
            const subjectSelect = document.getElementById('subject-select');
            classSelect.innerHTML = '<option value="">Select Class</option>';
            sectionSelect.innerHTML = '<option value="">Select Section</option>';
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    if (!examId || !window.allExams) return;
    const exam = window.allExams.find(e => e._id === examId);
    if (!exam) return;
    currentExamData = exam;
    // Get unique classes
    const uniqueClasses = [...new Set((exam.classSections || []).map(cs => cs.class))];
    uniqueClasses.forEach(cls => {
            const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
            classSelect.appendChild(option);
    });
}

// Load sections for selected class
function loadSectionsForClass() {
    const classSelect = document.getElementById('class-select');
    const sectionSelect = document.getElementById('section-select');
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    if (!currentExamData || !classSelect.value) return;
    const sections = (currentExamData.classSections || [])
        .filter(cs => cs.class === classSelect.value)
        .map(cs => cs.section);
    const uniqueSections = [...new Set(sections)];
    uniqueSections.forEach(sec => {
        const option = document.createElement('option');
        option.value = sec;
        option.textContent = sec;
        sectionSelect.appendChild(option);
    });
}

// Load subjects for selected exam
function loadSubjectsForExam() {
    const subjectSelect = document.getElementById('subject-select');
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    if (!currentExamData) return;
    (currentExamData.subjects || []).forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.name;
        option.textContent = `${subject.name} (Max: ${subject.maxMarks})`;
        subjectSelect.appendChild(option);
            });
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

        // Use the same endpoint as attendance/mark-attendance
        const response = await fetch(`/api/teacher/students/${className}/${section}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch students');

        const students = await response.json();
            // Get existing results
            const resultsResponse = await fetch(`/api/results/exam/${examId}?class=${className}&section=${section}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const resultsData = await resultsResponse.json();
            const results = resultsData.success ? resultsData.data : [];

        displayStudents(students, results, subject);
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
        // Defensive check for result.student
        const result = results.find(r => r.student && r.student._id === student._id);
        const subjectResult = result?.subjects.find(s => s.name === subject);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.studentInfo && student.studentInfo.rollNumber ? student.studentInfo.rollNumber : 'N/A'}</td>
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
                <button class="save-btn" 
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
async function saveMarks(studentId, silent = false) {
    const examId = document.getElementById('exam-select').value;
    const subject = document.getElementById('subject-select').value;
    const marksInput = document.querySelector(`input[data-student-id="${studentId}"]`);
    const errorText = marksInput.nextElementSibling;
    const saveBtn = marksInput.parentElement.nextElementSibling.querySelector('.save-btn');
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

        // Find the subject object from the current exam
        const exam = window.allExams.find(e => e._id === examId);
        const subjectObj = exam.subjects.find(s => s.name === subject);

        if (!subjectObj) {
            throw new Error('Subject details not found');
        }

        const className = document.getElementById('class-select').value;
        const section = document.getElementById('section-select').value;

        const payload = {
            examId,
            studentId,
            class: className,
            section: section,
            marks: [{
                subjectId: subjectObj._id,
                subjectName: subjectObj.name,
                maxMarks: subjectObj.maxMarks,
                obtainedMarks: marks,
                passingMarks: subjectObj.passingMarks
            }]
        };

        const response = await fetch('/api/results/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            successText.style.display = 'inline';
            setTimeout(() => {
                successText.style.display = 'none';
            }, 3000);
            // No alert if silent
            if (!silent) showAlert('Marks saved!', 'success');
        } else {
            throw new Error(data.message || 'Failed to save marks');
        }
    } catch (error) {
        console.error('Error:', error);
        errorText.textContent = error.message;
        errorText.style.display = 'block';
        if (!silent) showAlert(error.message, 'error');
        throw error; // So Promise.all can catch
    } finally {
        saveBtn.disabled = false;
    }
}

// Save all marks for all students in the table
async function saveAllMarks() {
    const rows = document.querySelectorAll('#student-list-body tr');
    if (rows.length === 0) {
        showAlert('No students to save.', 'error');
        return;
    }

    let allValid = true;
    let savePromises = [];

    rows.forEach(row => {
        const marksInput = row.querySelector('.marks-input');
        const studentId = marksInput.getAttribute('data-student-id');
        const errorText = marksInput.nextElementSibling;
        const marks = parseInt(marksInput.value);
        const maxMarks = parseInt(marksInput.max);

        // Validate marks
        if (isNaN(marks) || marks < 0 || marks > maxMarks) {
            errorText.textContent = `Marks must be between 0 and ${maxMarks}`;
            errorText.style.display = 'block';
            allValid = false;
        } else {
            errorText.style.display = 'none';
            // Call saveMarks for each student, but don't await yet
            savePromises.push(saveMarks(studentId, true)); // true = silent (no alert)
        }
    });

    if (!allValid) {
        showAlert('Please fix errors before saving all.', 'error');
        return;
    }

    // Wait for all saves to finish
    try {
        await Promise.all(savePromises);
        showAlert('All marks saved successfully!', 'success');
    } catch (e) {
        showAlert('Some marks could not be saved.', 'error');
    }
}

// Setup event listeners for cascading dropdowns
function setupEventListeners() {
    const examSelect = document.getElementById('exam-select');
    if (examSelect) {
        examSelect.addEventListener('change', function() {
        loadClassesForExam(this.value);
        // Reset students and subjects
        document.getElementById('student-list-body').innerHTML = '';
        document.getElementById('student-table').style.display = 'none';
        document.getElementById('no-data').style.display = 'none';
    });
    }
    const classSelect = document.getElementById('class-select');
    if (classSelect) {
        classSelect.addEventListener('change', function() {
        loadSectionsForClass();
        // Reset students
        document.getElementById('student-list-body').innerHTML = '';
        document.getElementById('student-table').style.display = 'none';
        document.getElementById('no-data').style.display = 'none';
    });
    }
    const sectionSelect = document.getElementById('section-select');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', function() {
        loadSubjectsForExam();
        // Reset students
        document.getElementById('student-list-body').innerHTML = '';
        document.getElementById('student-table').style.display = 'none';
        document.getElementById('no-data').style.display = 'none';
    });
    }
    const subjectSelect = document.getElementById('subject-select');
    if (subjectSelect) {
        subjectSelect.addEventListener('change', function() {
        loadStudents();
    });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
    });
    }

    // Change password
    const changePasswordBtn = document.getElementById('change-password');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Change password functionality coming soon!');
    });
    }

    // Update info
    const updateInfoBtn = document.getElementById('update-info');
    if (updateInfoBtn) {
        updateInfoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Update info functionality coming soon!');
    });
    }

    // Upload photo
    const uploadPhotoBtn = document.getElementById('upload-photo');
    if (uploadPhotoBtn) {
        uploadPhotoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Upload photo functionality coming soon!');
    });
    }
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