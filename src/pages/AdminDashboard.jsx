import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { getGovernorates, getDistricts, getSubdistricts } from '../lib/locations';
import { 
  Users, BookOpen, TrendingUp, LogOut, Download, Upload, 
  Trash2, Edit, Plus, Printer 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    avgImprovement: 0,
  });
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [gradeFilter, setGradeFilter] = useState('');
  const [improvementsList, setImprovementsList] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: teacherCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
      
      const { data: assessments } = await supabase
        .from('assessments')
        .select(`
          id, improvement_percentage, performance_status, difference_score, created_at, subject_id, teacher_id,
          pre_test_result, post_test_result, max_degree,
          students ( student_code, first_name, second_name, third_name, fourth_name, gender )
        `)
        .order('created_at', { ascending: false });
      
      let avgImp = 0;
      let statusCounts = { 'Excellent': 0, 'Good': 0, 'Needs Improvement': 0 };
      
      if (assessments && assessments.length > 0) {
        setImprovementsList(assessments);
        const sum = assessments.reduce((acc, curr) => acc + (curr.improvement_percentage || 0), 0);
        avgImp = sum / assessments.length;
        
        assessments.forEach(a => {
          if (statusCounts[a.performance_status] !== undefined) {
            statusCounts[a.performance_status]++;
          }
        });
      }

      setStats({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        avgImprovement: avgImp.toFixed(1)
      });

      setChartData([
        { name: 'Excellent', value: statusCounts['Excellent'] },
        { name: 'Good', value: statusCounts['Good'] },
        { name: 'Needs Imp.', value: statusCounts['Needs Improvement'] },
      ]);

      // Fetch lists
      const { data: studentsData } = await supabase.from('students').select('*').order('created_at', { ascending: false }).limit(1000);
      if (studentsData) setStudents(studentsData);

      const { data: teachersData } = await supabase.from('teachers').select('*').order('created_at', { ascending: false });
      if (teachersData) setTeachers(teachersData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Excel Export
  const exportStudents = () => {
    const exportData = students.map(s => ({
      'Student Code': s.student_code,
      'First Name': s.first_name,
      'Second Name': s.second_name,
      'Third Name': s.third_name,
      'Fourth Name': s.fourth_name,
      'Gender': s.gender,
      'Class/Grade': s.class_grade,
      'Phone': s.phone_number,
      'Governorate': s.governorate || '',
      'District': s.district || '',
      'Subdistrict': s.subdistrict || '',
      'Village': s.village || '',
      'Registered Date': new Date(s.created_at).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_export.xlsx");
  };

  const exportImprovements = () => {
    const exportData = filteredImprovements.map(item => ({
      Date: new Date(item.created_at).toLocaleDateString(),
      'Teacher Name': teachers.find(t => t.id === item.teacher_id)?.full_name || 'Unknown',
      'Student Code': item.students?.student_code || 'N/A',
      'Student Name': item.students ? `${item.students.first_name} ${item.students.second_name} ${item.students.third_name} ${item.students.fourth_name}`.trim().replace(/\s+/g, ' ') : 'Unknown',
      Gender: item.students?.gender || 'N/A',
      Subject: item.subject_id || 'N/A',
      'Pre-Test': item.pre_test_result !== undefined ? item.pre_test_result : 'N/A',
      'Post-Test': item.post_test_result !== undefined ? item.post_test_result : 'N/A',
      'Max Score': item.max_degree !== undefined ? item.max_degree : 'N/A',
      'Improvement %': item.improvement_percentage !== undefined ? `${item.improvement_percentage}%` : '0%',
      'Diff. Score': item.difference_score !== undefined ? `+${item.difference_score}` : '0',
      Status: item.performance_status || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Improvements");
    XLSX.writeFile(wb, "improvements_export.xlsx");
  };

  const exportTeachers = () => {
    const exportData = teachers.map(t => ({
      'Username': t.email ? t.email.replace('@tgh.nfe', '') : '',
      'Full Name': t.full_name,
      'Password': t.password || '',
      'Joined Date': new Date(t.created_at).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");
    XLSX.writeFile(wb, "teachers_export.xlsx");
  };

  // Excel Import
  const importStudents = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      if (data.length > 0) {
        setLoading(true);
        // Basic validation and insert
        try {
          const insertData = data.map(row => {
            const getVal = (keys) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return row[k];
              }
              return '';
            };

            return {
              student_code: getVal(['Student Code', 'student_code', 'code']) || `NFE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
              first_name: getVal(['First Name', 'first_name', 'firstName']),
              second_name: getVal(['Second Name', 'second_name', 'secondName']),
              third_name: getVal(['Third Name', 'third_name', 'thirdName']),
              fourth_name: getVal(['Fourth Name', 'fourth_name', 'fourthName']),
              phone_number: String(getVal(['Phone', 'Phone Number', 'phone_number', 'phone']) || ''),
              class_grade: getVal(['Class/Grade', 'Class / Grade', 'class_grade', 'grade']),
              gender: getVal(['Gender', 'gender']) || 'Male',
              governorate: getVal(['Governorate', 'governorate']),
              district: getVal(['District', 'district']),
              subdistrict: getVal(['Subdistrict', 'subdistrict']),
              village: getVal(['Village', 'village'])
            };
          });

          // Upsert: insert new records, skip duplicates on student_code
          const { data: upserted, error } = await supabase
            .from('students')
            .upsert(insertData, { onConflict: 'student_code', ignoreDuplicates: true })
            .select();
          if (error) throw error;
          const imported = upserted?.length ?? 0;
          const skipped = insertData.length - imported;
          alert(`Import complete!\n✅ ${imported} students imported.${skipped > 0 ? `\n⚠️ ${skipped} skipped (duplicate student codes).` : ''}`);
          fetchDashboardData();
        } catch (error) {
          alert('Import failed: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  // Add Teacher State
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ username: '', password: '', full_name: '' });
  const [teacherLoading, setTeacherLoading] = useState(false);

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    setTeacherLoading(true);
    
    try {
      // Create a temporary client so we don't log the admin out
      const tempClient = supabase.auth.admin || supabase; 
      // Actually, standard signUp might log us out. The safest client-side workaround:
      const anonClient = supabase; // We'll just use the regular one and handle if it logs out, but let's try standard signUp.
      // Wait, Supabase v2 signUp with an active session returns an error "User already registered" if we don't use admin API.
      // The only way to create a user while logged in is if we use the same API call or tell the user it requires backend.
      
      // Let's attempt to use the standard signUp. If it fails because a user is logged in, we will show a specific error.
      // Convert username to internal Supabase email format
      const internalEmail = newTeacher.username.trim().toLowerCase() + '@tgh.nfe';
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: internalEmail,
        password: newTeacher.password,
      });

      if (authError) throw authError;

      if (authData?.user) {
        const { error: dbError } = await supabase.from('teachers').insert([{
          id: authData.user.id,
          email: internalEmail,
          full_name: newTeacher.full_name,
          password: newTeacher.password
        }]);
        if (dbError) throw dbError;
        
        alert('Teacher added successfully!');
        setShowTeacherModal(false);
        setNewTeacher({ username: '', password: '', full_name: '' });
        fetchDashboardData();
      }
    } catch (error) {
      alert('Error adding teacher: ' + error.message + '\n\nIf it says "User already registered" or logs you out, it is because Supabase requires a secure backend (Service Role Key) to create users while logged in. Please create them via the Supabase Authentication Dashboard instead.');
    } finally {
      setTeacherLoading(false);
    }
  };

  const deleteTeacher = async (id) => {
    if (window.confirm('Are you sure you want to delete this teacher? This will permanently remove them.')) {
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (!error) {
        setTeachers(teachers.filter(t => t.id !== id));
        setStats({ ...stats, totalTeachers: stats.totalTeachers - 1 });
      } else {
        alert('Failed to delete teacher');
      }
    }
  };

  const deleteAllStudents = async () => {
    if (window.confirm('WARNING: Are you absolutely sure you want to delete ALL students? This cannot be undone.')) {
      setLoading(true);
      const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (!error) {
        setStudents([]);
        setStats({ ...stats, totalStudents: 0 });
        alert('All students have been deleted.');
      } else {
        alert('Failed to delete students: ' + error.message);
      }
      setLoading(false);
    }
  };

  // Edit Student State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const openEditModal = (student) => {
    setEditingStudent({ ...student });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          first_name: editingStudent.first_name,
          second_name: editingStudent.second_name,
          third_name: editingStudent.third_name,
          fourth_name: editingStudent.fourth_name,
          class_grade: editingStudent.class_grade,
          phone_number: editingStudent.phone_number,
          gender: editingStudent.gender
        })
        .eq('id', editingStudent.id);
        
      if (error) throw error;
      
      // Update local state
      setStudents(students.map(s => s.id === editingStudent.id ? editingStudent : s));
      setShowEditModal(false);
      alert('Student updated successfully!');
    } catch (error) {
      alert('Failed to update student: ' + error.message);
    } finally {
      setEditLoading(false);
    }
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const uniqueGrades = [...new Set(students.map(s => s.class_grade))].filter(Boolean);
  const filteredStudents = gradeFilter ? students.filter(s => s.class_grade === gradeFilter) : students;

  const uniqueSubjects = [...new Set(improvementsList.map(i => i.subject_id))].filter(Boolean);
  const filteredImprovements = subjectFilter ? improvementsList.filter(i => i.subject_id === subjectFilter) : improvementsList;

  return (
    <div className="flex" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Triangle Logo" style={{ height: '55px', objectFit: 'contain', mixBlendMode: 'lighten' }} />
            <h1 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>NFE Admin</h1>
          </div>
        </div>
        
        <nav style={{ padding: '16px 0', flex: 1 }}>
          <div 
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <TrendingUp size={18} /> Dashboard Overview
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <Users size={18} /> Students Management
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'teachers' ? 'active' : ''}`}
            onClick={() => setActiveTab('teachers')}
          >
            <Users size={18} /> Teachers Management
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'improvements' ? 'active' : ''}`}
            onClick={() => setActiveTab('improvements')}
          >
            <TrendingUp size={18} /> Improvements Tracking
          </div>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={handleLogout} className="btn btn-secondary w-full flex justify-center text-sm">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {loading && <div className="text-center py-8">Loading data...</div>}

        {!loading && activeTab === 'overview' && (
          <div className="fade-in">
            <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
            
            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="glass-card flex items-center gap-4">
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-secondary text-sm">Total Students</div>
                  <div className="text-2xl font-bold">{stats.totalStudents}</div>
                </div>
              </div>
              <div className="glass-card flex items-center gap-4">
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-secondary text-sm">Total Teachers</div>
                  <div className="text-2xl font-bold">{stats.totalTeachers}</div>
                </div>
              </div>
              <div className="glass-card flex items-center gap-4">
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="text-secondary text-sm">Avg Improvement</div>
                  <div className="text-2xl font-bold">{stats.avgImprovement}%</div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-card">
                <h3 className="font-bold text-lg mb-4">Performance Distribution</h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="glass-card">
                <h3 className="font-bold text-lg mb-4">Recent Improvements (Demo)</h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" />
                      <YAxis stroke="var(--text-secondary)" />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                      <Bar dataKey="value" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'students' && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Students Management</h2>
              <div className="flex gap-2 items-center">
                <select 
                  className="input-field" 
                  style={{ width: 'auto', minWidth: '150px' }}
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                >
                  <option value="">All Grades</option>
                  {uniqueGrades.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
                <label className="btn btn-secondary cursor-pointer">
                  <Upload size={16} /> Import Excel
                  <input type="file" accept=".xlsx, .csv" style={{ display: 'none' }} onChange={importStudents} />
                </label>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={16} /> Print IDs
                </button>
                <button className="btn btn-secondary" onClick={exportStudents}>
                  <Download size={16} /> Export
                </button>
                <button className="btn btn-primary" onClick={() => alert('Adding manually can be done via the public form for now.')}>
                  <Plus size={16} /> Add Student
                </button>
                <button className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={deleteAllStudents}>
                  <Trash2 size={16} /> Delete All
                </button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Full Name</th>
                      <th>Class</th>
                      <th>Location</th>
                      <th>Phone</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => (
                      <tr key={s.id}>
                        <td><span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{s.student_code}</span></td>
                        <td className="font-medium">{s.first_name} {s.second_name} {s.third_name} {s.fourth_name}</td>
                        <td>{s.class_grade}</td>
                        <td className="text-secondary">{s.governorate && s.district ? `${s.governorate} - ${s.district}` : 'N/A'}</td>
                        <td>{s.phone_number}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="text-accent-primary" title="Edit" onClick={() => openEditModal(s)}><Edit size={16} /></button>
                            <button className="text-danger" title="Delete" onClick={() => deleteStudent(s.id)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr><td colSpan="5" className="text-center py-4 text-secondary">No students found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'teachers' && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Teachers Management</h2>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={exportTeachers}>
                  <Download size={16} /> Export Excel
                </button>
                <button className="btn btn-primary" onClick={() => setShowTeacherModal(true)}>
                  <Plus size={16} /> Add Teacher
                </button>
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Full Name</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map(t => (
                      <tr key={t.id}>
                        <td className="font-medium">{t.email ? t.email.replace('@tgh.nfe', '') : '—'}</td>
                        <td>{t.full_name}</td>
                        <td>{new Date(t.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="text-danger" title="Delete" onClick={() => deleteTeacher(t.id)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {teachers.length === 0 && (
                      <tr><td colSpan="4" className="text-center py-4 text-secondary">No teachers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'improvements' && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Improvements Tracking</h2>
              <div className="flex gap-2 items-center">
                <select 
                  className="input-field" 
                  style={{ width: 'auto', minWidth: '150px' }}
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={exportImprovements}>
                  <Download size={16} /> Export
                </button>
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Teacher Name</th>
                      <th>Student Code</th>
                      <th>Student Name</th>
                      <th>Gender</th>
                      <th>Subject</th>
                      <th>Pre-Test</th>
                      <th>Post-Test</th>
                      <th>Max Score</th>
                      <th>Improvement %</th>
                      <th>Diff. Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImprovements.map(item => (
                      <tr key={item.id}>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>{teachers.find(t => t.id === item.teacher_id)?.full_name || 'Unknown'}</td>
                        <td><span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{item.students?.student_code || 'N/A'}</span></td>
                        <td className="font-medium">
                          {item.students ? `${item.students.first_name} ${item.students.second_name} ${item.students.third_name} ${item.students.fourth_name}` : 'Unknown'}
                        </td>
                        <td>{item.students?.gender || 'N/A'}</td>
                        <td>{item.subject_id}</td>
                        <td dir="ltr">{item.pre_test_result !== undefined ? item.pre_test_result : '-'}</td>
                        <td dir="ltr">{item.post_test_result !== undefined ? item.post_test_result : '-'}</td>
                        <td dir="ltr">{item.max_degree !== undefined ? item.max_degree : '-'}</td>
                        <td className="font-bold text-primary" dir="ltr">{item.improvement_percentage}%</td>
                        <td dir="ltr">+{item.difference_score} pts</td>
                        <td>
                          <span className={`badge ${item.performance_status === 'Excellent' ? 'badge-success' : item.performance_status === 'Good' ? 'badge-warning' : 'badge-danger'}`}>
                            {item.performance_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {improvementsList.length === 0 && (
                      <tr><td colSpan="12" className="text-center py-4 text-secondary">No assessments recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', backgroundColor: 'var(--bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="font-bold text-xl mb-4">Edit Student</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">First Name</label>
                  <input type="text" className="input-field" required value={editingStudent.first_name} onChange={(e) => setEditingStudent({...editingStudent, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Second Name</label>
                  <input type="text" className="input-field" required value={editingStudent.second_name} onChange={(e) => setEditingStudent({...editingStudent, second_name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Third Name</label>
                  <input type="text" className="input-field" required value={editingStudent.third_name} onChange={(e) => setEditingStudent({...editingStudent, third_name: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Fourth Name</label>
                  <input type="text" className="input-field" required value={editingStudent.fourth_name} onChange={(e) => setEditingStudent({...editingStudent, fourth_name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Class / Grade</label>
                  <input type="text" className="input-field" required value={editingStudent.class_grade} onChange={(e) => setEditingStudent({...editingStudent, class_grade: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Phone Number</label>
                  <input type="text" className="input-field" required value={editingStudent.phone_number} onChange={(e) => setEditingStudent({...editingStudent, phone_number: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Governorate</label>
                  <select className="input-field" value={editingStudent.governorate || ''} onChange={(e) => setEditingStudent({...editingStudent, governorate: e.target.value, district: '', subdistrict: ''})}>
                    <option value="">Select Governorate</option>
                    {getGovernorates().map(gov => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">District</label>
                  <select className="input-field" value={editingStudent.district || ''} onChange={(e) => setEditingStudent({...editingStudent, district: e.target.value, subdistrict: ''})} disabled={!editingStudent.governorate}>
                    <option value="">Select District</option>
                    {getDistricts(editingStudent.governorate).map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Subdistrict</label>
                  <select className="input-field" value={editingStudent.subdistrict || ''} onChange={(e) => setEditingStudent({...editingStudent, subdistrict: e.target.value})} disabled={!editingStudent.district}>
                    <option value="">Select Subdistrict</option>
                    {getSubdistricts(editingStudent.governorate, editingStudent.district).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Village / Neighborhood</label>
                  <input type="text" className="input-field" value={editingStudent.village || ''} onChange={(e) => setEditingStudent({...editingStudent, village: e.target.value})} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Gender</label>
                <select className="input-field" value={editingStudent.gender} onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Teacher Modal */}
      {showTeacherModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '400px', backgroundColor: 'var(--bg-secondary)' }}>
            <h3 className="font-bold text-xl mb-4">Add New Teacher</h3>
            <form onSubmit={handleAddTeacher}>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input type="text" className="input-field" required value={newTeacher.full_name} onChange={(e) => setNewTeacher({...newTeacher, full_name: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Username</label>
                <input type="text" className="input-field" required value={newTeacher.username} onChange={(e) => setNewTeacher({...newTeacher, username: e.target.value})} placeholder="e.g. teacher01" autoComplete="username" />
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <input type="password" className="input-field" required minLength="6" value={newTeacher.password} onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTeacherModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={teacherLoading}>
                  {teacherLoading ? 'Adding...' : 'Add Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .sidebar-item {
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
          font-weight: 500;
        }
        .sidebar-item:hover {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }
        .sidebar-item.active {
          background-color: var(--accent-light);
          color: var(--accent-primary);
          border-right: 3px solid var(--accent-primary);
        }
        .w-full { width: 100%; }
        .fade-in {
          animation: fadeIn var(--transition-normal);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Hidden Print Area for Barcode List */}
      <div className="print-area">
        <div style={{ textAlign: 'center', marginBottom: '20px', width: '100%' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '60px', marginBottom: '10px' }} />
          <h2 style={{ color: '#000', margin: 0 }}>Student Barcode List</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>#</th>
              <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Student Name</th>
              <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Grade / Gender</th>
              <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Student Code</th>
              <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Barcode</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr key={student.id} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>
                  {student.first_name} {student.second_name} {student.third_name} {student.fourth_name}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>
                  {student.class_grade} | {student.gender}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                  {student.student_code}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>
                  <Barcode value={student.student_code || 'INVALID'} width={1.2} height={30} displayValue={false} margin={0} background="#ffffff" lineColor="#000000" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
