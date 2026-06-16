# COMPREHENSIVE REGRESSION AUDIT REPORT

**Audit Date:** June 16, 2026
**Type:** Full Regression + Security Verification Audit
**Scope:** All Routes, Controllers, Middleware, Frontend Files, Auth Flows, Security Controls

---

## EXECUTIVE SUMMARY

**Overall Rating: ⚠️ BROKEN — Multiple Critical Regressions Detected**

The security hardening update has introduced **significant regressions** that break core authentication flows. The migration from localStorage JWT to HTTP-only cookies is **incomplete and dysfunctional** — the frontend sends a placeholder string `"cookie"` as a Bearer token, while the real JWT is in the HTTP-only cookie. The middleware has a fragile fallback that works partially but will break when cookies expire.

**Impact:** All 3 roles (Admin, Teacher, Student) are affected. Some pages may load but API calls will silently fail or return 401 errors.

---

## CRITICAL ISSUES

### CI-1: Authentication Architecture Is Broken — Hybrid Approach Doesn't Work

**Severity: 🔴 CRITICAL**

The system uses a broken hybrid auth approach:
1. Auth server sets HTTP-only cookie (`authController.js:26-32`)
2. Auth server does NOT return JWT in response body (`authController.js:86-92`)
3. `login.js:22` stores `localStorage.setItem("auth_token", "cookie")` — stores the STRING "cookie", not a real JWT
4. All frontend JS files read `localStorage.getItem("auth_token")` and send it as `Authorization: Bearer ${token}`
5. Since token = `"cookie"`, the frontend sends `Authorization: Bearer cookie`
6. `authMiddleware.js:41-46` checks Bearer header first, sees `"cookie"`, and explicitly sets `token = undefined`
7. Falls through to `getCookieToken(req)` which reads the HTTP-only cookie
8. **Result:** Works only when the HTTP-only cookie is valid AND the Bearer header sends the placeholder `"cookie"` string

**Root cause:** Incomplete migration from localStorage JWT to cookie auth.

**Affected files:**
- `login.js:22` — stores literal string "cookie" instead of actual JWT
- `dashboard.js:136` — reads `auth_token` from localStorage
- `dashboard.js:243` — sends `Authorization: Bearer ${token}` where token = "cookie"
- Every frontend JS file (69+ occurrences) — sends Bearer token from localStorage
- `authMiddleware.js:41-46` — fragile fallback logic with magic string "cookie"

**Fix required:** Either:
A. Remove HTTP-only cookie approach and return JWT in response body (revert to localStorage), OR
B. Remove all Bearer header logic from middleware, remove all `Authorization` headers from frontend, rely exclusively on cookies

---

### CI-2: No Server-Side Logout Endpoint

**Severity: 🔴 CRITICAL**

There is no logout route. Logout is purely client-side (`localStorage.removeItem`). The HTTP-only cookie cannot be cleared client-side, so the user remains "authenticated" in the browser session.

**Evidence:**
- `dashboard.js:448-460` — logout just clears localStorage
- `authRoutes.js` — no logout route defined
- `authController.js` — no logout function

**Impact:** Cannot invalidate server-side sessions. HTTP-only cookie remains valid until it expires (1 hour).

---

### CI-3: Student Controller Returns JWT in Response Body

**Severity: 🔴 CRITICAL**

`studentController.js:146-163` generates a JWT and returns it directly in the response body, completely bypassing the cookie auth mechanism. This introduces XSS vulnerability since the token is accessible to JavaScript.

```javascript
const token = jwt.sign(
    { id: student._id, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
);

res.json({
    message: "Login successful",
    student: { ... },
    token,  // <-- JWT in response body!
    expiresAt: ...
});
```

**Impact:** Any XSS vulnerability can steal the JWT token.

---

### CI-4: Teacher Controller Returns JWT in Response Body

**Severity: 🔴 CRITICAL**

