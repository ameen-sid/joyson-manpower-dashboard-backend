import db from '../config/db.js';

export const getManpowerStats = async (req, res) => {
    try {

        const { department, section, line, shift, startDate, endDate } = req.query;

        const sDate = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        const eDate = endDate || new Date().toISOString().split('T')[0];

        let reqSqlInner = 'SELECT date, SUM(required_count) as daily_total FROM daily_required_manpower WHERE date BETWEEN ? AND ?';
        const reqParams = [sDate, eDate];

        if (department) {
            reqSqlInner += ' AND department = ?';
            reqParams.push(department);
        }
        if (section) {
            reqSqlInner += ' AND section = ?';
            reqParams.push(section);
        }
        if (line) {
            reqSqlInner += ' AND line = ?';
            reqParams.push(line);
        }
        if (shift) {
            reqSqlInner += ' AND shift = ?';
            reqParams.push(shift);
        }

        reqSqlInner += ' GROUP BY date';
        const reqSql = `SELECT ROUND(AVG(daily_total)) as total_required FROM (${reqSqlInner}) as daily_sums`;

        const [reqRows] = await db.query(reqSql, reqParams);
        const totalRequired = Number(reqRows[0]?.total_required || 0);

        const [dateRows] = await db.query('SELECT COUNT(DISTINCT Date) as days FROM attendance WHERE Date BETWEEN ? AND ?', [sDate, eDate]);
        const totalDays = dateRows[0]?.days || 1;

        let actSql = `
            SELECT COUNT(a.EmployeeCode) as total_present 
            FROM attendance a
            JOIN headcountdataneemranaplant h ON a.EmployeeCode = h.EmpID 
            LEFT JOIN employeemap e ON h.EmpID = e.EmployeeCode 
            WHERE a.Date BETWEEN ? AND ? AND a.Status IN('Present', 'HalfDay')
        `;

        const actParams = [sDate, eDate];
        if (department) {
            actSql += ' AND h.Department = ?';
            actParams.push(department);
        }
        if (section) {
            actSql += ' AND h.Section = ?';
            actParams.push(section);
        }
        if (line) {
            actSql += ' AND e.LineMachine = ?';
            actParams.push(line);
        }
        if (shift) {
            actSql += ' AND h.Shift = ?';
            actParams.push(shift);
        }

        const [actRows] = await db.query(actSql, actParams);
        const presentCount = actRows[0]?.total_present || 0;
        const totalActual = Math.round(presentCount / totalDays);

        const buffer = totalActual - totalRequired;
        return res.json({
            success: true,
            required: totalRequired,
            actual: totalActual,
            buffer: buffer
        });
    } catch (error) {
        console.error('Error fetching manpower stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching manpower stats',
            error: error.message
        });
    }
};

export const getSkillMatrix = async (req, res) => {
    try {

        const { department, section, line, shift, endDate } = req.query;

        const snapshotDate = endDate || new Date().toISOString().split('T')[0];
        let reqSql = `
            SELECT 
                SUM(req_l0) as req_l0, 
                SUM(req_l1) as req_l1, 
                SUM(req_l2) as req_l2, 
                SUM(req_l3) as req_l3, 
                SUM(req_l4) as req_l4
            FROM daily_required_manpower 
            WHERE date = ?
        `;
        const reqParams = [snapshotDate];

        if (department) {
            reqSql += ' AND department = ?';
            reqParams.push(department);
        }
        if (section) {
            reqSql += ' AND section = ?';
            reqParams.push(section);
        }
        if (line) {
            reqSql += ' AND line = ?';
            reqParams.push(line);
        }
        if (shift) {
            reqSql += ' AND shift = ?';
            reqParams.push(shift);
        }

        const [reqRows] = await db.query(reqSql, reqParams);
        const reqData = reqRows[0] || {};

        const requiredMap = {
            'L0': Number(reqData.req_l0 || 0),
            'L1': Number(reqData.req_l1 || 0),
            'L2': Number(reqData.req_l2 || 0),
            'L3': Number(reqData.req_l3 || 0),
            'L4': Number(reqData.req_l4 || 0)
        };

        let availSql = `
            SELECT e.Skill, COUNT(a.EmployeeCode) as total_present 
            FROM employeemap e
            JOIN attendance a ON e.EmployeeCode = a.EmployeeCode
            JOIN headcountdataneemranaplant h ON a.EmployeeCode = h.EmpID
            WHERE a.Date = ?
            AND a.Status IN ('Present', 'HalfDay')
        `;

        const availParams = [snapshotDate];
        if (department) {
            availSql += ' AND h.Department = ?';
            availParams.push(department);
        }
        if (section) {
            availSql += ' AND h.Section = ?';
            availParams.push(section);
        }
        if (line) {
            availSql += ' AND e.LineMachine = ?';
            availParams.push(line);
        }
        if (shift) {
            availSql += ' AND h.Shift = ?';
            availParams.push(shift);
        }
        availSql += ' GROUP BY e.Skill';

        const [availRows] = await db.query(availSql, availParams);

        const skills = ['L0', 'L1', 'L2', 'L3', 'L4'];
        const matrix = skills.map(skill => {
            const req = requiredMap[skill];
            const avail = availRows.find(r => r.Skill === skill)?.total_present || 0;
            return {
                skill: skill,
                required: req,
                available: avail,
                gap: avail - req
            };
        });

        return res.json(matrix);
    } catch (error) {
        console.error('Error fetching skill matrix:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching skill matrix',
            error: error.message
        });
    }
};


