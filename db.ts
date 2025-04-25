// import { drizzle } from 'drizzle-orm/node-postgres';
// import pg from 'pg';
// const { Pool } = pg;

// // const pool = new Pool({
// //   host: process.env.DB_HOST,
// //   port: Number(process.env.DB_PORT),
// //   user: process.env.DB_USER,
// //   password: process.env.DB_PASSWORD,
// //   database: process.env.DB_NAME,
// // });


// // // Export the Drizzle client
// // export const db = drizzle(pool);
// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   ssl: {
//     rejectUnauthorized: false, // 👈 this is the key
//   },
// });
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Pool } from 'pg';
import * as schema from './shared/schema';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, { schema });