`teacherController.js:69-83` (registerTeacher) and `teacherController.js:105-119` (loginTeacher) both return JWTs in response body instead of using HTTP-only cookies.

---

### CI-5: `express-rate-limit` Missing from package.json

**Severity: 🔴 CRITICAL**

**File:** `package.json`
`express-rate-limit` is imported in `index.js:65` but NOT listed as a dependency. Fresh deployments will crash with `Error: Cannot find module 'express-rate-limit'`.

---

### CI-6: Wrong HTTP Status Code for Validation Errors

**Severity: 🔴 CRITICAL**

`adminController.js:509` returns HTTP 404 (Not Found) when missing required fields. Should be 400 (Bad Request).

```javascript
if (!name || !email || !phone || !password || !role) {
    return res.status(404).json({ success: false, message: 'Missing required fields...' });
    //               ^^^^ WRONG — should be 400
}
```

**Impact:** Frontend error handling that checks for 400 will incorrectly interpret this as "not found".

---

## SECURITY ISSUES

### SI-1: Cookie Security Flaw — Missing `expires` field

**Severity: ⚠️ HIGH**

**File:** `authController.js:25-33`

The auth cookie has `maxAge: 60 * 60 * 1000` (1 hour) but does NOT set the `expires` field. While `maxAge` should work, some older browsers ignore `maxAge` and require `expires`. Additionally, the `secure` flag is only set in production.

```javascript
res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // Not secure in dev
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,
    path: '/'
});
```

---

### SI-2: IDOR in Homework Controller — Incomplete Ownership Check

**Severity: ⚠️ HIGH**

**File:** `homeworkController.js:155-202`

`getClassHomework` allows teachers to access homework if assigned classes are empty:
```javascript
const hasAccess = assignedClasses.length === 0 || assignedClasses.includes(classValue);
```
If `assignedClasses` is empty (no class teacher assignment), ANY teacher can view ANY class's homework.

---

### SI-3: No Ownership Check on Homework Update/Delete — Only TeacherID

**Severity: ⚠️ HIGH**

**File:** `homeworkController.js:221-268`

`updateHomework` and `deleteHomework` check that the homework's `teacher` field matches `req.user._id`, but there's no admin override. Admin users cannot update/delete homework directly.

---

### SI-4: No Logout Cookie Clearing

**Severity: ⚠️ HIGH**

When user clicks logout on frontend (`dashboard.js:448-460`), localStorage is cleared but the HTTP-only cookie remains valid. If Keep-Alive is still running, the cookie remains active for up to 1 hour.

---

### SI-5: Keep-Alive Maintains Auth Indefinitely

**Severity: ⚠️ MEDIUM**

`dashboard.js:115-124` pings `/api/health` every 9 minutes. Since the auth token expires in 1 hour, and the keep-alive does NOT refresh the token, the user's token will eventually expire. However, the keep-alive does not prevent expiry — it only keeps the backend from sleeping.

**Note:** This is actually a false positive on severity — the keep-alive doesn't refresh tokens, so expiry still happens. However, without a refresh token mechanism, the user must re-login after 1 hour.

---

## ROLE-BASED ISSUES

### Admin

| Feature | Status | Issue |
|---------|--------|-------|
| Login | ⚠️ BROKEN | Auth hybrid flow — works only because cookie falls through |
| Dashboard | ⚠️ BROKEN | Profile fetch sends Bearer "cookie" header |
| Profile Update | ⚠️ BROKEN | Same auth issue |
| User Management | ⚠️ BROKEN | All CRUD operations broken by auth flow |
| Fee Management | ⚠️ BROKEN | admin-fees.html sends Bearer from localStorage |
| Notice Board | ⚠️ BROKEN | noticeboard.js sends Bearer from localStorage |
| Attendance Status | ⚠️ BROKEN | Same auth issue |
| Communications | ⚠️ BROKEN | admin-communications.html sends Bearer from localStorage |
| Timetable | ⚠️ BROKEN | admin-timetable.html sends Bearer from localStorage |
| Add User | ⚠️ WRONG STATUS | Returns 404 instead of 400 for validation errors |
| Bulk Import | ⚠️ BROKEN | Auth flow |
| Fee Analytics | ⚠️ BROKEN | Auth flow |
| Reports | ⚠️ BROKEN | admin-results.js uses localStorage.getItem('token') — WRONG KEY |

