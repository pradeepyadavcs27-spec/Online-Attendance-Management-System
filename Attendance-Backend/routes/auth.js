const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-secure-secret';
const JWT_EXPIRES = '8h';

// RESET USERS
router.get('/reset-users', async (req, res) => {
  await User.deleteMany({});
  res.json({ message: "Users reset ✅" });
});

// CREATE DEMO USERS
router.get('/create-demo-users', async (req, res) => {
  try {
    const users = [
      { username: "admin", password: "admin123", role: "admin" },
      { username: "teacher1", password: "teacher123", role: "teacher" },
      { username: "student1", password: "student123", role: "student" }
    ];

    for (let u of users) {
      let existing = await User.findOne({ username: u.username });

      if (!existing) {
        const hashed = await bcrypt.hash(u.password, 10);

        await User.create({
          username: u.username,
          email: `${u.username}@test.com`,
          password: hashed,
          role: u.role,
          rollNumber: "101",
          class: "CSE"
        });
      }
    }

    res.json({ message: "Demo users created ✅" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error creating users" });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    let { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    username = username.trim();
    role = role.toLowerCase();

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    if (user.role !== role) {
      return res.status(400).json({ success: false, message: "Wrong role selected" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    let redirect = "";
    if (role === "admin") redirect = "/admin-Dashboard.html";
    if (role === "teacher") redirect = "/teacher-dashboard.html";
    if (role === "student") redirect = "/student-dashboard.html";

    res.json({
      success: true,
      redirect,
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.log("LOGIN ERROR:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.log('ME ERROR:', error);
    res.status(500).json({ message: 'Unable to verify user' });
  }
});

module.exports = router;
