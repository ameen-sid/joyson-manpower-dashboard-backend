import express from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats/manpower', dashboardController.getManpowerStats);
router.get('/stats/manpower-trend', dashboardController.getManpowerTrend);
router.get('/stats/absenteeism', dashboardController.getAbsenteeismTrend);
router.get('/stats/dojo', dashboardController.getDojoStats);
router.get('/stats/dojo-trend', dashboardController.getDojoTrend);
router.get('/stats/skill-matrix', dashboardController.getSkillMatrix);
router.get('/stats/attrition', dashboardController.getAttritionStats);
router.get('/filters', dashboardController.getFilterOptions);
router.post('/required-manpower', dashboardController.setRequiredManpower);

export default router;