### Teacher

| Feature | Status | Issue |
|---------|--------|-------|
| Login | ⚠️ BROKEN | Auth hybrid flow |
| Dashboard | ⚠️ BROKEN | Auth hybrid flow |
| Profile | ⚠️ BROKEN | Auth hybrid flow |
| Attendance Marking | ⚠️ BROKEN | mark-attendance.js reads auth_token from localStorage |
| Homework Creation | ⚠️ BROKEN | assign-homework.html, homework.js all read localStorage |
| Homework Editing | ⚠️ BROKEN | Same auth issue |
| Homework Deletion | ⚠️ BROKEN | Same auth issue |
| Results Entry | ⚠️ BROKEN | admin-results.js uses wrong localStorage key 'token' |
| Class Lists | ⚠️ BROKEN | Auth flow |
| Student Details | ⚠️ BROKEN | Auth flow |
| Notice Board | ⚠️ BROKEN | noticeboard.js auth flow |
| Teacher Attendance | ⚠️ BROKEN | Auth flow |
| Communications | ⚠️ BROKEN | admin-communications.html auth flow |

### Student

| Feature | Status | Issue |
|---------|--------|-------|
| Login | ⚠️ BROKEN | Auth hybrid flow |
| Dashboard | ⚠️ BROKEN | Auth hybrid flow |
| Profile | ⚠️ BROKEN | Auth hybrid flow |
| Attendance View | ⚠️ BROKEN | attendance.js sends Bearer from localStorage |
| Results View | ⚠️ BROKEN | view-results.js reads localStorage auth_token |
| Homework View | ⚠️ BROKEN | view-homework.html auth flow |
| Homework Submission | ⚠️ BROKEN | view-homework.html auth flow |
| Fee Details | ⚠️ BROKEN | fee-details.html auth flow |
| Notice Board | ⚠️ BROKEN | noticeboard.js auth flow |
| Communications | ⚠️ BROKEN | complaints.html auth flow |

---

## AUTHENTICATION ISSUES

| # | Issue | File | Severity |
|---|-------|------|----------|
| A1 | localStorage stores "cookie" string instead of JWT | login.js:22 | 🔴 CRITICAL |
| A2 | All frontend JS reads auth_token from localStorage (69+ occurrences) | Multiple files | 🔴 CRITICAL |
| A3 | All frontend JS sends Bearer header with placeholder "cookie" value | Multiple files | 🔴 CRITICAL |
| A4 | Middleware treats "cookie" string as magic value to fall through | authMiddleware.js:43 | 🔴 CRITICAL |
| A5 | No server-side logout endpoint | N/A | 🔴 CRITICAL |
| A6 | Student login returns JWT in response body | studentController.js:146-163 | 🔴 CRITICAL |
| A7 | Teacher login returns JWT in response body | teacherController.js:105-119 | 🔴 CRITICAL |
| A8 | Teacher register returns JWT in response body | teacherController.js:69-83 | 🔴 CRITICAL |
| A9 | admin-results.js uses wrong localStorage key 'token' (not 'auth_token') | admin-results.js | 🔴 CRITICAL |
| A10 | No refresh token mechanism | N/A | ⚠️ HIGH |
| A11 | admin-only route at teacherRoutes.js:150 has no auth check for registerTeacher | teacherRoutes.js:150 | ⚠️ HIGH |
| A12 | Cookie not cleared on logout | dashboard.js:448-460 | ⚠️ HIGH |