export const getFilterOptions = async (req, res) => {
    try {

        const [deptRows] = await db.query('SELECT DISTINCT Department FROM headcountdataneemranaplant WHERE Department IS NOT NULL AND Department != "" ORDER BY Department');
        const [secRows] = await db.query('SELECT DISTINCT Section FROM headcountdataneemranaplant WHERE Section IS NOT NULL AND Section != "" ORDER BY Section');
        const [lineRows] = await db.query('SELECT DISTINCT Line FROM linemaster WHERE Line IS NOT NULL AND Line != "" ORDER BY Line');
        const [shiftRows] = await db.query('SELECT DISTINCT Shift FROM headcountdataneemranaplant WHERE Shift IS NOT NULL AND Shift != "" ORDER BY Shift');
        const shiftsFromDb = shiftRows.map(r => r.Shift);
        const shifts = Array.from(new Set(['A', 'B', 'C', 'General', ...shiftsFromDb]));
        return res.json({
            success: true,
            departments: deptRows.map(r => r.Department),
            sections: secRows.map(r => r.Section),
            lines: lineRows.map(r => r.Line),
            shifts: shifts
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching filter options',
            error: error.message
        });
    }
};

export const getManpowerTrend = async (req, res) => {
    try {

        const { department, section, line, shift, startDate, endDate } = req.query;

        const sDate = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        const eDate = endDate || new Date().toISOString().split('T')[0];

        const [dateRows] = await db.query(`
            SELECT DISTINCT DATE_FORMAT(Date, '%Y-%m-%d') as dateStr 
            FROM attendance 
            WHERE Date BETWEEN ? AND ?
            ORDER BY Date ASC
        `, [sDate, eDate]);

        if (dateRows.length === 0) return res.json([]);

        let hFilter = " h.ActiveLeft = 'Active'";
        let hParams = [];

        if (department) {
            hFilter += " AND h.Department = ?";
            hParams.push(department);
        }
        if (section) {
            hFilter += " AND h.Section = ?";
            hParams.push(section);
        }
        if (shift) {
            hFilter += " AND h.Shift = ?";
            hParams.push(shift);
        }

        let eJoin = "";
        if (line) {
            eJoin = " JOIN employeemap em ON h.EmpID = em.EmployeeCode ";
            hFilter += " AND em.LineMachine = ?";
            hParams.push(line);
        }

        const actSql = `
            SELECT
            DATE_FORMAT(a.Date, '%Y-%m-%d') as dateStr,
            COUNT(DISTINCT a.EmployeeCode) as actual
            FROM attendance a
            JOIN headcountdataneemranaplant h ON a.EmployeeCode = h.EmpID
            ${eJoin}
            WHERE a.Date BETWEEN ? AND ?
            AND a.Status IN('Present', 'HalfDay')
            AND ${hFilter}
            GROUP BY a.Date
        `;

        const fullParams = [sDate, eDate, ...hParams];
        const [actRows] = await db.query(actSql, fullParams);

        let reqSql = 'SELECT DATE_FORMAT(date, "%Y-%m-%d") as dateStr, SUM(required_count) as required FROM daily_required_manpower WHERE date BETWEEN ? AND ?';
        let reqParams = [sDate, eDate];

        if (department) {
            reqSql += ' AND department = ?';
            reqParams.push(department);
        }
        if (section) {
            reqSql += ' AND section = ?';
            reqParams.push(section);
        }
        if (line) {
            reqSql += ' AND line = ?';
            reqParams.push(line);
        }
        if (shift) {
            reqSql += ' AND shift = ?';
            reqParams.push(shift);
        }

        reqSql += ' GROUP BY dateStr';

        const [reqRows] = await db.query(reqSql, reqParams);

        const data = dateRows.map(dRow => {
            const dStr = dRow.dateStr;
            const actRecord = actRows.find(a => a.dateStr === dStr);
            const actual = actRecord ? actRecord.actual : 0;

            const reqRecord = reqRows.find(r => r.dateStr === dStr);
            const reqCount = reqRecord ? reqRecord.required : 0;

            return {
                date: dStr,
                total_required: reqCount,
                actual_available: actual,
                buffer: actual - reqCount
            };
        });

        return res.json(data);
    } catch (error) {
        console.error('Error fetching manpower trend:', error);
        return res.status(500).json({ success: false, message: 'Error fetching manpower trend', error: error.message });
    }
};

