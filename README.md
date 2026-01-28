# Todo POC Backend

Node.js/Express backend for the WatermelonDB offline-first Todo app.

## Quick Start

```bash
# Install dependencies
npm install

# Start PostgreSQL
brew services start postgresql@16

# Create database (first time only)
/opt/homebrew/opt/postgresql@16/bin/createdb todo_poc

# Run migrations
npm run migrate

# Start server
npm run dev
```

Server runs at `http://localhost:3000`

## Environment Variables

Create `.env` file:
```
DATABASE_URL=postgresql://aman@localhost:5432/todo_poc
PORT=3000
NODE_ENV=development
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| GET/POST/PUT/DELETE | `/api/categories` | Category CRUD |
| GET/POST/PUT/DELETE | `/api/todos` | Todo CRUD |
| POST | `/api/sync/pull` | Pull changes |
| POST | `/api/sync/push` | Push changes |

## Database Schema

**Note:** Column names differ from client (demonstrating sync field mapping)

| Client Field | Server Column |
|--------------|---------------|
| title | name |
| description | details |
| is_completed | done |
| created_at | created_timestamp |
| updated_at | modified_at |

## Query Commands

```bash
# Connect to database
/opt/homebrew/opt/postgresql@16/bin/psql -d todo_poc

# List users
SELECT id, email FROM users;

# List todos for a user
SELECT t.name, t.details, t.done 
FROM todos t 
JOIN users u ON t.user_id = u.id 
WHERE u.email = 'test@example.com';
```

## Scripts

- `npm run dev` - Start with hot reload
- `npm run build` - Compile TypeScript
- `npm run start` - Run compiled code
- `npm run migrate` - Run database migrations

---

See `/Users/aman/Desktop/POCs/DOCUMENTATION.md` for full project documentation.
