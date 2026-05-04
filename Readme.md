# Online Attendance Management System

A full-stack web application designed to simplify and automate the process of managing student attendance. The system allows teachers to efficiently record attendance while providing administrative control over student and teacher data.

---

## Features

- Teacher Authentication (Login & Registration)
- Mark and Manage Attendance
- Student Management (Add / Bulk Import via Excel)
- Teacher Management (Bulk Import Support)
- Date-wise Attendance Tracking
- Clean and Organized Dashboard
- Secure Backend with JWT Authentication
- Full-stack Implementation (Frontend + Backend)

---

## Tech Stack

**Frontend**
- HTML
- CSS
- JavaScript

**Backend**
- Node.js
- Express.js

**Database**
- MongoDB

**Tools & Libraries**
- JWT (Authentication)
- XLSX (Excel File Handling)

---

## Project Structure

Online-Attendance-Management-System/
│
├── Attendance-Backend/        # Backend (API, Database, Authentication)
├── attendance-system/         # Frontend (User Interface)
├── dummy-students-import.xlsx # Sample student data file
├── dummy-teachers-import.xlsx # Sample teacher data file

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/pradeepyadavcs27-spec/Online-Attendance-Management-System.git
cd Online-Attendance-Management-System
```

---

### 2. Backend Setup

```bash
cd Attendance-Backend
npm install
```

Create a `.env` file in the backend directory and add:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Run the backend server:

```bash
npm start
```

---

### 3. Frontend Setup

```bash
cd ../attendance-system
npm install
npm start
```

---

## Usage

1. Register or login as a teacher  
2. Add students manually or upload via Excel file  
3. Mark attendance for specific dates  
4. View and manage attendance records  

---

## Future Enhancements

- Responsive Mobile UI  
- Attendance Analytics Dashboard  
- Email Notifications  
- Student Login Portal  
- Cloud Deployment (AWS / Vercel)  
- Advanced Search and Filters  

---

## Contributing

Contributions are welcome.

1. Fork the repository  
2. Create a new branch (`git checkout -b feature-name`)  
3. Commit your changes (`git commit -m "Add feature"`)  
4. Push to the branch (`git push origin feature-name`)  
5. Open a Pull Request  

---

## License

This project is licensed under the MIT License.

---

## Author

Pradeep Yadav  
Email: pradeep.yadav.cs27@iilm.edu  
GitHub: https://github.com/pradeepyadavcs27-spec  

---

## Support

If you find this project useful, please consider giving it a star on GitHub.