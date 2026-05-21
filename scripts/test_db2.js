import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function check() {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
        const [rows] = await db.query('SELECT EmployeeCode, DATE_FORMAT(Date, "%Y-%m-%d") as formatted_date, Status FROM attendance ORDER BY id DESC LIMIT 50');
        fs.writeFileSync('db_out.json', JSON.stringify(rows, null, 2));
        console.log('Done mapping rows to db_out.json');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
