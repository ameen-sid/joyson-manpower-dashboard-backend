import bcrypt from 'bcryptjs';
import db from '../config/db.js';

export const initializeDatabase = async () => {
    console.log('[Database Init] Starting safe database table verification...');
    try {
        // 1. users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "users" table verified.');

        // Insert Admin User if table is empty
        const [userRows] = await db.query('SELECT * FROM users WHERE username = ?', ['admin123']);
        if (userRows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin123', hashedPassword]);
            console.log('[Database Init] Admin user "admin123" created successfully.');
        }

        // 2. employeemap table
        await db.query(`
            CREATE TABLE IF NOT EXISTS employeemap (
                id INT AUTO_INCREMENT PRIMARY KEY,
                PlantCode VARCHAR(50),
                EmployeeCode VARCHAR(50),
                LineMachine VARCHAR(100),
                Station VARCHAR(100),
                StationType VARCHAR(100),
                Skill ENUM('L0', 'L1', 'L2', 'L3', 'L4'),
                Groupleader VARCHAR(100)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "employeemap" table verified.');

        // 3. linemaster table
        await db.query(`
            CREATE TABLE IF NOT EXISTS linemaster (
                id INT AUTO_INCREMENT PRIMARY KEY,
                PlantCode VARCHAR(50),
                Line VARCHAR(100)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "linemaster" table verified.');

        // 4. updstationmaster table
        await db.query(`
            CREATE TABLE IF NOT EXISTS updstationmaster (
                id INT AUTO_INCREMENT PRIMARY KEY,
                PlantCode VARCHAR(50),
                Line VARCHAR(100),
                Station VARCHAR(100),
                stationType VARCHAR(100)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "updstationmaster" table verified.');

        // 5. headcountdataneemranaplant table
        await db.query(`
            CREATE TABLE IF NOT EXISTS headcountdataneemranaplant (
                id INT AUTO_INCREMENT PRIMARY KEY,
                Entity VARCHAR(100),
                EmpID VARCHAR(50),
                EmployeeName VARCHAR(100),
                Gender ENUM('Male', 'Female'),
                DivisionPlant VARCHAR(100),
                Department VARCHAR(100),
                Section VARCHAR(100),
                ActiveLeft ENUM('Active', 'Left'),
                Category VARCHAR(50),
                DateOfJoin DATE,
                DateOfLeaving DATE,
                IsDojo BOOLEAN DEFAULT FALSE,
                DojoCertifiedDate DATE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "headcountdataneemranaplant" table verified.');

        // 6. departmentwiseskill table
        await db.query(`
            CREATE TABLE IF NOT EXISTS departmentwiseskill (
                id INT AUTO_INCREMENT PRIMARY KEY,
                EmployeeGroup CHAR(10),
                DepartmentCode VARCHAR(50),
                StationType VARCHAR(100),
                Shift CHAR(10),
                Skill ENUM('L0', 'L1', 'L2', 'L3', 'L4'),
                IndentManpower INT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "departmentwiseskill" table verified.');

        // 7. dailymanpowerstats table
        await db.query(`
            CREATE TABLE IF NOT EXISTS dailymanpowerstats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                total_required INT DEFAULT 0,
                actual_available INT DEFAULT 0,
                buffer INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "dailymanpowerstats" table verified.');

        // 8. attendance table
        await db.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                EmployeeCode VARCHAR(50),
                Date DATE,
                Status ENUM('Present', 'Absent', 'Leave', 'HalfDay') DEFAULT 'Present',
                PunchingTime DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "attendance" table verified.');

        // 9. daily_required_manpower table
        await db.query(`
            CREATE TABLE IF NOT EXISTS daily_required_manpower (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                department VARCHAR(100) DEFAULT '',
                section VARCHAR(100) DEFAULT '',
                line VARCHAR(100) DEFAULT '',
                shift VARCHAR(100) DEFAULT '',
                required_count INT NOT NULL DEFAULT 0,
                req_l0 INT NOT NULL DEFAULT 0,
                req_l1 INT NOT NULL DEFAULT 0,
                req_l2 INT NOT NULL DEFAULT 0,
                req_l3 INT NOT NULL DEFAULT 0,
                req_l4 INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('[Database Init] "daily_required_manpower" table verified.');

        // Incremental Migrations / Schema upgrades for Shift feature
        // 1. Add Shift column to headcountdataneemranaplant
        const [headcountCols] = await db.query("SHOW COLUMNS FROM headcountdataneemranaplant LIKE 'Shift'");
        if (headcountCols.length === 0) {
            await db.query("ALTER TABLE headcountdataneemranaplant ADD COLUMN Shift VARCHAR(50) DEFAULT NULL;");
            console.log('[Database Init] Added Shift column to headcountdataneemranaplant.');
        }

        // 2. Add shift column to daily_required_manpower
        const [reqCols] = await db.query("SHOW COLUMNS FROM daily_required_manpower LIKE 'shift'");
        if (reqCols.length === 0) {
            await db.query("ALTER TABLE daily_required_manpower ADD COLUMN shift VARCHAR(100) DEFAULT '';");
            console.log('[Database Init] Added shift column to daily_required_manpower.');
        }

        // 3. Setup/Update unique constraint on daily_required_manpower (date, department, section, line, shift)
        const [indexes] = await db.query("SHOW INDEX FROM daily_required_manpower WHERE Key_name = 'unique_daily_req'");
        // Check if index includes shift (we expect it to cover 5 columns: date, department, section, line, shift)
        if (indexes.length !== 5) {
            try {
                await db.query("ALTER TABLE daily_required_manpower DROP KEY unique_daily_req");
                console.log('[Database Init] Dropped old unique index unique_daily_req.');
            } catch (err) {
                // Ignore if key didn't exist
            }
            await db.query("ALTER TABLE daily_required_manpower ADD UNIQUE KEY unique_daily_req (date, department, section, line, shift)");
            console.log('[Database Init] Created shift-inclusive unique index on daily_required_manpower.');
        }

        // 4. Add PunchingTime column to attendance table
        const [attendanceCols] = await db.query("SHOW COLUMNS FROM attendance LIKE 'PunchingTime'");
        if (attendanceCols.length === 0) {
            await db.query("ALTER TABLE attendance ADD COLUMN PunchingTime DATETIME DEFAULT NULL;");
            console.log('[Database Init] Added PunchingTime column to attendance table.');
        }

        console.log('[Database Init] Safe database verification completed successfully.');
    } catch (error) {
        console.error('[Database Init] Error verifying database tables:', error);
    }
};
