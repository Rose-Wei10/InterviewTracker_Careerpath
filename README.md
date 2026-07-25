# Interview Tracker

A full-stack web application that helps job seekers organize and track their internship and job applications throughout the recruiting process.

## Features

### Authentication
- Secure user authentication using Clerk
- Each user has their own private application data
- Protected dashboard routes

### Dashboard
- View application statistics
- Track application progress
- Status summary cards
- Recent application overview

### Job Application Management
- Add new applications
- Edit existing applications
- Delete applications
- Update application status
- Store:
  - Company
  - Job Title
  - Location
  - Salary
  - Applied Date
  - Job Link
  - Notes

### Application Status

Supported statuses:

- Applied
- Online Assessment (OA)
- Interview
- Final Round
- Offer
- Reject
- Ghosted

### Database

Data is stored using Prisma ORM with PostgreSQL.

Each application belongs to a specific authenticated user.

---

# Tech Stack

## Frontend

- React
- TypeScript
- Vite
- React Router
- Axios
- CSS

## Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL

## Authentication

- Clerk Authentication

---

# Project Structure

```
InterviewTracker
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   └── package.json
│
├── server/
│   ├── prisma/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── config/
│   │   └── index.ts
│   └── package.json
│
└── README.md
```

---

# Getting Started

## Prerequisites

- Node.js
- PostgreSQL
- npm
- Clerk Account

---

## Clone Repository

```bash
git clone https://github.com/yourusername/interview-tracker.git

cd interview-tracker
```

---

# Backend Setup

Navigate to the server folder.

```bash
cd server
```

Install dependencies.

```bash
npm install
```

Create a `.env` file.

Example:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/interview_tracker"

CLERK_SECRET_KEY=your_clerk_secret_key
```

Generate Prisma Client.

```bash
npx prisma generate
```

Run database migration.

```bash
npx prisma migrate dev
```

Start backend server.

```bash
npm run dev
```

Server runs at:

```
http://localhost:5001
```

---

# Frontend Setup

Navigate to the client folder.

```bash
cd client
```

Install dependencies.

```bash
npm install
```

Create `.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=your_publishable_key

VITE_API_URL=http://localhost:5001/api
```

Start development server.

```bash
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

# API Endpoints

## Applications

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/applications` | Get all user applications |
| POST | `/api/applications` | Create application |
| PUT | `/api/applications/:id` | Update application |
| DELETE | `/api/applications/:id` | Delete application |

## Dashboard

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |

---

# Current Progress

- ✅ Clerk Authentication
- ✅ Protected Routes
- ✅ PostgreSQL Database
- ✅ Prisma ORM
- ✅ CRUD Operations
- ✅ Dashboard Statistics
- ✅ Application Status Tracking
- ✅ User-specific Data Storage
- ✅ REST API
- 🚧 Dashboard Charts (In Progress)
- 🚧 CSS/UI Improvements
- 🚧 Responsive Design
- 🚧 Search & Filter
- 🚧 Resume Upload
- 🚧 Email Reminder Feature

---

# Future Improvements

- Dashboard charts
- Search and filter applications
- Sort by date or status
- Resume management
- Interview calendar
- Email reminders
- Export applications as CSV
- Dark mode
- Mobile responsive layout

---

# Screenshots

> Screenshots will be added after the UI is finalized.

---

# License

This project is for educational purposes and personal portfolio use.

---

# Author

Developed by **Rose Wei**