import db from '../config/db.js';

async function migrate() {
    console.log('Starting Database Migration for Shift Filter...');
    try {
        // 1. Add Shift column to headcountdataneemranaplant table if not exists
        const [headcountCols] = await db.query("SHOW COLUMNS FROM headcountdataneemranaplant LIKE 'Shift'");
        if (headcountCols.length === 0) {
            await db.query("ALTER TABLE headcountdataneemranaplant ADD COLUMN Shift VARCHAR(50) DEFAULT NULL;");
            console.log('- Added Shift column to headcountdataneemranaplant');
        } else {
            console.log('- Shift column already exists in headcountdataneemranaplant');
        }

        // 2. Add shift column to daily_required_manpower if not exists
        const [reqCols] = await db.query("SHOW COLUMNS FROM daily_required_manpower LIKE 'shift'");
        if (reqCols.length === 0) {
            await db.query("ALTER TABLE daily_required_manpower ADD COLUMN shift VARCHAR(100) DEFAULT '';");
            console.log('- Added shift column to daily_required_manpower');
        } else {
            console.log('- shift column already exists in daily_required_manpower');
        }

        // 3. Drop old unique key and add updated one including shift
        try {
            await db.query("ALTER TABLE daily_required_manpower DROP KEY unique_daily_req");
            console.log('- Dropped old unique index unique_daily_req');
        } catch (err) {
            console.log('- Old index unique_daily_req was not found or already dropped');
        }

        // Create new unique index
        await db.query("ALTER TABLE daily_required_manpower ADD UNIQUE KEY unique_daily_req (date, department, section, line, shift)");
        console.log('- Created new unique index unique_daily_req (date, department, section, line, shift)');

        console.log('Database Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
