import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { initializeSchedulers } from './services/attendanceSyncService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (req, res) => {
    return res.json({
        success: true,
        message: 'Server is running'
    });
});

app.get('/api/db-test', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS solution');
        return res.json({
            success: true,
            solution: rows[0].solution
        });
    } catch (error) {
        console.error('Database query failed:', error);
        return res.status(500).json({
            success: false,
            message: 'Database connection failed'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Start automated schedulers for external MSSQL rawpunch sync
    initializeSchedulers();
});