const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  email: String,
  password: String,
  role: String,
  rollNumber: String,
  class: String,
  branch: String,
  section: String,
  subject: String
});

module.exports = mongoose.model('User', userSchema);
