-- Arogya OS manual SQL bootstrap.
-- Run before Drizzle-generated migrations in every environment.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gin;
create extension if not exists pg_trgm;

-- Optional, enable if your managed Postgres permits it.
-- create extension if not exists pgaudit;