export const getAbsenteeismTrend = async (req, res) => {
    try {

        const { department, section, line, shift, startDate, endDate } = req.query;

        const sDate = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        const eDate = endDate || new Date().toISOString().split('T')[0];

        let whereClause = "a.Date BETWEEN ? AND ?";
        let params = [sDate, eDate];
        let joinClause = "JOIN headcountdataneemranaplant h ON a.EmployeeCode = h.EmpID";

        if (department) {
            whereClause += " AND h.Department = ?";
            params.push(department);
        }
        if (section) {
            whereClause += " AND h.Section = ?";
            params.push(section);
        }
        if (shift) {
            whereClause += " AND h.Shift = ?";
            params.push(shift);
        }
        if (line) {
            joinClause += " JOIN employeemap em ON h.EmpID = em.EmployeeCode";
            whereClause += " AND em.LineMachine = ?";
            params.push(line);
        }

        const sql = `
            SELECT
            DATE_FORMAT(a.Date, '%Y-%m-%d') as dateStr,
            COUNT(CASE WHEN a.Status IN('Absent', 'Leave') THEN 1 END) as absents,
            COUNT(*) as total_records,
            (COUNT(CASE WHEN a.Status IN('Absent', 'Leave') THEN 1 END) / COUNT(*)) * 100 as rate
            FROM attendance a
            ${joinClause}
            WHERE ${whereClause}
            GROUP BY a.Date
            ORDER BY a.Date ASC
        `;

        const [rows] = await db.query(sql, params);
        const data = rows.map(row => ({
            date: row.dateStr,
            rate: parseFloat(row.rate).toFixed(1)
        }));

        return res.json(data);
    } catch (error) {
        console.error('Error fetching absenteeism trend:', error);
        return res.status(500).json({ success: false, message: 'Error fetching absenteeism trend', error: error.message });
    }
};

export const getDojoStats = async (req, res) => {
    try {

        const { department, section, line, shift } = req.query;

        let sql = `SELECT COUNT(DISTINCT h.EmpID) as count FROM headcountdataneemranaplant h`;
        let whereClause = " WHERE h.IsDojo = 1 AND h.ActiveLeft = 'Active'";
        let params = [];
        let joins = "";

        if (department) {
            whereClause += ' AND h.Department = ?';
            params.push(department);
        }
        if (section) {
            whereClause += ' AND h.Section = ?';
            params.push(section);
        }
        if (shift) {
            whereClause += ' AND h.Shift = ?';
            params.push(shift);
        }
        if (line) {
            joins += " JOIN employeemap em ON h.EmpID = em.EmployeeCode";
            whereClause += ' AND em.LineMachine = ?';
            params.push(line);
        }

        const [rows] = await db.query(sql + joins + whereClause, params);
        return res.json({
            success: true,
            totalDojo: rows[0].count
        });
    } catch (error) {
        console.error('Error fetching Dojo stats:', error);
        return res.status(500).json({ success: false, message: 'Error fetching Dojo stats', error: error.message });
    }
};

