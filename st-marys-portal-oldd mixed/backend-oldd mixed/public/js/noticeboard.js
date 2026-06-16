document.addEventListener('DOMContentLoaded', function() {
    // Check auth token and user role
    const token = localStorage.getItem("auth_token");
    const userRole = localStorage.getItem("user_role");
    
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Show admin controls for teachers and admin
    if (userRole === 'teacher' || userRole === 'admin') {
        document.body.setAttribute('data-role', userRole);
        
        // Fetch class and section data for dropdowns
        fetchClassAndSectionData();
    } else {
        document.body.setAttribute('data-role', 'student');
    }

    // Initialize date picker with current date
    const datePicker = document.getElementById('noticeDate');
    if (datePicker) {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        datePicker.value = formattedDate;
    }

    // Fetch notices from database
    fetchNotices();

    // ---- Filter Functionality ----
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            const filterValue = this.getAttribute('data-filter');
            const noticeItems = document.querySelectorAll('.notice-item');
            
            // Show all notices if 'all' is selected, otherwise filter by category
            noticeItems.forEach(item => {
                if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // ---- Search Functionality ----
    const searchInput = document.getElementById('searchNotice');
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const noticeItems = document.querySelectorAll('.notice-item');
        
        noticeItems.forEach(item => {
            const title = item.querySelector('.notice-header h3').textContent.toLowerCase();
            const content = item.querySelector('.notice-content').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || content.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // ---- Modal Functionality ----
    const noticeList = document.getElementById('noticeList');
    const modal = document.getElementById('noticeModal');
    const modalClose = document.querySelector('.modal-close');
    
    // Open modal when clicking on a notice
    noticeList.addEventListener('click', function(e) {
        // Don't open modal if clicking on edit/delete buttons or attachments
        if (e.target.closest('.notice-actions') || e.target.closest('.notice-attachment')) {
            return;
        }
        
        const noticeItem = e.target.closest('.notice-item');
        if (noticeItem) {
            const title = noticeItem.querySelector('.notice-header h3').textContent;
            const category = noticeItem.querySelector('.notice-badge').textContent;
            const categoryClass = noticeItem.querySelector('.notice-badge').classList[1];
            const date = noticeItem.querySelector('.notice-date').textContent;
            const author = noticeItem.querySelector('.notice-author').textContent;
            const content = noticeItem.querySelector('.notice-content').textContent;
            
            // Get attachment if it exists
            const attachmentEl = noticeItem.querySelector('.notice-attachment');
            let attachmentHTML = '';
            
            if (attachmentEl) {
                const attachmentUrl = attachmentEl.getAttribute('href');
                const attachmentText = attachmentEl.textContent.trim();
                attachmentHTML = `<a href="${attachmentUrl}" class="notice-attachment" target="_blank">
                    <i class="fas fa-paperclip"></i> ${escapeHtml(attachmentText)}
                </a>`;
            }
            
            // Populate modal using textContent to prevent XSS
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalCategory').textContent = category;
            document.getElementById('modalCategory').className = `notice-badge ${categoryClass}`;
            document.getElementById('modalDate').textContent = date;
            document.getElementById('modalAuthor').textContent = author;
            document.getElementById('modalContent').textContent = content;
            document.getElementById('modalAttachment').innerHTML = attachmentHTML;
            
            // Show modal
            modal.classList.add('active');
        }
    });
    
    // Close modal when clicking on close button or outside the modal
    modalClose.addEventListener('click', function() {
        modal.classList.remove('active');
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // ---- Add Notice Form Submission ----
    const addNoticeForm = document.getElementById('addNoticeForm');
    
    if (addNoticeForm) {
        addNoticeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const title = document.getElementById('noticeTitle').value;
            const category = document.getElementById('noticeCategory').value;
            const date = document.getElementById('noticeDate').value;
            const content = document.getElementById('noticeContent').value;
            const attachment = document.getElementById('noticeAttachment').files[0];
            const important = document.getElementById('noticeImportant').checked;
            const targetClass = document.getElementById('targetClass').value;
            const targetSection = document.getElementById('targetSection').value;
            
            // Create form data for API request
            const formData = new FormData();
            formData.append('title', title);
            formData.append('category', category);
            formData.append('date', date);
            formData.append('content', content);
            formData.append('important', important);
            formData.append('targetClass', targetClass);
            formData.append('targetSection', targetSection);
            if (attachment) {
                formData.append('attachment', attachment);
            }
            
            // Set author as 'Class Teacher' for teachers and 'Principal' for admins
            const authorTitle = userRole === 'admin' ? 'Principal' : 'Class Teacher';
            formData.append('author', authorTitle);
            
            // Check if we're editing an existing notice
            const noticeId = addNoticeForm.getAttribute('data-editing');
            
            let url = '/api/notice';
            let method = 'POST';
            
            if (noticeId) {
                url = `/api/notice/${noticeId}`;
                method = 'PUT';
            }
            
            // Send notice to server
            fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to publish notice');
                }
                return response.json();
            })
            .then(data => {
                showToast(noticeId ? 'Notice updated successfully!' : 'Notice published successfully!', 'success');
                
                // Reset form and clear editing state
                addNoticeForm.reset();
                addNoticeForm.removeAttribute('data-editing');
                document.querySelector('.form-actions .btn-primary').innerHTML = 
                    '<i class="fas fa-paper-plane"></i> Publish Notice';
                
                // Set current date again
                const today = new Date();
                const formattedDate = today.toISOString().split('T')[0];
                document.getElementById('noticeDate').value = formattedDate;
                
                // Refresh notices to show the newly added/updated notice
                fetchNotices();
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Failed to publish notice. Please try again.', 'error');
            });
        });
    }

    // ---- Edit and Delete Functionality ----
    document.addEventListener('click', function(e) {
        // Only allow teachers and admins to edit/delete notices
        if (userRole !== 'teacher' && userRole !== 'admin') {
            // Block any clicks on edit or delete buttons for students
            if (e.target.closest('.btn-edit') || e.target.closest('.btn-delete')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Students are not allowed to edit or delete notices');
                return;
            }
            return;
        }
        
        // Edit button clicked
        if (e.target.closest('.btn-edit')) {
            const noticeItem = e.target.closest('.notice-item');
            const noticeId = noticeItem.getAttribute('data-id');
            const title = noticeItem.querySelector('.notice-header h3').textContent;
            const category = noticeItem.querySelector('.notice-badge').textContent.toLowerCase();
            const content = noticeItem.querySelector('.notice-content p').textContent;
            const isImportant = noticeItem.classList.contains('notice-important');
            
            // Fetch the complete notice data to get class and section
            fetch(`/api/notice/${noticeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch notice details');
                }
                return response.json();
            })
            .then(notice => {
                // Populate the form with notice data
                document.getElementById('noticeTitle').value = title;
                document.getElementById('noticeCategory').value = category;
                document.getElementById('noticeContent').value = content;
                document.getElementById('noticeImportant').checked = isImportant;
                
                // Set class and section if available
                if (notice.targetClass) {
                    document.getElementById('targetClass').value = notice.targetClass;
                }
                if (notice.targetSection) {
                    document.getElementById('targetSection').value = notice.targetSection;
                }
                
                // Add data-editing attribute to the form to track edited notice ID
                document.getElementById('addNoticeForm').setAttribute('data-editing', noticeId);
                
                // Change button text to indicate editing
                document.querySelector('.form-actions .btn-primary').innerHTML = 
                    '<i class="fas fa-save"></i> Update Notice';
                
                // Scroll to the form
                document.querySelector('.add-notice-section').scrollIntoView({ behavior: 'smooth' });
                
                // Show toast
                showToast('Notice loaded for editing', 'success');
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Failed to load notice for editing', 'error');
                
                // Fall back to basic edit without class/section
                document.getElementById('noticeTitle').value = title;
                document.getElementById('noticeCategory').value = category;
                document.getElementById('noticeContent').value = content;
                document.getElementById('noticeImportant').checked = isImportant;
                document.getElementById('addNoticeForm').setAttribute('data-editing', noticeId);
                document.querySelector('.form-actions .btn-primary').innerHTML = 
                    '<i class="fas fa-save"></i> Update Notice';
                document.querySelector('.add-notice-section').scrollIntoView({ behavior: 'smooth' });
            });
        }
        
        // Delete button clicked
        if (e.target.closest('.btn-delete')) {
            if (confirm('Are you sure you want to delete this notice?')) {
                const noticeItem = e.target.closest('.notice-item');
                const noticeId = noticeItem.getAttribute('data-id');
                
                // Delete from database
                fetch(`/api/notice/${noticeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to delete notice');
                    }
                    return response.json();
                })
                .then(data => {
                    noticeItem.remove();
                    showToast('Notice deleted successfully!', 'success');
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Failed to delete notice. Please try again.', 'error');
                });
            }
        }
    });

    // Helper to escape HTML strings
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Function to create a safe DOM element for a notice
    function createNoticeElement(notice, noticeDate) {
        const template = document.getElementById('notice-template');
        if (template) {
            const clone = template.content.cloneNode(true);
            const item = clone.querySelector('.notice-item');
            if (item) {
                if (notice.important) item.classList.add('notice-important');
                item.setAttribute('data-category', notice.category || 'general');
                item.setAttribute('data-id', notice._id);
                
                const titleEl = item.querySelector('.notice-header h3');
                if (titleEl) titleEl.textContent = notice.title;
                
                const badge = item.querySelector('.notice-badge');
                if (badge) {
                    badge.textContent = notice.category ? notice.category.charAt(0).toUpperCase() + notice.category.slice(1) : 'General';
                    if (notice.category) badge.classList.add(notice.category);
                }
                
                const dateEl = item.querySelector('.notice-date');
                if (dateEl) dateEl.innerHTML = '<i class="fas fa-calendar-alt"></i> ' + noticeDate;
                
                const authorEl = item.querySelector('.notice-author');
                if (authorEl) authorEl.innerHTML = '<i class="fas fa-user"></i> ' + escapeHtml(notice.author || '');
                
                const contentEl = item.querySelector('.notice-content p');
                if (contentEl) contentEl.textContent = notice.content || '';
                
                const footer = item.querySelector('.notice-footer');
                if (footer) {
                    const attachmentHTML = notice.attachment 
                        ? `<a href="/api/notice/attachment/${notice.attachment.split('/').pop()}" class="notice-attachment" target="_blank">
                             <i class="fas fa-paperclip"></i> ${escapeHtml(notice.attachment.split('/').pop())}
                           </a>` 
                        : '';
                    const actionsHTML = `<span class="notice-actions admin-only">
                        <button class="btn-icon btn-edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
                    </span>`;
                    footer.innerHTML = attachmentHTML + actionsHTML;
                }
                
                return clone;
            }
        }
        return null;
    }

    // Function to fetch notices from database
    function fetchNotices() {
        const noticeList = document.getElementById('noticeList');
        
        // Show loading indicator
        noticeList.innerHTML = '<div class="notice-loading">Loading notices...</div>';
        
        // First, if user is a student, get their class and section information
        if (userRole === 'student') {
            // Fetch student profile to get class and section
            fetch('/api/student/profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch student profile');
                }
                return response.json();
            })
            .then(profileData => {
                console.log('Student profile data:', profileData);
                
                // Extract class and section from profile
                // The structure can be different depending on how the student data is stored
                let studentClass, studentSection;
                
                if (profileData.user?.studentInfo) {
                    // Using newer structure with studentInfo property
                    studentClass = profileData.user.studentInfo.class;
                    studentSection = profileData.user.studentInfo.section;
                } else if (profileData.user) {
                    // Using direct properties on user object
                    studentClass = profileData.user.class;
                    studentSection = profileData.user.section;
                } else if (profileData.roleData) {
                    // Using roleData structure from auth profile
                    studentClass = profileData.roleData.class;
                    studentSection = profileData.roleData.section;
                } else {
                    // Fallback to top-level properties if available
                    studentClass = profileData.class;
                    studentSection = profileData.section;
                }
                
                console.log('Extracted student class:', studentClass, 'section:', studentSection);
                
                // If we still couldn't find class and section, try fetching from auth profile
                if (!studentClass || !studentSection) {
                    console.log('Could not find class and section in student profile, trying auth profile...');
                    fetchFromAuthProfile();
                } else {
                    // Now get all notices and filter them
                    fetchAndFilterNotices(studentClass, studentSection);
                }
            })
            .catch(error => {
                console.error('Error fetching student profile:', error);
                // Fetch all notices without filtering as fallback
                fetchAndFilterNotices();
            });
        } else {
            // For teachers and admins, no need to fetch profile first - the backend will handle filtering
            fetchAndFilterNotices();
        }

        // Function to fetch notices and apply filtering if needed
        function fetchAndFilterNotices(userClass, userSection) {
            fetch('/api/notice', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch notices');
                }
                return response.json();
            })
            .then(notices => {
                // Clear loading indicator
                noticeList.innerHTML = '';
                
                if (!notices || notices.length === 0) {
                    noticeList.innerHTML = '<div class="no-notices">No notices available at this time.</div>';
                    return;
                }
                
                // Sort notices by date (newest first)
                notices.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // For students, filter notices by class and section
                let filteredNotices = notices;
                if (userRole === 'student' && userClass && userSection) {
                    console.log('Student Class:', userClass, 'Section:', userSection);
                    console.log('Filtering notices based on class and section...');
                    
                    filteredNotices = notices.filter(notice => {
                        if (notice.targetClass === 'all' && notice.targetSection === 'all') {
                            return true;
                        }
                        
                        // Normalize values for comparison (convert to lowercase strings)
                        const normalizedNoticeClass = String(notice.targetClass).toLowerCase();
                        const normalizedNoticeSection = String(notice.targetSection).toLowerCase();
                        const normalizedStudentClass = String(userClass).toLowerCase();
                        const normalizedStudentSection = String(userSection).toLowerCase();
                        
                        // Show class-specific notices (for the student's class)
                        if (normalizedNoticeClass === normalizedStudentClass || normalizedNoticeClass === 'all') {
                            // Only if targeted to all sections of this class OR specifically to student's section
                            const sectionMatch = normalizedNoticeSection === 'all' || normalizedNoticeSection === normalizedStudentSection;
                            return sectionMatch;
                        }
                        return false;
                    });
                    
                    console.log('Filtered notices count:', filteredNotices.length);
                }
                
                // If no notices to show after filtering
                if (filteredNotices.length === 0) {
                    noticeList.innerHTML = '<div class="no-notices">No notices available for your class and section.</div>';
                    return;
                }
                
                // Add filtered notices to the DOM
                filteredNotices.forEach(notice => {
                    const noticeDate = new Date(notice.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    
                    // Build notice using safe DOM methods instead of insertAdjacentHTML
                    const noticeDiv = document.createElement('div');
                    noticeDiv.className = 'notice-item' + (notice.important ? ' notice-important' : '');
                    noticeDiv.setAttribute('data-category', notice.category || 'general');
                    noticeDiv.setAttribute('data-id', notice._id);
                    
                    const header = document.createElement('div');
                    header.className = 'notice-header';
                    
                    const titleH3 = document.createElement('h3');
                    titleH3.textContent = notice.title || '';
                    header.appendChild(titleH3);
                    
                    const badge = document.createElement('span');
                    badge.className = 'notice-badge ' + (notice.category || 'general');
                    badge.textContent = notice.category ? notice.category.charAt(0).toUpperCase() + notice.category.slice(1) : 'General';
                    header.appendChild(badge);
                    
                    noticeDiv.appendChild(header);
                    
                    const meta = document.createElement('div');
                    meta.className = 'notice-meta';
                    
                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'notice-date';
                    dateSpan.innerHTML = '<i class="fas fa-calendar-alt"></i> ' + noticeDate;
                    meta.appendChild(dateSpan);
                    
                    const authorSpan = document.createElement('span');
                    authorSpan.className = 'notice-author';
                    authorSpan.innerHTML = '<i class="fas fa-user"></i> ' + escapeHtml(notice.author || '');
                    meta.appendChild(authorSpan);
                    
                    noticeDiv.appendChild(meta);
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'notice-content';
                    const contentP = document.createElement('p');
                    contentP.textContent = notice.content || '';
                    contentDiv.appendChild(contentP);
                    noticeDiv.appendChild(contentDiv);
                    
                    const footer = document.createElement('div');
                    footer.className = 'notice-footer';
                    
                    if (notice.attachment) {
                        const attachA = document.createElement('a');
                        attachA.href = '/api/notice/attachment/' + notice.attachment.split('/').pop();
                        attachA.className = 'notice-attachment';
                        attachA.target = '_blank';
                        attachA.innerHTML = '<i class="fas fa-paperclip"></i> ' + escapeHtml(notice.attachment.split('/').pop());
                        footer.appendChild(attachA);
                    }
                    
                    const actionsSpan = document.createElement('span');
                    actionsSpan.className = 'notice-actions admin-only';
                    actionsSpan.innerHTML = '<button class="btn-icon btn-edit"><i class="fas fa-edit"></i></button><button class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>';
                    footer.appendChild(actionsSpan);
                    
                    noticeDiv.appendChild(footer);
                    noticeList.appendChild(noticeDiv);
                });

                if (userRole === 'student' && userClass && userSection) {
                    // Add a message at the top of the notices section
                    const noticesHeader = document.querySelector('.notices-section .section-header');
                    if (noticesHeader && !noticesHeader.querySelector('.student-filter-info')) {
                        const filterInfo = document.createElement('div');
                        filterInfo.className = 'student-filter-info';
                        filterInfo.innerHTML = '<div class="filter-badge"><i class="fas fa-filter"></i> Showing notices for Class ' + escapeHtml(userClass) + ', Section ' + escapeHtml(userSection) + '</div>';
                        noticesHeader.appendChild(filterInfo);
                    }
                }
                
                // If teacher is viewing notices, add a message about access
                if (userRole === 'teacher') {
                    // Add a message at the top of the notices section
                    const noticesHeader = document.querySelector('.notices-section .section-header');
                    if (noticesHeader && !noticesHeader.querySelector('.teacher-filter-info')) {
                        fetch('/api/teacher/notice-sections/' + localStorage.getItem('user_id'), {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        })
                        .then(response => {
                            if (!response.ok) throw new Error('Failed to fetch teacher notice sections');
                            return response.json();
                        })
                        .then(data => {
                            let accessList = [];
                            // Add all assigned class-section combos
                            if (data.noticeSections && data.noticeSections.length > 0) {
                                data.noticeSections.forEach(combo => {
                                    if (combo.includes('-')) {
                                        const [cls, section] = combo.split('-');
                                        accessList.push('<span style=\'display:inline-block;margin-bottom:4px;\'>Class <b>' + escapeHtml(cls) + '</b>, Section <b>' + escapeHtml(section) + '</b></span>');
                                    }
                                });
                            }
                            if (data.classTeacherClass && data.classTeacherSection) {
                                accessList.push('<span style=\'display:inline-block;margin-bottom:4px;\'><b>Class ' + escapeHtml(data.classTeacherClass) + ', Section ' + escapeHtml(data.classTeacherSection) + '</b> <span style=\'background:#1976d2;color:#fff;border-radius:6px;padding:2px 8px;font-size:0.85em;margin-left:6px;\'>Class Teacher</span></span>');
                            }
                            if (accessList.length === 0) {
                                accessList.push('<span style="color:#888;">No section access assigned.</span>');
                            }
                            const filterInfo = document.createElement('div');
                            filterInfo.className = 'teacher-filter-info';
                            filterInfo.innerHTML = '<div class="filter-badge" style="background:#e3f0ff;padding:1em 1.5em 1em 1.5em;border-radius:1em;"><i class="fas fa-filter"></i> <b>You have access to notices for:&nbsp&nbsp&nbsp</b><br><div style="margin-top:1em;display:flex;flex-direction:column;gap:0.5em;">' + accessList.join('') + '</div></div>';
                            noticesHeader.appendChild(filterInfo);
                        })
                        .catch(error => {
                            console.error('Error fetching teacher notice sections:', error);
                            const filterInfo = document.createElement('div');
                            filterInfo.className = 'teacher-filter-info';
                            filterInfo.innerHTML = '<div class="filter-badge"><i class="fas fa-filter"></i> Showing notices based on your section access settings</div>';
                            noticesHeader.appendChild(filterInfo);
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching notices:', error);
                noticeList.innerHTML = '<div class="notice-error">Error loading notices: ' + escapeHtml(error.message) + '</div>';
            });
        }
    }

    // ---- Toast Notification Function ----
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');
        
        // Set message and icon
        toastMessage.textContent = message;
        
        if (type === 'success') {
            toast.className = 'toast active success';
            toastIcon.className = 'toast-icon fas fa-check-circle';
        } else {
            toast.className = 'toast active error';
            toastIcon.className = 'toast-icon fas fa-exclamation-circle';
        }
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('active');
        }, 100);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }

    // Function to fetch class and section data
    function fetchClassAndSectionData() {
        const classDropdown = document.getElementById('targetClass');
        const sectionDropdown = document.getElementById('targetSection');
        const token = localStorage.getItem("auth_token");

        // Clear dropdowns
        classDropdown.innerHTML = '<option value="all">All Classes</option>';
        sectionDropdown.innerHTML = '<option value="all">All Sections</option>';

        // Fetch classes from API
        fetch('/api/teacher/classes', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch class data');
            return response.json();
        })
        .then(data => {
            if (data && data.classes && data.classes.length > 0) {
                // Populate class dropdown
                data.classes.sort().forEach(cls => {
                    const option = document.createElement('option');
                    option.value = cls;
                    option.textContent = `Class ${cls}`;
                    classDropdown.appendChild(option);
                });
            }

            // When class changes, fetch sections for that class
            classDropdown.addEventListener('change', function() {
                const selectedClass = this.value;
                sectionDropdown.innerHTML = '<option value="all">All Sections</option>';

                if (selectedClass === 'all') {
                    // If "All Classes" selected, show all unique sections (if available)
                    if (data.sections && data.sections.length > 0) {
                        data.sections.sort().forEach(section => {
                            const option = document.createElement('option');
                            option.value = section;
                            option.textContent = `Section ${section}`;
                            sectionDropdown.appendChild(option);
                        });
                    }
                } else {
                    // Fetch sections for the selected class
                    fetch(`/api/teacher/sections/${selectedClass}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to fetch sections');
                        return response.json();
                    })
                    .then(sections => {
                        sectionDropdown.innerHTML = '<option value="all">All Sections</option>';
                        if (Array.isArray(sections) && sections.length > 0) {
                            sections.sort().forEach(section => {
                                const option = document.createElement('option');
                                option.value = section;
                                option.textContent = `Section ${section}`;
                                sectionDropdown.appendChild(option);
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching sections:', error);
                    });
                }
            });

            // Trigger change event to load sections for the default selection
            classDropdown.dispatchEvent(new Event('change'));
        })
        .catch(error => {
            console.error('Error fetching class/section data:', error);
            // Fallback to hardcoded values if API fails
            const fallbackClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
            const fallbackSections = ['A', 'B', 'C', 'D'];
            fallbackClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = `Class ${cls}`;
                classDropdown.appendChild(option);
            });
            fallbackSections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = `Section ${section}`;
                sectionDropdown.appendChild(option);
            });
        });
    }

    // Fallback to auth profile if student profile doesn't have required data
    function fetchFromAuthProfile() {
        fetch('/api/auth/profile', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch auth profile');
            }
            return response.json();
        })
        .then(profileData => {
            console.log('Auth profile data:', profileData);
            
            let studentClass, studentSection;
            
            if (profileData.roleData) {
                studentClass = profileData.roleData.class;
                studentSection = profileData.roleData.section;
            }
            
            console.log('Auth profile - class:', studentClass, 'section:', studentSection);
            
            // Get all notices and filter them
            fetchAndFilterNotices(studentClass, studentSection);
        })
        .catch(error => {
            console.error('Error fetching auth profile:', error);
            // Fetch all notices without filtering as last fallback
            fetchAndFilterNotices();
        });
    }
});