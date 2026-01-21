-- Create the user (use their full Entra ID email)
CREATE ROLE "user@yourfirm.com" WITH LOGIN;
-- Grant database connection permission
GRANT CONNECT ON DATABASE postgres TO "user@yourfirm.com";
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO "user@yourfirm.com";
-- Grant all privileges on existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "user@yourfirm.com";
-- Grant all privileges on future tables (so migrations work)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO "user@yourfirm.com";
-- Grant sequence permissions (for auto-incrementing IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "user@yourfirm.com";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO "user@yourfirm.com";