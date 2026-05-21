import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function createTable() {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        const sql = `
            CREATE TABLE IF NOT EXISTS daily_required_manpower (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                department VARCHAR(100) DEFAULT '',
                section VARCHAR(100) DEFAULT '',
                line VARCHAR(100) DEFAULT '',
                required_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_daily_req (date, department, section, line)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `;

        await db.query(sql);
        console.log('Table daily_required_manpower created or already exists.');
        
        // Also update setupDb.js so it's included in fresh installs
        process.exit(0);
    } catch(err) {
        console.error('Error creating table:', err);
        process.exit(1);
    }
}
createTable();
