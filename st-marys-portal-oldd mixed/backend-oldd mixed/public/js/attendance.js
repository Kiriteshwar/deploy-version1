// document.addEventListener("DOMContentLoaded", () => {
//   console.log("Stored Student ID:", localStorage.getItem("studentId"));
//   console.log("Stored Auth Token:", localStorage.getItem("auth_token"));
// });

// document.addEventListener("DOMContentLoaded", async () => {
//     const studentId = localStorage.getItem("studentId"); // Assume studentId is stored after login
//     if (!studentId) {
//       alert("User not logged in!");
//       return;
//     }
  
//     try {
//       const response = await fetch(`/api/attendance/${studentId}`, {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${localStorage.getItem("token")}`, // Ensure JWT is included
//         },
//       });
  
//       if (!response.ok) {
//         throw new Error("Failed to fetch attendance data");
//       }
  
//       const attendanceRecords = await response.json();
//       updateAttendanceUI(attendanceRecords);
//     } catch (error) {
//       console.error("Error fetching attendance:", error);
//     }
//   });
  
//   function updateAttendanceUI(attendanceRecords) {
//     if (!attendanceRecords || attendanceRecords.length === 0) {
//       document.getElementById("overallPercent").textContent = "No data available";
//       return;
//     }
  
//     const presentCount = attendanceRecords.filter((record) => record.status === "Present").length;
//     const absentCount = attendanceRecords.filter((record) => record.status === "Absent").length;
//     const totalDays = attendanceRecords.length;
//     const overallPercent = totalDays ? ((presentCount / totalDays) * 100).toFixed(2) : "--";
  
//     document.getElementById("presentCount").textContent = `✅ Present: ${presentCount}`;
//     document.getElementById("absentCount").textContent = `❌ Absent: ${absentCount}`;
//     document.getElementById("overallPercent").textContent = `${overallPercent}%`;
  
//     // **Fix: Progress bar updating correctly**
//     document.getElementById("overallProgress").style.width = `${overallPercent}%`;
  
//     // **Fix: Subject-wise attendance**
//     const subjectCards = document.getElementById("subjectCards");
//     subjectCards.innerHTML = "";
//     const subjects = {};
  
//     attendanceRecords.forEach((record) => {
//       if (!record.subject) return; // Ensure data includes subjects
  
//       if (!subjects[record.subject]) {
//         subjects[record.subject] = { present: 0, total: 0 };
//       }
  
//       subjects[record.subject].total++;
//       if (record.status === "Present") {
//         subjects[record.subject].present++;
//       }
//     });
  
//     Object.entries(subjects).forEach(([subject, stats]) => {
//       const percent = ((stats.present / stats.total) * 100).toFixed(2);
//       const card = document.createElement("div");
//       card.className = "subject-card";
//       card.innerHTML = `
//         <h3>${subject}</h3>
//         <p>✅ Present: ${stats.present}</p>
//         <p>❌ Absent: ${stats.total - stats.present}</p>
//         <strong>${percent}% Attendance</strong>
//       `;
//       subjectCards.appendChild(card);
//     });
  
//     // **Fix: Daily attendance**
//     const dailyCards = document.getElementById("dailyCards");
//     dailyCards.innerHTML = "";
//     attendanceRecords.forEach((record) => {
//       const card = document.createElement("div");
//       card.className = "daily-card";
//       card.innerHTML = `
//         <h4>${record.date}</h4>
//         <p class="${record.status === "Present" ? "status-present" : "status-absent"}">${record.status}</p>
//       `;
//       dailyCards.appendChild(card);
//     });
//   }


document.addEventListener("DOMContentLoaded", async () => {
    await loadAttendanceData();
});

async function loadAttendanceData() {
    const token = localStorage.getItem("auth_token");
    const userData = localStorage.getItem("user_data");

    if (!token || !userData) {
        window.location.href = "login.html";
        return;
    }

    try {
        const user = JSON.parse(userData);
        let studentId = user._id;

        if (!studentId || user.role !== 'student') {
            throw new Error("Access denied. Only students can view attendance.");
        }

        // Check token expiration
        const { exp } = JSON.parse(atob(token.split('.')[1]));
        if (Date.now() / 1000 > exp) {
            alert("Session expired! Please log in again.");
            localStorage.removeItem("auth_token");
            localStorage.removeItem("user_data");
            window.location.href = "login.html";
            return;
        }

        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/attendance/${studentId}?_t=${timestamp}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to fetch attendance data");
        }

        const data = await response.json();
        console.log('Fetched attendance data:', data); // Debug log
        updateAttendanceUI(data);
    } catch (error) {
        console.error("Error fetching attendance:", error);
        showError("Error loading attendance data. Please try again later.");
    }
}

function showError(message) {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    });
}

