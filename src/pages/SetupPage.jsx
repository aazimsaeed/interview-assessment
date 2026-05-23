import React, { useState, useEffect } from 'react';

export default function SetupPage({ onStart, onBack, username, onViewReport }) {
  // --- NEW: LINKING STATE ---
  const [isLinked, setIsLinked] = useState(null); // null = loading
  const [recruiterName, setRecruiterName] = useState("");
  const [keyInput, setKeyInput] = useState("");

  const [interviewId, setInterviewId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assignedInterviews, setAssignedInterviews] = useState([]);

  const API_BASE = "http://localhost:8000";

  // Check link status on load
  useEffect(() => {
    if (username) {
      fetch(`${API_BASE}/api/candidates/${username}/link_status`)
        .then(res => res.json())
        .then(data => {
            if (data.is_linked) {
                setRecruiterName(data.recruiter_name);
                setIsLinked(true);
            } else {
                setIsLinked(false);
            }
        })
        .catch(err => console.error("Failed to check link status", err));
    }
  }, [username]);

  // Fetch interviews ONLY IF linked
  useEffect(() => {
    if (username && isLinked) {
      fetch(`${API_BASE}/api/candidates/${username}/interviews?role=candidate`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAssignedInterviews(data);
        })
        .catch(err => console.error("Failed to fetch interviews", err));
    }
  }, [username, isLinked]);

  // --- NEW: Process linking submission ---
  const handleLinkKey = async (e) => {
      e.preventDefault();
      if (!keyInput.trim()) return setError("Please enter a key.");
      setLoading(true);
      setError("");

      try {
          const res = await fetch(`${API_BASE}/api/candidates/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: username, recruiter_key: keyInput })
          });
          const data = await res.json();

          if (!res.ok) throw new Error(data.detail);

          setRecruiterName(data.recruiter_name);
          setIsLinked(true);
      } catch (err) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleJoin = async (idToJoin) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/interviews/${idToJoin}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not find this interview.");
      }

      onStart({
        id: idToJoin,
        studentName: data.candidate_name,
        targetRole: data.target_role,
        questions: data.questions.join("\n")
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (idToDelete) => {
    const confirmDelete = window.confirm("Are you sure you want to remove this assessment? It will no longer appear on your dashboard.");
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/interviews/${idToDelete}?role=candidate`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setAssignedInterviews(prev => prev.filter(inv => inv.id !== idToDelete));
      } else {
        const data = await response.json();
        setError(data.detail || "Failed to delete interview.");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!interviewId.trim()) return setError("Please enter an ID");
    handleJoin(interviewId);
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "Unknown") return "Date Unknown";
    const safeDateString = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(safeDateString).toLocaleDateString(undefined, options);
  };

  if (isLinked === null) {
      return <div className="shell flex-center"><h2>Loading portal...</h2></div>;
  }

  // --- GATEKEEPER VIEW: IF NOT LINKED YET ---
  if (isLinked === false) {
      return (
        <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px' }}>
            <div className="card" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h1 style={{ margin: 0 }}>Connect Account</h1>
                    <button type="button" className="btn" onClick={onBack} style={{ background: '#1e293b', color: '#f8fafc', borderColor: '#334155', fontWeight: 'bold' }}>🚪 Logout</button>
                </div>
                
                <p style={{ color: '#94a3b8', marginBottom: '30px' }}>
                    Welcome, <strong>{username}</strong>. To access your assessments, please enter the personal 6-character Key provided by your recruiter.
                </p>

                {error && <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>{error}</div>}

                <form onSubmit={handleLinkKey} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="text" 
                        className="input" 
                        placeholder="e.g. A7B29F"
                        value={keyInput} 
                        onChange={e => setKeyInput(e.target.value.toUpperCase())} 
                        style={{ fontSize: '1.2rem', textAlign: 'center', letterSpacing: '3px' }}
                        maxLength={6}
                    />
                    <button type="submit" className="btn primary" disabled={loading} style={{ padding: '15px' }}>
                        {loading ? "Verifying..." : "Connect to Recruiter"}
                    </button>
                </form>
            </div>
        </div>
      );
  }

  // --- MAIN PORTAL: IF LINKED SUCCESSFULLY ---
  return (
    <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px' }}>
      <div className="card" style={{ padding: '40px', maxWidth: '600px', width: '100%' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ margin: 0 }}>Candidate Portal</h1>
          <button type="button" className="btn" onClick={onBack} style={{ background: '#1e293b', color: '#f8fafc', borderColor: '#334155', fontWeight: 'bold' }}>🚪 Logout</button>
        </div>

        <div style={{ marginBottom: '20px', background: 'rgba(56, 189, 248, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <p style={{ color: '#f8fafc', margin: '0 0 5px 0' }}>Welcome, <strong>{username}</strong>.</p>
            <p style={{ color: '#38bdf8', margin: 0, fontSize: '14px' }}>✅ Securely connected to Recruiter: <strong>{recruiterName}</strong></p>
        </div>

        {error && (
           <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>
             {error}
           </div>
        )}

        {assignedInterviews.length > 0 ? (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#e6edf3', marginBottom: '10px' }}>Your Assigned Interviews</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assignedInterviews.map((inv, index) => (
                <li key={inv.id} style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '1.2rem' }}>
                      Assessment {index + 1}: {inv.target_role}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
                      <strong>Created:</strong> {formatDate(inv.created_at)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                      <strong>Session ID:</strong> {inv.id}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {inv.is_completed ? (
                      <button 
                        className="btn" 
                        onClick={async () => {
                          try {
                             const res = await fetch(`${API_BASE}/api/reports/${inv.id}`);
                             const data = await res.json();
                             if(res.ok) onViewReport(data);
                          } catch (e) {
                             setError("Failed to load report from server.");
                          }
                        }}
                        style={{ padding: '12px 20px', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold' }}
                      >
                        View Report
                      </button>
                    ) : (
                      <button 
                        className="btn primary" 
                        disabled={loading} 
                        onClick={() => handleJoin(inv.id)}
                        style={{ padding: '12px 20px', background: '#22c55e', color: '#fff', borderColor: '#16a34a' }}
                      >
                        Join
                      </button>
                    )}
                    
                    <button 
                        className="btn" 
                        disabled={loading} 
                        onClick={() => handleDelete(inv.id)}
                        style={{ padding: '12px', background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }}
                        title="Remove Assessment"
                    >
                      🗑️
                    </button>
                  </div>

                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '30px', border: '1px solid #1e293b' }}>
            <p style={{ color: '#94a3b8', margin: 0 }}>No pending interviews assigned to you yet.</p>
          </div>
        )}

        <hr style={{ borderColor: '#1e293b', margin: '20px 0' }} />

        <h3 style={{ color: '#9fb0c3', marginBottom: '10px', fontSize: '0.9rem' }}>Or enter an Interview ID manually:</h3>
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input 
              type="text" 
              className="input" 
              placeholder="e.g. 8f7a9c2b"
              value={interviewId} 
              onChange={e => setInterviewId(e.target.value)} 
              style={{ flex: 1 }}
          />
          <button type="submit" className="btn" disabled={loading} style={{ padding: '12px 20px' }}>
            {loading ? "..." : "Join"}
          </button>
        </form>

      </div>
    </div>
  );
}