import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';

export default function SetupPage({ onStart, onBack, username, onViewReport }) {
  const [activeTab, setActiveTab] = useState('pending');

  const [profile, setProfile] = useState({ email: '', phone: '' });
  const [initialEmail, setInitialEmail] = useState("");
  const [updateOtp, setUpdateOtp] = useState("");
  const [showOtpField, setShowOtpField] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [linkedCompanies, setLinkedCompanies] = useState([]); 
  const [pendingInterviews, setPendingInterviews] = useState([]);
  const [completedInterviews, setCompletedInterviews] = useState([]);
  const [ads, setAds] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const API_BASE = "http://localhost:8000";
  const EMAILJS_SERVICE_ID = "service_rvp9rub"; 
  const EMAILJS_TEMPLATE_ID = "template_d0bdb6h";
  const EMAILJS_PUBLIC_KEY = "z_z2F1e4quN7sEzkd";

  const fetchDashboardData = async () => {
    if (!username) return;
    try {
      const profRes = await fetch(`${API_BASE}/api/candidates/${username}/profile`);
      if (profRes.ok) {
          const profData = await profRes.json();
          if (!isEditingProfile && !showOtpField && updateOtp === "") {
              setInitialEmail(profData.email || '');
              setProfile({ 
                  email: profData.email || '', 
                  phone: profData.phone || '' 
              });
          }
      }

      const linksRes = await fetch(`${API_BASE}/api/candidates/${username}/links`);
      const linksData = await linksRes.json();
      setLinkedCompanies(Array.isArray(linksData) ? linksData : []);

      const intRes = await fetch(`${API_BASE}/api/candidates/${username}/interviews?role=candidate`);
      const intData = await intRes.json();
      if (Array.isArray(intData)) {
          setPendingInterviews(intData.filter(i => !i.is_completed));
          setCompletedInterviews(intData.filter(i => i.is_completed));
      }

      const adsRes = await fetch(`${API_BASE}/api/advertisements`);
      if (adsRes.ok) setAds(await adsRes.json());

    } catch (err) { console.error("Dashboard Sync Error:", err); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 10000); 
    return () => clearInterval(intervalId);
  }, [username, isEditingProfile]);

  const handleJoin = async (idToJoin) => {
    try {
      const response = await fetch(`${API_BASE}/api/interviews/${idToJoin}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not find this interview.");
      onStart({ id: idToJoin, studentName: data.candidate_name, targetRole: data.target_role, questions: data.questions.join("\n") });
    } catch (err) { alert(err.message); } 
  };

  const handleApplyToJob = async (ad) => {
      try {
          const res = await fetch(`${API_BASE}/api/applications`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate_username: username, ad_id: ad.id, recruiter_key: ad.recruiter_key })
          });
          const data = await res.json();
          if (res.ok) alert(`Application sent to ${ad.company_name}! Check your pending tab later.`);
          else alert(data.message || "Failed to apply.");
      } catch (err) { alert("Error applying to job."); }
  };

  const emailChanged = profile.email !== initialEmail;

  const handleRequestProfileOtp = async () => {
      setSendingOtp(true);
      try {
          const response = await fetch(`${API_BASE}/api/profile/request-otp`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: profile.email, role: "candidate", username })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || "Failed to generate OTP.");

          if (data.otp_for_testing) {
              try {
                  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { to_email: profile.email, otp_code: data.otp_for_testing }, EMAILJS_PUBLIC_KEY);
                  alert("Verification code sent to your new email! Check your inbox.");
              } catch (emailErr) {
                  console.error("EmailJS Error:", emailErr);
                  alert(`⚠️ EmailJS failed. For testing, your OTP is: ${data.otp_for_testing}`);
              }
          }
          setShowOtpField(true);
      } catch (err) { alert(err.message); } 
      finally { setSendingOtp(false); }
  };

  const handleUpdateProfile = async (e) => {
      e.preventDefault();
      if (emailChanged && !updateOtp) return alert("You must request and enter an OTP to verify your new email address.");
      setSaving(true);
      try {
          const res = await fetch(`${API_BASE}/api/candidates/${username}/profile`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: profile.email, phone: profile.phone, otp: updateOtp })
          });
          const data = await res.json();
          if(res.ok) {
              alert("Profile updated successfully!");
              setInitialEmail(profile.email); setShowOtpField(false); setUpdateOtp("");
              setIsEditingProfile(false);
          } else { alert(data.detail || "Failed to update profile."); }
      } catch (err) { alert("Error saving profile."); }
      finally { setSaving(false); }
  };

  const handleDeleteAccount = async () => {
      if (!window.confirm("Are you sure you want to permanently delete your account? All of your applications, interviews, and reports will be lost.")) return;
      try {
          const res = await fetch(`${API_BASE}/api/candidates/${username}`, { method: 'DELETE' });
          if (res.ok) { alert("Account deleted successfully."); onBack(); } 
          else { alert("Failed to delete account."); }
      } catch (err) { alert("Error deleting account."); }
  };

  if (loading) return <div className="shell flex-center" style={{height: '100vh', color: '#38bdf8'}}><h2>Loading Workspace...</h2></div>;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      <div style={{ width: '280px', background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '30px 20px' }}>
        <h2 style={{ color: '#38bdf8', fontSize: '1.5rem', marginBottom: '40px', textAlign: 'center' }}>{username}'s Dashboard</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <button onClick={() => setActiveTab('pending')} style={{ ...sidebarBtnStyle, background: activeTab === 'pending' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'pending' ? '4px solid #38bdf8' : '4px solid transparent' }}>⏳ Pending Assessments {pendingInterviews.length > 0 && <span style={badgeStyle}>{pendingInterviews.length}</span>}</button>
            <button onClick={() => setActiveTab('history')} style={{ ...sidebarBtnStyle, background: activeTab === 'history' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'history' ? '4px solid #38bdf8' : '4px solid transparent' }}>✅ Interview History</button>
            <button onClick={() => setActiveTab('jobs')} style={{ ...sidebarBtnStyle, background: activeTab === 'jobs' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'jobs' ? '4px solid #38bdf8' : '4px solid transparent' }}>🌍 Explore Jobs</button>
            <button onClick={() => setActiveTab('profile')} style={{ ...sidebarBtnStyle, background: activeTab === 'profile' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'profile' ? '4px solid #38bdf8' : '4px solid transparent' }}>👤 My Profile</button>
        </div>
        <button onClick={onBack} style={{ ...sidebarBtnStyle, color: '#ef4444', marginTop: 'auto' }}>🚪 Logout</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '50px 60px' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', color: '#f8fafc' }}>
            {activeTab === 'pending' && "Pending Assessments"}
            {activeTab === 'history' && "Your Interview History"}
            {activeTab === 'jobs' && "Explore Opportunities"}
            {activeTab === 'profile' && "Profile Settings"}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>
             {activeTab === 'pending' && "Interviews that require your attention."}
             {activeTab === 'history' && "Review reports and feedback from past interviews."}
             {activeTab === 'jobs' && "Apply for new roles to generate more assessments."}
             {activeTab === 'profile' && "Manage your personal information securely."}
          </p>
        </div>

        {/* TAB: PENDING */}
        {activeTab === 'pending' && (
          <div>
             {pendingInterviews.length === 0 ? <div style={emptyStateStyle}>You're all caught up! Browse the Jobs tab to find new opportunities.</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    {pendingInterviews.map(inv => {
                        const company = linkedCompanies.find(c => c.recruiter_key === inv.recruiter_key)?.company_name || "Unknown Company";
                        return (
                            <div key={inv.id} style={cardStyle}>
                                <div>
                                    <span style={companyTagStyle}>{company}</span>
                                    <h3 style={{ margin: '10px 0', fontSize: '1.5rem', color: '#f8fafc' }}>{inv.target_role}</h3>
                                    <p style={{ margin: 0, color: '#64748b' }}>Assigned: {new Date(inv.created_at).toLocaleDateString()}</p>
                                </div>
                                <button className="btn primary" onClick={() => handleJoin(inv.id)} style={{ padding: '15px 30px', background: '#22c55e', border: 'none', fontSize: '1.1rem', borderRadius: '8px' }}>Start Interview ▶</button>
                            </div>
                        );
                    })}
                </div>
             )}
          </div>
        )}

        {/* TAB: HISTORY */}
        {activeTab === 'history' && (
          <div>
             {completedInterviews.length === 0 ? <div style={emptyStateStyle}>No completed interviews yet.</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    {completedInterviews.map(inv => {
                        const company = linkedCompanies.find(c => c.recruiter_key === inv.recruiter_key)?.company_name || "Unknown Company";
                        return (
                            <div key={inv.id} style={{ ...cardStyle, borderLeft: '4px solid #8b5cf6' }}>
                                <div>
                                    <span style={companyTagStyle}>{company}</span>
                                    <h3 style={{ margin: '10px 0', fontSize: '1.5rem', color: '#f8fafc' }}>{inv.target_role}</h3>
                                    <p style={{ margin: 0, color: '#64748b' }}>Completed Session</p>
                                </div>
                                <button className="btn primary" onClick={async () => {
                                    try {
                                        const res = await fetch(`${API_BASE}/api/reports/${inv.id}`);
                                        if(res.ok) onViewReport(await res.json());
                                    } catch (e) { alert("Failed to load report."); }
                                }} style={{ padding: '15px 30px', background: '#8b5cf6', border: 'none', fontSize: '1.1rem', borderRadius: '8px' }}>View Detailed Report 📄</button>
                            </div>
                        );
                    })}
                </div>
             )}
          </div>
        )}

        {/* TAB: JOBS */}
        {activeTab === 'jobs' && (
          <div>
            {ads.length === 0 ? <div style={emptyStateStyle}>No global opportunities currently available. Check back soon.</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px' }}>
                {ads.map((ad) => (
                    <div key={ad.id} style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: '30px', borderRadius: '20px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(56, 189, 248, 0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)'; }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{ad.company_name.charAt(0).toUpperCase()}</div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#e2e8f0' }}>{ad.company_name}</h2>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Posted {new Date(ad.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1.6rem', color: '#f8fafc', margin: '0 0 15px 0' }}>{ad.job_title}</h3>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>{ad.schedule || 'Full-time'}</span>
                        <span style={{ padding: '6px 12px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>{ad.location || 'Remote'}</span>
                    </div>

                    <div style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', flex: 1, marginBottom: '25px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>
                        {ad.description}
                    </div>
                    
                    <button onClick={() => handleApplyToJob(ad)} className="btn primary" style={{ width: '100%', padding: '15px', borderRadius: '10px', fontSize: '1.1rem', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', border: 'none' }}>1-Click Apply ➔</button>
                    </div>
                ))}
                </div>
            )}
          </div>
        )}

        {/* TAB: PROFILE WITH OTP VERIFICATION & EDIT MODE */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: '600px' }}>
             
             <div style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '30px' }}>
                 <p style={{ margin: '0 0 5px 0', color: '#94a3b8' }}>Username (Immutable)</p>
                 <h2 style={{ margin: 0, color: '#f8fafc' }}>{username}</h2>
             </div>
             
             <div style={{ background: '#0f172a', padding: '30px', borderRadius: '12px', border: '1px solid #334155' }}>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                     <h3 style={{ margin: 0, color: '#e2e8f0' }}>Contact Information</h3>
                     {!isEditingProfile && (
                         <button className="btn primary" onClick={() => setIsEditingProfile(true)} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
                             ✏️ Edit Profile
                         </button>
                     )}
                 </div>

                 {!isEditingProfile ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                         <div>
                             <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '13px' }}>Email Address</label>
                             <div style={{ color: '#f8fafc', fontSize: '1.1rem', padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                                 {profile.email || 'N/A'}
                             </div>
                         </div>
                         <div>
                             <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '13px' }}>Phone Number</label>
                             <div style={{ color: '#f8fafc', fontSize: '1.1rem', padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                                 {profile.phone || 'N/A'}
                             </div>
                         </div>
                     </div>
                 ) : (
                     <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s' }}>
                         <div>
                             <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Email Address</label>
                             <div style={{ display: 'flex', gap: '10px' }}>
                                 <input type="email" required className="input" value={profile.email || ''} onChange={e => {
                                     setProfile({...profile, email: e.target.value});
                                     setShowOtpField(false); setUpdateOtp("");
                                 }} style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', padding: '12px', color: '#f8fafc' }} disabled={showOtpField} />
                                 {emailChanged && !showOtpField && (
                                     <button type="button" onClick={handleRequestProfileOtp} disabled={sendingOtp} className="btn primary" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '0 20px', fontWeight: 'bold' }}>{sendingOtp ? "Sending..." : "Verify New Email"}</button>
                                 )}
                             </div>
                         </div>
                         
                         {showOtpField && (
                             <div style={{ animation: 'fadeIn 0.5s' }}>
                                 <label style={{ display: 'block', marginBottom: '8px', color: '#22c55e' }}>Enter 6-Digit OTP sent to your new email</label>
                                 <input type="text" required className="input" placeholder="000000" value={updateOtp} onChange={e => setUpdateOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} style={{ width: '100%', borderColor: '#22c55e', background: 'rgba(34, 197, 94, 0.05)', padding: '12px', color: '#f8fafc', letterSpacing: '2px' }} />
                             </div>
                         )}
                         
                         <div>
                             <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Phone Number</label>
                             <input type="tel" required className="input" value={profile.phone || ''} onChange={e => setProfile({...profile, phone: e.target.value})} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: '12px', color: '#f8fafc' }} />
                         </div>
                         
                         <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                             <button type="submit" className="btn primary" disabled={saving || (emailChanged && updateOtp.length !== 6)} style={{ flex: 1, padding: '15px', background: (emailChanged && updateOtp.length !== 6) ? '#334155' : '#38bdf8', color: (emailChanged && updateOtp.length !== 6) ? '#94a3b8' : '#0f172a', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>
                                 {saving ? "Saving..." : (emailChanged ? "Verify OTP & Save Changes" : "Save Changes")}
                             </button>
                             <button type="button" className="btn" onClick={() => { setIsEditingProfile(false); fetchDashboardData(); setShowOtpField(false); setUpdateOtp(""); }} style={{ padding: '0 25px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px' }}>
                                 Cancel
                             </button>
                         </div>
                     </form>
                 )}
             </div>

             <div style={{ marginTop: '30px', marginBottom: '40px' }}>
                 <h3 style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '13px', marginBottom: '15px' }}>Approved Company Links</h3>
                 {linkedCompanies.length === 0 ? <p style={{ color: '#64748b' }}>No connections yet.</p> : (
                     <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {linkedCompanies.map((comp, i) => <div key={i} style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '8px 16px', borderRadius: '20px', fontSize: '14px' }}>✅ {comp.company_name} - {comp.target_role || 'General'}</div>)}
                     </div>
                 )}
             </div>

             <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>Delete Account</h3>
                <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '14px' }}>Permanently delete your profile and all associated data.</p>
                <button onClick={handleDeleteAccount} className="btn" style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', padding: '12px 25px', borderRadius: '8px', width: '100%' }}>🗑️ Delete Account</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

const sidebarBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '15px 20px', textAlign: 'left', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '1rem', cursor: 'pointer', borderRadius: '0 8px 8px 0', transition: 'all 0.2s ease' };
const badgeStyle = { background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' };
const emptyStateStyle = { background: '#1e293b', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '1.2rem', border: '1px dashed #475569' };
const cardStyle = { background: '#1e293b', padding: '30px', borderRadius: '16px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const companyTagStyle = { padding: '4px 10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' };