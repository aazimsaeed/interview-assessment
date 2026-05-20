import React, { useState, useEffect } from 'react';

export default function SetupPage({ onStart, onBack, username, onViewReport }) {
  const [interviewId, setInterviewId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assignedInterviews, setAssignedInterviews] = useState([]);

  const API_BASE = "http://localhost:8000";

  // Auto-fetch candidate's pending interviews on load
  useEffect(() => {
    if (username) {
      fetch(`${API_BASE}/api/candidates/${username}/interviews`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAssignedInterviews(data);
        })
        .catch(err => console.error("Failed to fetch interviews", err));
    }
  }, [username]);

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

  // --- NEW: Handle Interview Deletion ---
  const handleDelete = async (idToDelete) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this assessment? This cannot be undone.");
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/interviews/${idToDelete}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove it from the local UI list immediately
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

  // Helper function to format the timestamp
  const formatDate = (dateString) => {
    if (!dateString || dateString === "Unknown") return "Date Unknown";
    
    // Fix: Append 'Z' to treat the naive SQLite datetime as UTC 
    const safeDateString = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(safeDateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px' }}>
      <div className="card" style={{ padding: '40px', maxWidth: '600px', width: '100%' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ margin: 0 }}>Candidate Portal</h1>
          
          <button 
            type="button" 
            className="btn" 
            onClick={onBack} 
            style={{ background: '#1e293b', color: '#f8fafc', borderColor: '#334155', fontWeight: 'bold' }}
          >
            🚪 Logout
          </button>
        </div>

        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
          Welcome, <strong>{username}</strong>. Choose an interview session below to begin.
        </p>

        {error && (
           <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>
             {error}
           </div>
        )}

        {/* Dynamic Assigned Interviews List */}
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
                    
                    {/* NEW: Delete Button */}
                    <button 
                        className="btn" 
                        disabled={loading} 
                        onClick={() => handleDelete(inv.id)}
                        style={{ padding: '12px', background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }}
                        title="Delete Assessment"
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

        {/* Manual Entry Fallback */}
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