export const getDojoTrend = async (req, res) => {
    try {

        const { department, section, line, shift, startDate, endDate } = req.query;

        const sDate = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        const eDate = endDate || new Date().toISOString().split('T')[0];

        const [dateRows] = await db.query(`
            SELECT DISTINCT DATE_FORMAT(Date, '%Y-%m-%d') as dateStr 
            FROM attendance 
            WHERE Date BETWEEN ? AND ?
            ORDER BY Date ASC
        `, [sDate, eDate]);

        if (dateRows.length === 0) return res.json([]);

        let hFilter = " h.ActiveLeft = 'Active' AND h.IsDojo = 1";
        let hParams = [];
        if (department) {
            hFilter += " AND h.Department = ?";
            hParams.push(department);
        }
        if (section) {
            hFilter += " AND h.Section = ?";
            hParams.push(section);
        }
        if (shift) {
            hFilter += " AND h.Shift = ?";
            hParams.push(shift);
        }

        let eJoin = "";
        if (line) {
            eJoin = " JOIN employeemap em ON h.EmpID = em.EmployeeCode ";
            hFilter += " AND em.LineMachine = ?";
            hParams.push(line);
        }

        const sql = `
            SELECT
            DATE_FORMAT(a.Date, '%Y-%m-%d') as dateStr,
            COUNT(DISTINCT a.EmployeeCode) as count
            FROM attendance a
            JOIN headcountdataneemranaplant h ON a.EmployeeCode = h.EmpID
            ${eJoin}
            WHERE a.Date BETWEEN ? AND ?
            AND a.Status IN('Present', 'HalfDay')
            AND ${hFilter}
            GROUP BY a.Date
        `;

        const fullParams = [sDate, eDate, ...hParams];
        const [rows] = await db.query(sql, fullParams);

        const data = dateRows.map(dRow => {
            const dStr = dRow.dateStr;
            const record = rows.find(r => r.dateStr === dStr);
            return {
                date: dStr,
                count: record ? record.count : 0
            };
        });

        return res.json(data);
    } catch (error) {
        console.error('Error fetching Dojo trend:', error);
        return res.status(500).json({ success: false, message: 'Error fetching Dojo trend', error: error.message });
    }
};

