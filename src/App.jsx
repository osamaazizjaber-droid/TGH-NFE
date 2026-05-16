import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicRegistration from './pages/PublicRegistration';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherPortal from './pages/TeacherPortal';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<PublicRegistration />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/teacher/*" element={<TeacherPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
