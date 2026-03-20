# 📚 NEU Library Visitor Management System v2

A web-based library visitor check-in system for **New Era University**. Built with vanilla HTML/CSS/JavaScript and powered by **Firebase** (Authentication + Firestore + Hosting).

🌐 **Live Site:** https://neu-libraryv2-7000e.web.app

---

## ✨ Features

| Feature | Details |
|---|---|
| **Google OAuth** | Sign in with `@neu.edu.ph` Google Workspace accounts only |
| **Email / Password** | Standard credential login using NEU institutional email |
| **Role-based access** | `visitor` (check-in) and `admin` (dashboard) roles |
| **Dual-role switching** | Staff who are also admins can switch views without logging out |
| **Visitor check-in** | Purpose checkboxes, college selection, auto sign-out countdown |
| **Admin dashboard** | Live stats, charts (trend/college/purpose/type), filters by date/college/type |
| **Visitor log** | Full searchable table of all check-in records |
| **User management** | View all users, block/unblock accounts |
| **CSV export** | Export visitor data for any date range |
| **Real-time clock** | Live PHT clock on the login page |

---

## 🗂️ File Structure

```
neu-library/
├── index.html              # Login / Register page
├── checkin.html            # Visitor check-in page
├── dashboard.html          # Admin dashboard
├── global.css              # Shared CSS variables, resets, components
├── login.css               # Login page styles + modal styles
├── checkin.css             # Check-in page styles
├── dashboard.css           # Dashboard styles
├── firebase.js             # Firebase app init
├── storage.js              # Firestore data layer (all DB operations)
├── auth.js                 # Firebase Auth logic (login, register, Google OAuth)
├── login.js                # Login page JS (UI logic)
├── checkin.js              # Check-in page JS
├── dashboard.js            # Dashboard JS (charts, tables, filters)
├── reports.js              # CSV export logic
├── firebase.json           # Firebase Hosting + Firestore deploy config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
├── .firebaserc             # Firebase project alias
├── .gitignore
├── neuLogo.png             # NEU logo (required)
└── neuBg.jpg               # Background image (required)
```

---

## 👤 Admin Accounts

| Email | Role | Login Method |
|---|---|---|
| `clarkangel.deleon@neu.edu.ph` | Admin + Visitor | Google OAuth |
| `jcesperanza@neu.edu.ph` | Admin + Visitor | Google OAuth |

> To add more admins: register their account first, then go to Firestore → `users` collection → find their document → change `roles` to `["visitor", "admin"]` and `activeRole` to `admin`.

---

## 🚀 Deploying Updates

After changing any file, run in your terminal:

```bash
# Deploy everything (hosting + rules)
firebase deploy

# Deploy only hosting (faster — use when you only changed HTML/CSS/JS)
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

---

## 🔒 Security Rules Summary

The `firestore.rules` file enforces:

| Collection | Who can read | Who can write |
|---|---|---|
| `users` | Own profile only; admins see all | User creates own profile; user/admin can update |
| `visits` | Public read for login page counters; admins see all | Any authenticated user can create |

Deleting visit records is **disabled** to preserve audit history.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| **Google sign-in popup blocked** | Allow popups for your site in browser settings |
| **"auth/unauthorized-domain" error** | Add your domain to Firebase → Authentication → Authorized domains |
| **Firestore permission denied** | Run `firebase deploy --only firestore:rules` |
| **Composite index error in console** | Run `firebase deploy --only firestore:indexes` |
| **Blank page / module errors** | Make sure you're serving over HTTP, not opening the file directly. Use `firebase serve` locally. |
| **Charts not loading** | Check browser console for errors; Chart.js CDN requires internet access |
| **Login page visitor count shows "–"** | Deploy latest `firestore.rules` — visits need public read access |
| **Check-in failed error** | Deploy latest `firestore.rules` and `storage.js` |
| **Browser showing old version** | Hard refresh with `Ctrl + Shift + R` |

---

## 💻 Local Development

To test locally before deploying:

```bash
firebase serve
# Opens at http://localhost:5000
```

> You must run `firebase serve` (not open HTML files directly) because ES Modules (`import`/`export`) require an HTTP server.

---

## 📋 Firestore Data Structure

```
users/
  {uid}/
    firstName:  "Juan"
    mi:         "D."
    lastName:   "Dela Cruz"
    email:      "juand.delacruz@neu.edu.ph"
    schoolId:   "24-13384-401"
    college:    "CICS"
    program:    "BSCS"
    userType:   "student"           // "student" | "faculty" | "staff"
    roles:      ["visitor"]         // ["visitor"] or ["visitor", "admin"]
    activeRole: "visitor"           // "visitor" | "admin"
    isBlocked:  false
    googleAuth: false
    createdAt:  "2026-03-21"

visits/
  {auto-id}/
    userId:    "{uid}"
    purpose:   "Reading Books, Research / Thesis"
    college:   "CICS"
    userType:  "student"
    timestamp: "2026-03-21T08:30:00.000Z"
    createdAt: Timestamp
```

---

## 🤝 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **Authentication:** Firebase Authentication (Google OAuth + Email/Password)
- **Database:** Firebase Firestore (NoSQL, real-time)
- **Hosting:** Firebase Hosting (CDN, HTTPS)
- **Charts:** Chart.js 4.4
- **Fonts:** EB Garamond (display), Source Sans 3 (body) via Google Fonts

---

*NEU Library Visitor Management System v2 — New Era University, Philippines*