function updateAttendanceUI(data) {
    if (!data || !data.records || !Array.isArray(data.records)) {
        showError("Invalid attendance data format");
        return;
    }

    if (data.records.length === 0) {
        showError("No attendance data available");
        return;
    }

    try {
        const { statistics, records } = data;
        
        // Clear any existing error messages
        document.querySelectorAll('.error-message').forEach(el => el.remove());

        // Update overall statistics
        const elements = {
            presentCount: document.getElementById("presentCount"),
            absentCount: document.getElementById("absentCount"),
            noSessionCount: document.getElementById("noSessionCount"),
            overallPercent: document.getElementById("overallPercent"),
            overallProgress: document.getElementById("overallProgress")
        };

        // Check if all required elements exist
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                throw new Error(`Required element "${key}" not found in the DOM`);
            }
        }

        elements.presentCount.innerHTML = `
            <i class="fas fa-check-circle"></i> Present: ${statistics.presentDays}
        `;
        elements.absentCount.innerHTML = `
            <i class="fas fa-times-circle"></i> Absent: ${statistics.absentDays}
        `;
        elements.noSessionCount.innerHTML = `
            <i class="fas fa-minus-circle"></i> No Session: ${statistics.noSessionDays}
        `;
        
        elements.overallPercent.textContent = `${statistics.attendancePercentage}%`;
        
        // Update progress bar width and color based on percentage
        const percentage = Math.min(Math.max(statistics.attendancePercentage, 0), 100); // Ensure percentage is between 0 and 100
        elements.overallProgress.style.width = `${percentage}%`;
        
        // Remove existing color classes
        elements.overallProgress.classList.remove('high', 'medium', 'low');
        
        // Add appropriate color class based on percentage thresholds
        if (percentage >= 75) {
            elements.overallProgress.classList.add('high');
        } else if (percentage >= 35) {
            elements.overallProgress.classList.add('medium');
        } else {
            elements.overallProgress.classList.add('low');
        }

        // Update subject-wise attendance
        updateSubjectAttendance(records);

        // Update daily attendance
        updateDailyAttendance(records);

    } catch (error) {
        console.error("Error updating UI:", error);
        showError(`Error displaying attendance data: ${error.message}`);
    }
}

function updateSubjectAttendance(records) {
    const subjects = {};
    records.forEach(record => {
        if (!record.subject) return;

        if (!subjects[record.subject]) {
            subjects[record.subject] = { present: 0, absent: 0, noSession: 0, total: 0 };
        }

        subjects[record.subject].total++;
        switch (record.status) {
            case "Present":
                subjects[record.subject].present++;
                break;
            case "Absent":
                subjects[record.subject].absent++;
                break;
            default:
                subjects[record.subject].noSession++;
        }
    });

    const subjectCards = document.getElementById("subjectCards");
    if (!subjectCards) {
        console.error("Subject cards container not found");
        return;
    }
    subjectCards.innerHTML = "";

    Object.entries(subjects).forEach(([subject, stats]) => {
        const totalClasses = stats.total - stats.noSession;
        const percentage = totalClasses > 0 ? ((stats.present / totalClasses) * 100).toFixed(2) : 0;
        const card = document.createElement("div");
        card.className = "subject-card";
        
        // Determine progress bar color class based on percentage
        let progressColorClass = 'low';
        if (percentage >= 75) {
            progressColorClass = 'high';
        } else if (percentage >= 35) {
            progressColorClass = 'medium';
        }
        
        card.innerHTML = `
            <h3><i class="fas fa-book"></i> ${subject}</h3>
            <div class="progress-container">
                <div class="progress-bar ${progressColorClass}" style="width: ${percentage}%"></div>
            </div>
            <div class="subject-stats">
                <span class="status-present">
                    <i class="fas fa-check-circle"></i> ${stats.present}
                </span>
                <span class="status-absent">
                    <i class="fas fa-times-circle"></i> ${stats.absent}
                </span>
                <span class="status-no-session">
                    <i class="fas fa-minus-circle"></i> ${stats.noSession}
                </span>
            </div>
            <div class="subject-percent">
                <strong>${percentage}%</strong> Attendance
            </div>
        `;
        subjectCards.appendChild(card);
    });
}

function updateDailyAttendance(records) {
    const dailyCards = document.getElementById("dailyCards");
    dailyCards.innerHTML = "";

    const dateGroups = {};
    records.forEach(record => {
        const date = new Date(record.date);
        const dateStr = date.toISOString().split('T')[0];
        
        if (!dateGroups[dateStr]) {
            dateGroups[dateStr] = [];
        }
        dateGroups[dateStr].push(record);
    });

    const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

    sortedDates.forEach(dateStr => {
        const dayRecords = dateGroups[dateStr].sort((a, b) => a.period - b.period);
        const date = new Date(dateStr);
        
        const formattedDate = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);

        const row = document.createElement("div");
        row.className = "daily-card";

        let periodsHtml = '';
        dayRecords.forEach(record => {
            const statusClass = 
                record.status === "Present" ? "status-present" : 
                record.status === "Absent" ? "status-absent" : "status-no-session";
            
            periodsHtml += `
                <div class="period ${statusClass}">
                    <div class="period-header">
                        <span class="period-number">Period ${record.period}</span>
                        <span class="period-subject">${record.subject}</span>
                    </div>
                    <div class="period-status">
                        <i class="fas fa-${
                            record.status === "Present" ? "check-circle" : 
                            record.status === "Absent" ? "times-circle" : "minus-circle"
                        }"></i>
                        ${record.status}
                    </div>
                    ${record.remarks ? `<div class='period-remarks'><i class='fas fa-comment'></i> ${record.remarks}</div>` : ''}
                </div>
            `;
        });

        row.innerHTML = `
            <div class="date">
                <i class="fas fa-calendar-day"></i>
                ${formattedDate}
            </div>
            <div class="periods">
                ${periodsHtml}
            </div>
        `;

        dailyCards.appendChild(row);
    });
}
