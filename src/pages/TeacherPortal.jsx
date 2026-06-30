import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, LogOut, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    pts: 'pts',
    testType: 'Test Type',
    score: 'Score',
    allSubjectsCompleted: 'All assessment cycles for this student have been completed!',
    metricsPlaceholder: 'Calculated metrics will appear once both Pre-Test and Post-Test results are recorded.',
    submit: 'Submit Assessment'
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
    pts: 'نقطة',
    testType: 'نوع الاختبار',
    score: 'الدرجة',
    allSubjectsCompleted: 'تم إكمال جميع دورات التقييم لهذا الطالب!',
    metricsPlaceholder: 'ستظهر المقاييس المحسوبة بمجرد تسجيل نتائج الاختبارين القبلي والبعدي.',
    submit: 'تسجيل التقييم'
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
    pre_test: '',
    post_test: '',
  });
  const [existingAssessments, setExistingAssessments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Fetch student's existing assessments on selection
  useEffect(() => {
    if (!selectedStudent) {
      setExistingAssessments([]);
      return;
    }
    const fetchExisting = async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', selectedStudent.id);
      if (!error && data) {
        setExistingAssessments(data);
      }
    };
    fetchExisting();
  }, [selectedStudent]);

  // Determine completion status of subjects
  const subjectsList = ['Math', 'Science', 'Arabic', 'English'];
  const subjectsStatus = useMemo(() => {
    const status = {};
    subjectsList.forEach(sub => {
      status[sub] = { pre: false, post: false, row: null };
    });
    existingAssessments.forEach(a => {
      const sub = a.subject_id;
      if (status[sub]) {
        if (a.pre_test_result !== null && a.pre_test_result !== undefined && a.pre_test_result !== '') {
          status[sub].pre = true;
        }
        if (a.post_test_result !== null && a.post_test_result !== undefined && a.post_test_result !== '') {
          status[sub].post = true;
        }
        status[sub].row = a;
      }
    });
    return status;
  }, [existingAssessments]);

  // Set default subject and test type based on completion status
  useEffect(() => {
    const firstAvailableSubject = subjectsList.find(sub => {
      const status = subjectsStatus[sub];
      return !(status.pre && status.post);
    });

    if (firstAvailableSubject) {
      const currentStatus = subjectsStatus[assessmentData.subject];
      if (!currentStatus || (currentStatus.pre && currentStatus.post)) {
        setAssessmentData(prev => ({ ...prev, subject: firstAvailableSubject }));
      }
    }
  }, [subjectsStatus]);

  useEffect(() => {
    const currentStatus = subjectsStatus[assessmentData.subject];
    if (currentStatus && currentStatus.row) {
      const row = currentStatus.row;
      setAssessmentData(prev => ({
        ...prev,
        pre_test: row.pre_test_result !== null && row.pre_test_result !== undefined ? String(row.pre_test_result) : '',
        post_test: row.post_test_result !== null && row.post_test_result !== undefined ? String(row.post_test_result) : '',
        max_degree: row.max_degree || 100
      }));
    } else {
      setAssessmentData(prev => ({
        ...prev,
        pre_test: '',
        post_test: '',
        max_degree: 100
      }));
    }
  }, [assessmentData.subject, subjectsStatus]);

  // Search students (exclude fully completed ones)
  useEffect(() => {
    const fetchStudents = async () => {
      const trimmedQuery = searchQuery.trim();
      console.log("[Search] Triggered with query:", trimmedQuery);
      if (!trimmedQuery) {
        setStudents([]);
        return;
      }

      // Split the search query into terms (e.g. "Osama Aziz" -> ["Osama", "Aziz"])
      const terms = trimmedQuery.split(/\s+/).filter(Boolean);
      console.log("[Search] Terms:", terms);
      
      // Construct a broad OR query for Supabase to fetch candidates.
      // We will search for any candidate matching any term in any name field or student code.
      const orConditions = [];
      terms.forEach(term => {
        // Build wildcard term for Arabic compatibility
        // Replacing Alef (ا,أ,إ,آ) with * (matches any characters in PostgREST ilike)
        // Replacing Yeh/Alef Maksura (ي,ى) with *
        // Replacing Teh Marbuta/Heh (ة,ه) with *
        const wildcard = term
          .replace(/[أإآا]/g, '*')
          .replace(/[ىي]/g, '*')
          .replace(/[ةه]/g, '*');

        orConditions.push(
          `student_code.ilike.*${wildcard}*`,
          `first_name.ilike.*${wildcard}*`,
          `second_name.ilike.*${wildcard}*`,
          `third_name.ilike.*${wildcard}*`,
          `fourth_name.ilike.*${wildcard}*`,
          `project_code.ilike.*${wildcard}*`
        );
      });
      const orFilter = orConditions.join(',');
      console.log("[Search] Generated orFilter for database:", orFilter);

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .or(orFilter)
        .limit(100);
        
      console.log("[Search] Database students count:", studentsData?.length, "Error:", studentsError);
      if (studentsError) {
        console.error("[Search] Database students error details:", studentsError);
      }

      if (!studentsError && studentsData) {
        const studentIds = studentsData.map(s => s.id);
        console.log("[Search] Student IDs found:", studentIds);
        if (studentIds.length > 0) {
          const { data: assessmentsData, error: assessmentsError } = await supabase
            .from('assessments')
            .select('*')
            .in('student_id', studentIds);

          console.log("[Search] Database assessments count:", assessmentsData?.length, "Error:", assessmentsError);
          if (assessmentsError) {
            console.error("[Search] Database assessments error details:", assessmentsError);
          } else {
            console.log("[Search] assessmentsData details:", JSON.stringify(assessmentsData.map(a => ({ id: a.id, subject: a.subject_id, pre: a.pre_test_result, post: a.post_test_result }))));
          }

          // Helper to normalize Arabic characters for robust comparison
          const normalizeArabic = (str) => {
            if (!str) return '';
            return str
              .toLowerCase()
              .replace(/[أإآأ]/g, 'ا')
              .replace(/ة/g, 'ه')
              .replace(/ى/g, 'ي')
              .replace(/[\u064B-\u065F]/g, ''); // Remove Tashkeel (diacritics)
          };

          if (!assessmentsError && assessmentsData) {
            const filtered = studentsData.filter(student => {
              // 1. Strict Multi-term Match: Check that every search term matches the student (Arabic normalized)
              const fullName = normalizeArabic(`${student.first_name || ''} ${student.second_name || ''} ${student.third_name || ''} ${student.fourth_name || ''}`);
              const studentCode = normalizeArabic(student.student_code || '');
              
              const matchesAllTerms = terms.every(term => {
                const normalizedTerm = normalizeArabic(term);
                const matchName = fullName.includes(normalizedTerm);
                const matchCode = studentCode.includes(normalizedTerm);
                const matchProject = student.project_code ? normalizeArabic(student.project_code).includes(normalizedTerm) : false;
                return matchName || matchCode || matchProject;
              });
              
              if (!matchesAllTerms) {
                console.log(`[Search] Student ${student.student_code} filtered out: terms mismatch`);
                return false;
              }

              // 2. Logging Completion Check (we do not exclude them from search results so teachers can view/find them)
              const studentAssessments = assessmentsData.filter(a => a.student_id === student.id);
              const completedSubjectsCount = subjectsList.filter(subject => {
                const subAssessments = studentAssessments.filter(a => a.subject_id === subject);
                const hasPre = subAssessments.some(a => a.pre_test_result !== null && a.pre_test_result !== undefined && a.pre_test_result !== '');
                const hasPost = subAssessments.some(a => a.post_test_result !== null && a.post_test_result !== undefined && a.post_test_result !== '');
                return hasPre && hasPost;
              }).length;

              const isComplete = completedSubjectsCount === subjectsList.length;
              console.log(`[Search] Student ${student.student_code} (${student.first_name}): Completed ${completedSubjectsCount}/${subjectsList.length} subjects. Is complete?`, isComplete);
              
              return true; // Keep in search results even if fully completed
            });
            
            console.log("[Search] Final filtered students display count:", filtered.length, filtered);
            // Limit the final displayed list to a reasonable number (e.g., 15)
            setStudents(filtered.slice(0, 15));
          } else {
            console.warn("[Search] Falling back to name-only filtering due to assessments fetch error");
            // If assessments fetch failed, fall back to basic name filtering
            const nameFiltered = studentsData.filter(student => {
              const fullName = normalizeArabic(`${student.first_name || ''} ${student.second_name || ''} ${student.third_name || ''} ${student.fourth_name || ''}`);
              const studentCode = normalizeArabic(student.student_code || '');
              return terms.every(term => {
                const normalizedTerm = normalizeArabic(term);
                return fullName.includes(normalizedTerm) || studentCode.includes(normalizedTerm);
              });
            });
            setStudents(nameFiltered.slice(0, 15));
          }
        } else {
          setStudents([]);
        }
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

  const calculateLiveMetrics = () => {
    const preVal = assessmentData.pre_test;
    const postVal = assessmentData.post_test;
    const max = parseFloat(assessmentData.max_degree) || 1;

    const pre = preVal !== '' && preVal !== null && preVal !== undefined ? parseFloat(preVal) : null;
    const post = postVal !== '' && postVal !== null && postVal !== undefined ? parseFloat(postVal) : null;

    if (pre !== null && post !== null && !isNaN(pre) && !isNaN(post)) {
      const diff = post - pre;
      const improvementPercent = (diff / max) * 100;
      
      let statusText = 'needsImprovement';
      if (improvementPercent >= 80) statusText = 'excellent';
      else if (improvementPercent >= 50) statusText = 'good';

      return { 
        diff, 
        improvementPercent: improvementPercent.toFixed(1), 
        status: statusText, 
        complete: true 
      };
    }

    return { complete: false };
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

      const subject = assessmentData.subject;
      const max = parseFloat(assessmentData.max_degree);
      
      const preVal = assessmentData.pre_test;
      const postVal = assessmentData.post_test;

      const pre = preVal !== '' && preVal !== null && preVal !== undefined ? parseFloat(preVal) : null;
      const post = postVal !== '' && postVal !== null && postVal !== undefined ? parseFloat(postVal) : null;

      if (pre === null && post === null) {
        throw new Error(lang === 'ar' ? 'الرجاء إدخال درجة واحدة على الأقل' : 'Please enter at least one score');
      }

      if (pre !== null && (isNaN(pre) || pre < 0 || pre > max)) {
        throw new Error(lang === 'ar' ? 'درجة الاختبار القبلي غير صالحة' : 'Invalid Pre-Test score');
      }
      if (post !== null && (isNaN(post) || post < 0 || post > max)) {
        throw new Error(lang === 'ar' ? 'درجة الاختبار البعدي غير صالحة' : 'Invalid Post-Test score');
      }

      const status = subjectsStatus[subject];
      const existingRow = status?.row;

      // Determine final metrics
      let diff = null;
      let improvementPercent = null;
      let perfStatus = null;

      if (pre !== null && post !== null) {
        diff = post - pre;
        improvementPercent = parseFloat(((diff / max) * 100).toFixed(1));
        let pStatus = 'needsImprovement';
        if (improvementPercent >= 80) pStatus = 'excellent';
        else if (improvementPercent >= 50) pStatus = 'good';
        perfStatus = pStatus === 'excellent' ? 'Excellent' : pStatus === 'good' ? 'Good' : 'Needs Improvement';
      }

      if (existingRow) {
        // Update existing row
        const { error: updateError } = await supabase
          .from('assessments')
          .update({
            pre_test_result: pre,
            post_test_result: post,
            improvement_percentage: improvementPercent,
            difference_score: diff,
            performance_status: perfStatus
          })
          .eq('id', existingRow.id);

        if (updateError) throw updateError;
      } else {
        // Insert new row
        const { error: insertError } = await supabase
          .from('assessments')
          .insert([{
            student_id: selectedStudent.id,
            teacher_id: userData.user.id,
            subject_id: subject,
            max_degree: max,
            pre_test_result: pre,
            post_test_result: post,
            improvement_percentage: improvementPercent,
            difference_score: diff,
            performance_status: perfStatus
          }]);

        if (insertError) throw insertError;
      }
      
      setSubmitSuccess(true);
      setAssessmentData(prev => ({ ...prev, pre_test: '', post_test: '' }));
      
      const { data: updatedData } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', selectedStudent.id);
      if (updatedData) {
        setExistingAssessments(updatedData);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit assessment.');
    } finally {
      setLoading(false);
    }
  };

  const metrics = calculateLiveMetrics();

  const allCompleted = selectedStudent && subjectsList.every(sub => subjectsStatus[sub]?.pre && subjectsStatus[sub]?.post);

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
              </div>
              
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
                      <span>{student.student_code} {student.project_code ? `(${student.project_code})` : ''}</span>
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
                    {t('recordingFor')} <strong>{selectedStudent.first_name} {selectedStudent.second_name}</strong> ({selectedStudent.student_code}){selectedStudent.project_code ? ` - ${selectedStudent.project_code}` : ''}
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

              {allCompleted ? (
                <div className="flex flex-col items-center gap-4 text-center py-8" style={{ color: 'var(--success)', border: '1px dashed var(--success)', borderRadius: '12px', padding: '24px' }}>
                  <CheckCircle size={48} />
                  <p className="font-bold text-lg">{t('allSubjectsCompleted')}</p>
                </div>
              ) : (
                <form onSubmit={submitAssessment}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">{t('subject')}</label>
                        <select name="subject" className="input-field" value={assessmentData.subject} onChange={handleAssessmentChange}>
                          {(!subjectsStatus['Math']?.pre || !subjectsStatus['Math']?.post) && <option value="Math">{t('math')}</option>}
                          {(!subjectsStatus['Science']?.pre || !subjectsStatus['Science']?.post) && <option value="Science">{t('science')}</option>}
                          {(!subjectsStatus['Arabic']?.pre || !subjectsStatus['Arabic']?.post) && <option value="Arabic">{t('arabic')}</option>}
                          {(!subjectsStatus['English']?.pre || !subjectsStatus['English']?.post) && <option value="English">{t('english')}</option>}
                        </select>
                      </div>
                      <div>
                        <label className="input-label">{t('maxDegree')}</label>
                        <input type="number" name="max_degree" className="input-field" min="1" value={assessmentData.max_degree} onChange={handleAssessmentChange} required />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '24px' }}>
                    <div>
                      <label className="input-label">{t('preTest')}</label>
                      <input 
                        type="number" 
                        name="pre_test" 
                        className="input-field" 
                        step="0.1" 
                        max={assessmentData.max_degree} 
                        value={assessmentData.pre_test} 
                        onChange={handleAssessmentChange} 
                        disabled={subjectsStatus[assessmentData.subject]?.pre} 
                        placeholder={subjectsStatus[assessmentData.subject]?.pre ? 'Recorded' : ''}
                      />
                    </div>
                    <div>
                      <label className="input-label">{t('postTest')}</label>
                      <input 
                        type="number" 
                        name="post_test" 
                        className="input-field" 
                        step="0.1" 
                        max={assessmentData.max_degree} 
                        value={assessmentData.post_test} 
                        onChange={handleAssessmentChange} 
                        disabled={subjectsStatus[assessmentData.subject]?.post}
                        placeholder={subjectsStatus[assessmentData.subject]?.post ? 'Recorded' : ''}
                      />
                    </div>
                  </div>

                  <div className="p-4 mb-6" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 className="font-bold text-sm mb-3 text-secondary">{t('calculatedMetrics')}</h3>
                    {metrics.complete ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-secondary text-sm">{t('improvement')}</div>
                          <div className="font-bold text-lg text-primary" dir="ltr">{metrics.improvementPercent}%</div>
                        </div>
                        <div>
                          <div className="text-secondary text-sm">{t('difference')}</div>
                          <div className="font-bold text-lg text-primary" dir="ltr">+{metrics.diff} {t('pts')}</div>
                        </div>
                        <div>
                          <div className="text-secondary text-sm">{t('status')}</div>
                          <span className={`badge ${metrics.status === 'excellent' ? 'badge-success' : metrics.status === 'good' ? 'badge-warning' : 'badge-danger'}`} style={{ marginTop: '4px' }}>
                            {t(metrics.status)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-secondary text-sm" style={{ opacity: 0.8 }}>
                        {t('metricsPlaceholder')}
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }} disabled={loading}>
                    {loading ? '...' : t('submit')}
                  </button>
                </form>
              )}
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
