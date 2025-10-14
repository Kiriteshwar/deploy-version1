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
        // Load teacher's data for Create New Homework section
        await loadTeacherData();
    
        // Event Listeners for Create New Homework
        document.getElementById('classSelect').addEventListener('change', loadSections);
        document.getElementById('homeworkForm').addEventListener('submit', submitHomework);
        
        // Initialize filter dropdowns for Manage Homework (when that tab becomes active)
        console.log('Homework page initialized successfully');
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
        
        // Populate class select for Create New Homework
        const classSelect = document.getElementById('classSelect');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Select Class</option>';
            
            if (data.classes && Array.isArray(data.classes)) {
                // Sort classes naturally (1, 2, 10 instead of 1, 10, 2)
                const sortedClasses = data.classes.sort((a, b) => {
                    const aNum = parseInt(a.match(/\d+/)?.[0] || a);
                    const bNum = parseInt(b.match(/\d+/)?.[0] || b);
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return aNum - bNum;
                    }
                    return a.localeCompare(b);
                });
                
                sortedClasses.forEach(cls => {
                    const option = document.createElement('option');
                    option.value = cls;
                    option.textContent = `Class ${cls}`;
                    classSelect.appendChild(option);
                });
                
                console.log('Loaded classes for Create New Homework:', sortedClasses);
            } else {
                console.error('Invalid classes data:', data);
                throw new Error('Invalid teacher data received');
            }
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
    const sectionSelect = document.getElementById('sectionSelect');
    
    // Clear sections dropdown
    if (sectionSelect) {
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
    }
    
    if (!classValue) {
        console.log('No class selected, sections dropdown cleared');
        return;
    }

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
        
        if (Array.isArray(sections) && sections.length > 0) {
            // Sort sections alphabetically
            sections.sort();
            
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = section;
                sectionSelect.appendChild(option);
            });
            
            console.log(`Loaded ${sections.length} sections for class ${classValue}:`, sections);
        } else {
            console.warn('No sections found for class:', classValue);
            showToast(`No sections found for Class ${classValue}`, 'warning');
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
    } else if (type === 'warning') {
        toastIcon.className = 'toast-icon fas fa-exclamation-triangle';
    } else {
        toastIcon.className = 'toast-icon fas fa-info-circle';
    }
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// Function to populate the manage homework filter dropdowns
async function populateManageHomeworkFilters() {
    try {
        const token = localStorage.getItem('auth_token');
        const classFilter = document.getElementById('filterClass');
        
        if (!classFilter) {
            console.log('Filter class dropdown not found - probably not on manage tab');
            return;
        }
        
        console.log('Populating manage homework filters...');
        classFilter.innerHTML = '<option value="">All Classes</option>';
        
        // Fetch all available classes using the same API as create homework
        const response = await fetch('/api/teacher/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch classes for filters');
        }
        
        const data = await response.json();
        
        if (data.classes && Array.isArray(data.classes)) {
            // Sort classes naturally
            const sortedClasses = data.classes.sort((a, b) => {
                const aNum = parseInt(a.match(/\d+/)?.[0] || a);
                const bNum = parseInt(b.match(/\d+/)?.[0] || b);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return aNum - bNum;
                }
                return a.localeCompare(b);
            });
            
            sortedClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = `Class ${cls}`;
                classFilter.appendChild(option);
            });
            
            console.log('Loaded classes for manage homework filters:', sortedClasses);
        }
        
        // Set up change event to load sections for the selected class
        classFilter.addEventListener('change', async function() {
            await loadSectionsForFilter(this.value);
        });
        
    } catch (err) {
        console.error('Error loading manage homework filters:', err);
        showToast('Failed to load filter options', 'error');
    }
}

// Function to load sections for the manage homework filter
async function loadSectionsForFilter(classValue) {
    const sectionFilter = document.getElementById('filterSection');
    
    if (!sectionFilter) {
        console.log('Section filter dropdown not found');
        return;
    }
    
    // Clear sections dropdown
    sectionFilter.innerHTML = '<option value="">All Sections</option>';
    
    if (!classValue) {
        console.log('No class selected for filter, sections cleared');
        return;
    }
    
    try {
        console.log('Loading sections for filter, class:', classValue);
        
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/teacher/sections/${classValue}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch sections for filter');
        }
        
        const sections = await response.json();
        
        if (Array.isArray(sections) && sections.length > 0) {
            sections.sort(); // Sort alphabetically
            
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = section;
                sectionFilter.appendChild(option);
            });
            
            console.log(`Loaded ${sections.length} sections for filter:`, sections);
        } else {
            console.warn('No sections found for class in filter:', classValue);
        }
        
    } catch (error) {
        console.error('Error loading sections for filter:', error);
        showToast('Failed to load sections for filter', 'error');
    }
}

