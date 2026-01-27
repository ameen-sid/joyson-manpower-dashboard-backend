import db from '../config/db.js';

export const getManpowerStats = async (req, res) => {
    try {

        const { department, section, line } = req.query;

        // 1. Required Manpower (departmentwiseskill)
        // Note: departmentwiseskill only has DepartmentCode, no Section or Line specific indent usually, but checking schema
        let reqSql = 'SELECT SUM(IndentManpower) as total_required FROM departmentwiseskill WHERE 1=1';
        const reqParams = [];

        if (department) {
            reqSql += ' AND DepartmentCode = ?';
            reqParams.push(department);
        }
        // If section/line logic exists for Required, add here. For now assuming Required is at Dept level.

        const [reqRows] = await db.query(reqSql, reqParams);
        const totalRequired = reqRows[0].total_required || 0;

        // 2. Actual Manpower (headcountdataneemranaplant)
        // We can filter by Department and Section directly.
        // For Line, we need to join with employeemap if HeadCount doesn't imply line.
        // Assuming headcountdataneemranaplant might not have 'Line' column, but let's check if we can join employeemap for Line filtering.
        let actSql = `
            SELECT COUNT(DISTINCT h.EmpID) as total_actual 
            FROM headcountdataneemranaplant h 
            LEFT JOIN employeemap e ON h.EmpID = e.EmployeeCode 
            WHERE h.ActiveLeft = 'Active'
        `;

        const actParams = [];
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

        const [actRows] = await db.query(actSql, actParams);
        const totalActual = actRows[0].total_actual || 0;

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
            message: 'Error fetching manpower stats' 
        });
    }
};

export const getSkillMatrix = async (req, res) => {
    try {

        const { department, section, line } = req.query;

        // 1. Required Skills (departmentwiseskill)
        let reqSql = 'SELECT Skill, SUM(IndentManpower) as required FROM departmentwiseskill WHERE 1=1';
        const reqParams = [];

        if (department) {
            reqSql += ' AND DepartmentCode = ?';
            reqParams.push(department);
        }
        reqSql += ' GROUP BY Skill';
        const [reqRows] = await db.query(reqSql, reqParams);

        // 2. Available Skills (employeemap JOIN headcountdataneemranaplant)
        // Join needed to filter employeemap by Dept/Section from HeadCount
        let availSql = `
            SELECT e.Skill, COUNT(DISTINCT e.EmployeeCode) as available 
            FROM employeemap e
            JOIN headcountdataneemranaplant h ON e.EmployeeCode = h.EmpID
            WHERE h.ActiveLeft = 'Active'
        `;

        const availParams = [];
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
        availSql += ' GROUP BY e.Skill';

        const [availRows] = await db.query(availSql, availParams);

        // Merging data
        const skills = ['L0', 'L1', 'L2', 'L3', 'L4'];
        const matrix = skills.map(skill => {
            const req = reqRows.find(r => r.Skill === skill)?.required || 0;
            const avail = availRows.find(r => r.Skill === skill)?.available || 0;
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
            message: 'Error fetching skill matrix' 
        });
    }
};

export const getAttritionStats = async (req, res) => {
    try {

        const { department, section, line } = req.query;

        // Query to get counts of Active and Left employees with filters
        let sql = `
            SELECT h.ActiveLeft, COUNT(DISTINCT h.EmpID) as count
            FROM headcountdataneemranaplant h
            LEFT JOIN employeemap e ON h.EmpID = e.EmployeeCode
            WHERE 1=1
        `;

        const params = [];
        if (department) {
            sql += ' AND h.Department = ?';
            params.push(department);
        }
        if (section) {
            sql += ' AND h.Section = ?';
            params.push(section);
        }
        if (line) {
            sql += ' AND e.LineMachine = ?';
            params.push(line);
        }

        sql += ' GROUP BY h.ActiveLeft';

        const [rows] = await db.query(sql, params);

        let active = 0;
        let left = 0;

        rows.forEach(row => {
            if (row.ActiveLeft === 'Active') active = row.count;
            if (row.ActiveLeft === 'Left') left = row.count;
        });

        const total = active + left;
        const rate = total > 0 ? ((left / total) * 100).toFixed(1) : 0;

        // Without DateOfLeaving, we calculate a single Cumulative Attrition Rate
        return res.json([
            { month: 'Current', rate: parseFloat(rate) }
        ]);
    } catch (error) {
        console.error('Error fetching attrition stats:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Error fetching attrition stats' 
        });
    }
};

export const getFilterOptions = async (req, res) => {
    try {

        const [deptRows] = await db.query('SELECT DISTINCT Department FROM headcountdataneemranaplant WHERE Department IS NOT NULL AND Department != "" ORDER BY Department');
        const [secRows] = await db.query('SELECT DISTINCT Section FROM headcountdataneemranaplant WHERE Section IS NOT NULL AND Section != "" ORDER BY Section');
        const [lineRows] = await db.query('SELECT DISTINCT Line FROM linemaster WHERE Line IS NOT NULL AND Line != "" ORDER BY Line');

        return res.json({
            success: true,
            departments: deptRows.map(r => r.Department),
            sections: secRows.map(r => r.Section),
            lines: lineRows.map(r => r.Line)
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Error fetching filter options' 
        });
    }
};