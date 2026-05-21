import * as xlsx from 'xlsx';
import db from '../config/db.js';

export const uploadAttendance = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // 1. Read the Excel buffer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; // Assuming the first sheet has the data
        const sheet = workbook.Sheets[sheetName];

        // 2. Convert to JSON with raw dates (to handle Excel serial numbers correctly)
        // raw: false converts dates to formatted strings based on Excel cell format (e.g., '10/25/24')
        const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (data.length === 0) {
            return res.status(400).json({ success: false, message: 'The Excel file is empty.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            let insertedCount = 0;
            let updatedCount = 0;
            const errors = [];

            // 3. Process each row
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const rowNum = i + 2; // +2 because 0-index and header row

                const empCode = row.EmployeeCode?.toString().trim();
                let dateVal = row.Date;
                const statusStr = row.Status?.toString().trim();

                // Validation
                if (!empCode || !dateVal || !statusStr) {
                    errors.push(`Row ${rowNum}: Missing mandatory fields (EmployeeCode, Date, or Status).`);
                    continue;
                }

                const validStatuses = ['Present', 'Absent', 'Leave', 'HalfDay'];
                if (!validStatuses.includes(statusStr)) {
                    errors.push(`Row ${rowNum}: Invalid Status '${statusStr}'. Must be one of: Present, Absent, Leave, HalfDay.`);
                    continue;
                }

                // Convert Excel serial date to string or parse given string without timezone drifting
                let formattedDate;
                if (typeof dateVal === 'number') {
                    // Extract precise Year/Month/Day directly from Excel logic
                    const ssf = xlsx.SSF || xlsx.default?.SSF;
                    const parsed = ssf.parse_date_code(dateVal);
                    // Format as YYYY-MM-DD
                    formattedDate = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
                } else {
                    // Try to parse string date (e.g. '2026-02-25')
                    const d = new Date(dateVal);
                    if (isNaN(d.getTime())) {
                        errors.push(`Row ${rowNum}: Invalid Date format '${dateVal}'.`);
                        continue;
                    }
                    // Use local components matching the original string date, avoiding UTC conversion
                    formattedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }

                // Check if record exists for this Employee and Date
                const [existing] = await connection.query(
                    'SELECT id FROM attendance WHERE EmployeeCode = ? AND Date = ?',
                    [empCode, formattedDate]
                );

                if (existing.length > 0) {
                    // Update
                    await connection.query(
                        'UPDATE attendance SET Status = ? WHERE id = ?',
                        [statusStr, existing[0].id]
                    );
                    updatedCount++;
                } else {
                    // Insert
                    await connection.query(
                        'INSERT INTO attendance (EmployeeCode, Date, Status) VALUES (?, ?, ?)',
                        [empCode, formattedDate, statusStr]
                    );
                    insertedCount++;
                }
            }

            if (errors.length > 0 && insertedCount === 0 && updatedCount === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Failed to process file due to errors.',
                    errors: errors
                });
            }

            await connection.commit();

            return res.json({
                success: true,
                message: `Successfully processed file. Inserted: ${insertedCount}, Updated: ${updatedCount}.`,
                errors: errors.length > 0 ? errors : undefined // Include non-fatal errors if any rows succeeded
            });

        } catch (dbError) {
            await connection.rollback();
            throw dbError; // Caught by outer block
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error uploading attendance:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while processing the Excel file.' });
    }
};

// Helper function to safely parse Excel dates or strings
const parseExcelDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'number') {
        const ssf = xlsx.SSF || xlsx.default?.SSF;
        const parsed = ssf.parse_date_code(dateVal);
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return null;
};

