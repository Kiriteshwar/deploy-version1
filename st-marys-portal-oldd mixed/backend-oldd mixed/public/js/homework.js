document.addEventListener('DOMContentLoaded', async () => {
    // Initialize date picker with tomorrow's date as default expiry
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('expiryDate').value = tomorrow.toISOString().split('T')[0];

    // Check authentication
    const token = localStorage.getItem('auth_token');
    console.log('Token available:', !!token);
    
    if (!token) {
        showToast('Please log in to continue', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    try {
        // Load teacher's data
        await loadTeacherData();
    
        // Event Listeners
        document.getElementById('classSelect').addEventListener('change', loadSections);
        document.getElementById('homeworkForm').addEventListener('submit', submitHomework);
        await populateClassFilterDropdown();
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize: ' + error.message, 'error');
    }
});

async function loadTeacherData() {
    try {
        showLoading();
        console.log('Fetching teacher data...');
        
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/teacher/classes', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Teacher data response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`Failed to fetch teacher data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Received teacher data:', data);
        
        // Populate class select
        const classSelect = document.getElementById('classSelect');
        classSelect.innerHTML = '<option value="">Select Class</option>';
        
        if (data.classes && Array.isArray(data.classes)) {
            data.classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = `Class ${cls}`;
                classSelect.appendChild(option);
            });
        } else {
            console.error('Invalid classes data:', data);
            throw new Error('Invalid teacher data received');
        }

    } catch (error) {
        console.error('Error in loadTeacherData:', error);
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function loadSections() {
    const classValue = document.getElementById('classSelect').value;
    if (!classValue) return;

    try {
        showLoading();
        console.log('Fetching sections for class:', classValue);
        
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/teacher/sections/${classValue}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Sections response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`Failed to fetch sections: ${response.status} ${response.statusText}`);
        }

        const sections = await response.json();
        console.log('Received sections:', sections);
        
        const sectionSelect = document.getElementById('sectionSelect');
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        
        if (Array.isArray(sections)) {
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = section;
                sectionSelect.appendChild(option);
            });
        } else {
            console.error('Invalid sections data:', sections);
            throw new Error('Invalid sections data received');
        }

    } catch (error) {
        console.error('Error in loadSections:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function submitHomework(e) {
    e.preventDefault();
    
    // Show loading overlay
    showLoading();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Get class and section values
    const classValue = document.getElementById('classSelect').value;
    const sectionValue = document.getElementById('sectionSelect').value;
    
    if (!classValue || !sectionValue) {
        showToast('Please select both class and section', 'error');
        hideLoading();
        return;
    }
    
    // Instead of combining them, keep classId as just the class value
    // The server expects classId to be just the class name
    formData.set('classId', classValue);
    formData.set('section', sectionValue);
    
    // Handle the checkbox properly - if it's not checked, it won't be in the FormData
    const allowSubmissionCheckbox = document.getElementById('allowSubmission');
    if (allowSubmissionCheckbox) {
        formData.set('allowSubmission', allowSubmissionCheckbox.checked ? 'on' : 'off');
    }

    console.log('Submitting homework with class:', classValue, 'section:', sectionValue, 
                'allowSubmission:', formData.get('allowSubmission'));
    
    try {
        const token = localStorage.getItem('auth_token');
        console.log('Using token for submission:', !!token);
        
        // Log form data for debugging
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }
        
        const response = await fetch('/api/homework/create', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Homework submission response status:', response.status);
        
        const resultDiv = document.getElementById('result');
        resultDiv.className = ''; // Clear previous classes
        
        if (response.ok) {
            const data = await response.json();
            console.log('Homework created successfully:', data);
            
            showToast('Homework assigned successfully!', 'success');
            resultDiv.textContent = 'Homework assigned successfully!';
            resultDiv.classList.add('success');
            form.reset();
            
            // Reset date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('expiryDate').value = tomorrow.toISOString().split('T')[0];
            
            // Reset select options
            document.getElementById('classSelect').selectedIndex = 0;
            document.getElementById('sectionSelect').innerHTML = '<option value="">Select Section</option>';
        } else {
            let errorMessage = `Error ${response.status}: ${response.statusText}`;
            
            try {
                const data = await response.json();
                console.error('Error response:', data);
                errorMessage = data.message || errorMessage;
            } catch (jsonError) {
                console.error('Failed to parse error response', jsonError);
                const text = await response.text();
                console.error('Raw error response:', text);
            }
            
            showToast(errorMessage, 'error');
            resultDiv.textContent = 'Error: ' + errorMessage;
            resultDiv.classList.add('error');
        }
    } catch (error) {
        console.error('Error submitting homework:', error);
        const resultDiv = document.getElementById('result');
        resultDiv.textContent = 'Error: ' + error.message;
        resultDiv.className = 'error';
        showToast(error.message, 'error');
    } finally {
        // Hide loading overlay
        hideLoading();
    }
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    console.log(`Toast: ${type} - ${message}`);
    
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }
    
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    toastMessage.textContent = message;
    toast.className = 'toast active ' + type;
    
    if (type === 'success') {
        toastIcon.className = 'toast-icon fas fa-check-circle';
    } else if (type === 'error') {
        toastIcon.className = 'toast-icon fas fa-exclamation-circle';
    } else {
        toastIcon.className = 'toast-icon fas fa-info-circle';
    }
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// Add this function to fetch all classes for the filter dropdown
async function populateClassFilterDropdown() {
    const token = localStorage.getItem('auth_token');
    const classFilter = document.getElementById('filterClass');
    classFilter.innerHTML = '<option value="">All Classes</option>';
    try {
        const response = await fetch('/api/teacher/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch classes');
        const data = await response.json();
        if (data.classes && Array.isArray(data.classes)) {
            data.classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = `Class ${cls}`;
                classFilter.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error loading class filter:', err);
    }
}

// Update the function that renders the homework table in Manage Homework
// This should be called after both all classes and all homework are loaded
async function renderManageHomeworkTable() {
    const token = localStorage.getItem('auth_token');
    const classFilter = document.getElementById('filterClass');
    const sectionFilter = document.getElementById('filterSection');
    const statusFilter = document.getElementById('filterStatus');
    const tableBody = document.getElementById('homeworkTableBody');
    tableBody.innerHTML = '';

    // Fetch all classes
    let allClasses = [];
    try {
        const response = await fetch('/api/teacher/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            allClasses = data.classes || [];
        }
    } catch (err) {
        console.error('Error fetching all classes:', err);
    }

    // Fetch all homework
    let allHomework = [];
    try {
        const response = await fetch('/api/homework/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            allHomework = await response.json();
        }
    } catch (err) {
        console.error('Error fetching all homework:', err);
    }

    // Filter by selected class if needed
    let filteredClasses = allClasses;
    if (classFilter.value) {
        filteredClasses = filteredClasses.filter(cls => cls === classFilter.value);
    }

    // For each class, show homework or 'No submissions yet'
    filteredClasses.forEach(cls => {
        // Filter homework for this class and by section/status if needed
        let homeworkForClass = allHomework.filter(hw => hw.class === cls);
        if (sectionFilter.value) {
            homeworkForClass = homeworkForClass.filter(hw => hw.section === sectionFilter.value);
        }
        if (statusFilter.value && statusFilter.value !== 'All') {
            homeworkForClass = homeworkForClass.filter(hw => (hw.status || '').toLowerCase() === statusFilter.value.toLowerCase());
        }
        if (homeworkForClass.length === 0) {
            tableBody.innerHTML += `
                <tr>
                    <td colspan="7" style="text-align:center;color:#888;">No submissions yet for <b>${cls}</b></td>
                </tr>
            `;
        } else {
            homeworkForClass.forEach(hw => {
                // Render each homework row as before (reuse your existing code here)
                // Example:
                tableBody.innerHTML += `
                    <tr>
                        <td><input type="checkbox" data-id="${hw._id}"></td>
                        <td>${hw.title}</td>
                        <td>${hw.class}${hw.section ? '-' + hw.section : ''}</td>
                        <td>${new Date(hw.expiryDate).toLocaleDateString()}</td>
                        <td>${hw.status || ''}</td>
                        <td><a href="#" class="view-link">View</a></td>
                        <td><button class="btn btn-danger-outline">Delete</button></td>
                    </tr>
                `;
            });
        }
    });
}

// Call renderManageHomeworkTable() after loading the page or changing filters
document.getElementById('filterClass').addEventListener('change', renderManageHomeworkTable);
document.getElementById('filterSection').addEventListener('change', renderManageHomeworkTable);
document.getElementById('filterStatus').addEventListener('change', renderManageHomeworkTable);
document.addEventListener('DOMContentLoaded', renderManageHomeworkTable); 