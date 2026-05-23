import React, { useState, useEffect, useRef } from 'react';
import { createSpeechTracker } from '../audio/speechAnalysis';

export default function InterviewerDashboard({ onBack, username, onViewReport }) {
  // --- NEW: RECRUITER KEY STATE ---
  const [recruiterKey, setRecruiterKey] = useState("LOADING...");
  
  const [candidateName, setCandidateName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [customQuestions, setCustomQuestions] = useState("");
  
  const [selectedEmail, setSelectedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedId, setGeneratedId] = useState(null);
  const [error, setError] = useState("");
  const [candidatesList, setCandidatesList] = useState([]);

  const [reportCandidate, setReportCandidate] = useState(null);
  const [candidateInterviews, setCandidateInterviews] = useState([]);

  const [showCandidatesDropdown, setShowCandidatesDropdown] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const speechTrackerRef = useRef(null);

  const API_BASE = "http://localhost:8000";

  // Fetch Recruiter Key and then fetch Linked Candidates
  useEffect(() => {
    const fetchKeyAndCandidates = async () => {
        try {
            // 1. Get the personal key
            const keyRes = await fetch(`${API_BASE}/api/recruiters/${username}`);
            if (keyRes.ok) {
                const keyData = await keyRes.json();
                setRecruiterKey(keyData.recruiter_key);
                
                // 2. Fetch candidates specifically linked to this key
                const candRes = await fetch(`${API_BASE}/api/candidates?recruiter_key=${keyData.recruiter_key}`);
                if (candRes.ok) {
                    const candData = await candRes.json();
                    setCandidatesList(candData);
                }
            }
        } catch (err) {
            console.error("Failed to load dashboard data:", err);
        }
    };
    fetchKeyAndCandidates();

    return () => {
        if (speechTrackerRef.current) speechTrackerRef.current.turnOff();
    };
  }, [username]);

  const handleGenerate = async () => {
    if (!targetRole) return alert("Please enter a target role first.");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-questions?role=${encodeURIComponent(targetRole)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setCustomQuestions(data.questions);
    } catch (err) {
      alert("Failed to generate questions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
        if (speechTrackerRef.current) speechTrackerRef.current.turnOff();
        setCustomQuestions(prev => (prev + (prev ? '\n' : '') + liveTranscript).trim());
        setLiveTranscript("");
        setIsRecording(false);
    } else {
        speechTrackerRef.current = createSpeechTracker((metrics) => {
            setLiveTranscript(metrics.fullTranscript);
        });
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
      } catch (err) {
          setError("Failed to polish questions: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (isRecording) return setError("Please stop recording before creating the session.");
    setLoading(true);
    setError("");

    const questionList = customQuestions.split('\n').map(q => q.trim()).filter(q => q.length > 0);
    if (questionList.length === 0) {
       setError("Please generate or enter questions before creating the session.");
       setLoading(false);
       return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/interviews`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            candidate_name: candidateName,
            target_role: targetRole,
            questions: questionList
         })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setGeneratedId(data.interview_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReportsList = async (candidateUsername) => {
      setReportCandidate(candidateUsername);
      try {
          const res = await fetch(`${API_BASE}/api/candidates/${candidateUsername}/interviews?role=recruiter`);
          if (res.ok) {
              const data = await res.json();
              setCandidateInterviews(data);
          }
      } catch (err) {
          console.error("Failed to load interviews", err);
      }
  };

  const handleFetchFullReport = async (interviewId) => {
      try {
          const res = await fetch(`${API_BASE}/api/reports/${interviewId}`);
          if (res.ok) {
              const data = await res.json();
              if(onViewReport) onViewReport(data);
          }
      } catch (err) {
          console.error("Failed to load report details", err);
      }
  };

  const handleDeleteReport = async (interviewId) => {
      const confirmDelete = window.confirm("Are you sure you want to remove this session from your dashboard?");
      if (!confirmDelete) return;

      try {
          const res = await fetch(`${API_BASE}/api/interviews/${interviewId}?role=recruiter`, { method: 'DELETE' });
          if (res.ok) setCandidateInterviews(prev => prev.filter(inv => inv.id !== interviewId));
      } catch (err) {
          console.error("Failed to delete report", err);
      }
  };

  const handleDeleteCandidate = async (usernameToDelete) => {
      const confirmDelete = window.confirm(`Are you sure you want to completely delete candidate '${usernameToDelete}' and all their interview records? This cannot be undone.`);
      if (!confirmDelete) return;

      try {
          const res = await fetch(`${API_BASE}/api/candidates/${usernameToDelete}`, { method: 'DELETE' });
          if (res.ok) {
              setCandidatesList(prev => prev.filter(c => c.username !== usernameToDelete));
              if (candidateName === usernameToDelete) { setCandidateName(""); setTargetRole(""); setSelectedEmail(""); }
              if (reportCandidate === usernameToDelete) { setReportCandidate(null); setCandidateInterviews([]); }
          }
      } catch (err) {
          alert("Error connecting to server to delete candidate.");
      }
  };

  if (generatedId) {
      const mailtoLink = `mailto:${selectedEmail}?subject=Your Interview Link for ${targetRole}&body=Hello ${candidateName},%0D%0A%0D%0APlease log in to the Candidate Portal and use the following Interview ID to begin your assessment:%0D%0A%0D%0AInterview ID: ${generatedId}%0D%0A%0D%0ABest of luck!`;

      return (
          <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
              <div className="card" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                  <h2 style={{ color: '#22c55e', marginBottom: '20px' }}>✅ Session Created!</h2>
                  <p>Give this Interview ID to your candidate:</p>
                  <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', fontSize: '2rem', fontWeight: 'bold', margin: '20px 0', letterSpacing: '2px', color: '#38bdf8' }}>
                      {generatedId}
                  </div>
                  
                  {selectedEmail && (
                      <a href={mailtoLink} className="btn" style={{ width: '100%', marginBottom: '10px', display: 'block', textDecoration: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold' }}>
                          📧 Send Link via Email
                      </a>
                  )}

                  <button type="button" className="btn primary" onClick={() => { setGeneratedId(null); setSelectedEmail(""); setCandidateName(""); setTargetRole(""); setCustomQuestions(""); }} style={{ width: '100%' }}>Create Another</button>
                  <button type="button" className="btn" onClick={onBack} style={{ width: '100%', marginTop: '10px' }}>Back to Home</button>
              </div>
          </div>
      );
  }

  return (
    <div className="shell" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: 0 }}>Recruiter Dashboard</h1>
            <button type="button" className="btn" onClick={onBack}>← Back to Home</button>
        </div>

        {/* --- DISPLAY THE RECRUITER KEY --- */}
        <div style={{ background: '#0f172a', border: '1px solid #38bdf8', padding: '15px 25px', borderRadius: '8px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Logged in as: <strong>{username}</strong></p>
                <p style={{ margin: '5px 0 0 0', color: '#f8fafc', fontSize: '14px' }}>Share your personal Key with candidates so they can access your portal.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Recruiter Key</span>
                <h2 style={{ margin: '0', color: '#22c55e', letterSpacing: '3px' }}>{recruiterKey}</h2>
            </div>
        </div>
        {/* -------------------------------- */}

        {error && <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            <div className="card" style={{ padding: '40px', width: '100%' }}>
                
                {reportCandidate ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Interview History: <span style={{ color: '#38bdf8' }}>{reportCandidate}</span></h2>
                            <button className="btn" onClick={() => setReportCandidate(null)}>Close</button>
                        </div>
                        
                        {candidateInterviews.length === 0 ? (
                            <p style={{ color: '#94a3b8' }}>No interviews assigned or completed yet.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {candidateInterviews.map((inv, idx) => (
                                    <li key={inv.id} style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>Target Role: {inv.target_role}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Date: {new Date(inv.created_at.includes('Z') || inv.created_at.includes('+') ? inv.created_at : inv.created_at + 'Z').toLocaleDateString()}</div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {inv.is_completed ? (
                                                <button className="btn primary" onClick={() => handleFetchFullReport(inv.id)} style={{ padding: '8px 12px', fontSize: '13px' }}>View Full Report</button>
                                            ) : (
                                                <span style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 'bold', marginRight: '5px' }}>Pending...</span>
                                            )}
                                            
                                            <button 
                                                className="btn" 
                                                onClick={() => handleDeleteReport(inv.id)} 
                                                style={{ padding: '8px', fontSize: '12px', background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }} 
                                                title="Remove this session"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                ) : (
                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Create New Interview</h2>
                            
                            <button 
                                type="button" 
                                className="btn"
                                onClick={() => setShowCandidatesDropdown(!showCandidatesDropdown)}
                                style={{ background: showCandidatesDropdown ? '#38bdf8' : '#1e293b', color: showCandidatesDropdown ? '#0f172a' : '#f8fafc', fontWeight: 'bold' }}
                            >
                                {showCandidatesDropdown ? "✖ Close Candidates" : "📋 Linked Candidates"}
                            </button>
                        </div>

                        {showCandidatesDropdown && (
                            <div style={{
                                position: 'absolute',
                                top: '50px',
                                right: '0',
                                width: '380px',
                                maxHeight: '450px',
                                overflowY: 'auto',
                                background: '#0f172a',
                                border: '1px solid #38bdf8',
                                borderRadius: '8px',
                                padding: '15px',
                                zIndex: 10,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                            }}>
                                <h3 style={{ marginTop: 0, color: '#f8fafc', marginBottom: '15px' }}>Select a Candidate</h3>
                                {candidatesList.length === 0 ? (
                                    <p style={{ color: '#94a3b8' }}>No candidates have linked their account with your Key yet.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {candidatesList.map((cand, idx) => (
                                            <li 
                                                key={idx} 
                                                style={{ 
                                                    background: '#1e293b', 
                                                    padding: '15px', 
                                                    borderRadius: '8px', 
                                                    marginBottom: '10px', 
                                                    border: candidateName === cand.username ? '1px solid #38bdf8' : '1px solid transparent', 
                                                }}
                                            >
                                                <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '1.1rem' }}>{cand.username}</div>
                                                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Role: {cand.role || 'Not specified'}</div>
                                                
                                                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span>📧 {cand.email}</span>
                                                    <span>📞 {cand.phone}</span>
                                                </div>
                                                
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                                                    <button 
                                                        type="button"
                                                        className="btn primary" 
                                                        onClick={() => {
                                                            setReportCandidate(null);
                                                            setCandidateName(cand.username);
                                                            setTargetRole(cand.role || "");
                                                            setSelectedEmail(cand.email);
                                                            setShowCandidatesDropdown(false); 
                                                        }}
                                                        style={{ padding: '8px', fontSize: '12px', flex: 1 }}
                                                    >
                                                        ➕ Select
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        className="btn" 
                                                        onClick={() => {
                                                            handleViewReportsList(cand.username);
                                                            setShowCandidatesDropdown(false); 
                                                        }}
                                                        style={{ padding: '8px', fontSize: '12px', flex: 1, background: '#0f172a', color: '#f8fafc' }}
                                                    >
                                                        📊 Reports
                                                    </button>
                                                    
                                                    <button 
                                                        type="button"
                                                        className="btn" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteCandidate(cand.username);
                                                        }}
                                                        style={{ padding: '8px', fontSize: '12px', background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }}
                                                        title="Delete Candidate"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Candidate Name</label>
                                    <input type="text" required className="input" value={candidateName} onChange={e => setCandidateName(e.target.value)} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Target Role</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input type="text" required className="input" value={targetRole} onChange={e => setTargetRole(e.target.value)} />
                                        <button type="button" className="btn" onClick={handleGenerate} disabled={loading}>Auto-Generate</button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5px' }}>
                                    <label style={{ display: 'block' }}>Interview Questions</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button type="button" className="btn" onClick={handleToggleRecording} style={{ background: isRecording ? '#ef4444' : '#1e293b', borderColor: isRecording ? '#ef4444' : '#334155' }}>
                                            {isRecording ? "⏹ Stop Recording" : "🎤 Voice Dictation"}
                                        </button>
                                        <button type="button" className="btn" onClick={handlePolishGrammar} disabled={loading || (!customQuestions && !liveTranscript)} style={{ color: '#38bdf8', borderColor: '#0ea5e9' }}>
                                            ✨ Fix Grammar & Format
                                        </button>
                                    </div>
                                </div>

                                <textarea 
                                    required={!isRecording} readOnly={isRecording} className="input" 
                                    style={{ minHeight: '150px', resize: 'vertical', backgroundColor: isRecording ? '#1e2a3b' : '#0f172a', outline: isRecording ? '2px solid #ef4444' : 'none' }}
                                    value={isRecording ? (customQuestions + (customQuestions ? '\n\n' : '') + "🔴 Live: " + liveTranscript) : customQuestions} 
                                    onChange={e => setCustomQuestions(e.target.value)} 
                                    placeholder="1. Tell me about yourself...&#10;2. What are your strengths..."
                                />
                            </div>

                            <button type="submit" className="btn primary" disabled={loading || isRecording} style={{ padding: '15px', fontSize: '1.1rem' }}>
                                {loading ? "Processing..." : "Create Interview Link"}
                            </button>
                        </form>
                    </div>
                )}
            </div>

        </div>
    </div>
  );
}