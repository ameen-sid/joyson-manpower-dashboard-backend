import express from 'express';
import { login, logout, checkAuth } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/check', authenticateToken, checkAuth);

export default router;