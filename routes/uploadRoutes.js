import express from 'express';
import {
    uploadAttendance,
    uploadLineMaster,
    uploadUpdStationMaster,
    uploadDepartmentSkill,
    uploadHeadcount,
    uploadEmployeeMap
} from '../controllers/uploadController.js';
import multer from 'multer';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/attendance', upload.single('file'), uploadAttendance);

router.post('/linemaster', upload.single('file'), uploadLineMaster);
router.post('/updstationmaster', upload.single('file'), uploadUpdStationMaster);
router.post('/departmentwiseskill', upload.single('file'), uploadDepartmentSkill);
router.post('/headcount', upload.single('file'), uploadHeadcount);
router.post('/employeemap', upload.single('file'), uploadEmployeeMap);

export default router;