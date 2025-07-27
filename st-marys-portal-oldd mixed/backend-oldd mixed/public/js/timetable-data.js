// Timetable static data for all classes, sections, teachers
// Edit this file to update the timetable for the whole school
// Accessible as window.timetableData

window.timetableData = {
  periods: [
    { id: 1, time: '9:30 - 10:15 AM' },
    { id: 2, time: '10:15 - 11:00 AM' },
    { id: 3, time: '11:00 - 11:15 AM', isBreak: true, name: 'Interval' },
    { id: 4, time: '11:15 - 12:00 PM' },
    { id: 5, time: '12:00 - 12:45 PM' },
    { id: 6, time: '12:45 - 1:20 PM', isBreak: true, name: 'Lunch Break' },
    { id: 7, time: '1:20 - 2:00 PM' },
    { id: 8, time: '2:00 - 2:40 PM' },
    { id: 9, time: '2:40 - 2:50 PM', isBreak: true, name: 'Break' },
    { id: 10, time: '2:50 - 3:30 PM' },
    { id: 11, time: '3:30 - 4:10 PM' },
    { id: 12, time: '4:10 - 4:20 PM', isBreak: true, name: 'Diary Period' }
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  // Each entry: { class, section, day, period, subject, teacher }
  classes: [
    // Class 10-A - Monday
    { class: 'X', section: 'A', day: 'Monday', period: 1, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Monday', period: 2, subject: 'Physics', teacher: 'Teacher User-10' },
    { class: 'X', section: 'A', day: 'Monday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'A', day: 'Monday', period: 4, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Monday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Monday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Monday', period: 7, subject: 'History', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Monday', period: 8, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Monday', period: 9, subject: 'Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Monday', period: 10, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Monday', period: 11, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Monday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class 10-A - Tuesday
    { class: 'X', section: 'A', day: 'Tuesday', period: 1, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 2, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'A', day: 'Tuesday', period: 4, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 5, subject: 'History', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Tuesday', period: 7, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 8, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 9, subject: 'Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Tuesday', period: 10, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 11, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Tuesday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class 10-A - Wednesday
    { class: 'X', section: 'A', day: 'Wednesday', period: 1, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 2, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'A', day: 'Wednesday', period: 4, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 5, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Wednesday', period: 7, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 8, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 9, subject: 'Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Wednesday', period: 10, subject: 'Physical Education', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 11, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Wednesday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class 10-A - Thursday
    { class: 'X', section: 'A', day: 'Thursday', period: 1, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Thursday', period: 2, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Thursday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'A', day: 'Thursday', period: 4, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Thursday', period: 5, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Thursday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Thursday', period: 7, subject: 'History', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Thursday', period: 8, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Thursday', period: 9, subject: 'Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Thursday', period: 10, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Thursday', period: 11, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Thursday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class 10-A - Friday
    { class: 'X', section: 'A', day: 'Friday', period: 1, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Friday', period: 2, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Friday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'A', day: 'Friday', period: 4, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Friday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: '10', section: 'A', day: 'Friday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: '10', section: 'A', day: 'Friday', period: 7, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: '10', section: 'A', day: 'Friday', period: 8, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: '10', section: 'A', day: 'Friday', period: 9, subject: 'Break', isBreak: true },
    { class: '10', section: 'A', day: 'Friday', period: 10, subject: 'History', teacher: 'Teacher User' },
    { class: '10', section: 'A', day: 'Friday', period: 11, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: '10', section: 'A', day: 'Friday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class 10-A - Saturday
    { class: 'X', section: 'A', day: 'Saturday', period: 1, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Saturday', period: 2, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Saturday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'A', day: 'Saturday', period: 4, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Saturday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'A', day: 'Saturday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Saturday', period: 7, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Saturday', period: 8, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Saturday', period: 9, subject: 'Break', isBreak: true },
    { class: 'X', section: 'A', day: 'Saturday', period: 10, subject: 'Library', teacher: 'Teacher User' },
    { class: 'X', section: 'A', day: 'Saturday', period: 11, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'X', section: 'A', day: 'Saturday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class X-B - Monday
    { class: 'X', section: 'B', day: 'Monday', period: 1, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'X', section: 'B', day: 'Monday', period: 2, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'X', section: 'B', day: 'Monday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'X', section: 'B', day: 'Monday', period: 4, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'X', section: 'B', day: 'Monday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'X', section: 'B', day: 'Monday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'X', section: 'B', day: 'Monday', period: 7, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'X', section: 'B', day: 'Monday', period: 8, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'X', section: 'B', day: 'Monday', period: 9, subject: 'Break', isBreak: true },
    { class: 'X', section: 'B', day: 'Monday', period: 10, subject: 'Library', teacher: 'Teacher User' },
    { class: 'X', section: 'B', day: 'Monday', period: 11, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'X', section: 'B', day: 'Monday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class IX-C - Monday
    { class: 'IX', section: 'C', day: 'Monday', period: 1, subject: 'Mathematics', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Monday', period: 2, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'IX', section: 'C', day: 'Monday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'IX', section: 'C', day: 'Monday', period: 4, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Monday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 7, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 8, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 9, subject: 'Break', isBreak: true },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 10, subject: 'Library', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 11, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class IX-A - Tuesday
    { class: 'IX', section: 'C', day: 'Tuesday', period: 1, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 2, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 4, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 7, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 8, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 9, subject: 'Break', isBreak: true },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 10, subject: 'Library', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 11, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Tuesday', period: 12, subject: 'Diary Period', isBreak: true },
    
    // Class IX-C- Wednesday
    { class: 'IX', section: 'C', day: 'Wednesday', period: 1, subject: 'Mathematics', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 2, subject: 'Geography', teacher: 'Teacher User-2' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 3, subject: 'Interval', isBreak: true },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 4, subject: 'Chemistry', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 5, subject: 'Biology', teacher: 'Teacher User-2' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 6, subject: 'Lunch Break', isBreak: true },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 7, subject: 'English', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 8, subject: 'Physics', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 9, subject: 'Break', isBreak: true },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 10, subject: 'Library', teacher: 'Teacher User' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 11, subject: 'Computer Science', teacher: 'Teacher User-3' },
    { class: 'IX', section: 'C', day: 'Wednesday', period: 12, subject: 'Diary Period', isBreak: true },
  ],
  teachers: [
    { name: 'Teacher User', id: 'T1' },
    { name: 'Teacher User-2', id: 'T2' },
    { name: 'Teacher User-3', id: 'T3' },
    { name: 'Teacher User-4', id: 'T4' },
    { name: 'Teacher User-5', id: 'T5' }
  ]
};

// You can add more fields as needed for features like absent teachers, room numbers, etc.
// To update the timetable, just edit this file and redeploy. 