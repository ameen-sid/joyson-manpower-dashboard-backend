import express from 'express';
import { getManpowerStats, getSkillMatrix, getAttritionStats, getFilterOptions } from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/manpower', getManpowerStats);
router.get('/skills', getSkillMatrix);
router.get('/attrition', getAttritionStats);
router.get('/filters', getFilterOptions);

export default router;