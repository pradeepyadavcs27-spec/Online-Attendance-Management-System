const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');

function normalizeStatus(status) {
  if (!status) return null;
  const value = String(status).toLowerCase();
  if (value === 'present') return 'Present';
  if (value === 'absent') return 'Absent';
  return null;
}

function requireTeacherOrAdmin(req, res) {
  if (!req.user || !['teacher', 'admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Teacher or admin access required' });
    return false;
  }
  return true;
}

function requireNotStudent(req, res) {
  if (!req.user || req.user.role === 'student') {
    res.status(403).json({ message: 'Access denied' });
    return false;
  }
  return true;
}

async function cleanupOrphanAttendance() {
  const records = await Attendance.find().select('_id studentId').lean();
  const studentIds = [...new Set(records.map(record => String(record.studentId)).filter(Boolean))];
  const existingStudents = await User.find({ _id: { $in: studentIds }, role: 'student' }).select('_id').lean();
  const existingStudentIds = new Set(existingStudents.map(student => String(student._id)));
  const orphanIds = records
    .filter(record => !existingStudentIds.has(String(record.studentId)))
    .map(record => record._id);

  if (orphanIds.length > 0) {
    await Attendance.deleteMany({ _id: { $in: orphanIds } });
  }

  return orphanIds.length;
}

router.use(auth);

// 🔥 1. CLEAR OLD DATA (remove null records)
router.get('/clear', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    await Attendance.deleteMany({});
    res.json({ message: "All attendance data cleared ✅" });
  } catch (error) {
    res.status(500).json({ message: "Error clearing data" });
  }
});

// 🔥 2. ADD DUMMY ATTENDANCE
router.get('/dummy/:id', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    const userId = req.params.id;

    const attendance = await Attendance.create({
      studentId: userId,
      status: "Present",
      markedBy: req.user.id
    });

    res.json({ message: "Dummy data added ✅", attendance });
  } catch (error) {
    res.status(500).json({ message: "Error adding data" });
  }
});

// 🔥 3. GET ATTENDANCE
router.get('/', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    await cleanupOrphanAttendance();

    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.studentId) filter.studentId = req.query.studentId;

    const data = await Attendance.find(filter)
      .populate('studentId', 'name email rollNumber class branch section')
      .populate('markedBy', 'name username email subject');

    res.json(data.filter(record => record.studentId));
  } catch (error) {
    res.status(500).json({ message: "Error fetching data" });
  }
});

router.post('/mark', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;

    const { date, studentId, status } = req.body;
    const normalizedStatus = normalizeStatus(status);

    if (!date || !studentId || !normalizedStatus) {
      return res.status(400).json({ message: "Date, student, and status are required" });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { date, studentId },
      { date, studentId, status: normalizedStatus, markedBy: req.user.id, timestamp: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, attendance });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error saving attendance" });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;

    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "Date and attendance records are required" });
    }

    const operations = records.map(record => {
      const normalizedStatus = normalizeStatus(record.status);
      if (!record.studentId || !normalizedStatus) {
        throw new Error("Each record must include a student and valid status");
      }
      return {
        updateOne: {
          filter: { date, studentId: record.studentId },
          update: {
            $set: {
              date,
              studentId: record.studentId,
              status: normalizedStatus,
              markedBy: req.user.id,
              timestamp: new Date()
            }
          },
          upsert: true
        }
      };
    });

    const result = await Attendance.bulkWrite(operations, { ordered: true });
    res.json({ success: true, result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message || "Error saving attendance" });
  }
});

router.get('/student/:studentId/stats', async (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const records = await Attendance.find({ studentId: req.params.studentId })
      .populate('markedBy', 'name')
      .lean();

    const total = records.length;
    const present = records.filter(record => record.status === 'Present').length;
    const absent = records.filter(record => record.status === 'Absent').length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);

    res.json({
      total,
      present,
      absent,
      percentage,
      records: records.map(record => ({
        ...record,
        status: record.status.toLowerCase()
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching student stats" });
  }
});

router.get('/stats', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    await cleanupOrphanAttendance();

    const today = new Date().toISOString().split('T')[0];
    const [totalStudents, totalTeachers, totalRecords, todayMarked] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      Attendance.countDocuments(),
      Attendance.countDocuments({ date: today })
    ]);

    res.json({ totalStudents, totalTeachers, totalRecords, todayMarked });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// 🔥 4. EXPORT TO EXCEL
router.get('/export/excel', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    await cleanupOrphanAttendance();

    const data = await Attendance.find()
      .populate("studentId", "name email rollNumber class branch section")
      .populate("markedBy", "name")
      .lean();

    const validData = data.filter(item => item.studentId);

    if (validData.length === 0) {
      return res.status(404).json({ message: "No data available" });
    }

    const formatted = validData.map(item => ({
      Name: item.studentId?.name,
      RollNumber: item.studentId?.rollNumber,
      Class: item.studentId?.class,
      Branch: item.studentId?.branch,
      Section: item.studentId?.section,
      Email: item.studentId?.email,
      Date: item.date,
      Status: item.status,
      MarkedBy: item.markedBy?.name
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=attendance.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Export error" });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    await cleanupOrphanAttendance();

    const data = await Attendance.find()
      .populate("studentId", "name email rollNumber class branch section")
      .populate("markedBy", "name")
      .lean();

    const validData = data.filter(item => item.studentId);

    if (validData.length === 0) {
      return res.status(404).json({ message: "No data available" });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filename = 'attendance-report.pdf';
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);
    doc.fontSize(18).text('Attendance Report', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12);

    validData.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.studentId.name} | ${item.studentId.rollNumber || '-'} | ${item.studentId.class || '-'} | ${item.date} | ${item.status} | Marked by: ${item.markedBy?.name || '-'}
`);
      if ((index + 1) % 25 === 0) {
        doc.addPage();
      }
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ message: "PDF export failed" });
  }
});

router.get('/send-email', async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;

    const data = await Attendance.find()
      .populate("studentId", "name email")
      .lean();

    const mailUser = process.env.EMAIL_USER;
    const mailPass = process.env.EMAIL_PASS;
    const mailReceiver = process.env.EMAIL_TO;

    if (!mailUser || !mailPass || !mailReceiver) {
      return res.status(500).json({ message: 'Email configuration is missing in environment variables' });
    }

    let content = "Attendance Report:\n\n";
    data.forEach(item => {
      content += `${item.studentId?.name || 'Unknown'} - ${item.date} - ${item.status}\n`;
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: mailUser,
        pass: mailPass
      }
    });

    await transporter.sendMail({
      from: mailUser,
      to: mailReceiver,
      subject: "Attendance Report",
      text: content || "No data"
    });

    res.json({ message: "Email sent ✅" });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ message: "Email error" });
  }
});

module.exports = router;
