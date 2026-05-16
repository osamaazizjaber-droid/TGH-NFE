import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, LogOut, CheckCircle, AlertCircle, Globe, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';

const translations = {
  en: {
    portalTitle: 'Teacher Portal',
    logout: 'Logout',
    selectStudent: 'Select Student',
    searchPlaceholder: 'Search by Code or Name...',
    noStudents: 'No students found.',
    assessmentForm: 'Assessment Form',
    recordingFor: 'Recording results for:',
    successMsg: 'Assessment recorded successfully!',
    subject: 'Subject',
    math: 'Math',
    science: 'Science',
    arabic: 'Arabic',
    english: 'English',
    maxDegree: 'Maximum Degree',
    preTest: 'Pre-Test Result',
    postTest: 'Post-Test Result',
    calculatedMetrics: 'Calculated Metrics',
    improvement: 'Improvement',
    difference: 'Difference',
    status: 'Status',
    excellent: 'Excellent',
    good: 'Good',
    needsImprovement: 'Needs Improvement',
    cancel: 'Cancel',
    saveAssessment: 'Save Assessment',
    saving: 'Saving...',
    noStudentSelected: 'No Student Selected',
    pleaseSearch: 'Please search and select a student from the side panel to record their assessment.',
    pts: 'pts'
  },
  ar: {
    portalTitle: 'بوابة المعلم',
    logout: 'تسجيل خروج',
    selectStudent: 'اختر طالب',
    searchPlaceholder: 'ابحث بالرمز أو الاسم...',
    noStudents: 'لا يوجد طلاب.',
    assessmentForm: 'نموذج التقييم',
    recordingFor: 'تسجيل النتائج لـ:',
    successMsg: 'تم تسجيل التقييم بنجاح!',
    subject: 'المادة',
    math: 'الرياضيات',
    science: 'العلوم',
    arabic: 'اللغة العربية',
    english: 'اللغة الإنجليزية',
    maxDegree: 'الدرجة القصوى',
    preTest: 'نتيجة الاختبار القبلي',
    postTest: 'نتيجة الاختبار البعدي',
    calculatedMetrics: 'المقاييس المحسوبة',
    improvement: 'نسبة التحسن',
    difference: 'الفرق',
    status: 'الحالة',
    excellent: 'ممتاز',
    good: 'جيد',
    needsImprovement: 'يحتاج تحسين',
    cancel: 'إلغاء',
    saveAssessment: 'حفظ التقييم',
    saving: 'جاري الحفظ...',
    noStudentSelected: 'لم يتم اختيار طالب',
    pleaseSearch: 'يرجى البحث واختيار طالب من القائمة الجانبية لتسجيل تقييمه.',
    pts: 'نقطة'
  }
};

