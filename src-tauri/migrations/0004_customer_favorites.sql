ALTER TABLE customers ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_favorite_name
ON customers (favorite DESC, name COLLATE NOCASE);
