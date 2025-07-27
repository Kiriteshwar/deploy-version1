document.addEventListener('DOMContentLoaded', async () => {
    // Add CSS for overwrite mode
    const style = document.createElement('style');
    style.textContent = `
        .overwrite-mode {
            border: 2px solid #17a2b8;
            box-shadow: 0 0 10px rgba(23, 162, 184, 0.5);
        }
        #overwrite-notice {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 4px;
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
        }
        #overwriteButton {
            margin-right: 10px;
            background-color: #fd7e14;
            border-color: #fd7e14;
        }
        #overwriteButton:hover {
            background-color: #e67212;
            border-color: #e67212;
        }
    `;
    document.head.appendChild(style);

    // Initialize date picker with today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('datePicker').value = today;

    // Check authentication
    const token = localStorage.getItem('auth_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');

    if (!token || !userData || userData.role !== 'teacher') {
        showToast('Access denied. Please login as a teacher.', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    // Load teacher's data
    await loadTeacherData();

    // Event Listeners
    document.getElementById('classSelect').addEventListener('change', loadSections);
    document.getElementById('sectionSelect').addEventListener('change', loadStudents);
    document.getElementById('searchStudent').addEventListener('input', filterStudents);
    document.getElementById('markAllPresent').addEventListener('click', () => markAllStatus('Present'));
    document.getElementById('markAllAbsent').addEventListener('click', () => markAllStatus('Absent'));
    document.getElementById('markNoSession').addEventListener('click', () => markAllStatus('No Session'));
    document.getElementById('submitAttendance').addEventListener('click', () => submitAttendance());
    
    // Create overwrite button if it doesn't exist
    let overwriteButton = document.getElementById('overwriteButton');
    if (!overwriteButton) {
        const submitButton = document.getElementById('submitAttendance');
        if (submitButton) {
            overwriteButton = document.createElement('button');
            overwriteButton.id = 'overwriteButton';
            overwriteButton.className = 'btn btn-warning'; 
            overwriteButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Overwrite Existing';
            overwriteButton.addEventListener('click', () => submitAttendance(true));
            
            // Insert before submit button
            submitButton.parentNode.insertBefore(overwriteButton, submitButton);
        }
    }
});

async function loadTeacherData() {
    try {
        showLoading();
        
        // Fetch classes
        const classResponse = await fetch('/api/teacher/classes', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!classResponse.ok) {
            console.error('Server response:', await classResponse.text());
            throw new Error('Failed to fetch teacher data');
        }

        const classData = await classResponse.json();
        
        // Populate class select
        const classSelect = document.getElementById('classSelect');
        classSelect.innerHTML = '<option value="">Select Class</option>';
        classData.classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = `Class ${cls}`;
            classSelect.appendChild(option);
        });

        // Fetch subjects from subjects collection
        try {
            const subjectResponse = await fetch('/api/subjects/all', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!subjectResponse.ok) {
                throw new Error('Failed to fetch subjects from database');
            }
            
            const subjectData = await subjectResponse.json();

        // Populate subject select
        const subjectSelect = document.getElementById('subjectSelect');
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            
            // Check if subjectData is an array of objects with name property
            if (Array.isArray(subjectData)) {
                // Sort subjects alphabetically
                const sortedSubjects = subjectData.sort((a, b) => 
                    (a.name || '').localeCompare(b.name || '')
                );
                
                sortedSubjects.forEach(subject => {
                    if (subject && subject.name) {
                        const option = document.createElement('option');
                        option.value = subject.name;
                        option.textContent = subject.name;
                        subjectSelect.appendChild(option);
                    }
                });
                
                console.log('Subjects loaded from database:', sortedSubjects.map(s => s.name));
            } else {
                throw new Error('Invalid subject data format');
            }
        } catch (subjectError) {
            console.error('Error fetching subjects from database:', subjectError);
            
            // Fallback to subjects from teacher data if available
            if (classData.subjects && Array.isArray(classData.subjects)) {
                const subjectSelect = document.getElementById('subjectSelect');
                subjectSelect.innerHTML = '<option value="">Select Subject</option>';
                classData.subjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject;
                    option.textContent = subject;
                    subjectSelect.appendChild(option);
                });
                
                console.log('Using fallback subjects from teacher data');
            } else {
                // Last resort: use default subjects
                const defaultSubjects = [
                    'Mathematics', 'Science', 'English', 'History', 'Geography', 
                    'Hindi', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 
                    'Physical Education'
                ];
                
                const subjectSelect = document.getElementById('subjectSelect');
                subjectSelect.innerHTML = '<option value="">Select Subject</option>';
                defaultSubjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
                
                console.log('Using default subject list as fallback');
            }
        }

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadSections() {
    const classValue = document.getElementById('classSelect').value;
    if (!classValue) return;

    try {
        showLoading();
        const response = await fetch(`/api/teacher/sections/${classValue}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch sections');

        const sections = await response.json();
        const sectionSelect = document.getElementById('sectionSelect');
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionSelect.appendChild(option);
        });

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadStudents() {
    const classValue = document.getElementById('classSelect').value;
    const sectionValue = document.getElementById('sectionSelect').value;
    if (!classValue || !sectionValue) return;

    try {
        showLoading();
        const response = await fetch(`/api/teacher/students/${classValue}/${sectionValue}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch students');

        const students = await response.json();
        renderStudentTable(students);

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderStudentTable(students) {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';

    students.forEach(student => {
        const row = document.createElement('tr');
        row.dataset.studentId = student._id;

        row.innerHTML = `
            <td>${student.studentInfo.rollNumber}</td>
            <td>${student.name}</td>
            <td>
                <select class="status-select form-control">
                    <option value="">Select Status</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="No Session">No Session</option>
                </select>
            </td>
            <td>
                <input type="text" class="remarks-input form-control" placeholder="Add remarks">
            </td>
            <td>
                <button class="btn btn-sm btn-outline-success mark-present">P</button>
                <button class="btn btn-sm btn-outline-danger mark-absent">A</button>
                <button class="btn btn-sm btn-outline-secondary mark-no-session">N</button>
            </td>
        `;

        const presentBtn = row.querySelector('.mark-present');
        const absentBtn = row.querySelector('.mark-absent');
        const noSessionBtn = row.querySelector('.mark-no-session');
        const statusSelect = row.querySelector('.status-select');

        // Add event listeners for quick mark buttons
        presentBtn.addEventListener('click', () => {
            // Clear active class from all buttons in this row
            clearActiveButtonsInRow(row);
            // Add active class to present button
            presentBtn.classList.add('active');
            // Update select
            statusSelect.value = 'Present';
        });

        absentBtn.addEventListener('click', () => {
            // Clear active class from all buttons in this row
            clearActiveButtonsInRow(row);
            // Add active class to absent button
            absentBtn.classList.add('active');
            // Update select
            statusSelect.value = 'Absent';
        });

        noSessionBtn.addEventListener('click', () => {
            // Clear active class from all buttons in this row
            clearActiveButtonsInRow(row);
            // Add active class to no session button
            noSessionBtn.classList.add('active');
            // Update select
            statusSelect.value = 'No Session';
        });

        // Update button visuals when select changes
        statusSelect.addEventListener('change', () => {
            clearActiveButtonsInRow(row);
            const value = statusSelect.value;
            if (value === 'Present') {
                presentBtn.classList.add('active');
            } else if (value === 'Absent') {
                absentBtn.classList.add('active');
            } else if (value === 'No Session') {
                noSessionBtn.classList.add('active');
            }
        });

        tbody.appendChild(row);
    });
}

// Helper function to clear active class from buttons in a row
function clearActiveButtonsInRow(row) {
    const buttons = row.querySelectorAll('.btn');
    buttons.forEach(btn => btn.classList.remove('active'));
}

function markAllStatus(status) {
    document.querySelectorAll('.status-select').forEach(select => {
        select.value = status;
        
        // Update the buttons to show active state
        const row = select.closest('tr');
        clearActiveButtonsInRow(row);
        
        if (status === 'Present') {
            row.querySelector('.mark-present').classList.add('active');
        } else if (status === 'Absent') {
            row.querySelector('.mark-absent').classList.add('active');
        } else if (status === 'No Session') {
            row.querySelector('.mark-no-session').classList.add('active');
        }
    });
}

function filterStudents() {
    const searchText = document.getElementById('searchStudent').value.toLowerCase();
    const rows = document.querySelectorAll('#studentTableBody tr');

    rows.forEach(row => {
        const name = row.children[1].textContent.toLowerCase();
        const rollNo = row.children[0].textContent.toLowerCase();
        row.style.display = name.includes(searchText) || rollNo.includes(searchText) ? '' : 'none';
    });
}

async function checkExistingAttendance(formData) {
    try {
        // Encode each parameter individually
        const encodedDate = encodeURIComponent(formData.date);
        const encodedPeriod = encodeURIComponent(formData.period);
        const encodedClass = encodeURIComponent(formData.class);
        const encodedSection = encodeURIComponent(formData.section);
        const encodedSubject = encodeURIComponent(formData.subject);

        const url = `/api/attendance/check?date=${encodedDate}&period=${encodedPeriod}&class=${encodedClass}&section=${encodedSection}&subject=${encodedSubject}`;
        console.log('Checking attendance URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to check attendance');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error checking attendance:', error);
        throw error;
    }
}

// Custom confirmation dialog function
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';
        document.body.appendChild(overlay);
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'custom-confirm';
        dialog.innerHTML = `
            <div class="custom-confirm-title">Attendance Notice</div>
            <div class="custom-confirm-message">${message}</div>
            <div class="custom-confirm-buttons">
                <button class="custom-confirm-button custom-confirm-cancel">Cancel</button>
                <button class="custom-confirm-button custom-confirm-ok">OK</button>
            </div>
        `;
        document.body.appendChild(dialog);
        
        // Add event listeners
        const cancelButton = dialog.querySelector('.custom-confirm-cancel');
        const okButton = dialog.querySelector('.custom-confirm-ok');
        
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
            resolve(false);
        });
        
        okButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
            resolve(true);
        });
    });
}

