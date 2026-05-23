import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { initializeSchedulers } from './services/attendanceSyncService.js';
import { initializeDatabase } from './services/dbInitService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5175',
            'http://localhost:5173',
            'http://127.0.0.1:5175',
            'http://127.0.0.1:5173'
        ];

        const isLocalIP = origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.');
        if (allowedOrigins.includes(origin) || isLocalIP) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
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

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeDatabase();
    initializeSchedulers();
});