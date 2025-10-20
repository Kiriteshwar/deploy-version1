// window.onload = () => {
//     const token = localStorage.getItem("auth_token");

//     if (!token) {
//         window.location.href = "login.html";
//         return;
//     }

//     fetch("/api/student/profile", {
//         method: "GET",
//         headers: {
//             "Content-Type": "application/json",
//             "Authorization": `Bearer ${token}`
//         }
//     })
//     .then((response) => response.json())
//     .then((data) => {
//         if (data.user) {
//             document.getElementById("user-name").textContent = data.user.name;
//             document.getElementById("user-email").textContent = data.user.email;
//         } else {
//             alert("Failed to load user data.");
//         }
//     })
//     .catch((error) => {
//         console.error("Error:", error);
//         alert("Something went wrong.");
//     });

//     document.getElementById("logout-btn").addEventListener("click", () => {
//         localStorage.removeItem("auth_token");
//         window.location.href = "login.html";
//     });
// };

//new js
// window.onload = () => {
//     const token = localStorage.getItem("auth_token");
  
//     if (!token) {
//       window.location.href = "login.html";
//       return;
//     }

//     let studentId = null; // <--- Declare here so it's accessible globally in this script

//     // Fetch profile details
//     fetch("/api/student/profile", {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${token}`
//       }
//     })
//     .then((response) => response.json())
//     .then((data) => {
//       if (data.user) {
//         document.getElementById("user-name").textContent = data.user.name;
//         document.getElementById("user-email").textContent = data.user.email;
  
//         // Store student ID to use in API requests
//         const studentId = data.user.id;
    
//         // Attendance card click handler
//         const attendanceCard = document.getElementById("attendance-card");
//         if (attendanceCard) {
//           attendanceCard.addEventListener("click", () => {
//             fetch(`/api/attendance/${studentId}`, {
//               method: "GET",
//               headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `Bearer ${token}`
//               }
//             })
//             .then((res) => res.json())
//             .then((records) => {
//               const container = document.getElementById("feature-data");
//               if (Array.isArray(records)) {
//                 container.innerHTML = `
//                   <h3>Attendance Records</h3>
//                   <ul>
//                     ${records.map(r => `<li>${r.date} - ${r.status}</li>`).join('')}
//                   </ul>
//                 `;
//               } else {
//                 container.innerHTML = `<p>No records found.</p>`;
//               }
//             })
//             .catch((err) => {
//               console.error(err);
//               alert("Failed to load attendance");
//             });
//           });
//         }
//       } else {
//         alert("Failed to load user data.");
//       }
//     })
//     .catch((error) => {
//       console.error("Error:", error);
//       alert("Something went wrong.");
//     });
  
