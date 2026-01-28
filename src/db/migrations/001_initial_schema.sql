-- Users table
-- Note: Users table uses different column names than local DB to demonstrate
-- that remote and local schemas don't need to match
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    modified_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Categories table
-- Local DB uses: title, created_at, updated_at
-- Remote DB uses: name, created_timestamp, modified_at
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,  -- Maps to 'title' in local DB
    created_timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,  -- Maps to 'created_at'
    modified_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,  -- Maps to 'updated_at'
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Todos table
-- Local DB uses: title, description, is_completed, created_at, updated_at
-- Remote DB uses: name, details, done, created_timestamp, modified_at
CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,  -- Maps to 'title' in local DB
    details TEXT,  -- Maps to 'description' in local DB
    done BOOLEAN NOT NULL DEFAULT FALSE,  -- Maps to 'is_completed' in local DB
    created_timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,  -- Maps to 'created_at'
    modified_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,  -- Maps to 'updated_at'
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_modified_at ON categories(modified_at);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_category_id ON todos(category_id);
CREATE INDEX IF NOT EXISTS idx_todos_modified_at ON todos(modified_at);
