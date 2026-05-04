const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');
const Attendance = require('./models/Attendance');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ✅ ROUTES (VERY IMPORTANT)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/attendance', require('./routes/attendance'));

async function initDemoData() {
  const usersCount = await User.countDocuments();
  if (usersCount === 0) {
    console.log('ℹ️ No users found, creating demo users...');

    const bcrypt = require('bcryptjs');
    const demoUsers = [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'teacher1', password: 'teacher123', role: 'teacher' },
      { username: 'student1', password: 'student123', role: 'student' }
    ];

    for (const demo of demoUsers) {
      const hashed = await bcrypt.hash(demo.password, 10);
      await User.create({
        username: demo.username,
        password: hashed,
        role: demo.role,
        email: `${demo.username}@test.com`,
        name: demo.username,
        rollNumber: demo.role === 'student' ? '101' : undefined,
        class: demo.role === 'student' ? 'CSE' : undefined
      });
    }
    console.log('✅ Demo users created');
  }

  const attendanceCount = await Attendance.countDocuments();
  if (attendanceCount === 0) {
    const student = await User.findOne({ role: 'student' });
    const teacher = await User.findOne({ role: 'teacher' });

    if (student && teacher) {
      const today = new Date().toISOString().split('T')[0];
      await Attendance.create({
        studentId: student._id,
        status: 'Present',
        markedBy: teacher._id,
        date: today,
        timestamp: new Date()
      });
      console.log('✅ Demo attendance record created');
    }
  }
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await initDemoData();
  })
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// Test Route
app.get('/', (req, res) => {
  res.send('API Running...');
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});