---

## FRONTEND ISSUES (Alert/Confirm Replacements)

| # | File | Line | Current | Suggested |
|---|------|------|---------|-----------|
| F1 | login.js | 40 | `alert(data.message || ...)` | Toast notification |
| F2 | login.js | 44 | `alert("Something went wrong...")` | Toast notification |
| F3 | dashboard.js | 220 | `alert("Session expired!...")` | Toast notification |
| F4 | dashboard.js | 335 | `alert('Failed to load user profile data')` | Toast notification |
| F5 | dashboard.js | 510 | `alert('Class management feature coming soon!')` | Toast notification |
| F6 | mark-attendance.js | Multiple | `alert(message)` | Toast notification |
| F7 | attendance.js | Multiple | `alert("Session expired!...")` | Toast notification |
| F8 | account.js | Multiple | `alert(...)` (6 occurrences) | Toast notification |
| F9 | manage-users.js | Multiple | `alert(...)` (6 occurrences) | Toast notification |
| F10 | manage-exams.js | Multiple | `alert("Session expired!...")` | Toast notification |
| F11 | school-info.js | Multiple | `alert(...)` (10+ occurrences) | Toast notification |
| F12 | view-results.js | Multiple | `alert(...)` (3 occurrences) | Toast notification |
| F13 | admin-complaints.html | Multiple | `alert(...)` (12 occurrences) | Toast notification |
| F14 | admin-fees.html | Multiple | `alert(...)` (3 occurrences) | Toast notification |
| F15 | admin-timetable.html | Multiple | `alert(...)` (4 occurrences) | Toast notification |
| F16 | fee-details.html |  | `alert(...)` | Toast notification |
| F17 | complaints.html | Multiple | `alert(...)` (3 occurrences) | Toast notification |
| F18 | admissions.html | Multiple | `alert(...)` (2 occurrences) | Toast notification |
| F19 | index.html |  | `alert(...)` | Toast notification |
| F20 | dashboard.html |  | `alert(...)` (3 occurrences) | Toast notification |
| F21 | exam-management.js |  | `alert(...)` | Toast notification |
| F22 | grade-exams.js |  | `alert(...)` (3 occurrences) | Toast notification |
| F23 | admin-inquiries.html |  | `alert('Access denied...')` | Toast notification |
| F24 | teacher-notice-access.html |  | `alert("You do not have permission...")` | Toast notification |

**Total: 88 alert() calls + 16 confirm() calls need migration to toast notifications**

---

## API ISSUES

| # | Route | Method | Issue |
|---|-------|--------|-------|
| I1 | `/api/auth/login` | POST | Auth flow broken (hybrid approach) |
| I2 | `/api/auth/logout` | POST | Route does not exist |
| I3 | `/api/auth/profile` | GET | Frontend sends Bearer "cookie" — relies on cookie fallback |
| I4 | `/api/admin/users` | POST | Returns 404 for validation errors (should be 400) |
| I5 | `/api/admin/users` | POST | Missing required fields returns 404 at line 509 |
| I6 | `/api/fees` | GET | Student fee check relies on auth — broken by auth flow |
| I7 | `/api/fees/pay` | POST | `feesController.js:54` — references `req.user.studentInfo` for admin payment (should reference target student) |
| I8 | `/api/student/profile` | GET | Returns data in `{user: {...}}` wrapper while auth profile returns flat `{_id, name, ...}` — inconsistent |
| I9 | `/api/homework/class/:classId` | GET | `getClassHomework` uses `classId` param to split by `-` but data may have different format |
| I10 | `/api/notice` | GET/POST | Uses `teacherOnly` middleware — admins can't create notices? |
| I11 | `/api/notice/:id` | PUT/DELETE | Uses `teacherOnly` middleware — admins can't manage notices? |
| I12 | `/api/attendance/:studentId` | GET | Student ownership check works, but frontend attendance.js uses wrong token |