// Generic Upload Handler Template
const processMasterUpload = async (req, res, tableName, requiredKeys, rowMapper) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

        if (data.length === 0) return res.status(400).json({ success: false, message: 'The Excel file is empty.' });

        // Basic Header Validation (check if first row has expected keys)
        const firstRowKeys = Object.keys(data[0]);
        const missingKeys = requiredKeys.filter(k => !firstRowKeys.includes(k));
        if (missingKeys.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required columns in Excel: ${missingKeys.join(', ')}`
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // TRUNCATE to replace master data entirely
            await connection.query(`TRUNCATE TABLE ${tableName}`);

            let insertedCount = 0;
            const errors = [];

            // Execute Inserts sequentially to map data carefully
            for (let i = 0; i < data.length; i++) {
                try {
                    const rowData = rowMapper(data[i]);
                    const cols = Object.keys(rowData);
                    const placeholders = cols.map(() => '?').join(', ');
                    const values = cols.map(k => rowData[k] !== undefined ? rowData[k] : null);

                    const sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;
                    await connection.query(sql, values);
                    insertedCount++;
                } catch (err) {
                    errors.push(`Row ${i + 2}: ${err.message}`);
                }
            }

            if (insertedCount === 0 && errors.length > 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'All rows failed to insert.', errors });
            }

            await connection.commit();
            return res.json({
                success: true,
                message: `Successfully replaced ${tableName} with ${insertedCount} records.`,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error(`Error uploading ${tableName}:`, error);
        return res.status(500).json({ success: false, message: 'Internal server error processing Excel.' });
    }
};

export const uploadLineMaster = async (req, res) => {
    const requiredKeys = ['Plantcode', 'Line'];
    const mapper = (row) => ({
        PlantCode: row['Plantcode']?.toString(),
        Line: row['Line']?.toString()
    });
    return processMasterUpload(req, res, 'linemaster', requiredKeys, mapper);
};

export const uploadUpdStationMaster = async (req, res) => {
    const requiredKeys = ['Plantcode', 'LINE', 'Station', 'stationtype'];
    const mapper = (row) => ({
        PlantCode: row['Plantcode']?.toString(),
        Line: row['LINE']?.toString(),
        Station: row['Station']?.toString(),
        stationType: row['stationtype']?.toString()
    });
    return processMasterUpload(req, res, 'updstationmaster', requiredKeys, mapper);
};

export const uploadDepartmentSkill = async (req, res) => {
    const requiredKeys = ['EmployeeGroup', 'Department Code', 'StationType', 'Shift', 'Skill', 'IndentManpower'];
    const mapper = (row) => ({
        EmployeeGroup: row['EmployeeGroup']?.toString(),
        DepartmentCode: row['Department Code']?.toString(),
        StationType: row['StationType']?.toString(),
        Shift: row['Shift']?.toString(),
        Skill: row['Skill']?.toString(),
        IndentManpower: parseInt(row['IndentManpower']) || 0
    });
    return processMasterUpload(req, res, 'departmentwiseskill', requiredKeys, mapper);
};

export const uploadHeadcount = async (req, res) => {
    const requiredKeys = ['Entity', 'Emp.ID', 'Employee Name'];
    const mapper = (row) => ({
        Entity: row['Entity']?.toString(),
        EmpID: row['Emp.ID']?.toString(),
        EmployeeName: row['Employee Name']?.toString(),
        Gender: row['Gender']?.toString(),
        DivisionPlant: row['Division/Plant']?.toString(),
        Department: row['Department']?.toString(),
        Section: row['Section']?.toString(),
        ActiveLeft: row['Active / Left']?.toString(),
        Category: row['Category']?.toString(),
        DateOfJoin: parseExcelDate(row['Date of Join']),
        DateOfLeaving: parseExcelDate(row['Date of Leaving']),
        IsDojo: row['IsDojo'] === 'Yes' ? 1 : (parseInt(row['IsDojo']) || 0),
        DojoCertifiedDate: parseExcelDate(row['Dojo Certified Date']),
        Shift: row['Shift']?.toString() || row['SHIFT']?.toString() || row['shift']?.toString()
    });
    return processMasterUpload(req, res, 'headcountdataneemranaplant', requiredKeys, mapper);
};

export const uploadEmployeeMap = async (req, res) => {
    const requiredKeys = ['PlantCode', 'EmployeeCode', 'Line/Machine', 'Station', 'StationType', 'Skill', 'Groupleader'];
    const mapper = (row) => ({
        PlantCode: row['PlantCode']?.toString(),
        EmployeeCode: row['EmployeeCode']?.toString(),
        LineMachine: row['Line/Machine']?.toString(),
        Station: row['Station']?.toString(),
        StationType: row['StationType']?.toString(),
        Skill: row['Skill']?.toString(),
        Groupleader: row['Groupleader']?.toString()
    });
    return processMasterUpload(req, res, 'employeemap', requiredKeys, mapper);
};
