const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               process.env.DB_PORT,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  dateStrings:        true, // keep DATE/DATETIME columns as 'YYYY-MM-DD' strings, matching what the frontend already expects from Supabase
});

module.exports = pool;
