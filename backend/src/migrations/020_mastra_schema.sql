-- Migration: Create the `mastra` schema for Mastra AI memory storage.
-- Tables within this schema are auto-created by @mastra/pg PostgresStore on first init.
-- Run this ONCE in Supabase SQL Editor before deploying the Mastra refactor.

CREATE SCHEMA IF NOT EXISTS mastra;

-- Grant usage to the postgres role (which is what the connection string uses)
GRANT USAGE ON SCHEMA mastra TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA mastra TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA mastra GRANT ALL ON TABLES TO postgres;