export default function TeacherPortal() {
  const [lang, setLang] = useState('ar');
  const t = (key) => translations[lang][key] || key;

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [assessmentData, setAssessmentData] = useState({
    subject: 'Math',
    max_degree: 100,
    pre_test: 0,
    post_test: 0,
  });

  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let html5QrcodeScanner;
    if (isScanning) {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: {width: 250, height: 150} },
        false
      );
      html5QrcodeScanner.render(
        (decodedText) => {
          setSearchQuery(decodedText);
          setIsScanning(false);
          html5QrcodeScanner.clear();
        },
        (error) => {
          // ignore frame errors
        }
      );
    }
    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.log(e));
      }
    };
  }, [isScanning]);

  // Search students
  useEffect(() => {
    const fetchStudents = async () => {
      if (!searchQuery.trim()) {
        setStudents([]);
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .or(`student_code.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%`)
        .limit(5);
        
      if (!error && data) {
        setStudents(data);
      }
    };
    
    const timeoutId = setTimeout(() => {
      fetchStudents();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleAssessmentChange = (e) => {
    setAssessmentData({ ...assessmentData, [e.target.name]: e.target.value });
  };

  const calculateMetrics = () => {
    const max = parseFloat(assessmentData.max_degree) || 1;
    const pre = parseFloat(assessmentData.pre_test) || 0;
    const post = parseFloat(assessmentData.post_test) || 0;
    
    const diff = post - pre;
    const improvementPercent = (diff / max) * 100;
    
    let status = 'needsImprovement';
    if (improvementPercent >= 80) status = 'excellent';
    else if (improvementPercent >= 50) status = 'good';

    return { diff, improvementPercent: improvementPercent.toFixed(1), status };
  };

  const submitAssessment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    setLoading(true);
    setError(null);
    setSubmitSuccess(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("Not authenticated");

      const metrics = calculateMetrics();

      const { error: insertError } = await supabase
        .from('assessments')
        .insert([{
          student_id: selectedStudent.id,
          teacher_id: userData.user.id,
          subject_id: assessmentData.subject,
          max_degree: parseFloat(assessmentData.max_degree),
          pre_test_result: parseFloat(assessmentData.pre_test),
          post_test_result: parseFloat(assessmentData.post_test),
          improvement_percentage: parseFloat(metrics.improvementPercent),
          difference_score: metrics.diff,
          performance_status: metrics.status === 'excellent' ? 'Excellent' : metrics.status === 'good' ? 'Good' : 'Needs Improvement'
        }]);

      if (insertError) throw insertError;
      
      setSubmitSuccess(true);
      setAssessmentData({ ...assessmentData, pre_test: 0, post_test: 0 });
    } catch (err) {
      setError(err.message || 'Failed to submit assessment.');
    } finally {
      setLoading(false);
    }
  };

  const metrics = calculateMetrics();

  const toggleLanguage = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Navbar */}
      <nav style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Triangle Logo" style={{ height: '55px', objectFit: 'contain', mixBlendMode: 'lighten' }} />
          <h1 className="font-bold text-xl text-primary">{t('portalTitle')}</h1>
        </div>
        <div className="flex gap-4">
          <button onClick={toggleLanguage} className="btn btn-secondary text-sm flex items-center gap-2">
            <Globe size={16} /> {lang === 'ar' ? 'English' : 'عربي'}
          </button>
          <button onClick={handleLogout} className="btn btn-secondary text-sm flex items-center gap-2">
            <LogOut size={16} /> {t('logout')}
          </button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px', paddingLeft: '16px', paddingRight: '16px' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
          
          {/* Phase 1: Search & Select Student */}
          {!selectedStudent && (
            <div className="glass-card flex-col gap-4">
            <h2 className="font-bold text-lg mb-4">{t('selectStudent')}</h2>
            <div className="flex gap-2 mb-4">
              <div className="input-group relative" style={{ marginBottom: 0, flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', [lang === 'ar' ? 'right' : 'left']: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('searchPlaceholder')}
                  style={{ [lang === 'ar' ? 'paddingRight' : 'paddingLeft']: '40px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsScanning(true)}
                title="Scan Barcode"
                style={{ padding: '10px' }}
              >
                <Camera size={20} />
              </button>
            </div>

            {isScanning && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '500px', position: 'relative' }}>
                  <button 
                    onClick={() => setIsScanning(false)}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#000' }}
                  >
                    <X size={24} />
                  </button>
                  <h3 style={{ marginBottom: '16px', color: '#000', fontWeight: 'bold' }}>Scan Student Barcode</h3>
                  <div id="reader" style={{ width: '100%' }}></div>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
              {students.map(student => (
                <div 
                  key={student.id} 
                  onClick={() => setSelectedStudent(student)}
                  style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid var(--border-color)', 
                    cursor: 'pointer',
                    backgroundColor: selectedStudent?.id === student.id ? 'var(--accent-light)' : 'transparent',
                    borderRadius: '8px',
                    marginBottom: '4px'
                  }}
                  className="hover-bg"
                >
                  <div className="font-bold text-sm">{student.first_name} {student.second_name} {student.third_name} {student.fourth_name}</div>
                  <div className="text-secondary text-sm flex justify-between" style={{ marginTop: '4px' }}>
                    <span>{student.student_code}</span>
                    <span className="badge badge-warning">{student.class_grade}</span>
                  </div>
                  {student.governorate && student.district && (
                    <div className="text-secondary text-xs" style={{ marginTop: '4px', opacity: 0.8 }}>
                      {student.governorate} - {student.district} {student.village ? `- ${student.village}` : ''}
                    </div>
                  )}
                </div>
              ))}
              {searchQuery && students.length === 0 && (
                <div className="text-secondary text-sm text-center py-4">{t('noStudents')}</div>
              )}
            </div>
            </div>
          )}

          {/* Phase 2: Assessment Form */}
          {selectedStudent && (
            <div className="glass-card">
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="btn btn-secondary" 
                style={{ marginBottom: '16px', padding: '8px 12px', fontSize: '0.9rem', width: '100%', justifyContent: 'center' }}
              >
                {lang === 'ar' ? '→ العودة للبحث' : '← Back to Search'}
              </button>
                <div className="flex justify-between items-center mb-6" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h2 className="font-bold text-xl">{t('assessmentForm')}</h2>
                    <p className="text-secondary text-sm">
                      {t('recordingFor')} <strong>{selectedStudent.first_name} {selectedStudent.second_name}</strong> ({selectedStudent.student_code})
                    </p>
                  </div>
                </div>

                {submitSuccess && (
                  <div className="flex items-center gap-2 mb-4" style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px' }}>
                    <CheckCircle size={18} />
                    <span>{t('successMsg')}</span>
                  </div>
                )}
                
                {error && (
                  <div className="flex items-center gap-2 mb-4" style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={submitAssessment}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="input-label">{t('subject')}</label>
                      <select name="subject" className="input-field" value={assessmentData.subject} onChange={handleAssessmentChange}>
                        <option value="Math">{t('math')}</option>
                        <option value="Science">{t('science')}</option>
                        <option value="Arabic">{t('arabic')}</option>
                        <option value="English">{t('english')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="input-label">{t('maxDegree')}</label>
                      <input type="number" name="max_degree" className="input-field" min="1" value={assessmentData.max_degree} onChange={handleAssessmentChange} required />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <label className="input-label">{t('preTest')}</label>
                      <input type="number" name="pre_test" className="input-field" step="0.1" max={assessmentData.max_degree} value={assessmentData.pre_test} onChange={handleAssessmentChange} required />
                    </div>
                    <div>
                      <label className="input-label">{t('postTest')}</label>
                      <input type="number" name="post_test" className="input-field" step="0.1" max={assessmentData.max_degree} value={assessmentData.post_test} onChange={handleAssessmentChange} required />
                    </div>
                  </div>

                  <div className="p-4 mb-6" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 className="font-bold text-sm mb-3 text-secondary">{t('calculatedMetrics')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-secondary text-sm">{t('improvement')}</div>
                        <div className="font-bold text-lg text-primary" dir="ltr">{metrics.improvementPercent}%</div>
                      </div>
                      <div>
                        <div className="text-secondary text-sm">{t('difference')}</div>
                        <div className="font-bold text-lg text-primary" dir="ltr">+{metrics.diff} {t('pts')}</div>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }} disabled={loading}>
                    {loading ? '...' : t('submit')}
                  </button>
                </form>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .hover-bg:hover { background-color: var(--bg-primary) !important; }
      `}</style>
    </div>
  );
}
