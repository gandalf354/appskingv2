const mysql = require('mysql2/promise');
require('dotenv').config();

const useSSL = process.env.DB_SSL === 'true';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
const sslConfig = useSSL ? { rejectUnauthorized } : false;

// Create connection pool using TCP connection to phpMyAdmin
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'asusku',
  database: process.env.DB_NAME || 'db_appsking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: sslConfig,
  timezone: '+07:00' // Asia/Jakarta timezone
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully via TCP');
    console.log(`🏠 Host: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
    console.log(`📊 Connected to database: ${process.env.DB_NAME || 'db_appsking'}`);
    console.log(`👤 User: ${process.env.DB_USER || 'root'}`);
    
    // Test query to verify connection
    const [result] = await connection.execute('SELECT COUNT(*) as count FROM projects');
    console.log(`🗃️  Found ${result[0].count} projects in database`);
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔧 Check phpMyAdmin configuration:');
    console.error(`   Host: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
    console.error(`   User: ${process.env.DB_USER || 'root'}`);
    console.error(`   Password: ${process.env.DB_PASSWORD ? '***' : '(empty)'}`);
    console.error(`   Database: ${process.env.DB_NAME || 'db_appsking'}`);
    throw error;
  }
};

// Execute query with pool
const executeQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Get connection for transactions
const getConnection = async () => {
  return await pool.getConnection();
};

// Close pool
const closePool = async () => {
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

module.exports = {
  pool,
  testConnection,
  executeQuery,
  getConnection,
  closePool
};