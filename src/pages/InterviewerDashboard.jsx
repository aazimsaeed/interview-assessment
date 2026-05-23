import React, { useState, useEffect, useRef } from 'react';
import { createSpeechTracker } from '../audio/speechAnalysis';

export default function InterviewerDashboard({ onBack, username, onViewReport }) {
  const [recruiterKey, setRecruiterKey] = useState(() => localStorage.getItem(`key_${username}`) || "LOADING...");
  const [candidatesList, setCandidatesList] = useState(() => JSON.parse(localStorage.getItem(`cands_${username}`)) || []);
  
  const [candidateName, setCandidateName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [customQuestions, setCustomQuestions] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [generatedId, setGeneratedId] = useState(null);
  const [error, setError] = useState("");
  
  const [candidateInterviews, setCandidateInterviews] = useState([]);
  const [reportCandidate, setReportCandidate] = useState(null);

  // NEW: State for global all-reports view
  const [showAllReports, setShowAllReports] = useState(false);
  const [allInterviews, setAllInterviews] = useState([]);

  const [showCandidatesDropdown, setShowCandidatesDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const speechTrackerRef = useRef(null);

  const API_BASE = "http://localhost:8000";

  useEffect(() => {
    const initData = async () => {
        try {
            const keyRes = await fetch(`${API_BASE}/api/recruiters/${username}`);
            if (keyRes.ok) {
                const keyData = await keyRes.json();
                const newKey = keyData.recruiter_key;
                setRecruiterKey(newKey);
                localStorage.setItem(`key_${username}`, newKey);
                
                const candRes = await fetch(`${API_BASE}/api/candidates?recruiter_key=${newKey}`);
                if (candRes.ok) {
                    const candData = await candRes.json();
                    setCandidatesList(candData);
                    localStorage.setItem(`cands_${username}`, JSON.stringify(candData));
                }
            }
        } catch (err) {
            console.error("Failed to sync dashboard data:", err);
        }
    };

    if (username) initData();

    return () => {
        if (speechTrackerRef.current) speechTrackerRef.current.turnOff();
    };
  }, [username]);

  const refreshCandidates = async () => {
      if (recruiterKey === "LOADING...") return;
      try {
          const candRes = await fetch(`${API_BASE}/api/candidates?recruiter_key=${recruiterKey}`);
          if (candRes.ok) {
              const candData = await candRes.json();
              setCandidatesList(candData);
              localStorage.setItem(`cands_${username}`, JSON.stringify(candData));
          }
      } catch (err) { console.error("Refresh failed", err); }
  };

  const toggleDropdown = () => {
      if (!showCandidatesDropdown) refreshCandidates();
      setShowCandidatesDropdown(!showCandidatesDropdown);
  };

  const handleDeleteAccount = async () => {
      if (!window.confirm("Are you sure you want to permanently delete your recruiter account? This action cannot be undone.")) return;
      try {
          const res = await fetch(`${API_BASE}/api/recruiters/${username}`, { method: 'DELETE' });
          if (res.ok) {
              localStorage.removeItem(`key_${username}`);
              localStorage.removeItem(`cands_${username}`);
              onBack(); 
          } else { alert("Failed to delete account."); }
      } catch (err) { alert("Error deleting account."); }
  };

  const handleGenerate = async () => {
    if (!targetRole) return alert("Please enter a target role first.");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-questions?role=${encodeURIComponent(targetRole)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setCustomQuestions(data.questions);
    } catch (err) { alert("Failed to generate questions: " + err.message); } 
    finally { setLoading(false); }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
        if (speechTrackerRef.current) speechTrackerRef.current.turnOff();
        setCustomQuestions(prev => (prev + (prev ? '\n' : '') + liveTranscript).trim());
        setLiveTranscript("");
        setIsRecording(false);
    } else {
        speechTrackerRef.current = createSpeechTracker((metrics) => setLiveTranscript(metrics.fullTranscript));
        if (speechTrackerRef.current) speechTrackerRef.current.start();
        setIsRecording(true);
    }
  };

  const handlePolishGrammar = async () => {
      const textToPolish = customQuestions + (liveTranscript ? '\n' + liveTranscript : '');
      if (!textToPolish.trim()) return alert("Please write or dictate questions first.");
      setLoading(true);
      setError("");
      try {
          const res = await fetch(`${API_BASE}/api/polish-questions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ raw_text: textToPolish })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail);
          setCustomQuestions(data.questions);
          if (isRecording) handleToggleRecording(); 
      } catch (err) { setError("Failed to polish questions: " + err.message); } 
      finally { setLoading(false); }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (isRecording) return setError("Please stop recording before creating the session.");
    setLoading(true);
    setError("");

    const questionList = customQuestions.split('\n').map(q => q.trim()).filter(q => q.length > 0);
    try {
      const response = await fetch(`${API_BASE}/api/interviews`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
             candidate_name: candidateName, 
             target_role: targetRole, 
             questions: questionList,
             recruiter_key: recruiterKey 
         })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setGeneratedId(data.interview_id);
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const handleViewReportsList = async (candidateUsername) => {
      setShowAllReports(false);
      setReportCandidate(candidateUsername);
      try {
          const res = await fetch(`${API_BASE}/api/candidates/${candidateUsername}/interviews?role=recruiter`);
          if (res.ok) {
              const data = await res.json();
              setCandidateInterviews(data);
          }
      } catch (err) { console.error("Failed to load interviews", err); }
  };

  // NEW: Fetch all reports for this recruiter globally
  const handleFetchAllReports = async () => {
      setReportCandidate(null);
      setShowAllReports(true);
      try {
          const res = await fetch(`${API_BASE}/api/recruiters/${recruiterKey}/all-interviews`);
          if (res.ok) {
              const data = await res.json();
              setAllInterviews(data);
          }
      } catch (err) { console.error("Failed to load all reports", err); }
  };

  const handleFetchFullReport = async (interviewId) => {
      try {
          const res = await fetch(`${API_BASE}/api/reports/${interviewId}`);
          if (res.ok) {
              const data = await res.json();
              if(onViewReport) onViewReport(data);
          }
      } catch (err) { console.error("Failed to load report details", err); }
  };

  const handleDeleteReport = async (interviewId) => {
      if (!window.confirm("Remove this session?")) return;
      try {
          const res = await fetch(`${API_BASE}/api/interviews/${interviewId}?role=recruiter`, { method: 'DELETE' });
          if (res.ok) {
              setCandidateInterviews(prev => prev.filter(inv => inv.id !== interviewId));
              setAllInterviews(prev => prev.filter(inv => inv.id !== interviewId));
          }
      } catch (err) { console.error("Failed to delete report", err); }
  };

  if (generatedId) {
      return (
          <div className="shell flex-center" style={{ height: '100vh' }}>
              <div className="card" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                  <h2 style={{ color: '#22c55e', marginBottom: '20px' }}>✅ Session Created!</h2>
                  <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', fontSize: '2rem', fontWeight: 'bold', margin: '20px 0', color: '#38bdf8' }}>{generatedId}</div>
                  <button type="button" className="btn primary" onClick={() => { setGeneratedId(null); setCandidateName(""); }} style={{ width: '100%' }}>Create Another</button>
              </div>
          </div>
      );
  }

  return (
    <div className="shell" style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1>Recruiter Dashboard</h1>
            
            <div style={{ position: 'relative' }}>
                <button className="btn" onClick={() => setShowMenu(!showMenu)} style={{ padding: '10px 15px', fontSize: '1.2rem' }}>⋮</button>
                {showMenu && (
                    <div style={{ position: 'absolute', right: 0, top: '45px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '160px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                        <button className="btn" onClick={onBack} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: '#f8fafc' }}>🚪 Logout</button>
                        <button className="btn" onClick={handleDeleteAccount} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: '#ef4444' }}>🗑️ Delete Account</button>
                    </div>
                )}
            </div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #38bdf8', padding: '15px 25px', borderRadius: '8px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
               <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Logged in as: <strong>{username}</strong></p>
               <p style={{ margin: '5px 0 0 0', color: '#f8fafc' }}>Share your personal Key with candidates so they can access your portal.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <span style={{ fontSize: '12px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Recruiter Key</span>
               <h2 style={{ margin: '0', color: '#22c55e', letterSpacing: '3px' }}>{recruiterKey}</h2>
            </div>
        </div>

        <div className="card" style={{ padding: '40px', width: '100%' }}>
            {showAllReports ? (
                // VIEW 1: GLOBAL REPORTS
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>All Generated Reports</h2>
                        <button className="btn" onClick={() => setShowAllReports(false)}>← Back to Dashboard</button>
                    </div>
                    {allInterviews.length === 0 && <p style={{ color: '#94a3b8' }}>No reports have been generated using your key yet.</p>}
                    {allInterviews.map((inv) => (
                        <div key={inv.id} style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <h4 style={{ margin: '0 0 5px 0', color: '#38bdf8' }}>{inv.candidate_name}'s Report</h4>
                                <span style={{ fontSize: '13px', color: '#94a3b8' }}>{inv.target_role} | {new Date(inv.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {inv.is_completed ? <button className="btn primary" onClick={() => handleFetchFullReport(inv.id)} style={{ marginRight: '10px' }}>View Report</button> : <span style={{ marginRight: '15px', color: '#fbbf24' }}>Pending...</span>}
                                <button className="btn" onClick={() => handleDeleteReport(inv.id)} style={{ background: '#ef4444', borderColor: '#b91c1c' }}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>

            ) : reportCandidate ? (
                // VIEW 2: INDIVIDUAL CANDIDATE HISTORY
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>History: {reportCandidate}</h2>
                        <button className="btn" onClick={() => setReportCandidate(null)}>Close History</button>
                    </div>
                    {candidateInterviews.map((inv) => (
                        <div key={inv.id} style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{inv.target_role} | {new Date(inv.created_at).toLocaleDateString()}</span>
                            <div>
                                {inv.is_completed ? <button className="btn primary" onClick={() => handleFetchFullReport(inv.id)} style={{ marginRight: '10px' }}>View Report</button> : <span style={{ marginRight: '15px', color: '#fbbf24' }}>Pending...</span>}
                                <button className="btn" onClick={() => handleDeleteReport(inv.id)} style={{ background: '#ef4444', borderColor: '#b91c1c' }}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>

            ) : (
                // VIEW 3: CREATE DASHBOARD
                <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Create New Interview</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" className="btn" onClick={handleFetchAllReports} style={{ background: '#0f172a', color: '#f8fafc', fontWeight: 'bold' }}>
                                📁 All Reports
                            </button>
                            <button type="button" className="btn" onClick={toggleDropdown} style={{ background: showCandidatesDropdown ? '#38bdf8' : '#1e293b', color: showCandidatesDropdown ? '#0f172a' : '#f8fafc', fontWeight: 'bold' }}>
                                {showCandidatesDropdown ? "✖ Close" : "📋 Linked Candidates"}
                            </button>
                        </div>
                    </div>

                    {showCandidatesDropdown && (
                        <div style={{ position: 'absolute', top: '50px', right: '0', width: '380px', maxHeight: '450px', overflowY: 'auto', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '8px', padding: '15px', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
                            {candidatesList.length === 0 && <p style={{ color: '#94a3b8' }}>No linked candidates found.</p>}
                            {candidatesList.map((cand) => (
                                <div key={cand.username} style={{ background: '#1e293b', padding: '15px', marginBottom: '10px', borderRadius: '6px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#f8fafc' }}>{cand.username}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>{cand.email} | {cand.phone}</div>
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                                        <button className="btn primary" onClick={() => { setCandidateName(cand.username); setTargetRole(cand.role || ""); setShowCandidatesDropdown(false); }}>New Interview</button>
                                        <button className="btn" onClick={() => { handleViewReportsList(cand.username); setShowCandidatesDropdown(false); }}>View History</button>
                                        {/* Removed the Delete Account Button here as requested */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Candidate Name</label>
                                <input className="input" value={candidateName} onChange={e => setCandidateName(e.target.value)} required />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Target Role</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input className="input" value={targetRole} onChange={e => setTargetRole(e.target.value)} required />
                                    <button type="button" className="btn" onClick={handleGenerate} disabled={loading}>Auto-Generate</button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5px' }}>
                                <label>Interview Questions</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" className="btn" onClick={handleToggleRecording} style={{ background: isRecording ? '#ef4444' : '#1e293b' }}>
                                        {isRecording ? "⏹ Stop Recording" : "🎤 Voice Dictation"}
                                    </button>
                                    <button type="button" className="btn" onClick={handlePolishGrammar} disabled={loading || (!customQuestions && !liveTranscript)} style={{ color: '#38bdf8' }}>
                                        ✨ Fix Grammar
                                    </button>
                                </div>
                            </div>
                            <textarea 
                                className="input" 
                                required={!isRecording} readOnly={isRecording}
                                value={isRecording ? (customQuestions + (customQuestions ? '\n\n' : '') + "🔴 Live: " + liveTranscript) : customQuestions} 
                                onChange={e => setCustomQuestions(e.target.value)} 
                                style={{ minHeight: '150px', backgroundColor: isRecording ? '#1e2a3b' : '#0f172a' }} 
                            />
                        </div>
                        <button type="submit" className="btn primary" disabled={loading || isRecording} style={{ padding: '15px' }}>{loading ? "..." : "Create Link"}</button>
                    </form>
                </div>
            )}
        </div>
    </div>
  );
}