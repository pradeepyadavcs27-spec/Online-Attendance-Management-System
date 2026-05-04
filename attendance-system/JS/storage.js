/**
 * Storage Manager
 * Uses Backend API instead of localStorage
 */

const StorageManager = {
  init: function() {
    console.log('Using backend API for data storage');
  },

  // Add new user via API
  addUser: async function(userData) {
    try {
      const result = await API.register(userData);
      return result.user;
    } catch (error) {
      throw error;
    }
  },

  // Get all students from backend
  getStudents: async function() {
    try {
      return await API.getStudents();
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  },

  // Get all teachers from backend
  getTeachers: async function() {
    try {
      return await API.getTeachers();
    } catch (error) {
      console.error('Error fetching teachers:', error);
      return [];
    }
  },

  // Mark attendance via API
  markAttendance: async function(record) {
    try {
      return await API.markAttendance(record);
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  },

  // Get attendance records
  getAttendance: async function() {
    try {
      return await API.getAttendance();
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return [];
    }
  },

  // Get attendance by date
  getAttendanceByDate: async function(date) {
    try {
      return await API.getAttendance({ date });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return [];
    }
  },

  // Get attendance for specific student
  getStudentAttendance: async function(studentId) {
    try {
      const data = await API.getStudentStats(studentId);
      return data.records || [];
    } catch (error) {
      console.error('Error fetching student attendance:', error);
      return [];
    }
  },

  // Calculate percentage via API
  calculatePercentage: async function(studentId) {
    try {
      const data = await API.getStudentStats(studentId);
      return data.percentage || 0;
    } catch (error) {
      return 0;
    }
  },

  // Get dashboard stats from backend
  getStats: async function() {
    try {
      return await API.getStats();
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        totalStudents: 0,
        totalTeachers: 0,
        totalRecords: 0,
        todayMarked: 0
      };
    }
  }
};