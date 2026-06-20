import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';

export default function InterviewerDashboard({ username, recruiterKey, companyName: initialCompanyName, onBack, onViewReport }) {
  // Navigation State
  const [activeTab, setActiveTab] = useState('interviews'); // 'interviews', 'candidates', 'ads', 'applications', 'sessions', 'profile'
  
  // Tab 1: Interview Management State
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [questions, setQuestions] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Candidates Rankings State
  const [candidateStats, setCandidateStats] = useState({});

  // Tab 2: Job Ad State
  const [jobTitle, setJobTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ads, setAds] = useState([]); 

  // Tab 3: Applications State
  const [applications, setApplications] = useState([]);

  // Tab 4: Active Sessions State
  const [interviews, setInterviews] = useState([]);

  // Tab 5: Profile State & OTP Verification
  const [profile, setProfile] = useState({ email: '', company_name: initialCompanyName });
  const [initialEmail, setInitialEmail] = useState(""); // Track original email
  const [updateOtp, setUpdateOtp] = useState("");
  const [showOtpField, setShowOtpField] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [loading, setLoading] = useState(true);

  const API_BASE = "http://localhost:8000";

  // EMAILJS CONFIGURATION
  const EMAILJS_SERVICE_ID = "service_rvp9rub"; 
  const EMAILJS_TEMPLATE_ID = "template_d0bdb6h";
  const EMAILJS_PUBLIC_KEY = "z_z2F1e4quN7sEzkd";

  // ==========================================
  // DATA FETCHING & RANK COMPUTATION
  // ==========================================
  const fetchDashboardData = async () => {
    if (!recruiterKey) return;
    try {
      // 1. Fetch Approved Candidates
      const candRes = await fetch(`${API_BASE}/api/candidates?recruiter_key=${recruiterKey}`);
      let fetchedCandidates = [];
      if (candRes.ok) fetchedCandidates = await candRes.json();

      // 2. Fetch Created Interviews
      const intRes = await fetch(`${API_BASE}/api/recruiters/${recruiterKey}/all-interviews`);
      let fetchedInterviews = [];
      if (intRes.ok) fetchedInterviews = await intRes.json();
      setInterviews(fetchedInterviews);

      // 3. Fetch My Job Advertisements
      const adsRes = await fetch(`${API_BASE}/api/advertisements`);
      if (adsRes.ok) {
        const allAds = await adsRes.json();
        setAds(allAds.filter(a => a.recruiter_key === recruiterKey));
      }

      // 4. Fetch Pending Applications
      const appRes = await fetch(`${API_BASE}/api/recruiters/${recruiterKey}/applications`);
      if (appRes.ok) setApplications(await appRes.json());

      // 5. Fetch Profile
      const profRes = await fetch(`${API_BASE}/api/recruiters/${username}/profile`);
      if (profRes.ok) {
          const profData = await profRes.json();
          // Only update initial email if we aren't currently in the middle of editing it
          if (!showOtpField && updateOtp === "") {
             setInitialEmail(profData.email || '');
             setProfile({ email: profData.email || '', company_name: profData.company_name || initialCompanyName });
          }
      }

      // 6. Fetch Reports & Calculate Candidate Rankings
      const reportPromises = fetchedInterviews
          .filter(inv => inv.is_completed)
          .map(inv => fetch(`${API_BASE}/api/reports/${inv.id}`).then(res => res.ok ? res.json() : null));
      
      const reports = await Promise.all(reportPromises);
      const stats = {};
      fetchedCandidates.forEach(c => {
          stats[c.username] = { count: 0, totalScore: 0, completedCount: 0, rankScore: 0 };
      });

      fetchedInterviews.forEach(inv => {
          if (stats[inv.candidate_name]) {
              stats[inv.candidate_name].count += 1;
              const report = reports.find(r => r && r.interview_id === inv.id);
              if (report && report.metrics) {
                  const verbalScore = report.metrics.confidenceScore || 0;
                  const nonVerbalScore = report.metrics.eyeContactPercentage || 0;
                  const overall = (verbalScore + nonVerbalScore) / 2;
                  
                  stats[inv.candidate_name].totalScore += overall;
                  stats[inv.candidate_name].completedCount += 1;
              }
          }
      });

      Object.keys(stats).forEach(uname => {
          if (stats[uname].completedCount > 0) {
              stats[uname].rankScore = stats[uname].totalScore / stats[uname].completedCount;
          }
      });

      setCandidateStats(stats);

      // Sort candidates by ranking
      fetchedCandidates.sort((a, b) => (stats[b.username]?.rankScore || 0) - (stats[a.username]?.rankScore || 0));
      setCandidates(fetchedCandidates);
      
    } catch (err) { 
      console.error("Failed to sync dashboard", err); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [recruiterKey, username]);

  // ==========================================
  // CANDIDATE RANKING LOGIC
  // ==========================================
  const handleUnlinkCandidate = async (candidateUsername) => {
    if (!window.confirm(`Are you sure you want to unlink ${candidateUsername}? They will be removed from your talent pool.`)) return;
    setCandidates(prev => prev.filter(c => c.username !== candidateUsername));
    try {
        await fetch(`${API_BASE}/api/candidates/${candidateUsername}/unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recruiter_key: recruiterKey })
        });
        fetchDashboardData();
    } catch (e) { console.error("Failed to unlink candidate", e); }
  };

  const getRankBadge = (score, completedCount) => {
      if (completedCount === 0) return { label: 'Pending Tests', color: '#64748b' };
      if (score >= 80) return { label: '🌟 Top Tier', color: '#22c55e' };
      if (score >= 60) return { label: '👍 Strong', color: '#38bdf8' };
      if (score >= 40) return { label: '⚠️ Average', color: '#eab308' };
      return { label: '❌ Needs Review', color: '#f43f5e' };
  };

  // ==========================================
  // INTERVIEW CREATION LOGIC
  // ==========================================
  const handleCandidateSelect = (e) => {
    const selectedUsername = e.target.value;
    setSelectedCandidate(selectedUsername);
    const candidateObj = candidates.find(c => c.username === selectedUsername);
    if (candidateObj && candidateObj.target_role) {
      setTargetRole(candidateObj.target_role);
    } else {
      setTargetRole("");
    }
  };

  const handleGenerateQuestions = async () => {
    if (!targetRole) return alert("Please select a candidate to lock in their Target Role.");
    setLoadingAI(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-questions?role=${encodeURIComponent(targetRole)}`);
      const data = await res.json();
      if (res.ok) setQuestions(data.questions);
      else throw new Error(data.detail);
    } catch (err) { alert("Failed to generate questions: " + err.message); }
    finally { setLoadingAI(false); }
  };

  const handlePolishQuestions = async () => {
    if (!questions) return alert("No questions to polish.");
    setLoadingAI(true);
    try {
      const res = await fetch(`${API_BASE}/api/polish-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: questions })
      });
      const data = await res.json();
      if (res.ok) setQuestions(data.questions);
      else throw new Error(data.detail);
    } catch (err) { alert("Failed to polish questions: " + err.message); }
    finally { setLoadingAI(false); }
  };

  const handleSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech Recognition is not supported in this browser. Please use Chrome.");
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestions(prev => {
        const currentQs = prev.trim();
        const nextNumber = currentQs ? currentQs.split('\n').length + 1 : 1;
        return currentQs ? `${currentQs}\n${nextNumber}. ${transcript}` : `1. ${transcript}`;
      });
    };
    recognition.onerror = () => { alert("Microphone error."); };
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!selectedCandidate || !targetRole || !questions.trim()) {
      return alert("Please select a candidate, enter a role, and provide questions.");
    }

    const questionsArray = questions.split('\n').filter(q => q.trim() !== "");
    try {
      const res = await fetch(`${API_BASE}/api/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_name: selectedCandidate, target_role: targetRole, questions: questionsArray, recruiter_key: recruiterKey })
      });
      if (res.ok) {
        alert("Interview Session Successfully Created!");
        setSelectedCandidate(""); setTargetRole(""); setQuestions("");
        setActiveTab('sessions');
        fetchDashboardData(); 
      } else { throw new Error((await res.json()).detail); }
    } catch (err) { alert("Failed to create session: " + err.message); }
  };

  // ==========================================
  // ADS, APPROVALS & SESSIONS LOGIC
  // ==========================================
  const handleCreateAd = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/advertisements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruiter_key: recruiterKey, company_name: profile.company_name, job_title: jobTitle, description })
      });
      if (res.ok) {
        alert("Advertisement posted to the global landing page!");
        setJobTitle(""); setDescription("");
        fetchDashboardData();
      }
    } catch (err) { alert("Failed to post ad."); }
  };

  const handleDeleteAd = async (adId) => {
    if (!window.confirm("Are you sure you want to permanently delete this job advertisement?")) return;
    setAds(prev => prev.filter(a => a.id !== adId));
    try {
        await fetch(`${API_BASE}/api/advertisements/${adId}`, { method: 'DELETE' });
    } catch (e) { console.error("Failed to delete ad", e); }
  };

  const handleApproveApplicant = async (appId, candName) => {
    try {
      const res = await fetch(`${API_BASE}/api/applications/${appId}/approve`, { method: 'POST' });
      if (res.ok) {
        alert(`${candName} has been approved and linked to your portal!`);
        fetchDashboardData();
      }
    } catch (err) { alert("Failed to approve candidate."); }
  };

  const handleFetchReport = async (interviewId) => {
    try {
        const res = await fetch(`${API_BASE}/api/reports/${interviewId}`);
        if (res.ok && onViewReport) onViewReport(await res.json());
        else alert("Candidate has not completed this interview yet.");
    } catch (err) { console.error(err); }
  };

  const handleDeleteSession = async (idToDelete) => {
    if (!window.confirm("Hide this session from your dashboard?")) return;
    try {
      await fetch(`${API_BASE}/api/interviews/${idToDelete}?role=recruiter`, { method: 'DELETE' });
      fetchDashboardData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "WARNING: Are you sure you want to permanently delete your Recruiter account? This will instantly erase all your job ads, active sessions, and candidate links. This cannot be undone."
    );
    if (!confirmDelete) return;
    try {
      const res = await fetch(`${API_BASE}/api/recruiters/${username}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Your account has been permanently deleted.");
        onBack(); 
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete account.");
      }
    } catch (err) {
      alert("Error deleting account.");
    }
  };

  // ==========================================
  // PROFILE LOGIC & OTP VERIFICATION
  // ==========================================
  const emailChanged = profile.email !== initialEmail;

  const handleRequestProfileOtp = async () => {
      setSendingOtp(true);
      try {
          const response = await fetch(`${API_BASE}/api/profile/request-otp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: profile.email, role: "recruiter", username })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || "Failed to generate OTP.");

          if (data.otp_for_testing) {
              try {
                  await emailjs.send(
                      EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
                      { to_email: profile.email, otp_code: data.otp_for_testing },
                      EMAILJS_PUBLIC_KEY
                  );
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
      
      if (emailChanged && !updateOtp) {
          return alert("You must request and enter an OTP to verify your new email address.");
      }

      setSaving(true);
      try {
          const res = await fetch(`${API_BASE}/api/recruiters/${username}/profile`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  email: profile.email, 
                  company_name: profile.company_name,
                  otp: updateOtp
              })
          });
          const data = await res.json();
          if(res.ok) {
              alert("Company Profile updated successfully!");
              setInitialEmail(profile.email); // Reset baseline
              setShowOtpField(false);
              setUpdateOtp("");
          } else {
              alert(data.detail || "Failed to update profile.");
          }
      } catch (err) { alert("Error saving profile."); }
      finally { setSaving(false); }
  };

  if (loading) return <div className="shell flex-center" style={{height: '100vh', color: '#8b5cf6'}}><h2>Loading Recruiter Portal...</h2></div>;

  // ==========================================
  // RENDER UI
  // ==========================================
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <div style={{ width: '280px', background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '30px 20px' }}>
        <h2 style={{ color: '#8b5cf6', fontSize: '1.5rem', marginBottom: '10px', textAlign: 'center' }}>{username}'s Portal</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginBottom: '40px' }}>{profile.company_name}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <button onClick={() => setActiveTab('interviews')} style={{ ...sidebarBtnStyle, background: activeTab === 'interviews' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'interviews' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                🎤 Assessment Creator
            </button>
            <button onClick={() => setActiveTab('candidates')} style={{ ...sidebarBtnStyle, background: activeTab === 'candidates' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'candidates' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                🏆 Candidate Rankings
            </button>
            <button onClick={() => setActiveTab('ads')} style={{ ...sidebarBtnStyle, background: activeTab === 'ads' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'ads' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                📢 Job Advertisements
            </button>
            <button onClick={() => setActiveTab('applications')} style={{ ...sidebarBtnStyle, background: activeTab === 'applications' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'applications' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                👥 Pending Approvals
                {applications.length > 0 && <span style={badgeStyle}>{applications.length}</span>}
            </button>
            <button onClick={() => setActiveTab('sessions')} style={{ ...sidebarBtnStyle, background: activeTab === 'sessions' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'sessions' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                📊 Active Sessions
            </button>
            <button onClick={() => setActiveTab('profile')} style={{ ...sidebarBtnStyle, background: activeTab === 'profile' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'profile' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                🏢 Company Profile
            </button>
        </div>

        <button onClick={onBack} style={{ ...sidebarBtnStyle, color: '#ef4444', marginTop: 'auto' }}>🚪 Logout</button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '50px 60px' }}>
        
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', color: '#f8fafc' }}>
            {activeTab === 'interviews' && "Assessment Creator"}
            {activeTab === 'candidates' && "Candidate Rankings & Pool"}
            {activeTab === 'ads' && "Advertisement Manager"}
            {activeTab === 'applications' && "Applicant Tracking"}
            {activeTab === 'sessions' && "Active Sessions & Reports"}
            {activeTab === 'profile' && "Company Profile"}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>
             {activeTab === 'interviews' && "Generate AI-driven interview scripts for approved candidates."}
             {activeTab === 'candidates' && "Evaluate your talent pool ranked by AI verbal and non-verbal analysis."}
             {activeTab === 'ads' && "Publish job openings and manage your existing postings."}
             {activeTab === 'applications' && "Review and approve incoming candidate applications."}
             {activeTab === 'sessions' && "Monitor dispatched interviews and review completed performance reports."}
             {activeTab === 'profile' && "Update your organizational details securely."}
          </p>
        </div>

        {/* TAB: INTERVIEWS */}
        {activeTab === 'interviews' && (
          <div className="card" style={{ padding: '40px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>1. Select Approved Candidate</label>
                <select className="input" value={selectedCandidate} onChange={handleCandidateSelect} required style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: '15px' }}>
                  <option value="">-- Choose from approved candidates --</option>
                  {candidates.map(c => (
                    <option key={c.username} value={c.username}>{c.username} - Applied for: {c.target_role || 'General'}</option>
                  ))}
                </select>
                {candidates.length === 0 && <p style={{ margin: '8px 0 0 0', color: '#fbbf24', fontSize: '13px' }}>No candidates linked yet. Approve applications first!</p>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>2. Target Role (Auto-filled from Application)</label>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <input type="text" className="input" value={targetRole} readOnly placeholder="Select a candidate above to load their role" style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', opacity: 0.7, cursor: 'not-allowed', padding: '15px' }} />
                  <button type="button" className="btn primary" onClick={handleGenerateQuestions} disabled={loadingAI || !targetRole} style={{ background: '#8b5cf6', borderColor: '#7c3aed', padding: '0 25px' }}>
                    {loadingAI ? "⏳ Generating..." : "✨ AI Auto-Generate"}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>3. Interview Script (One question per line)</label>
                <textarea className="input" value={questions} onChange={e => setQuestions(e.target.value)} required placeholder="1. Tell me about yourself...&#10;2. Explain React hooks..." style={{ minHeight: '200px', resize: 'vertical', background: '#1e293b', border: '1px solid #334155', padding: '15px' }} />
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px', gap: '15px' }}>
                  <button type="button" className={`btn ${isRecording ? 'primary' : ''}`} onClick={handleSpeechToText} style={{ background: isRecording ? '#ef4444' : 'transparent', border: `1px solid ${isRecording ? '#dc2626' : '#334155'}`, color: '#e2e8f0', padding: '10px 20px' }}>
                    {isRecording ? "🔴 Listening..." : "🎙️ Speak Question"}
                  </button>
                  <button type="button" className="btn" onClick={handlePolishQuestions} disabled={loadingAI || !questions} style={{ background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', padding: '10px 20px' }}>
                    {loadingAI ? "Polishing..." : "📝 Polish Grammar"}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn primary" style={{ padding: '20px', fontSize: '1.1rem', marginTop: '10px', background: '#22c55e', border: 'none', borderRadius: '8px' }}>
                🚀 Dispatch Interview to Candidate
              </button>
            </form>
          </div>
        )}

        {/* TAB: CANDIDATE RANKINGS */}
        {activeTab === 'candidates' && (
          <div>
            {candidates.length === 0 ? (
                <div style={emptyStateStyle}>No candidates linked to your account yet. Head to Pending Approvals.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {candidates.map((c, index) => {
                        const stats = candidateStats[c.username] || { count: 0, rankScore: 0, completedCount: 0 };
                        const badge = getRankBadge(stats.rankScore, stats.completedCount);
                        
                        return (
                            <div key={c.username} style={{...cardStyle, borderLeft: `4px solid ${badge.color}`, padding: '20px 30px'}}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>#{index + 1} {c.username}</h3>
                                        <span style={{ background: `${badge.color}20`, color: badge.color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                            {badge.label}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '14px' }}>
                                        Target Role: <strong style={{ color: '#e2e8f0' }}>{c.target_role || 'General'}</strong> | 
                                        Interviews Hosted: <strong style={{ color: '#e2e8f0' }}>{stats.count}</strong> | 
                                        Overall AI Score: <strong style={{ color: badge.color }}>{stats.rankScore > 0 ? `${stats.rankScore.toFixed(1)}%` : 'N/A'}</strong>
                                    </div>
                                </div>
                                <button onClick={() => handleUnlinkCandidate(c.username)} className="btn" style={{ background: '#451a1e', borderColor: '#7f1d1d', color: '#fca5a5' }}>
                                    ✂️ Unlink Candidate
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
          </div>
        )}

        {/* TAB: ADS */}
        {activeTab === 'ads' && (
          <div>
            <div className="card" style={{ padding: '40px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', marginBottom: '40px' }}>
              <h3 style={{ marginTop: 0, color: '#f8fafc', marginBottom: '20px' }}>Create New Advertisement</h3>
              <form onSubmit={handleCreateAd} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>Job Title</label>
                  <input type="text" required className="input" placeholder="e.g., Senior React Developer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: '15px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontWeight: 'bold' }}>Job Description</label>
                  <textarea required className="input" placeholder="Describe the role, responsibilities, and requirements..." value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: '150px', resize: 'vertical', width: '100%', background: '#1e293b', border: '1px solid #334155', padding: '15px' }} />
                </div>
                <button type="submit" className="btn primary" style={{ padding: '20px', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>
                  📢 Publish to Global Job Board
                </button>
              </form>
            </div>

            <h3 style={{ color: '#f8fafc', marginBottom: '20px' }}>Your Active Advertisements</h3>
            {ads.length === 0 ? (
                <p style={{ color: '#64748b' }}>You currently have no active job postings.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {ads.map((ad) => (
                        <div key={ad.id} style={{ ...cardStyle, padding: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 5px 0', color: '#38bdf8' }}>{ad.job_title}</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Posted: {new Date(ad.created_at).toLocaleDateString()}</p>
                                <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', maxWidth: '80%' }}>{ad.description}</p>
                            </div>
                            <button onClick={() => handleDeleteAd(ad.id)} className="btn" style={{ background: '#451a1e', borderColor: '#7f1d1d', color: '#fca5a5' }}>
                                🗑️ Delete Ad
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* TAB: APPLICATIONS */}
        {activeTab === 'applications' && (
          <div>
            {applications.length === 0 ? (
              <div style={emptyStateStyle}>No pending applications right now.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {applications.map(app => (
                  <div key={app.id} style={cardStyle}>
                    <div>
                      <span style={{...companyTagStyle, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6'}}>New Application</span>
                      <h3 style={{ margin: '10px 0', fontSize: '1.5rem', color: '#f8fafc' }}>{app.candidate_username}</h3>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
                        Applied for: <strong style={{ color: '#38bdf8' }}>{app.job_title}</strong> | {app.candidate_email}
                      </p>
                    </div>
                    <button onClick={() => handleApproveApplicant(app.id, app.candidate_username)} className="btn primary" style={{ background: '#22c55e', border: 'none', padding: '15px 30px', fontSize: '1.1rem', borderRadius: '8px' }}>
                      ✅ Approve & Link
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SESSIONS */}
        {activeTab === 'sessions' && (
          <div>
            {interviews.length === 0 ? (
                <div style={emptyStateStyle}>No interviews generated yet. Head to Assessment Creator to begin.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {interviews.map(inv => (
                        <div key={inv.id} style={cardStyle}>
                            <div>
                                <h3 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '1.5rem' }}>{inv.candidate_name}</h3>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Role: {inv.target_role} | Session ID: {inv.id}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {inv.is_completed ? (
                                    <button className="btn primary" onClick={() => handleFetchReport(inv.id)} style={{ background: '#8b5cf6', border: 'none', padding: '12px 25px' }}>📄 View AI Report</button>
                                ) : (
                                    <span style={{ padding: '12px 25px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', borderRadius: '8px', fontSize: '14px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>⏳ Awaiting Candidate</span>
                                )}
                                <button className="btn" onClick={() => handleDeleteSession(inv.id)} style={{ background: '#451a1e', border: '1px solid #7f1d1d', color: '#fca5a5', padding: '12px 20px' }}>Hide / Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* TAB: PROFILE WITH OTP VERIFICATION */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: '600px' }}>
             
             {/* Read-Only Status */}
             <div style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '30px' }}>
                 <p style={{ margin: '0 0 5px 0', color: '#94a3b8' }}>Admin Username</p>
                 <h2 style={{ margin: 0, color: '#f8fafc' }}>{username}</h2>
                 <p style={{ margin: '15px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>Organization Key: {recruiterKey}</p>
             </div>

             {/* Editable Form */}
             <div style={{ background: '#0f172a', padding: '30px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '30px' }}>
                 <h3 style={{ margin: '0 0 20px 0', color: '#e2e8f0' }}>Organization Profile</h3>
                 <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     <div>
                         <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Company Name</label>
                         <input type="text" required className="input" value={profile.company_name} onChange={e => setProfile({...profile, company_name: e.target.value})} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: '15px', color: '#f8fafc' }} />
                     </div>
                     <div>
                         <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Work Email Address</label>
                         <div style={{ display: 'flex', gap: '10px' }}>
                             <input type="email" required className="input" value={profile.email} onChange={e => {
                                 setProfile({...profile, email: e.target.value});
                                 setShowOtpField(false);
                                 setUpdateOtp("");
                             }} style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', padding: '15px', color: '#f8fafc' }} disabled={showOtpField} />
                             
                             {/* OTP Trigger Button */}
                             {emailChanged && !showOtpField && (
                                 <button type="button" onClick={handleRequestProfileOtp} disabled={sendingOtp} className="btn primary" style={{ background: '#8b5cf6', borderColor: '#7c3aed', padding: '0 20px' }}>
                                     {sendingOtp ? "Sending..." : "Verify New Email"}
                                 </button>
                             )}
                         </div>
                     </div>

                     {/* OTP Input Field */}
                     {showOtpField && (
                         <div style={{ animation: 'fadeIn 0.5s' }}>
                             <label style={{ display: 'block', marginBottom: '8px', color: '#22c55e' }}>Enter 6-Digit OTP sent to your new email</label>
                             <input type="text" required className="input" placeholder="000000" value={updateOtp} onChange={e => setUpdateOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} style={{ width: '100%', borderColor: '#22c55e', background: 'rgba(34, 197, 94, 0.05)', padding: '15px', color: '#f8fafc', letterSpacing: '2px' }} />
                         </div>
                     )}

                     <button type="submit" className="btn primary" disabled={saving || (emailChanged && updateOtp.length !== 6)} style={{ padding: '20px', background: (emailChanged && updateOtp.length !== 6) ? '#334155' : '#8b5cf6', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>
                         {saving ? "Saving..." : (emailChanged ? "Verify OTP & Save Changes" : "Save Company Changes")}
                     </button>
                 </form>
             </div>

             {/* DANGER ZONE */}
             <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '30px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>Delete Account</h3>
                <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '14px' }}>Permanently delete your organization, all job advertisements, and candidate links.</p>
                <button onClick={handleDeleteAccount} className="btn" style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', padding: '12px 25px', borderRadius: '8px', width: '100%' }}>
                  🗑️ Delete Organization Account
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Inline Styles
const sidebarBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '18px 20px', textAlign: 'left', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '1rem', cursor: 'pointer', borderRadius: '0 8px 8px 0', transition: 'all 0.2s ease' };
const badgeStyle = { background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' };
const emptyStateStyle = { background: '#1e293b', padding: '50px', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '1.2rem', border: '1px dashed #475569' };
const cardStyle = { background: '#0f172a', padding: '30px', borderRadius: '16px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' };
const companyTagStyle = { padding: '6px 12px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' };