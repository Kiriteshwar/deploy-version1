import Discipline from '../models/disciplineModel.js';

export async function getDisciplineRecords(req, res) {
    try {
        const student_id = req.user.id;
        const records = await Discipline.getStudentRecords(student_id);
        res.json(records);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
}