async function submitAttendance(isOverwrite = false) {
    try {
        const classValue = document.getElementById('classSelect').value;
        const sectionValue = document.getElementById('sectionSelect').value;
        const subjectValue = document.getElementById('subjectSelect').value;
        const periodValue = document.getElementById('periodSelect').value;
        const dateValue = document.getElementById('datePicker').value;

        // Update error message if it exists
        const errorCard = document.querySelector('.alert-danger');
        if (errorCard) {
            const errorIcon = errorCard.querySelector('i') || document.createElement('i');
            errorIcon.className = 'fas fa-exclamation-circle';
            
            const errorMessage = document.createElement('div');
            errorMessage.innerHTML = 'Please mark status for all students or click the <strong>"Overwrite Existing"</strong> button';
            
            // Clear and update error card
            errorCard.innerHTML = '';
            errorCard.appendChild(errorIcon);
            errorCard.appendChild(document.createTextNode(' '));
            errorCard.appendChild(errorMessage);
        }

        // Update the UI to indicate if in overwrite mode
        const formContainer = document.querySelector('.card') || document.querySelector('form');
        if (formContainer) {
            if (isOverwrite) {
                formContainer.classList.add('overwrite-mode');
                // Add a notice at the top of the form
                let overwriteNotice = document.getElementById('overwrite-notice');
                if (!overwriteNotice) {
                    overwriteNotice = document.createElement('div');
                    overwriteNotice.id = 'overwrite-notice';
                    overwriteNotice.className = 'alert alert-info';
                    overwriteNotice.innerHTML = '<strong>Overwrite Mode</strong>: You only need to mark the students you want to update.';
                    formContainer.prepend(overwriteNotice);
                }
            } else {
                formContainer.classList.remove('overwrite-mode');
                const existingNotice = document.getElementById('overwrite-notice');
                if (existingNotice) {
                    existingNotice.remove();
                }
            }
        }

        if (!classValue || !sectionValue || !subjectValue || !periodValue || !dateValue) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        console.log(`Submitting attendance: class=${classValue}, section=${sectionValue}, subject=${subjectValue}, period=${periodValue}, date=${dateValue}, overwrite=${isOverwrite}`);
        
        showLoading();

        // Create array of attendance data for students with status
        const attendanceData = [];
        let allMarked = true;
        let anyMarked = false;

        // Process all students in the table
        document.querySelectorAll('#studentTableBody tr').forEach(row => {
            const status = row.querySelector('.status-select').value;
            if (!status) {
                allMarked = false;
                return;
            }

            anyMarked = true;
            const studentId = row.dataset.studentId;
            const studentName = row.querySelector('td:nth-child(2)').textContent;
            
            console.log(`Processing student: ${studentName}, ID=${studentId}, status=${status}`);
            
            attendanceData.push({
                student: studentId,
                status: status,
                remarks: row.querySelector('.remarks-input').value || '',
                subject: subjectValue,
                period: parseInt(periodValue),
                date: dateValue,
                class: classValue,
                section: sectionValue
            });
        });

        // When overwriting, we only need at least one student marked
        // When creating new records, we need all students marked
        if (isOverwrite) {
            console.log('Overwrite mode: Only requiring at least one student to be marked');
            if (!anyMarked) {
                showToast('Please mark status for at least one student', 'error');
                hideLoading();
                return;
            }
        } else {
            console.log('New attendance mode: Requiring all students to be marked');
            if (!allMarked) {
                showToast('Please mark status for all students or use the "Overwrite Existing" button', 'error');
                hideLoading();
                return;
            }
        }

        // Send the attendance data to the server with a direct overwrite flag if specified
        try {
            console.log(`Sending attendance data with overwrite=${isOverwrite}, student count=${attendanceData.length}`);
            
            // Add the current timestamp to prevent caching issues
            const timestamp = new Date().getTime();
            
            // Log the exact request being sent
            console.log('Sending request with payload:', {
                attendance: attendanceData,
                overwrite: isOverwrite
            });
            
            const response = await fetch(`/api/attendance/mark?t=${timestamp}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({ 
                    attendance: attendanceData, 
                    overwrite: isOverwrite 
                })
            });

            // Handle conflict response (HTTP 409) for attendance that needs to be overwritten
            if (response.status === 409) {
                const errorData = await response.json();
                console.log('Received conflict response:', errorData);
                
                if (errorData.conflictFound) {
                    hideLoading();
                    const confirmOverwrite = await showCustomConfirm(errorData.message + '\n\nDo you want to overwrite existing attendance records?');
                    
                    if (confirmOverwrite) {
                        console.log('User confirmed overwrite, resubmitting with overwrite=true');
                        // Important: Set isOverwrite to true explicitly to allow partial student marking
                        // Show a message to let the user know they're in overwrite mode
                        showToast('Now in overwrite mode. You only need to mark the students you want to update.', 'info');
                        await submitAttendance(true);
                    }
                    return;
                }
                
                throw new Error(errorData.message || 'Conflict in attendance data');
            }
            
            // Handle other error responses
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                
                try {
                    // Try to parse the error as JSON
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || 'Failed to submit attendance';
                    
                    // If there are specific errors, show the first one
                    if (errorData.errors && errorData.errors.length > 0) {
                        errorMessage = errorData.errors[0];
                    }
                } catch (parseError) {
                    // If parsing fails, use the raw text
                    errorMessage = errorText || 'Failed to submit attendance';
                }
                
                console.error('Server error response:', errorMessage);
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Attendance marked successfully:', data);
            
            // Show success message with record count
            let successMessage = 'Attendance marked successfully';
            if (data.records) {
                successMessage += ` for ${data.records} student${data.records !== 1 ? 's' : ''}`;
            }
            
            // Add warning count if any
            if (data.warnings && data.warnings.length > 0) {
                successMessage += ` (with ${data.warnings.length} warning${data.warnings.length !== 1 ? 's' : ''})`;
            }
            
            showToast(successMessage, 'success');
            
            // Reload page after a short delay to show the success message
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting attendance:', error);
            
            // Specific handling for the duplicate attendance error
            if (error.message.includes('Attendance already marked for')) {
                hideLoading();
                // Extract just the important part of the message
                const errorMsg = error.message.replace('Failed to mark attendance: ', '');
                const confirmOverwrite = await showCustomConfirm(errorMsg + '\n\nDo you want to overwrite?');
                
                if (confirmOverwrite) {
                    console.log('User confirmed overwrite for error case, resubmitting with overwrite=true');
                    // Important: Set isOverwrite to true explicitly to allow partial student marking
                    // Show a message to let the user know they're in overwrite mode
                    showToast('Now in overwrite mode. You only need to mark the students you want to update.', 'info');
                    await submitAttendance(true);
                    return;
                }
            } else {
                showToast(error.message, 'error');
            }
        }

    } catch (error) {
        console.error('General error in submitAttendance:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showLoading() {
    // Add loading indicator
    document.body.classList.add('loading');
}

function hideLoading() {
    // Remove loading indicator
    document.body.classList.remove('loading');
}

function showToast(message, type = 'info') {
    // Get the toast element
    const toast = document.getElementById('toast');
    if (!toast) {
        // Fallback to alert if toast element doesn't exist
        alert(message);
        return;
    }
    
    // Get the message span and icon
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    if (!toastMessage) {
        // Fallback to alert if toast message element doesn't exist
        alert(message);
        return;
    }
    
    // Set the message
    toastMessage.textContent = message;
    
    // Set title based on type
    let title = '';
    if (type === 'success') {
        title = 'Success';
    } else if (type === 'error') {
        title = 'Error';
    } else {
        title = 'Information';
    }
    
    // Update the toast content to include a title
    toastMessage.innerHTML = `<div class="toast-title">${title}</div><div class="toast-text">${message}</div>`;
    
    // Update classes based on type
    toast.className = 'toast active';
    toast.classList.add(type);
    
    if (toastIcon) {
        if (type === 'success') {
            toastIcon.className = 'toast-icon fas fa-check-circle';
        } else if (type === 'error') {
            toastIcon.className = 'toast-icon fas fa-exclamation-circle';
        } else {
            toastIcon.className = 'toast-icon fas fa-info-circle';
        }
    }
    
    // Show the toast
    toast.style.display = 'flex';
    
    // Hide the toast after 5 seconds
    setTimeout(() => {
        toast.style.display = 'none';
        toast.classList.remove('active');
    }, 5000);
} 