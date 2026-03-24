<<<<<<< HEAD
# Full-Stack To-Do Web Application

A modern, sleek, and minimal To-Do list web application built with a Vanilla HTML/CSS/JS frontend and Node.js + Express + PostgreSQL backend.

## Features

- **User Authentication**: Register, Login, Logout with JWT.
- **Task Management**: Create, view, update, and delete tasks.
- **Bonus Features**: Due dates, task filtering, search function, toast notifications, loading spinners.
- **UI/UX**: Responsive modern dark-theme design with glassmorphism and smooth animations.

## Folder Structure

```
project/
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD GitHub Actions workflow
├── frontend/
│   ├── index.html          # Main HTML structure
│   ├── style.css           # UI Styles
│   └── app.js              # Application logic and API calls
├── backend/
│   ├── db/
│   │   ├── index.js        # PostgreSQL pool configuration
│   │   └── schema.sql      # Database tables definition
│   ├── middleware/
│   │   └── auth.js         # JWT validation middleware
│   ├── routes/
│   │   ├── auth.js         # Register/Login paths
│   │   └── tasks.js        # CRUD endpoints for tasks
│   ├── package.json        
│   └── server.js           # Express app entrypoint
├── .env.example
├── .gitignore
└── README.md
```

## Setup Instructions (Local Development)

### Prerequisites
- Node.js (v16+)
- PostgreSQL installed and running locally.

### 1. Database Setup
Create a PostgreSQL database named `todo_db`.
Run the SQL queries found in `backend/db/schema.sql` against your new database to set up the `users` and `tasks` tables.

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder (you can copy `.env.example` from the root):
   ```
   PORT=5000
   DATABASE_URL=postgres://youruser:yourpassword@localhost:5432/todo_db
   JWT_SECRET=your_super_secret_key
   NODE_ENV=development
   ```
4. Start the server:
   ```bash
   node server.js
   ```
   The backend will start running on `http://localhost:5000`.

### 3. Frontend Setup
1. The frontend uses Vanilla HTML/CSS/JS and does not require a build step.
2. In `frontend/app.js`, the `API_URL` is set to `http://localhost:5000/api` by default.
3. Open `frontend/index.html` directly in your browser, or serve it using an extension like VSCode's "Live Server" for the best experience.

## Deployment Steps

This repository includes a GitHub Actions configuration for automated deployment (`.github/workflows/deploy.yml`).

### Frontend Deployment (Vercel)
1. Push your code to GitHub.
2. Log in to [Vercel](https://vercel.com/) and import your GitHub repository.
3. Set the Root Directory to `frontend`.
4. Deploy the application.
5. Note your deployed frontend URL. Update the `API_URL` in `app.js` to point to your hosted backend URL, then push changes to trigger a re-deploy.

### Backend Deployment (Render or Railway)
1. Log in to [Render](https://render.com/) or [Railway](https://railway.app/).
2. Create a new PostgreSQL Database instance. Copy the Internal or External Database URL.
3. Create a new Web Service and link your GitHub repository.
4. Set the Root Directory to `backend` and the Start Command to `node server.js`.
5. Add the Environment Variables:
   - `DATABASE_URL` (From step 2)
   - `JWT_SECRET` (A secure random string)
   - `NODE_ENV=production`
6. Deploy the service.

### Automated CI/CD Setup
If you want GitHub Actions to automatically deploy on `git push`:
1. In your GitHub repository settings goes to `Settings > Secrets and variables > Actions`.
2. Add secrets for Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
3. Add a secret for Render: `RENDER_DEPLOY_HOOK_URL` (you can find this in Render settings for your Web Service).
4. Now, every push to `main` will re-deploy your application seamlessly.
=======
# manplanner
Full-stack To-Do web app (Node.js/Express + PostgreSQL + Vanilla JS) with JWT auth and a modern glassmorphism UI
>>>>>>> 2901bfb2d897cc164e076ae13f44ba9dc9b7b519