//     // Logout
//     document.getElementById("logout-btn").addEventListener("click", () => {
//       localStorage.removeItem("auth_token");
//       window.location.href = "login.html";
//     });
//   };
/// more neww jss////
window.onload = () => {
    const token = localStorage.getItem("auth_token");
    const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
    
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Dropdown logic
    const profileCollapsed = document.getElementById('profileCollapsed');
    const profileExpanded = document.getElementById('profileExpanded');
    const profileDropdown = document.getElementById('profileDropdown');
    let dropdownOpen = false;

    function openDropdown() {
        profileExpanded.style.display = 'block';
        dropdownOpen = true;
    }
    function closeDropdown() {
        profileExpanded.style.display = 'none';
        dropdownOpen = false;
    }
    profileCollapsed.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdownOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });
    document.addEventListener('click', (e) => {
        if (dropdownOpen && !profileDropdown.contains(e.target)) {
            closeDropdown();
        }
    });
    // ESC key closes dropdown
    document.addEventListener('keydown', (e) => {
        if (dropdownOpen && e.key === 'Escape') closeDropdown();
    });

    // Populate collapsed and expanded profile info
    function setProfileInfo(data) {
        console.log("setProfileInfo called with:", data);
        // Collapsed
        const collapsedName = document.getElementById("profile-name-collapsed");
        if (collapsedName) collapsedName.textContent = data?.name || 'User';
        // Expanded
        const expandedName = document.getElementById("profile-name");
        if (expandedName) expandedName.textContent = data?.name || 'User';

        const roll = document.getElementById("profile-roll");
        const classEl = document.getElementById("profile-class");
        const section = document.getElementById("profile-section");

        if (data.role === 'student') {
            if (roll) {
                roll.textContent = 'Roll: ' + (data?.roleData?.rollNumber || 'N/A');
                roll.style.display = 'block';
            }
            if (classEl) {
                classEl.textContent = 'Class: ' + (data?.roleData?.class || 'N/A');
                classEl.style.display = 'block';
            }
            if (section) {
                section.textContent = 'Section: ' + (data?.roleData?.section || 'N/A');
                section.style.display = 'block';
            }
        } else {
            if (roll) roll.style.display = 'none';
            if (classEl) classEl.style.display = 'none';
            if (section) section.style.display = 'none';
        }
    }

    // Decode token expiration time and compare
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    console.log("Token Expiration Time:", new Date(exp * 1000));
    console.log("Current Time:", new Date());

    if (Date.now() / 1000 > exp) {
        alert("Session expired! Please log in again.");
        // Clear all user-related data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_data');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        localStorage.removeItem('studentClass');
        localStorage.removeItem('studentSection');
        // Note: username is no longer used, user_name is the standard key
        window.location.href = "login.html";
    }

    // Update welcome message with user's name from login response
    if (userData.name) {
        document.getElementById("user-name").textContent = userData.name;
    }

    // Fetch full profile data
    fetch("/api/auth/profile", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        cache: "no-store" // <-- Add this line
    })
    .then(response => {
        if (response.status === 304) {
            // Optionally, use cached data or show a message
            throw new Error('Profile not modified, no new data.');
        }
        if (!response.ok) {
            throw new Error('Profile fetch failed');
        }
        return response.json();
    })
    .then(data => {
        console.log("Profile data:", data);
        // Update welcome message and dropdown name
        if (data.name) {
            const userNameEl = document.getElementById("user-name");
            if (userNameEl) userNameEl.textContent = data.name;
            localStorage.setItem("user_name", data.name);
        }

        setProfileInfo(data); // <-- Ensure profile info is updated for all users

        // Handle role-specific UI elements
        if (data.role === 'student') {
            document.querySelectorAll('.student-only').forEach(el => el.style.display = 'block');
            document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            if (data.roleData) {
                const classEl = document.getElementById("profile-class");
                if (classEl) classEl.textContent = 'Class: ' + (data.roleData.class || 'N/A');
                const sectionEl = document.getElementById("profile-section");
                if (sectionEl) sectionEl.textContent = 'Section: ' + (data.roleData.section || 'N/A');
                const rollEl = document.getElementById("profile-roll");
                if (rollEl) rollEl.textContent = 'Roll: ' + (data.roleData.rollNumber || 'N/A');
            }
        } else if (data.role === 'teacher') {
            document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'block');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            if (data.roleData) {
                const classEl = document.getElementById("profile-class");
                if (classEl) classEl.textContent = 'Class: ' + (data.roleData.classTeacherOf || 'N/A');
                const sectionEl = document.getElementById("profile-section");
                if (sectionEl) sectionEl.textContent = 'Section: ' + (Array.isArray(data.roleData.subjects) ? data.roleData.subjects.join(', ') : data.roleData.subjects || 'N/A');
                const rollEl = document.getElementById("profile-roll");
                if (rollEl) rollEl.textContent = 'Roll: ' + (data.roleData.employeeId || 'N/A');
            }
        } else if (data.role === 'admin') {
            document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'none');
            addAdminCards();
        }

        // Update profile info in dropdown and collapsed
        const collapsedName = document.getElementById("profile-name-collapsed");
        if (collapsedName) collapsedName.textContent = data?.name || 'User';
        const expandedName = document.getElementById("profile-name");
        if (expandedName) expandedName.textContent = data?.name || 'User';
        // Profile pictures (use real one if available, else fallback to ui-avatars.com)
        let picUrl = data?.profilePicUrl || 'default-avatar.jpg';
        if (!data?.profilePicUrl && data?.name) {
            picUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=E0E7EF&color=1976d2&size=128`;
        }
        const picCollapsed = document.getElementById("profile-pic-collapsed");
        if (picCollapsed) picCollapsed.src = picUrl;
        const picLarge = document.getElementById("profile-pic");
        if (picLarge) picLarge.src = picUrl;
        
        // Remove loading overlay after profile is loaded
        const overlay = document.getElementById('authLoadingOverlay');
        if (overlay) overlay.style.display = 'none';
    })
    .catch(error => {
        console.error('Error fetching profile:', error);
        alert('Failed to load user profile data');
        // Remove loading overlay even on error
        const overlay = document.getElementById('authLoadingOverlay');
        if (overlay) overlay.style.display = 'none';
    });

    // Attach event listeners to cards

    // Student attendance card handler
    const attendanceCard = document.getElementById("attendance-card");
    if (attendanceCard) {
        attendanceCard.addEventListener("click", () => {
            window.location.href = "attendance.html";
        });
    }

    // Student timetable card handler
    const timetableCard = document.getElementById("timetable-card");
    if (timetableCard) {
        timetableCard.addEventListener("click", () => {
            window.location.href = "view-timetable.html";
        });
    }

    // Teacher class schedule card handler
    const classScheduleCard = document.getElementById("class-schedule-card");
    if (classScheduleCard) {
        classScheduleCard.addEventListener("click", () => {
            window.location.href = "view-timetable.html";
        });
    }

    // Add homework card handler (for students)
    const homeworkCard = document.getElementById("homework-card");
    if (homeworkCard) {
        homeworkCard.addEventListener("click", () => {
            window.location.href = "view-homework.html";
        });
    }

    // Add mark attendance card handler
    const markAttendanceCard = document.getElementById("mark-attendance-card");
    if (markAttendanceCard) {
        markAttendanceCard.addEventListener("click", () => {
            window.location.href = "mark-attendance.html";
        });
    }

    // Add assign homework card handler (for teachers)
    const assignHomeworkCard = document.getElementById("assign-homework-card");
    if (assignHomeworkCard) {
        assignHomeworkCard.addEventListener("click", () => {
            window.location.href = "assign-homework.html";
        });
    }

    // Add view submissions card handler (for teachers)
    const viewSubmissionsCard = document.getElementById("view-submissions-card");
    if (viewSubmissionsCard) {
        viewSubmissionsCard.addEventListener("click", () => {
            window.location.href = "view-submissions.html";
        });
    }
    
    // Add manage exams card handler (for teachers)
    const manageExamsCard = document.getElementById("manage-exams-card");
    if (manageExamsCard) {
        manageExamsCard.addEventListener("click", () => {
            window.location.href = "manage-exams.html";
        });
    }
    
    // Add grade exams card handler (for teachers)
    const gradeExamsCard = document.getElementById("grade-exams-card");
    if (gradeExamsCard) {
        gradeExamsCard.addEventListener("click", () => {
            window.location.href = "grade-exams.html";
        });
    }

    // Add notices card handler
    const noticesCard = document.getElementById("notices-card");
    if (noticesCard) {
        noticesCard.addEventListener("click", () => {
            window.location.href = "noticeboard.html";
        });
    }

    // Remove event listeners for non-existent elements
    // document.getElementById("change-password").addEventListener("click", (e) => {
    //     e.preventDefault();
    //     // TODO: Implement change password functionality
    //     alert("Change password functionality coming soon!");
    // });

    // document.getElementById("update-info").addEventListener("click", (e) => {
    //     e.preventDefault();
    //     // TODO: Implement update info functionality
    //     alert("Update info functionality coming soon!");
    // });

    // document.getElementById("upload-photo").addEventListener("click", (e) => {
    //     e.preventDefault();
    //     // TODO: Implement photo upload functionality
    //     alert("Photo upload functionality coming soon!");
    // });

    // Settings link
    document.getElementById('account-settings-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'account.html'; // Placeholder, create this page next
    });
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        localStorage.removeItem('studentClass');
        localStorage.removeItem('studentSection');
        // Note: username is no longer used, user_name is the standard key
        window.location.href = 'login.html';
    });

    // Always attach click handler for Manage Users card (admin)
    const manageUsersCard = document.getElementById('manage-users-card');
    if (manageUsersCard) {
        manageUsersCard.onclick = () => { window.location.href = 'manage-users.html'; };
    }

    // Global dark mode support
    if (localStorage.getItem('dark_mode') === 'true') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }


};

// Function to add admin-specific cards
function addAdminCards() {
    const cardContainer = document.querySelector('.card-container');
    if (!cardContainer) return;
    
    // Show admin-only cards that are already in the HTML
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    
    // Array of admin card definitions
    const adminCards = [
        {
            id: 'manage-timetable-card',
            icon: '📅',
            title: 'Manage Timetables',
            action: () => { window.location.href = 'admin-timetable.html'; }
        },
        {
            id: 'admin-complaints-card',
            icon: '💬',
            title: 'Manage Complaints',
            action: () => { window.location.href = 'admin-complaints.html'; }
        },
        {
            id: 'manage-users-card',
            icon: '👥',
            title: 'Manage Users',
            action: () => { window.location.href = 'manage-users.html'; }
        },
        {
            id: 'manage-classes-card',
            icon: '🏫',
            title: 'Manage Classes',
            action: () => { alert('Class management feature coming soon!'); }
        },
        {
            id: 'manage-exams',
            icon: '📝',
            title: 'Manage Exams',
            action: () => { window.location.href = 'manage-exams.html'; }
        },
        {
            id: 'school-settings-card',
            icon: '⚙️',
            title: 'School Settings',
            action: () => { alert('School settings feature coming soon!'); }
        }
    ];
    
    // Create and add each admin card
    adminCards.forEach(cardInfo => {
        // Check if card already exists (to avoid duplicates)
        if (!document.getElementById(cardInfo.id)) {
            const card = document.createElement('div');
            card.className = 'dashboard-card';
            card.id = cardInfo.id;
            card.textContent = `${cardInfo.icon} ${cardInfo.title}`;
            
            // Add click handler
            card.addEventListener('click', cardInfo.action);
            
            // Add card to container
            cardContainer.appendChild(card);
        }
    });
    
    // Show all admin cards
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
}

function loadDashboardContent() {
    const userRole = localStorage.getItem('user_role');
    let dashboardContent = '';

    if (userRole === 'admin') {
        dashboardContent = `
            <div class="dashboard-grid">
                <a href="manage-users.html" class="dashboard-item">
                    <i class="fas fa-users"></i>
                    <h3>Manage Users</h3>
                </a>
                <a href="manage-classes.html" class="dashboard-item">
                    <i class="fas fa-chalkboard"></i>
                    <h3>Manage Classes</h3>
                </a>
                <a href="manage-exams.html" class="dashboard-item">
                    <i class="fas fa-file-alt"></i>
                    <h3>Manage Exams</h3>
                </a>
                <a href="view-results.html" class="dashboard-item">
                    <i class="fas fa-chart-bar"></i>
                    <h3>View Results</h3>
                </a>
            </div>`;
    } else if (userRole === 'teacher') {
        dashboardContent = `
            <div class="dashboard-grid">
                <a href="manage-exams.html" class="dashboard-item">
                    <i class="fas fa-file-alt"></i>
                    <h3>Manage Unit Tests & Practicals</h3>
                </a>
                <a href="view-results.html" class="dashboard-item">
                    <i class="fas fa-chart-bar"></i>
                    <h3>View Results</h3>
                </a>
            </div>`;
    } else if (userRole === 'student') {
        dashboardContent = `
            <div class="dashboard-grid">
                <a href="view-results.html" class="dashboard-item">
                    <i class="fas fa-chart-bar"></i>
                    <h3>View Results</h3>
                </a>
            </div>`;
    }

    document.getElementById('dashboard-content').innerHTML = dashboardContent;
}

