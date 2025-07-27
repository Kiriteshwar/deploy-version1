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
    
    // Load results
    loadResults();

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
                document.getElementById('dropdown-class').textContent = data.roleData.class || 'N/A';
                document.getElementById('dropdown-section').textContent = data.roleData.section || 'N/A';
                document.getElementById('dropdown-roll').textContent = data.roleData.rollNumber || 'N/A';
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Load student's results
async function loadResults() {
    try {
        const academicYear = document.getElementById('academic-year').value;
        const url = `/api/results/student${academicYear ? `?academicYear=${academicYear}` : ''}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            displayResults(data.data);
            updateAcademicYearOptions(data.data);
        } else {
            showAlert('Error loading results', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load results', 'error');
    }
}

function calculateGrade(subjects, percentage) {
    // F if any subject is below passing
    if (subjects.some(s => s.obtainedMarks < s.passingMarks)) return 'F';
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

function displayResults(results) {
    const container = document.getElementById('results-container');
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-scroll"></i>
                <h3>No Results Found</h3>
                <p>Your exam results will appear here once they are declared.</p>
            </div>
        `;
        return;
    }

    // Calculate totals and grades for each result
    results.forEach(result => {
        // Use marks array (not subjects)
        const subjects = result.marks || result.subjects || [];
        result.totalObtained = subjects.reduce((sum, s) => sum + (s.obtainedMarks || 0), 0);
        result.totalMarks = subjects.reduce((sum, s) => sum + (s.maxMarks || 0), 0);
        result.percentage = result.totalMarks ? (result.totalObtained / result.totalMarks) * 100 : 0;
        result.grade = calculateGrade(subjects, result.percentage);

        // Calculate grade for each subject
        subjects.forEach(s => {
            s.grade = (s.obtainedMarks < s.passingMarks) ? 'F' : '';
        });

        // For rendering
        result.subjects = subjects;
    });

    container.innerHTML = results.map(result => `
        <div class="result-card">
            <div class="result-header">
                <h4>${result.exam.name}</h4>
                <div class="result-meta">
                    <span><i class="fas fa-calendar-alt"></i> ${new Date(result.createdAt).toLocaleDateString()}</span>
                    <span><i class="fas fa-graduation-cap"></i> ${result.class}-${result.section}</span>
                    <span><i class="fas fa-user-check"></i> Declared by: ${result.declaredBy.name}</span>
                </div>
            </div>
            
            <div class="subjects">
                ${result.subjects.map(subject => `
                    <div class="subject-row">
                        <div class="subject-name">
                            ${subject.subjectName || subject.name}
                            <small class="text-muted">(Max: ${subject.maxMarks})</small>
                        </div>
                        <div class="subject-marks">
                            <span>${subject.obtainedMarks}</span>
                            ${subject.grade ? `<span class="grade-badge grade-${subject.grade.toLowerCase().replace('+', '-plus')}">${subject.grade}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="total-row">
                <div class="subject-row">
                    <div>Total Score</div>
                    <div class="subject-marks">
                        <span>${result.totalObtained}/${result.totalMarks}</span>
                        <span class="grade-badge grade-${result.grade.toLowerCase().replace('+', '-plus')}">${result.grade}</span>
                    </div>
                </div>
                <div class="subject-row">
                    <div>Percentage</div>
                    <div>${result.percentage.toFixed(2)}%</div>
                </div>
                ${result.rank ? `
                    <div class="subject-row">
                        <div>Class Rank</div>
                        <div>#${result.rank}</div>
                    </div>
                ` : ''}
            </div>
            
            ${result.remarks ? `
                <div class="remarks">
                    <strong>Remarks:</strong> ${result.remarks}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Update academic year filter options
function updateAcademicYearOptions(results) {
    const years = new Set(results.map(r => r.academicYear));
    const select = document.getElementById('academic-year');
    
    // Keep the "All" option
    const allOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(allOption);
    
    // Add year options
    Array.from(years).sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Academic year filter change
    document.getElementById('academic-year').addEventListener('change', loadResults);

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
    });

    // Change password
    document.getElementById('change-password').addEventListener('click', (e) => {
        e.preventDefault();
        alert('Change password functionality coming soon!');
    });

    // Update info
    document.getElementById('update-info').addEventListener('click', (e) => {
        e.preventDefault();
        alert('Update info functionality coming soon!');
    });

    // Upload photo
    document.getElementById('upload-photo').addEventListener('click', (e) => {
        e.preventDefault();
        alert('Upload photo functionality coming soon!');
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