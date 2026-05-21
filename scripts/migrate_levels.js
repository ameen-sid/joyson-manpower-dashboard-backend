import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migrateTable() {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        // Add columns if they don't exist
        const sql = `
            ALTER TABLE daily_required_manpower
            ADD COLUMN req_l0 INT NOT NULL DEFAULT 0 AFTER required_count,
            ADD COLUMN req_l1 INT NOT NULL DEFAULT 0 AFTER req_l0,
            ADD COLUMN req_l2 INT NOT NULL DEFAULT 0 AFTER req_l1,
            ADD COLUMN req_l3 INT NOT NULL DEFAULT 0 AFTER req_l2,
            ADD COLUMN req_l4 INT NOT NULL DEFAULT 0 AFTER req_l3
        `;

        try {
            await db.query(sql);
            console.log('Successfully added L0-L4 columns.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Columns already exist.');
            } else {
                throw e;
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error altering table:', err);
        process.exit(1);
    }
}
migrateTable();
