# Finance Dashboard API
This project is a RESTful API built with Node.js, Express, and SQLite, designed to manage financial records and handle role-based access control. 

My main goal with this implementation was to create a clean, maintainable, and easy-to-evaluate system .

# Single-File Structure
You will notice the core application logic is contained entirely within `server.js`. In a real-world production environment, I would have split this into a modular architecture (separating routes, controllers, middlewares, and database logic). However, for the scope of this assessment, a single-file approach makes it significantly easier for you to read top-to-bottom and trace the data flow without jumping between multiple files.

# Database Selection
I chose SQLite for data persistence. It is incredibly lightweight and requires zero external configuration or database servers on your end. More importantly, it natively supports standard SQL aggregation functions, which allowed me to offload the heavy lifting for the dashboard analytics (like calculating totals and category breakdowns) directly to the database layer rather than processing arrays in Node.js.

# Simplified Authentication
To keep the focus on authorization and business logic, I implemented a mock authentication middleware. Instead of requiring a full JWT login flow, the API reads an `x-user-id` header to identify the user making the request. This perfectly simulates an environment where an API gateway handles the actual authentication and forwards the user identity to this backend service.

# Setup and Installation

1. Clone or download this repository to your local machine.
2. Open your terminal in the project folder and install the dependencies:
   `npm install`
3. Start the development server:
   `npm start`

The server will start on `http://localhost:3000`. On its very first run, it will automatically create a local `database.sqlite` file and seed an initial Admin user (ID: 1) so you can start testing immediately.

## Roles and Access Levels

The system enforces strict access control based on three user roles:

* **Viewer:** Has read-only access. They can view the financial records but cannot create, modify, or delete them.
* **Analyst:** Can view financial records and has permission to access the aggregated summary data for dashboard reporting.
* **Admin:** Has unrestricted access. They can create new users, assign roles, and create or manage financial records.

## Assumptions and Tradeoffs

* **Pagination:** I intentionally left out pagination on the GET records endpoint to keep the API footprint small, though it would be a mandatory addition before going to production.
* **Currency:** I assumed all financial amounts are standard numbers representing a single base currency.
* **Soft Deletes:** To keep the database schema simple, I assumed that any future delete operations would be hard deletes, though implementing a `deleted_at` timestamp would be my preferred approach for a real finance application.

## API Endpoints Reference

### User Management
* `POST /api/users` (Requires Admin): Creates a new user.
* `GET /api/users` (Requires Admin): Fetches all users.

### Financial Records
* `POST /api/records` (Requires Admin): Creates a new transaction.
* `GET /api/records` (All roles): Fetches records. Supports `?type=` and `?category=` filters.

### Analytics
* `GET /api/summary` (Requires Analyst or Admin): Returns dashboard summary data.