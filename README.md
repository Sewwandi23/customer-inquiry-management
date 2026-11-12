# Customer Inquiry Management System

A full-stack web application for managing customer inquiries. Staff members can log in, create inquiries, search and filter records, view inquiry details, and update inquiry statuses.

## Technologies Used

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Vitest

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- bcryptjs
- Zod
- Supertest

## Main Features

- Staff login and authentication
- Create customer inquiries
- View all inquiries
- Search inquiries
- Filter inquiries by status
- View complete inquiry details
- Update inquiry status
- Status transitions: New → In Progress → Resolved
- Input validation and error handling
- Optimistic concurrency control to handle stale updates
- Protected API routes

## Project Structure

```text
customer-inquiry-management/
├── frontend/
│   ├── app/
│   └── __tests__/
├── backend/
│   ├── config/
│   ├── database/
│   ├── middleware/
│   ├── routes/
│   └── tests/
├── README.md
└── DECISIONS.md
```

## Prerequisites

- Node.js
- npm
- PostgreSQL
- Git

## Database Setup

1. Create a PostgreSQL database named `customer_inquiry_db`.
2. Open `backend/database/schema.sql` in pgAdmin.
3. Execute the SQL script to create the required tables and indexes.

## Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the backend folder:

```env
PORT=5001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=customer_inquiry_db
DB_USER=postgres
DB_PASSWORD=your_postgresql_password
JWT_SECRET=your_secret_key
```

Start the backend:

```bash
node server.js
```

Backend URL: `http://localhost:5001`

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:3000`

## Testing

Frontend tests:

```bash
cd frontend
npm test
```

Frontend production build:

```bash
npm run build
```

Backend tests:

```bash
cd backend
node --test
```

## Authentication

Staff members must log in to access protected inquiry management features. The backend uses JWT authentication to protect API endpoints.

## Inquiry Status Workflow

```text
New → In Progress → Resolved
```

Resolved inquiries cannot be moved to another status.

## Security

- Passwords are hashed using bcrypt.
- JWT authentication protects API endpoints.
- Input validation is implemented using Zod.
- Database queries use parameterized SQL.
- Environment variables are used for sensitive configuration.

## Author

Developed as a Full-Stack Developer Internship Assessment project.

## Admin Account Setup

A default staff account can be created using the provided setup script.

1. Configure `ADMIN_PASSWORD` in the backend `.env` file.
2. Make sure the PostgreSQL database and tables are created.
3. Run the following command from the backend directory:

```bash
node create-staff.js