export const getAttritionStats = async (req, res) => {
    try {

        const { department, section, line, shift, startDate, endDate } = req.query;

        let whereClause = " ActiveLeft = 'Left'";
        let params = [];

        let sDate, eDate;
        if (startDate && endDate) {
            sDate = new Date(startDate);
            eDate = new Date(endDate);
            whereClause += " AND DateOfLeaving BETWEEN ? AND ?";
            params.push(startDate, endDate);
        } else {
            eDate = new Date();
            sDate = new Date();
            sDate.setMonth(sDate.getMonth() - 6);
            whereClause += " AND DateOfLeaving >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)";
        }

        const diffTime = Math.abs(eDate - sDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isDaily = diffDays <= 31;

        let fromClause = "FROM headcountdataneemranaplant h";
        if (department) {
            whereClause += ' AND Department = ?';
            params.push(department);
        }
        if (section) {
            whereClause += ' AND Section = ?';
            params.push(section);
        }
        if (shift) {
            whereClause += ' AND Shift = ?';
            params.push(shift);
        }
        if (line) {
            fromClause += " JOIN employeemap em ON h.EmpID = em.EmployeeCode";
            whereClause += ' AND em.LineMachine = ?';
            params.push(line);
        }

        let sql;
        if (isDaily) {
            sql = `
                SELECT
                DATE_FORMAT(DateOfLeaving, '%Y-%m-%d') as period,
                COUNT(DISTINCT h.EmpID) as leavers
                ${fromClause}
                WHERE ${whereClause}
                GROUP BY period
                ORDER BY period ASC
            `;
        } else {
            sql = `
                SELECT
                DATE_FORMAT(DateOfLeaving, '%Y-%m') as period,
                COUNT(DISTINCT h.EmpID) as leavers
                ${fromClause}
                WHERE ${whereClause}
                GROUP BY period
                ORDER BY period ASC
            `;
        }

        const [leaverRows] = await db.query(sql, params);

        let activeWhere = " ActiveLeft = 'Active'";
        let activeParams = [];
        let activeFrom = "FROM headcountdataneemranaplant h";

        if (department) {
            activeWhere += ' AND Department = ?';
            activeParams.push(department);
        }
        if (section) {
            activeWhere += ' AND Section = ?';
            activeParams.push(section);
        }
        if (shift) {
            activeWhere += ' AND Shift = ?';
            activeParams.push(shift);
        }
        if (line) {
            activeFrom += " JOIN employeemap em ON h.EmpID = em.EmployeeCode";
            activeWhere += ' AND em.LineMachine = ?';
            activeParams.push(line);
        }

        const [activeRows] = await db.query(`SELECT COUNT(DISTINCT h.EmpID) as pf ${activeFrom} WHERE ${activeWhere} `, activeParams);
        const currentForce = activeRows[0].pf || 1;

        // Generate all periods between sDate and eDate to ensure we return 0.0% even when there are no leavers
        const periods = [];
        const targetEnd = new Date(eDate);

        if (isDaily) {
            let runDate = new Date(sDate);
            while (runDate <= targetEnd) {
                const yr = runDate.getFullYear();
                const mo = String(runDate.getMonth() + 1).padStart(2, '0');
                const dy = String(runDate.getDate()).padStart(2, '0');
                periods.push(`${yr}-${mo}-${dy}`);
                runDate.setDate(runDate.getDate() + 1);
            }
        } else {
            let runDate = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
            const endYear = targetEnd.getFullYear();
            const endMonth = targetEnd.getMonth();
            while (runDate.getFullYear() < endYear || (runDate.getFullYear() === endYear && runDate.getMonth() <= endMonth)) {
                const yr = runDate.getFullYear();
                const mo = String(runDate.getMonth() + 1).padStart(2, '0');
                periods.push(`${yr}-${mo}`);
                runDate.setMonth(runDate.getMonth() + 1);
            }
        }

        const data = periods.map(periodStr => {
            const row = leaverRows.find(r => r.period === periodStr);
            const leavers = row ? row.leavers : 0;
            const rate = ((leavers / currentForce) * 100).toFixed(1);
            return {
                period: periodStr,
                rate: rate,
                type: isDaily ? 'Daily' : 'Monthly'
            };
        });

        return res.json(data);
    } catch (error) {
        console.error('Error fetching attrition stats:', error);
        return res.status(500).json({ success: false, message: 'Error fetching attrition stats', error: error.message });
    }
};

export const setRequiredManpower = async (req, res) => {
    try {

        const { date, department, section, line, shift, req_l0, req_l1, req_l2, req_l3, req_l4 } = req.body;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is mandatory' });
        }

        const l0 = parseInt(req_l0) || 0;
        const l1 = parseInt(req_l1) || 0;
        const l2 = parseInt(req_l2) || 0;
        const l3 = parseInt(req_l3) || 0;
        const l4 = parseInt(req_l4) || 0;
        const totalReq = l0 + l1 + l2 + l3 + l4;

        const dept = department || '';
        const sect = section || '';
        const ln = line || '';
        const sft = shift || '';

        const sql = `
            INSERT INTO daily_required_manpower
            (date, department, section, line, shift, required_count, req_l0, req_l1, req_l2, req_l3, req_l4)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            required_count = VALUES(required_count),
            req_l0 = VALUES(req_l0),
            req_l1 = VALUES(req_l1),
            req_l2 = VALUES(req_l2),
            req_l3 = VALUES(req_l3),
            req_l4 = VALUES(req_l4)
        `;
        await db.query(sql, [date, dept, sect, ln, sft, totalReq, l0, l1, l2, l3, l4]);

        return res.json({ success: true, message: 'Required manpower levels updated successfully' });
    } catch (error) {
        console.error('Error setting required manpower:', error);
        return res.status(500).json({ success: false, message: 'Server error updating required manpower', error: error.message });
    }
};

export default {
    getManpowerStats,
    getSkillMatrix,
    getFilterOptions,
    getManpowerTrend,
    getAbsenteeismTrend,
    getDojoStats,
    getDojoTrend,
    getAttritionStats,
    setRequiredManpower
};