---

## SECURITY REGRESSION VERIFICATION

| Security Fix | Status | Notes |
|-------------|--------|-------|
| Cookie Authentication | ⚠️ BROKEN | Hybrid approach — cookies set but frontend still uses localStorage Bearer |
| HTTPOnly Cookies | ✅ ACTIVE | `authController.js:27` — `httpOnly: true` |
| SameSite Protection | ✅ ACTIVE | `authController.js:28` — `sameSite: 'strict'` |
| Secure Cookies | ⚠️ PARTIAL | Only in production (`NODE_ENV === 'production'`) |
| IDOR Protection (Attendance) | ✅ ACTIVE | `attendanceController.js:506-509` |
| IDOR Protection (Results) | ✅ ACTIVE | `resultsController.js:117-119` |
| IDOR Protection (Fees) | ✅ ACTIVE | `feesController.js:50-52` — defensive admin check |
| NoSQL Injection Protection | ✅ ACTIVE | `escapeRegex()` used in admin search endpoints |
| Path Traversal Protection | ✅ ACTIVE | `noticeBoardRoutes.js:257-270` — 3-layer defense |
| Ownership Validation (Homework) | ⚠️ WEAK | Teacher check bypassed if no assignments |
| Password Security | ✅ ACTIVE | Pre-save hook hashing, no double-hash |
| Input Sanitization | ✅ ACTIVE | `sanitizeText()`, `sanitizeObjectStrings()` available but NOT used in controllers |
| Rate Limiting | ⚠️ BROKEN | `express-rate-limit` missing from package.json |

---

## RECOMMENDED FIX ORDER

### Priority 1: 🔴 BLOCKING (Must Fix Before Any Other Work)

1. **Fix Authentication Architecture** — Either:
   - Option A: Return JWT in login response body, remove cookie auth, revert to localStorage Bearer tokens
   - Option B: Remove ALL Bearer header logic from middleware, remove ALL Authorization headers from frontend, rely exclusively on cookies
2. **Add `express-rate-limit` to package.json** — `npm install express-rate-limit --save`
3. **Add server-side logout endpoint** that clears the auth cookie
4. **Fix `admin-results.js`** — change `localStorage.getItem('token')` to `localStorage.getItem('auth_token')`
5. **Fix `adminController.js:509`** — change HTTP 404 to 400 for validation errors

### Priority 2: ⚠️ HIGH (Should Fix ASAP)

6. **Remove JWT return from student/teacher controller login/register responses**
7. **Fix fee payment controller** — `feesController.js:54` should use target student's info, not admin's
8. **Add cookie clearing to logout** — server endpoint should clear the cookie
9. **Fix homework ownership** — add admin override for update/delete
10. **Fix notice board `teacherOnly` middleware** — admins should be able to manage notices

### Priority 3: 🟡 MEDIUM (Fix When Practical)

11. Migrate all `alert()` calls to toast notifications (88 occurrences)
12. Migrate all `confirm()` calls to modal/notification patterns (16 occurrences)
13. Add cookie `secure: true` in development with local HTTPS
14. Add `sanitizeText()` / `sanitizeObjectStrings()` usage to all user input in controllers
15. Standardize API response format across all endpoints
16. Add token refresh mechanism

---

## ESTIMATED EFFORT

| Priority | Effort | Details |
|----------|--------|---------|
| Priority 1 | HIGH | Auth architecture decision + implementation affects every frontend file |
| Priority 2 | MEDIUM | Targeted fixes in controllers and routes |
| Priority 3 | HIGH | 88 alert() + 16 confirm() migrations across 20+ files |

**Total Estimated Effort: HIGH (3-5 days for complete fix + testing)**

---

## RAW SEARCH RESULTS

### PHASE 1: localStorage.getItem('token') — OLD PATTERN
- `public/js/admin-results.js` — 6 occurrences
- `public/js/attendance.js` — 1 occurrence (commented out)

