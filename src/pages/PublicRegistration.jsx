import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { getGovernorates, getDistricts, getSubdistricts } from '../lib/locations';

const translations = {
  en: {
    title: 'Student Registration',
    subtitle: 'Please fill out the form below to enroll.',
    firstName: 'First Name *',
    secondName: 'Second Name *',
    thirdName: 'Third Name *',
    fourthName: 'Fourth Name *',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    classGrade: 'Class / Grade *',
    gradePlaceholder: 'e.g. Grade 5',
    phone: 'Phone Number *',
    submit: 'Submit Registration',
    submitting: 'Submitting...',
    successTitle: 'Registration Successful!',
    successMsg: 'Your information has been saved successfully. Please save your Student Code:',
    registerAnother: 'Register Another Student',
    phoneExists: 'A student with this phone number is already registered.',
    errorDefault: 'An error occurred during registration.',
    governorate: 'Governorate *',
    district: 'District *',
    subdistrict: 'Subdistrict',
    village: 'Village / Neighborhood',
    selectGov: 'Select Governorate',
    selectDist: 'Select District',
    selectSub: 'Select Subdistrict'
  },
  ar: {
    title: 'تسجيل الطالب',
    subtitle: 'يرجى ملء النموذج أدناه للتسجيل.',
    firstName: '* الاسم الأول',
    secondName: '* اسم الأب',
    thirdName: '* اسم الجد',
    fourthName: '* اللقب / الاسم الرابع',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    classGrade: '* الصف / المرحلة الدراسية',
    gradePlaceholder: 'مثال: الصف الخامس',
    phone: '* رقم الهاتف',
    submit: 'تأكيد التسجيل',
    submitting: 'جاري التسجيل...',
    successTitle: 'تم التسجيل بنجاح!',
    successMsg: 'تم حفظ معلوماتك بنجاح. يرجى الاحتفاظ برمز الطالب الخاص بك:',
    registerAnother: 'تسجيل طالب آخر',
    phoneExists: 'يوجد طالب مسجل برقم الهاتف هذا مسبقاً.',
    errorDefault: 'حدث خطأ أثناء التسجيل.',
    governorate: '* المحافظة',
    district: '* القضاء',
    subdistrict: 'الناحية',
    village: 'القرية / الحي',
    selectGov: 'اختر المحافظة',
    selectDist: 'اختر القضاء',
    selectSub: 'اختر الناحية'
  }
};

export default function PublicRegistration() {
  const [lang, setLang] = useState('ar');
  const t = (key) => translations[lang][key] || key;

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const [formData, setFormData] = useState({
    first_name: '',
    second_name: '',
    third_name: '',
    fourth_name: '',
    phone_number: '',
    class_grade: '',
    gender: 'Male',
    governorate: '',
    district: '',
    subdistrict: '',
    village: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [generatedCode, setGeneratedCode] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'governorate') {
      setFormData({ ...formData, governorate: value, district: '', subdistrict: '' });
    } else if (name === 'district') {
      setFormData({ ...formData, district: value, subdistrict: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const generateStudentCode = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `NFE-${year}-${randomNum}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('phone_number', formData.phone_number)
        .single();

      if (existingStudent) {
        throw new Error(t('phoneExists'));
      }

      const studentCode = generateStudentCode();

      const { error: insertError } = await supabase
        .from('students')
        .insert([{ ...formData, student_code: studentCode }]);

      if (insertError) throw insertError;

      setGeneratedCode(studentCode);
      setSuccess(true);
      setFormData({
        first_name: '', second_name: '', third_name: '', fourth_name: '',
        phone_number: '', class_grade: '', gender: 'Male',
        governorate: '', district: '', subdistrict: '', village: ''
      });
    } catch (err) {
      setError(err.message || t('errorDefault'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: '100vh', padding: '20px' }}>
        <div className="glass-card text-center" style={{ maxWidth: '500px', width: '100%' }}>
          <CheckCircle size={64} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
          <h2 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>{t('successTitle')}</h2>
          <p className="text-secondary" style={{ marginBottom: '24px' }}>{t('successMsg')}</p>
          <div style={{ padding: '16px', background: 'var(--bg-primary)', border: '2px dashed var(--accent-primary)', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
            {generatedCode}
          </div>
          <button onClick={() => setSuccess(false)} className="btn btn-primary" style={{ marginTop: '24px', width: '100%' }}>
            {t('registerAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center" style={{ minHeight: '100vh', padding: '40px 20px', position: 'relative' }}>
      
      {/* Language Toggle */}
      <button 
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} 
        className="btn btn-secondary" 
        style={{ position: 'absolute', top: '20px', [lang === 'ar' ? 'left' : 'right']: '20px', zIndex: 10 }}
      >
        <Globe size={16} /> {lang === 'ar' ? 'English' : 'عربي'}
      </button>

      <div className="glass-card" style={{ maxWidth: '600px', width: '100%' }}>
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <img src="/logo.png" alt="Triangle Generation Humanitaire" style={{ height: '110px', objectFit: 'contain', margin: '0 auto 24px', mixBlendMode: 'lighten' }} />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-secondary" style={{ marginTop: '8px' }}>{t('subtitle')}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2" style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '24px', fontSize: '0.875rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
            <div>
              <label className="input-label">{t('firstName')}</label>
              <input type="text" name="first_name" className="input-field" value={formData.first_name} onChange={handleChange} required />
            </div>
            <div>
              <label className="input-label">{t('secondName')}</label>
              <input type="text" name="second_name" className="input-field" value={formData.second_name} onChange={handleChange} required />
            </div>
            <div>
              <label className="input-label">{t('thirdName')}</label>
              <input type="text" name="third_name" className="input-field" value={formData.third_name} onChange={handleChange} required />
            </div>
            <div>
              <label className="input-label">{t('fourthName')}</label>
              <input type="text" name="fourth_name" className="input-field" value={formData.fourth_name} onChange={handleChange} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
            <div>
              <label className="input-label">{t('gender')}</label>
              <select name="gender" className="input-field" value={formData.gender} onChange={handleChange}>
                <option value="Male">{t('male')}</option>
                <option value="Female">{t('female')}</option>
              </select>
            </div>
            <div>
              <label className="input-label">{t('classGrade')}</label>
              <input type="text" name="class_grade" className="input-field" value={formData.class_grade} onChange={handleChange} required placeholder={t('gradePlaceholder')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
            <div>
              <label className="input-label">{t('governorate')}</label>
              <select name="governorate" className="input-field" value={formData.governorate} onChange={handleChange} required>
                <option value="">{t('selectGov')}</option>
                {getGovernorates().map(gov => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">{t('district')}</label>
              <select name="district" className="input-field" value={formData.district} onChange={handleChange} required disabled={!formData.governorate}>
                <option value="">{t('selectDist')}</option>
                {getDistricts(formData.governorate).map(dist => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
            <div>
              <label className="input-label">{t('subdistrict')}</label>
              <select name="subdistrict" className="input-field" value={formData.subdistrict} onChange={handleChange} disabled={!formData.district}>
                <option value="">{t('selectSub')}</option>
                {getSubdistricts(formData.governorate, formData.district).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">{t('village')}</label>
              <input type="text" name="village" className="input-field" value={formData.village} onChange={handleChange} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label className="input-label">{t('phone')}</label>
            <input type="tel" name="phone_number" className="input-field" value={formData.phone_number} onChange={handleChange} required placeholder="e.g. +9647XXXXXXXXX" dir="ltr" />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }} disabled={loading}>
            {loading ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
