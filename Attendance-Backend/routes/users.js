const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const auth = require('../middleware/auth');

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }

  return '';
}

function buildImportedUser(row, role) {
  const name = pick(row, ['name', 'Name', 'fullName', 'Full Name', 'FullName']);
  const username = pick(row, ['username', 'Username', 'userName', 'User Name']);
  const password = pick(row, ['password', 'Password']);
  const email = pick(row, ['email', 'Email']);
  const rollNumber = pick(row, ['rollNumber', 'Roll Number', 'rollNo', 'Roll No', 'RollNo']);
  const className = pick(row, ['class', 'Class', 'className', 'Class Name']);
  const branch = pick(row, ['branch', 'Branch']);
  const section = pick(row, ['section', 'Section']);
  const subject = pick(row, ['subject', 'Subject']);

  return {
    name,
    username: username || rollNumber,
    email,
    password,
    role,
    rollNumber,
    class: className,
    branch,
    section,
    subject
  };
}

async function importUsersFromWorkbook(buffer, role) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const result = {
    totalRows: rows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const importedUser = buildImportedUser(rows[index], role);

    if (!importedUser.name || !importedUser.username) {
      result.skipped++;
      result.errors.push(`Row ${rowNumber}: name and username are required`);
      continue;
    }

    if (role === 'student' && (!importedUser.rollNumber || !importedUser.class)) {
      result.skipped++;
      result.errors.push(`Row ${rowNumber}: rollNumber and class are required for students`);
      continue;
    }

    const existing = await User.findOne({ username: importedUser.username });
    const update = {
      name: importedUser.name,
      username: importedUser.username,
      email: importedUser.email || `${importedUser.username}@test.com`,
      role,
      rollNumber: role === 'student' ? importedUser.rollNumber : undefined,
      class: role === 'student' ? importedUser.class : undefined,
      branch: role === 'student' ? importedUser.branch : undefined,
      section: role === 'student' ? importedUser.section : undefined,
      subject: role === 'teacher' ? importedUser.subject : undefined
    };

    if (importedUser.password || !existing) {
      update.password = await bcrypt.hash(importedUser.password || `${importedUser.username}123`, 10);
    }

    await User.updateOne(
      { username: importedUser.username },
      { $set: update },
      { upsert: true, runValidators: true }
    );

    if (existing) {
      result.updated++;
    } else {
      result.imported++;
    }
  }

  return result;
}

function isAdmin(req) {
  return req.user && req.user.role === 'admin';
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
}

router.use(auth);

// ✅ GET ALL USERS
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({ message: "Access denied" });
    }

    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/import/:role', express.raw({
  type: [
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ],
  limit: '10mb'
}), async (req, res) => {
  try {
    const error = requireAdmin(req, res);
    if (error) return;

    const role = req.params.role;

    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ message: "Invalid import role" });
    }

    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ message: "Excel file is required" });
    }

    const result = await importUsersFromWorkbook(req.body, role);
    res.json({ success: true, ...result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message || "Import failed" });
  }
});

// ✅ ADD STUDENT
router.post('/add-student', async (req, res) => {
  try {
    const error = requireAdmin(req, res);
    if (error) return;

    const { name, rollNumber, className, branch, section, username, password } = req.body;

    if (!name || !rollNumber || !className || !username || !password) {
      return res.status(400).json({ message: "All fields required ❌" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Username already exists ❌" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const student = await User.create({
      name,
      username,
      email: username + "@test.com",
      password: hashed,
      role: "student",
      rollNumber,
      class: className,
      branch,
      section
    });

    res.json({ success: true, student });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error adding student" });
  }
});

// ✅ ADD TEACHER
router.post('/add-teacher', async (req, res) => {
  try {
    const error = requireAdmin(req, res);
    if (error) return;

    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ message: "All fields required ❌" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Username already exists ❌" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const teacher = await User.create({
      name,
      username,
      email: username + "@test.com",
      password: hashed,
      role: "teacher"
    });

    res.json({ success: true, teacher });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error adding teacher" });
  }
});

module.exports = router;
