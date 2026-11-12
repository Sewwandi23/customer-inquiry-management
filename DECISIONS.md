
# Technical Decisions – Customer Inquiry Management System

## 1. Authentication

JWT-based authentication is used to protect inquiry management API endpoints. Passwords are hashed using bcrypt before being stored in the database.

Unauthenticated users cannot access protected dashboard APIs.

## 2. Inquiry Access

Any authenticated staff member can view and manage all inquiries. The `created_by` field records which staff member created each inquiry for auditing purposes.

## 3. Input Validation

Zod validation is implemented on the backend to validate customer names, contact methods, contact values, subjects, descriptions, and inquiry status values.

Invalid requests are rejected with appropriate HTTP error responses.

The system allows duplicate inquiries to be recorded separately. This is because the same customer may contact the organization multiple times about similar or different issues.

## 4. Inquiry Status Workflow

The system supports the following status transitions:

- New → In Progress
- In Progress → Resolved

Resolved inquiries cannot be moved to another status. This prevents completed inquiries from being reopened through the current workflow.

## 5. Concurrent Updates

Optimistic concurrency control is implemented using a version number.

When a staff member updates an inquiry, the current version must match the database version. If another user has already updated the record, the API returns HTTP 409 Conflict. The frontend allows the user to refresh and view the latest information.

## 6. Error Handling

The application handles authentication errors, invalid input, missing inquiry records, network failures, and concurrent update conflicts.

Loading, empty, success, and error states are provided in the frontend.

## 7. Database Design

PostgreSQL is used for persistent data storage.

Staff and inquiry information are stored in separate tables. Foreign keys maintain relationships, while constraints protect valid contact methods and inquiry statuses.

## 8. Testing

Backend tests use Node.js built-in test runner and Supertest. Frontend tests use Vitest and React Testing Library.

The application was also manually tested for login, inquiry creation, searching, filtering, status updates, invalid IDs, unauthorized access, and concurrent updates.

Automated tests verify the login page rendering, invalid login feedback, API availability, and unauthorized API access.

## 9. Trade-offs and Assumptions

- All authenticated staff members can access all inquiries.
- Only the defined forward status transitions are supported.
- External notification services are not included.
- PostgreSQL is used instead of a cloud database to keep the assessment setup straightforward.

## 10. AI Tool Usage Disclosure

AI tools were used as development assistance for understanding requirements, troubleshooting errors, improving code structure, and preparing documentation.

The implementation was reviewed, run, and tested by the developer. Final technical decisions and project verification were performed by the developer.

## 11. Future Improvements

The following improvements could be considered in future versions:

- Add administrator-managed staff account creation and management.
- Introduce role-based access control if different staff permissions are required.
- Add pagination for handling a large number of inquiries.
- Improve automated test coverage for inquiry validation, status transitions, and concurrent updates.
- Add email notifications for important inquiry status changes.
- Deploy the application to a production environment.

These improvements were not included to keep the implementation focused on the assessment requirements and the available development time.
