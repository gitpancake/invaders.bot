// lib/postgresClient.ts
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

declare global {
  var _pgPool: Pool | undefined;
}

const pool = global._pgPool ?? new Pool({ 
  connectionString,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '5000'),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000'),
  allowExitOnIdle: process.env.NODE_ENV === 'test'
});

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export default pool;
