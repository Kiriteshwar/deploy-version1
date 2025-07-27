import express from 'express';
const router = express.Router();
import { getDisciplineRecords } from '../controllers/disciplineController.js';
import { protect } from '../middleware/authMiddleware.js';

router.get('/', protect, getDisciplineRecords);

export default router;
