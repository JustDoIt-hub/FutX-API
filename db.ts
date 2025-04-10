import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure neon client to use fetch API
neonConfig.fetchConnectionCache = true;

// Use environment variable for database connection
const sql = neon(process.env.DATABASE_URL!);

// Create and export database client
export const db = drizzle(sql);
