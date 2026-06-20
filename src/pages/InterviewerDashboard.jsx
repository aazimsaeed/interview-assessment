import React, { useState, useEffect } from 'react';

export default function InterviewerDashboard({ username, recruiterKey, companyName: initialCompanyName, onBack, onViewReport }) {
  // Navigation State
  const [activeTab, setActiveTab] = useState('interviews'); // 'interviews', 'ads', 'applications', 'sessions', 'profile'
  
  // Tab 1: Interview Management State
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [questions, setQuestions] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Tab 2: Job Ad State
  const [jobTitle, setJobTitle] = useState("");
  const [description, setDescription] = useState("");

  // Tab 3: Applications State
  const [applications, setApplications] = useState([]);

  // Tab 4: Active Sessions State
  const [interviews, setInterviews] = useState([]);

  // Tab 5: Profile State
  const [profile, setProfile] = useState({ email: '', company_name: initialCompanyName });
  const [saving, setSaving] = useState(false);
  
  const [loading, setLoading] = useState(true);

  const API_BASE = "http://localhost:8000";

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const fetchDashboardData = async () => {
    if (!recruiterKey) return;
    try {
      // Fetch Approved Candidates
      const candRes = await fetch(`${API_BASE}/api/candidates?recruiter_key=${recruiterKey}`);
      if (candRes.ok) setCandidates(await candRes.json());

      // Fetch Created Interviews
      const intRes = await fetch(`${API_BASE}/api/recruiters/${recruiterKey}/all-interviews`);
      if (intRes.ok) setInterviews(await intRes.json());

      // Fetch Pending Applications
      const appRes = await fetch(`${API_BASE}/api/recruiters/${recruiterKey}/applications`);
      if (appRes.ok) setApplications(await appRes.json());

      // Fetch Profile
      const profRes = await fetch(`${API_BASE}/api/recruiters/${username}/profile`);
      if (profRes.ok) {
          const profData = await profRes.json();
          setProfile({ email: profData.email || '', company_name: profData.company_name || initialCompanyName });
      }
      
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
      }
    } catch (err) { alert("Failed to post ad."); }
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
  // ==========================================
  // DELETE ACCOUNT LOGIC
  // ==========================================
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "WARNING: Are you sure you want to permanently delete your Recruiter account? This will instantly erase all your job ads, active sessions, and candidate links. This cannot be undone."
    );
    
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/api/recruiters/${username}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Your account has been permanently deleted.");
        onBack(); // Routes the user back to the landing page
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete account.");
      }
    } catch (err) {
      alert("Error deleting account.");
    }
  };

  // ==========================================
  // PROFILE LOGIC
  // ==========================================
  const handleUpdateProfile = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
          const res = await fetch(`${API_BASE}/api/recruiters/${username}/profile`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: profile.email, company_name: profile.company_name })
          });
          if(res.ok) alert("Company Profile updated successfully!");
          else alert("Failed to update profile.");
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
            <button onClick={() => setActiveTab('ads')} style={{ ...sidebarBtnStyle, background: activeTab === 'ads' ? '#1e293b' : 'transparent', borderLeft: activeTab === 'ads' ? '4px solid #8b5cf6' : '4px solid transparent' }}>
                📢 Post Job Ads
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
            {activeTab === 'ads' && "Advertisement Manager"}
            {activeTab === 'applications' && "Applicant Tracking"}
            {activeTab === 'sessions' && "Active Sessions & Reports"}
            {activeTab === 'profile' && "Company Profile"}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>
             {activeTab === 'interviews' && "Generate AI-driven interview scripts for approved candidates."}
             {activeTab === 'ads' && "Publish job openings directly to the global platform."}
             {activeTab === 'applications' && "Review and approve incoming candidate applications."}
             {activeTab === 'sessions' && "Monitor dispatched interviews and review completed performance reports."}
             {activeTab === 'profile' && "Update your organizational details and contact methods."}
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
                    <option key={c.username} value={c.username}>{c.username} - Applied for: {c.target_role}</option>
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

        {/* TAB: ADS */}
        {activeTab === 'ads' && (
          <div className="card" style={{ padding: '40px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}>
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
                                <button className="btn" onClick={() => handleDeleteSession(inv.id)} style={{ background: 'transparent', border: '1px solid #451a1e', color: '#fca5a5', padding: '12px 20px' }}>Hide</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* TAB: PROFILE */}
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
                         <input type="email" required className="input" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: '15px', color: '#f8fafc' }} />
                     </div>
                     <button type="submit" className="btn primary" disabled={saving} style={{ padding: '20px', background: '#8b5cf6', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>
                         {saving ? "Saving..." : "Save Company Changes"}
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