### PHASE 1: localStorage.getItem('auth_token') — CURRENT PATTERN
- 69 occurrences across:
  - `admin-fees.html`, `admin-communications.html`, `dashboard.html`, `fee-details.html`
  - `complaints.html`, `assign-homework.html`, `admin-complaints.html`, `admin-inquiries.html`
  - `admin-timetable.html`, `manage-timetable.html`
  - `js/account.js`, `js/attendance.js`, `js/admin-results.js`, `js/exam-management.js`
  - `js/dashboard.js`, `js/grade-exams.js`, `js/fee-alert.js`, `js/manage-users.js`
  - `js/manage-exams.js`, `js/homework.js`, `js/noticeboard.js`, `js/mark-attendance.js`
  - `js/school-info.js`, `js/view-results.js`
  - `view-homework.html`, `view-timetable.html`, `view-submissions.html`
  - `teacher-notice-access.html`

### PHASE 1: atob(token.split('.'))
- `public/js/dashboard.js:215`
- `public/js/attendance.js` (commented, active code)
- `public/js/manage-exams.js`

### PHASE 1: Authorization: Bearer
- 19+ occurrences in frontend HTML/JS sending Bearer tokens from localStorage

### PHASE 6: alert() Occurrences
- 88 total across frontend JS and HTML files
- Key files: admin-complaints.html (12), school-info.js (10+), manage-users.js (6), account.js (6), admin-timetable.html (4), dashboard.html (3), etc.

### PHASE 6: confirm() Occurrences
- 16 total across frontend files
- Key operations: delete user/complaint/notice/homework/exam confirmation, bulk operations

---

## APPENDIX: Files Requiring Auth Fix

Every frontend file that reads `localStorage.getItem("auth_token")` and sends it as a Bearer header needs to be updated if Option B (pure cookie auth) is chosen:

1. `public/js/login.js`
2. `public/js/dashboard.js`
3. `public/js/account.js`
4. `public/js/attendance.js`
5. `public/js/admin-results.js`
6. `public/js/noticeboard.js`
7. `public/js/mark-attendance.js`
8. `public/js/homework.js`
9. `public/js/manage-users.js`
10. `public/js/manage-exams.js`
11. `public/js/exam-management.js`
12. `public/js/grade-exams.js`
13. `public/js/fee-alert.js`
14. `public/js/school-info.js`
15. `public/js/view-results.js`
16. `public/admin-fees.html`
17. `public/admin-complaints.html`
18. `public/admin-inquiries.html`
19. `public/admin-timetable.html`
20. `public/admin-communications.html`
21. `public/fee-details.html`
22. `public/complaints.html`
23. `public/assign-homework.html`
24. `public/view-homework.html`
25. `public/view-timetable.html`
26. `public/view-submissions.html`
27. `public/manage-timetable.html`
28. `public/dashboard.html`
29. `public/teacher-notice-access.html`
30. `public/admissions.html`

---

## FINAL VERDICT

**Current State: ⚠️ NOT PRODUCTION-READY**

The security fixes applied (cookie auth, IDOR protection, path traversal, NoSQL injection, etc.) are technically correct at the backend middleware/controller level, but the **authentication plumbing between frontend and backend is fundamentally broken**.

The system will appear to work initially because:
1. Login stores `"cookie"` string in localStorage 
2. All API calls send `Authorization: Bearer cookie`
3. `authMiddleware.js:43` sees this as the magic string and falls through to cookie parsing
4. The real JWT in the HTTP-only cookie authenticates the request

This breaks when:
- The HTTP-only cookie expires (1 hour) — all API calls fail
- A page is loaded without the cookie (e.g., after browser restart) — redirects to login
- Any code path that doesn't follow this fragile fallback

**Recommended action:** Fix Priority 1 items before any further development or deployment. The auth architecture decision (Option A or Option B) must be made first, as it affects every single frontend file.