# Interview Tracker

A full-stack web application that helps job seekers organize, monitor, and manage their job search from application to offer. The application provides a centralized dashboard for tracking applications, managing resumes, and monitoring recruiting progress.

---

## ✨ Features

### 🔐 Authentication

- Secure authentication with Clerk
- Protected routes
- User-specific dashboard and data
- JWT authentication between frontend and backend

---

### 📊 Dashboard

- Overview of application statistics
- Status summary cards
- Recent activity feed
- Upcoming interview section
- Funnel chart showing recruiting pipeline
- Personalized dashboard for each user

---

### 💼 Job Application Management

Users can:

- Create new applications
- Edit application details
- Delete applications
- Update application status
- Track interview progress

Each application stores:

- Company
- Job Title
- Location
- Salary
- Job Link
- Applied Date
- Current Status
- Notes

---

### 📌 Supported Statuses

- Applied
- Online Assessment (OA)
- Interview
- Final Round
- Offer
- Reject
- Ghosted

---

### 📄 Resume Manager

Instead of attaching one resume to every application, users have a dedicated resume library.

Features include:

- Upload multiple resumes
- Resume name
- Resume description
- View uploaded resumes
- Delete resumes
- Resume files stored securely on AWS S3

---

### ☁️ AWS S3 Integration

Resume uploads are handled through AWS S3.

Features:

- Secure cloud storage
- Unique file naming using UUID
- Public file URL generation
- Delete files from S3
- Express API integration

---

### 📈 Statistics

Automatically calculates:

- Total applications
- Number of interviews
- Offers received
- Rejections
- Online assessments
- Final rounds
- Ghosted applications

---

### 🔒 User Isolation

Every authenticated user only has access to:

- Their own dashboard
- Their own applications
- Their own resumes
- Their own statistics

---

# 🛠 Tech Stack

## Frontend

- React
- TypeScript
- Vite
- React Router
- Axios
- Clerk React SDK
- CSS

---

## Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL

---

## Authentication

- Clerk

---

## Cloud Storage

- AWS S3
- AWS SDK v3

---

## Database

- PostgreSQL

---

# 📁 Project Structure

```
InterviewTracker
│
├── client
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   ├── services
│   │   ├── hooks
│   │   ├── types
│   │   └── assets
│   └── package.json
│
├── server
│   ├── prisma
│   ├── src
│   │   ├── config
│   │   ├── controllers
│   │   ├── middleware
│   │   ├── routes
│   │   ├── utils
│   │   └── index.ts
│   └── package.json
│
└── README.md
```

---

# 🗄 Database Schema

## User

- id
- clerkId
- email

Relations

- Job Applications
- Resumes

---

## Job Application

- id
- company
- role
- location
- salary
- jobLink
- appliedDate
- notes
- status
- userId

---

## Resume

- id
- name
- description
- fileUrl
- createdAt
- userId

---

# 🚀 Getting Started

## Prerequisites

- Node.js 20+
- PostgreSQL
- npm
- Clerk Account
- AWS Account
- S3 Bucket

---

## Clone Repository

```bash
git clone https://github.com/yourusername/interview-tracker.git

cd interview-tracker
```

---

# Backend Setup

```bash
cd server

npm install
```

Create a `.env`

```env
DATABASE_URL=

CLERK_SECRET_KEY=

AWS_REGION=
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_BUCKET_NAME=
```

Generate Prisma Client

```bash
npx prisma generate
```

Run migration

```bash
npx prisma migrate dev
```

Start server

```bash
npm run dev
```

Backend

```
http://localhost:5001
```

---

# Frontend Setup

```bash
cd client

npm install
```

Create `.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=

VITE_API_URL=http://localhost:5001/api
```

Run

```bash
npm run dev
```

Frontend

```
http://localhost:5173
```

---

# 📡 REST API

## Dashboard

| Method | Endpoint |
|----------|------------------------|
| GET | /api/dashboard |

---

## Applications

| Method | Endpoint |
|----------|----------------------------|
| GET | /api/applications |
| POST | /api/applications |
| PUT | /api/applications/:id |
| PATCH | /api/applications/:id/status |
| DELETE | /api/applications/:id |

---

## Resume

| Method | Endpoint |
|----------|----------------------|
| GET | /api/resumes |
| POST | /api/resumes/upload |
| DELETE | /api/resumes/:id |

---

# 📸 Screenshots

## Dashboard

*Coming soon*

---

## Resume Manager

*Coming soon*

---

## Add Application

*Coming soon*

---

# 📅 Roadmap

### ✅ Completed

- Clerk Authentication
- JWT Authorization
- User-specific Dashboard
- CRUD Job Applications
- Dashboard Statistics
- Status Tracking
- AWS S3 Resume Upload
- Resume Library
- Delete Resume
- PostgreSQL Database
- Prisma ORM
- RESTful API
- Activity Feed
- Funnel Chart
- Protected Routes

---

### 🚧 In Progress

- Resume download button
- Better dashboard UI/UX
- Responsive mobile layout
- Edit application modal improvements
- Dashboard visual enhancements

---

### 💡 Future Features

- Search applications
- Filter by status
- Sort applications
- Calendar integration
- Interview reminders
- Resume version comparison
- Export to CSV
- Export to PDF
- Dark mode
- Analytics dashboard
- Company notes
- Interview history
- AI resume suggestions

---

# 🎯 Learning Objectives

This project demonstrates experience with:

- Full-stack web development
- REST API design
- Authentication and authorization
- Database modeling with Prisma
- Cloud storage using AWS S3
- CRUD operations
- Secure file uploads
- TypeScript
- React state management
- Backend API development
- PostgreSQL
- User data isolation

---

# 📄 License

This project is intended for educational and portfolio purposes.

---

# 👩‍💻 Author

**Rose Wei**

Computer Science Student

Full-Stack Developer