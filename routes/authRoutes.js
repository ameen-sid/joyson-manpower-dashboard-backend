import express from 'express';
import { login, logout, checkAuth } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', authenticateToken, logout);

// GET /api/auth/check
router.get('/check', authenticateToken, checkAuth);

export default router;