import cron from 'node-cron';
import db from '../config/db.js';
import { getMssqlConnection, sql } from '../config/mssql.js';

const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Core Logic: Fetch raw punches from MSSQL and upsert into MySQL
 * @param {Date} startDateTime - Starting timestamp to scan punches
 * @param {Date} endDateTime - Ending timestamp to scan punches
 */
export const syncRawPunches = async (startDateTime, endDateTime) => {
    console.log(`[Sync Service] Starting punch sync between ${startDateTime.toISOString()} and ${endDateTime.toISOString()}...`);

    let mssqlPool;
    try {
        mssqlPool = await getMssqlConnection();
    } catch (err) {
        console.warn('[Sync Service] MSSQL not reachable or unconfigured. Skipping punch fetch.', err.message);
        return { success: false, reason: 'MSSQL_CONNECTION_FAILED' };
    }

    try {
        // 1. Fetch raw punches from MSSQL machinerawpunch table
        const query = `
            SELECT cardno, officepunch 
            FROM machinerawpunch 
            WHERE officepunch >= @startTime AND officepunch <= @endTime
            ORDER BY officepunch ASC
        `;

        const request = mssqlPool.request();
        request.input('startTime', sql.DateTime, startDateTime);
        request.input('endTime', sql.DateTime, endDateTime);

        const result = await request.query(query);
        const punches = result.recordset;

        console.log(`[Sync Service] Fetched ${punches.length} raw punches from MSSQL.`);

        if (punches.length === 0) {
            console.log('[Sync Service] No new punches found to sync.');
            return { success: true, synced: 0 };
        }

        // 2. Group punches by EmployeeCode (cardno) and Date (YYYY-MM-DD)
        const punchMap = new Map();

        punches.forEach(punch => {
            const empCode = punch.cardno?.toString().trim();
            const punchTime = punch.officepunch;

            if (!empCode || !punchTime) return;

            const dateStr = toLocalDateString(new Date(punchTime));
            const key = `${empCode}_${dateStr}`;

            // We only need the presence of a punch on that date
            if (!punchMap.has(key)) {
                punchMap.set(key, { empCode, dateStr });
            }
        });

        console.log(`[Sync Service] Found ${punchMap.size} unique employee-day punch records to process.`);

        // 3. Ingest into MySQL attendance table
        let insertedCount = 0;
        let updatedCount = 0;

        const mySqlConnection = await db.getConnection();
        await mySqlConnection.beginTransaction();

        try {
            for (const [key, record] of punchMap.entries()) {
                const { empCode, dateStr } = record;

                // Check if an attendance record already exists for this card number and date
                const [existing] = await mySqlConnection.query(
                    'SELECT id, Status FROM attendance WHERE EmployeeCode = ? AND Date = ?',
                    [empCode, dateStr]
                );

                if (existing.length > 0) {
                    const currentStatus = existing[0].Status;
                    // If employee was marked Absent or HalfDay, or state is blank, update to Present
                    if (currentStatus !== 'Present') {
                        await mySqlConnection.query(
                            "UPDATE attendance SET Status = 'Present' WHERE id = ?",
                            [existing[0].id]
                        );
                        updatedCount++;
                    }
                } else {
                    // Create new attendance record
                    await mySqlConnection.query(
                        "INSERT INTO attendance (EmployeeCode, Date, Status) VALUES (?, ?, 'Present')",
                        [empCode, dateStr]
                    );
                    insertedCount++;
                }
            }

            await mySqlConnection.commit();
            console.log(`[Sync Service] MySQL transaction committed successfully. Ingested: ${insertedCount}, Updated: ${updatedCount}.`);
        } catch (dbError) {
            await mySqlConnection.rollback();
            console.error('[Sync Service] MySQL Transaction rolled back due to error:', dbError);
            throw dbError;
        } finally {
            mySqlConnection.release();
        }

        return { success: true, synced: punchMap.size, insertedCount, updatedCount };

    } catch (error) {
        console.error('[Sync Service] Error executing syncRawPunches:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Reconcile Absenteeism: Identify active employees with zero punches for today and record them as 'Absent'
 */
export const reconcileAbsenteeism = async () => {
    const todayStr = toLocalDateString(new Date());
    console.log(`[Sync Service] Starting nightly absenteeism reconciliation for date: ${todayStr}...`);

    try {
        const mySqlConnection = await db.getConnection();
        await mySqlConnection.beginTransaction();

        try {
            // 1. Fetch all active employees from employee master headcount roster
            const [activeEmployees] = await mySqlConnection.query(
                "SELECT EmpID, EmployeeName FROM headcountdataneemranaplant WHERE ActiveLeft = 'Active' AND EmpID IS NOT NULL AND EmpID != ''"
            );

            // 2. Fetch all recorded attendance entries for today
            const [attendanceRecords] = await mySqlConnection.query(
                "SELECT EmployeeCode FROM attendance WHERE Date = ?",
                [todayStr]
            );

            // Create a set of employees who already have an attendance record for today (Present, Leave, HalfDay, or manually logged)
            const markedEmployees = new Set(attendanceRecords.map(r => r.EmployeeCode.toString().trim()));

            let absentCount = 0;

            // 3. For each active employee, if they have no attendance status logged, mark them as Absent
            for (const employee of activeEmployees) {
                const empCode = employee.EmpID.toString().trim();

                if (!markedEmployees.has(empCode)) {
                    await mySqlConnection.query(
                        "INSERT INTO attendance (EmployeeCode, Date, Status) VALUES (?, ?, 'Absent')",
                        [empCode, todayStr]
                    );
                    absentCount++;
                }
            }

            await mySqlConnection.commit();
            console.log(`[Sync Service] Reconciled absenteeism successfully. Marked ${absentCount} active employees as Absent for ${todayStr}.`);
        } catch (dbError) {
            await mySqlConnection.rollback();
            console.error('[Sync Service] MySQL absenteeism transaction rolled back:', dbError);
            throw dbError;
        } finally {
            mySqlConnection.release();
        }

    } catch (error) {
        console.error('[Sync Service] General error during absenteeism reconciliation:', error);
    }
};

/**
 * Initialize all Cron Jobs
 */
export const initializeSchedulers = () => {
    console.log('[Sync Service] Initializing Automated Schedulers...');

    // 1. Cron Job: Sync punches every 10 minutes
    // Runs */10 * * * * (Every 10 minutes, e.g. 0, 10, 20, 30...)
    cron.schedule('*/10 * * * *', async () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 1); // Fetch starting from 24 hours ago to cover shift transition gaps safely

        try {
            await syncRawPunches(start, end);
        } catch (err) {
            console.error('[Sync Schedulers] Failed to execute periodic punch sync cron:', err.message);
        }
    });
    console.log('[Sync Service] Scheduled task: Raw Punch Sync runs every 10 minutes.');

    // 2. Cron Job: Nightly absenteeism mark
    // Runs daily at 23:55 (55 23 * * *)
    cron.schedule('55 23 * * *', async () => {
        try {
            await reconcileAbsenteeism();
        } catch (err) {
            console.error('[Sync Schedulers] Failed to execute nightly absenteeism reconciliation cron:', err.message);
        }
    });
    console.log('[Sync Service] Scheduled task: Daily Absenteeism Reconciliation runs daily at 23:55.');
};
