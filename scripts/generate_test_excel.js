import * as xlsx from 'xlsx';

// Using REAL EmpIDs from the database
const data = [
    ['EmployeeCode', 'Date', 'Status'],
    ['JAAI030910031', '2026-02-10', 'Present'],
    ['JAAI101010303', '2026-02-10', 'Absent'],
    ['JAAI021210451', '2026-02-10', 'Leave'],
    ['JAAI051310554', '2026-02-10', 'HalfDay'],
    ['JAAI071210017', '2026-02-10', 'Present']
];

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet(data);
xlsx.utils.book_append_sheet(wb, ws, 'AttendanceData');
xlsx.writeFile(wb, 'test_attendance.xlsx');
console.log('test_attendance.xlsx generated with REAL EmpIDs');
