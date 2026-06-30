import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { getGovernorates, getDistricts, getSubdistricts } from '../lib/locations';
import { 
  Users, BookOpen, TrendingUp, LogOut, Download, Upload, 
  Trash2, Edit, Plus, Printer, AlertCircle, Search
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
  
  // Incomplete Cycles States
  const [incompleteCycles, setIncompleteCycles] = useState([]);
  const [incompleteSearchQuery, setIncompleteSearchQuery] = useState('');
  const [incompleteSubjectFilter, setIncompleteSubjectFilter] = useState('');
  const [incompleteTypeFilter, setIncompleteTypeFilter] = useState('');

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
      
      // Fetch all assessments using pagination (bypasses server-side limit of 1000)
      let allAssessments = [];
      let assessmentsPage = 0;
      const pageSize = 1000;
      let hasMoreAssessments = true;

      while (hasMoreAssessments) {
        const { data: pageData, error: assessmentsError } = await supabase
          .from('assessments')
          .select(`
            id, student_id, improvement_percentage, performance_status, difference_score, created_at, subject_id, teacher_id,
            pre_test_result, post_test_result, max_degree,
            students ( id, student_code, first_name, second_name, third_name, fourth_name, gender, class_grade )
          `)
          .range(assessmentsPage * pageSize, (assessmentsPage + 1) * pageSize - 1)
          .order('created_at', { ascending: false });

        if (assessmentsError) {
          console.error("[AdminDashboard] Error fetching assessments page:", assessmentsError);
          hasMoreAssessments = false;
          break;
        }

        if (pageData && pageData.length > 0) {
          allAssessments = [...allAssessments, ...pageData];
          if (pageData.length < pageSize) {
            hasMoreAssessments = false;
          } else {
            assessmentsPage++;
          }
        } else {
          hasMoreAssessments = false;
        }
      }

      console.log("[AdminDashboard] Total assessments fetched paginated:", allAssessments.length);
      const ghaith = allAssessments.filter(a => a.student_id === "a6f861aa-c23e-45b4-8446-338bca7acf01" || a.students?.id === "a6f861aa-c23e-45b4-8446-338bca7acf01");
      console.log("[AdminDashboard] Ghaith assessments in fetched list:", ghaith);
      
      let avgImp = 0;
      let statusCounts = { 'Excellent': 0, 'Good': 0, 'Needs Improvement': 0 };
      if (allAssessments.length > 0) {
        setImprovementsList(allAssessments);
        const sum = allAssessments.reduce((acc, curr) => acc + (curr.improvement_percentage || 0), 0);
        avgImp = sum / allAssessments.length;
        
        allAssessments.forEach(a => {
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

      // Fetch all students using pagination (bypasses server-side limit of 1000)
      let allStudents = [];
      let studentsPage = 0;
      let hasMoreStudents = true;

      while (hasMoreStudents) {
        const { data: pageStudents, error: studentsErr } = await supabase
          .from('students')
          .select('*')
          .range(studentsPage * pageSize, (studentsPage + 1) * pageSize - 1)
          .order('created_at', { ascending: false });

        if (studentsErr) {
          console.error("[AdminDashboard] Error fetching students page:", studentsErr);
          hasMoreStudents = false;
          break;
        }

        if (pageStudents && pageStudents.length > 0) {
          allStudents = [...allStudents, ...pageStudents];
          if (pageStudents.length < pageSize) {
            hasMoreStudents = false;
          } else {
            studentsPage++;
          }
        } else {
          hasMoreStudents = false;
        }
      }

      console.log("[AdminDashboard] Total students fetched paginated:", allStudents.length);
      if (allStudents.length > 0) {
        setStudents(allStudents);
      }

      // Compute incomplete cycles (including Not Started / Missed subjects)
      const cycles = [];
      const subjectsList = ['Math', 'Science', 'Arabic', 'English'];
      const studentList = allStudents;
      const assessmentsList = allAssessments;

      studentList.forEach(student => {
        subjectsList.forEach(subject => {
          const studentAssessments = assessmentsList.filter(a => 
            (a.student_id === student.id || a.students?.id === student.id) && a.subject_id === subject
          );

          let pre_test = null;
          let post_test = null;
          let max_degree = 100;
          let created_at = student.created_at;
          let teacher_id = null;

          studentAssessments.forEach(item => {
            if (item.pre_test_result !== null && item.pre_test_result !== undefined && item.pre_test_result !== '') {
              pre_test = item.pre_test_result;
            }
            if (item.post_test_result !== null && item.post_test_result !== undefined && item.post_test_result !== '') {
              post_test = item.post_test_result;
            }
            if (!teacher_id || new Date(item.created_at) > new Date(created_at)) {
              created_at = item.created_at;
              teacher_id = item.teacher_id;
              max_degree = item.max_degree;
            }
          });

          const hasPre = pre_test !== null && pre_test !== undefined && pre_test !== '';
          const hasPost = post_test !== null && post_test !== undefined && post_test !== '';

          if (hasPre && !hasPost) {
            cycles.push({
              student,
              subject,
              type: 'Pre-Test Only',
              score: pre_test,
              max_degree,
              created_at,
              teacher_id
            });
          } else if (!hasPre && hasPost) {
            cycles.push({
              student,
              subject,
              type: 'Post-Test Only',
              score: post_test,
              max_degree,
              created_at,
              teacher_id
            });
          } else if (!hasPre && !hasPost) {
            cycles.push({
              student,
              subject,
              type: 'Not Started',
              score: '—',
              max_degree,
              created_at,
              teacher_id: null
            });
          }
        });
      });
      setIncompleteCycles(cycles);

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
      'Project Code': s.project_code || '',
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
    // Group assessments by student
    const studentGroups = {};
    filteredImprovements.forEach(item => {
      const studentId = item.student_id || item.students?.id;
      if (!studentId) return;
      if (!studentGroups[studentId]) {
        studentGroups[studentId] = {
          student: item.students || students.find(s => s.id === studentId),
          assessments: {}
        };
      }
      studentGroups[studentId].assessments[item.subject_id] = item;
    });

    const rows = [];
    
    // Row 1 Header (English, Math, Arabic, Science merged headers)
    rows.push([
      "Student Code", "Student Name", "Gender", "Subject",
      "English", "", "", "",
      "Math", "", "", "",
      "Arabic", "", "", "",
      "Science", "", "", ""
    ]);
    
    // Row 2 Sub-headers
    rows.push([
      "", "", "", "",
      "Pre-Test", "Post-Test", "Max Score", "Improvement %",
      "Pre-Test", "Post-Test", "Max Score", "Improvement %",
      "Pre-Test", "Post-Test", "Max Score", "Improvement %",
      "Pre-Test", "Post-Test", "Max Score", "Improvement %"
    ]);

    // Populate Student Rows
    Object.values(studentGroups).forEach(group => {
      const s = group.student;
      if (!s) return;

      const getSubjectData = (subject) => {
        const a = group.assessments[subject];
        return [
          a?.pre_test_result !== undefined && a?.pre_test_result !== null ? a.pre_test_result : "—",
          a?.post_test_result !== undefined && a?.post_test_result !== null ? a.post_test_result : "—",
          a?.max_degree !== undefined && a?.max_degree !== null ? a.max_degree : "—",
          a?.improvement_percentage !== undefined && a?.improvement_percentage !== null ? `${a.improvement_percentage}%` : "—"
        ];
      };

      rows.push([
        s.student_code || "N/A",
        `${s.first_name || ''} ${s.second_name || ''} ${s.third_name || ''} ${s.fourth_name || ''}`.trim().replace(/\s+/g, ' ') || "Unknown",
        s.gender || "N/A",
        s.class_grade || "N/A", // Placed in the "Subject" Column (Column D) as represented in the template data
        ...getSubjectData("English"),
        ...getSubjectData("Math"),
        ...getSubjectData("Arabic"),
        ...getSubjectData("Science")
      ]);
    });

    // 1. Calculate Averages Row
    const avgRow = ["Average / General", "", "", ""];
    const subjects = ["English", "Math", "Arabic", "Science"];
    
    subjects.forEach(subject => {
      let preSum = 0, preCount = 0;
      let postSum = 0, postCount = 0;
      let maxSum = 0, maxCount = 0;
      let impSum = 0, impCount = 0;

      Object.values(studentGroups).forEach(group => {
        const a = group.assessments[subject];
        if (a) {
          if (a.pre_test_result !== undefined && a.pre_test_result !== null) {
            preSum += a.pre_test_result;
            preCount++;
          }
          if (a.post_test_result !== undefined && a.post_test_result !== null) {
            postSum += a.post_test_result;
            postCount++;
          }
          if (a.max_degree !== undefined && a.max_degree !== null) {
            maxSum += a.max_degree;
            maxCount++;
          }
          if (a.improvement_percentage !== undefined && a.improvement_percentage !== null) {
            impSum += a.improvement_percentage;
            impCount++;
          }
        }
      });

      avgRow.push(
        preCount > 0 ? parseFloat((preSum / preCount).toFixed(1)) : "—",
        postCount > 0 ? parseFloat((postSum / postCount).toFixed(1)) : "—",
        maxCount > 0 ? parseFloat((maxSum / maxCount).toFixed(1)) : "—",
        impCount > 0 ? `${(impSum / impCount).toFixed(1)}%` : "—"
      );
    });
    rows.push(avgRow);

    // 2. Calculate Indicators Stats for the summary table
    const stats = {
      Boys: { English: { tracked: 0, improved: 0 }, Math: { tracked: 0, improved: 0 }, Arabic: { tracked: 0, improved: 0 }, Science: { tracked: 0, improved: 0 }, "Overall (Any Subject)": { tracked: 0, improved: 0 } },
      Girls: { English: { tracked: 0, improved: 0 }, Math: { tracked: 0, improved: 0 }, Arabic: { tracked: 0, improved: 0 }, Science: { tracked: 0, improved: 0 }, "Overall (Any Subject)": { tracked: 0, improved: 0 } }
    };

    Object.values(studentGroups).forEach(group => {
      const s = group.student;
      if (!s) return;
      const gender = s.gender === 'Female' ? 'Girls' : 'Boys';
      
      let hasAnyTracked = false;
      let hasAnyImproved = false;

      subjects.forEach(subject => {
        const a = group.assessments[subject];
        if (a) {
          hasAnyTracked = true;
          stats[gender][subject].tracked++;
          const isImproved = a.performance_status === 'Excellent' || a.performance_status === 'Good';
          if (isImproved) {
            stats[gender][subject].improved++;
            hasAnyImproved = true;
          }
        }
      });

      if (hasAnyTracked) {
        stats[gender]["Overall (Any Subject)"].tracked++;
        if (hasAnyImproved) {
          stats[gender]["Overall (Any Subject)"].improved++;
        }
      }
    });

    // Append blank rows and Indicator Title
    rows.push([]);
    rows.push([]);
    rows.push(["SIGNIFICANT IMPROVEMENT INDICATOR BREAKDOWN (Improvement ≥ 50%)"]);
    rows.push(["Gender", "Subject", "Tracked Students", "Significant Improvement Count", "% Showed Significant Improvement"]);

    const appendIndicatorRow = (gender, subject) => {
      const data = stats[gender][subject];
      const percent = data.tracked > 0 ? `${((data.improved / data.tracked) * 100).toFixed(1)}%` : "0.0%";
      rows.push([gender, subject, data.tracked, data.improved, percent]);
    };

    subjects.forEach(subject => {
      appendIndicatorRow("Boys", subject);
      appendIndicatorRow("Girls", subject);
    });

    appendIndicatorRow("Boys", "Overall (Any Subject)");
    appendIndicatorRow("Girls", "Overall (Any Subject)");

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Set cell merges to match the user's Excel structure
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Student Code (merged vertically)
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Student Name (merged vertically)
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Gender (merged vertically)
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // Subject / Grade (merged vertically)
      { s: { r: 0, c: 4 }, e: { r: 0, c: 7 } }, // English (merged horizontally)
      { s: { r: 0, c: 8 }, e: { r: 0, c: 11 } }, // Math (merged horizontally)
      { s: { r: 0, c: 12 }, e: { r: 0, c: 15 } }, // Arabic (merged horizontally)
      { s: { r: 0, c: 16 }, e: { r: 0, c: 19 } }  // Science (merged horizontally)
    ];

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

  const exportIncompleteCycles = () => {
    const exportData = filteredIncompleteCycles.map(item => ({
      'Student Code': item.student?.student_code || 'N/A',
      'Student Name': item.student ? `${item.student.first_name} ${item.student.second_name} ${item.student.third_name} ${item.student.fourth_name}`.trim().replace(/\s+/g, ' ') : 'Unknown',
      'Gender': item.student?.gender || 'N/A',
      'Class/Grade': item.student?.class_grade || 'N/A',
      'Subject': item.subject || 'N/A',
      'Incomplete Type': item.type,
      'Recorded Score': item.score,
      'Max Score': item.max_degree,
      'Date Recorded': new Date(item.created_at).toLocaleDateString(),
      'Teacher Name': teachers.find(t => t.id === item.teacher_id)?.full_name || 'Unknown'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incomplete Cycles");
    XLSX.writeFile(wb, "incomplete_cycles_report.xlsx");
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
              project_code: getVal(['Project Code', 'project_code', 'projectCode', 'ProjectCode']),
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

  const deleteStudent = async (id) => {
    if (window.confirm('Are you sure you want to delete this student? This will permanently remove them.')) {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (!error) {
        setStudents(students.filter(s => s.id !== id));
        setStats({ ...stats, totalStudents: stats.totalStudents - 1 });
        alert('Student deleted successfully!');
      } else {
        alert('Failed to delete student: ' + error.message);
      }
    }
  };

  const deleteAssessment = async (id) => {
    if (window.confirm('Are you sure you want to delete this assessment record?')) {
      const { error } = await supabase.from('assessments').delete().eq('id', id);
      if (!error) {
        // Update local state
        const updatedList = improvementsList.filter(item => item.id !== id);
        setImprovementsList(updatedList);
        
        // Recalculate stats and chartData based on updated assessments list
        let avgImp = 0;
        let statusCounts = { 'Excellent': 0, 'Good': 0, 'Needs Improvement': 0 };
        
        if (updatedList.length > 0) {
          const sum = updatedList.reduce((acc, curr) => acc + (curr.improvement_percentage || 0), 0);
          avgImp = sum / updatedList.length;
          
          updatedList.forEach(a => {
            if (statusCounts[a.performance_status] !== undefined) {
              statusCounts[a.performance_status]++;
            }
          });
        }
        
        setStats(prev => ({
          ...prev,
          avgImprovement: avgImp.toFixed(1)
        }));
        
        setChartData([
          { name: 'Excellent', value: statusCounts['Excellent'] },
          { name: 'Good', value: statusCounts['Good'] },
          { name: 'Needs Imp.', value: statusCounts['Needs Improvement'] },
        ]);
        
        alert('Assessment deleted successfully!');
      } else {
        alert('Failed to delete assessment: ' + error.message);
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
          gender: editingStudent.gender,
          project_code: editingStudent.project_code
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

  const filteredIncompleteCycles = useMemo(() => {
    const normalizeArabic = (str) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/[أإآأ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, ''); // Remove Tashkeel (diacritics)
    };

    const normalizedQuery = normalizeArabic(incompleteSearchQuery);

    return incompleteCycles.filter(item => {
      const student = item.student;
      const name = normalizeArabic(`${student.first_name || ''} ${student.second_name || ''} ${student.third_name || ''} ${student.fourth_name || ''}`);
      const code = normalizeArabic(student.student_code || '');
      const matchesSearch = name.includes(normalizedQuery) || code.includes(normalizedQuery);
      
      const matchesSubject = !incompleteSubjectFilter || item.subject === incompleteSubjectFilter;
      
      const matchesType = !incompleteTypeFilter || item.type === incompleteTypeFilter;
      
      return matchesSearch && matchesSubject && matchesType;
    });
  }, [incompleteCycles, incompleteSearchQuery, incompleteSubjectFilter, incompleteTypeFilter]);

  const SUBJECT_COLORS = {
    'Math': '#3b82f6',      // Blue
    'Science': '#10b981',   // Emerald
    'Arabic': '#8b5cf6',    // Purple
    'English': '#f43f5e',   // Rose
    'Unknown': '#64748b'    // Slate
  };

  // Calculate unique tracked students total
  const totalTrackedStudents = useMemo(() => {
    const trackedIds = new Set(improvementsList.map(a => a.student_id || a.students?.id).filter(Boolean));
    return trackedIds.size;
  }, [improvementsList]);

  // Calculate significant improvement indicator statistics
  const indicatorStats = useMemo(() => {
    const stats = {
      Boys: { tracked: 0, improved: 0 },
      Girls: { tracked: 0, improved: 0 }
    };

    // Group assessments by student ID
    const studentGroups = {};
    improvementsList.forEach(item => {
      const studentId = item.student_id || item.students?.id;
      if (!studentId) return;
      if (!studentGroups[studentId]) {
        studentGroups[studentId] = {
          student: item.students || students.find(s => s.id === studentId),
          improved: false,
          tracked: false
        };
      }
      studentGroups[studentId].tracked = true;
      if (item.performance_status === 'Excellent' || item.performance_status === 'Good') {
        studentGroups[studentId].improved = true;
      }
    });

    Object.values(studentGroups).forEach(group => {
      const s = group.student;
      if (!s) return;
      const gender = s.gender === 'Female' ? 'Girls' : 'Boys';
      stats[gender].tracked++;
      if (group.improved) {
        stats[gender].improved++;
      }
    });

    return stats;
  }, [improvementsList, students]);

  const boysPercent = indicatorStats.Boys.tracked > 0 
    ? ((indicatorStats.Boys.improved / indicatorStats.Boys.tracked) * 100).toFixed(1) 
    : '0.0';
  const girlsPercent = indicatorStats.Girls.tracked > 0 
    ? ((indicatorStats.Girls.improved / indicatorStats.Girls.tracked) * 100).toFixed(1) 
    : '0.0';

  // Derive subject statistics from improvementsList
  const subjectStats = useMemo(() => {
    const subjectsMap = {};
    const defaultSubjects = ['Math', 'Science', 'Arabic', 'English'];
    
    // Initialize default subjects
    defaultSubjects.forEach(sub => {
      subjectsMap[sub] = {
        subject: sub,
        trackedStudents: new Set(),
        totalImprovement: 0,
        improvementCount: 0,
        totalAssessments: 0
      };
    });

    improvementsList.forEach(item => {
      const sub = item.subject_id || 'Unknown';
      if (!subjectsMap[sub]) {
        subjectsMap[sub] = {
          subject: sub,
          trackedStudents: new Set(),
          totalImprovement: 0,
          improvementCount: 0,
          totalAssessments: 0
        };
      }

      // Track unique students
      const studentId = item.student_id || item.students?.id;
      if (studentId) {
        subjectsMap[sub].trackedStudents.add(studentId);
      }

      subjectsMap[sub].totalAssessments++;

      if (item.improvement_percentage !== undefined && item.improvement_percentage !== null) {
        subjectsMap[sub].totalImprovement += item.improvement_percentage;
        subjectsMap[sub].improvementCount++;
      }
    });

    return Object.keys(subjectsMap).map(sub => {
      const data = subjectsMap[sub];
      const avgImp = data.improvementCount > 0 
        ? parseFloat((data.totalImprovement / data.improvementCount).toFixed(1)) 
        : 0;
      return {
        subject: sub,
        trackedStudents: data.trackedStudents.size,
        avgImprovement: avgImp,
        totalAssessments: data.totalAssessments
      };
    });
  }, [improvementsList]);

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
          <div 
            className={`sidebar-item ${activeTab === 'incomplete-cycles' ? 'active' : ''}`}
            onClick={() => setActiveTab('incomplete-cycles')}
          >
            <AlertCircle size={18} /> Incomplete Cycles
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
            <div className="grid grid-cols-4 gap-6 mb-8">
              <div className="glass-card flex items-center gap-4">
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-secondary text-sm">Total Students</div>
                  <div className="text-2xl font-bold">{stats.totalStudents}</div>
                </div>
              </div>
              <div className="glass-card flex items-center gap-4">
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(240, 140, 0, 0.1)', color: 'var(--accent-primary)' }}>
                  <BookOpen size={24} />
                </div>
                <div>
                  <div className="text-secondary text-sm">Tracked Students</div>
                  <div className="text-2xl font-bold">{totalTrackedStudents}</div>
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
                <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
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
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="glass-card">
                <h3 className="font-bold text-lg mb-4">Tracked Students per Subject</h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={subjectStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="subject" stroke="var(--text-secondary)" />
                      <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                      />
                      <Bar dataKey="trackedStudents" name="Tracked Students" fill="var(--accent-primary)" radius={[4, 4, 0, 0]}>
                        {subjectStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SUBJECT_COLORS[entry.subject] || '#F08C00'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Subject Tracking Analysis Table */}
            <div className="glass-card mt-8">
              <h3 className="font-bold text-lg mb-4 text-primary">Subject Tracking Analysis</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Tracked Students</th>
                      <th>Avg Improvement</th>
                      <th>Assessments Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectStats.map(item => (
                      <tr key={item.subject}>
                        <td className="font-semibold flex items-center gap-2">
                          <span 
                            style={{ 
                              display: 'inline-block', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              backgroundColor: SUBJECT_COLORS[item.subject] || '#F08C00' 
                            }} 
                          />
                          {item.subject}
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                            {item.trackedStudents} Students
                          </span>
                        </td>
                        <td>
                          <span className="font-bold" style={{ color: item.avgImprovement >= 50 ? 'var(--success)' : 'var(--warning)' }}>
                            {item.avgImprovement}%
                          </span>
                        </td>
                        <td>{item.totalAssessments} records</td>
                      </tr>
                    ))}
                    {subjectStats.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-secondary">No tracking data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                      <th>Project Code</th>
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
                        <td>{s.project_code || '—'}</td>
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

            {/* Significant Improvement Indicators Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6 animate-fade-in">
              <div className="glass-card flex items-center justify-between" style={{ borderLeft: '4px solid var(--accent-primary)', padding: '20px' }}>
                <div className="flex items-center gap-4">
                  <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(240, 140, 0, 0.1)', color: 'var(--accent-primary)' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <div className="text-secondary text-sm font-semibold">Boys Significant Improvement Indicator</div>
                    <div className="text-xs text-secondary mt-1">
                      {indicatorStats.Boys.improved} out of {indicatorStats.Boys.tracked} tracked boys showed ≥ 50% improvement
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-primary">{boysPercent}%</div>
                  <div className="text-xs text-secondary mt-1">Target Met Ratio</div>
                </div>
              </div>

              <div className="glass-card flex items-center justify-between" style={{ borderLeft: '4px solid var(--success)', padding: '20px' }}>
                <div className="flex items-center gap-4">
                  <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <div className="text-secondary text-sm font-semibold">Girls Significant Improvement Indicator</div>
                    <div className="text-xs text-secondary mt-1">
                      {indicatorStats.Girls.improved} out of {indicatorStats.Girls.tracked} tracked girls showed ≥ 50% improvement
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-success" style={{ color: 'var(--success)' }}>{girlsPercent}%</div>
                  <div className="text-xs text-secondary mt-1">Target Met Ratio</div>
                </div>
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
                      <th>Actions</th>
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
                        <td>
                          <div className="flex gap-2">
                            <button className="text-danger" title="Delete" onClick={() => deleteAssessment(item.id)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {improvementsList.length === 0 && (
                      <tr><td colSpan="13" className="text-center py-4 text-secondary">No assessments recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'incomplete-cycles' && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Incomplete Assessment Cycles</h2>
              <div className="flex gap-4 items-center">
                {/* Search Input */}
                <div style={{ position: 'relative', width: '250px' }}>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="Search by Code or Name..."
                    value={incompleteSearchQuery}
                    onChange={(e) => setIncompleteSearchQuery(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-secondary)' }} />
                </div>
                
                {/* Subject Filter */}
                <select 
                  className="input-field" 
                  style={{ width: 'auto', minWidth: '150px' }}
                  value={incompleteSubjectFilter}
                  onChange={(e) => setIncompleteSubjectFilter(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>

                {/* Test Type Filter */}
                <select
                  className="input-field"
                  style={{ width: 'auto', minWidth: '180px' }}
                  value={incompleteTypeFilter}
                  onChange={(e) => setIncompleteTypeFilter(e.target.value)}
                >
                  <option value="">All Incomplete Types</option>
                  <option value="Pre-Test Only">Pre-Test Only</option>
                  <option value="Post-Test Only">Post-Test Only</option>
                  <option value="Not Started">Not Started</option>
                </select>

                {/* Export Excel Button */}
                <button className="btn btn-secondary" onClick={exportIncompleteCycles}>
                  <Download size={16} /> Export
                </button>
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student Code</th>
                      <th>Student Name</th>
                      <th>Gender</th>
                      <th>Grade</th>
                      <th>Subject</th>
                      <th>Status / Missing Test</th>
                      <th>Recorded Score</th>
                      <th>Max Score</th>
                      <th>Date Recorded</th>
                      <th>Teacher Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncompleteCycles.map((item, index) => (
                      <tr key={index}>
                        <td><span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{item.student?.student_code || 'N/A'}</span></td>
                        <td className="font-medium">
                          {item.student ? `${item.student.first_name} ${item.student.second_name} ${item.student.third_name} ${item.student.fourth_name}` : 'Unknown'}
                        </td>
                        <td>{item.student?.gender || 'N/A'}</td>
                        <td>{item.student?.class_grade || 'N/A'}</td>
                        <td className="font-semibold">{item.subject}</td>
                        <td>
                          {item.type === 'Pre-Test Only' ? (
                            <span className="badge badge-warning">Missing Post-Test</span>
                          ) : item.type === 'Post-Test Only' ? (
                            <span className="badge badge-danger">Missing Pre-Test</span>
                          ) : (
                            <span className="badge badge-danger">Not Started</span>
                          )}
                        </td>
                        <td dir="ltr" className="font-bold text-primary">{item.score}</td>
                        <td dir="ltr">{item.max_degree}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>{teachers.find(t => t.id === item.teacher_id)?.full_name || 'Unknown'}</td>
                      </tr>
                    ))}
                    {filteredIncompleteCycles.length === 0 && (
                      <tr><td colSpan="10" className="text-center py-4 text-secondary">No incomplete assessment cycles found.</td></tr>
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="input-label">Gender</label>
                  <select className="input-field" value={editingStudent.gender} onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Project Code</label>
                  <input type="text" className="input-field" value={editingStudent.project_code || ''} onChange={(e) => setEditingStudent({...editingStudent, project_code: e.target.value})} placeholder="e.g. TGH-NFE" />
                </div>
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
