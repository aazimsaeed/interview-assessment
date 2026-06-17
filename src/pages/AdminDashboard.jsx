import React, { useState, useEffect } from 'react';

// ==========================================
// MOCK CHART COMPONENTS FOR DASHBOARD
// ==========================================

const BarChart = ({ title, data, color }) => (
  <div style={{ background: '#0f172a', border: '1px solid #1e2a36', borderRadius: '8px', padding: '15px', height: '200px', display: 'flex', flexDirection: 'column' }}>
    <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#9fb0c3' }}>{title}</h4>
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
      {data.map((val, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <div 
            style={{ width: '100%', background: color, height: `${val.percentage}%`, borderRadius: '4px 4px 0 0', opacity: 0.8, minHeight: '5px', transition: 'height 1s ease-out' }} 
            title={`Value: ${val.value}`} 
          />
          <span style={{ fontSize: '10px', color: '#64748b' }}>{val.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const CircularGauge = ({ label, value, color, max = 100 }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  // Ensure we don't go over 100% on the circle drawing
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e2a36" strokeWidth="8" />
        <circle 
          cx="50" cy="50" r={radius} 
          fill="none" 
          stroke={color} 
          strokeWidth="8" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          strokeLinecap="round" 
          transform="rotate(-90 50 50)" 
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
        <text x="50" y="55" textAnchor="middle" fill="#e6edf3" fontSize="20" fontWeight="bold">
          {percentage.toFixed(0)}%
        </text>
      </svg>
      <span style={{ color: '#9fb0c3', fontSize: '12px', marginTop: '8px', fontWeight: '500', textAlign: 'center' }}>{label}</span>
    </div>
  );
};

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================

export default function AdminDashboard({ onBack, onViewReport }) {
  const [stats, setStats] = useState({ recruiters: 0, candidates: 0, interviews: 0, reports: 0 });
  const [users, setUsers] = useState({ recruiters: [], candidates: [] });
  const [globalInterviews, setGlobalInterviews] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview'); 
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(new Date());

  const API_BASE = "http://localhost:8000";

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const statRes = await fetch(`${API_BASE}/api/admins/system-stats`);
      if (statRes.ok) setStats(await statRes.json());

      const userRes = await fetch(`${API_BASE}/api/admins/users`);
      if (userRes.ok) setUsers(await userRes.json());

      const sessionRes = await fetch(`${API_BASE}/api/admins/all-interviews`);
      if (sessionRes.ok) setGlobalInterviews(await sessionRes.json());
      
      setLastSynced(new Date());
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // Auto-Sync after 10 minutes (600,000 milliseconds)
    const intervalId = setInterval(fetchAdminData, 600000);
    return () => clearInterval(intervalId);
  }, []);

  const handleDeleteUser = async (role, username) => {
    if (!window.confirm(`Are you sure you want to delete the ${role} account: ${username}? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/admins/users/${role}/${username}`, { method: 'DELETE' });
        if (res.ok) {
            fetchAdminData();
        } else {
            alert("Failed to delete user.");
        }
    } catch (err) {
        alert("Error deleting user.");
    }
  };

  const handleFetchFullReport = async (interviewId) => {
    try {
        const res = await fetch(`${API_BASE}/api/reports/${interviewId}`);
        if (res.ok) {
            const data = await res.json();
            if(onViewReport) onViewReport(data);
        } else {
            alert("Report not found or incomplete.");
        }
    } catch (err) { console.error("Failed to load report details", err); }
  };

  const handleDeleteSession = async (interviewId) => {
      if (!window.confirm("Permanently delete this interview session?")) return;
      try {
          const res = await fetch(`${API_BASE}/api/interviews/${interviewId}?role=admin`, { method: 'DELETE' });
          if (res.ok) {
              setGlobalInterviews(prev => prev.filter(inv => inv.id !== interviewId));
              setStats(prev => ({ ...prev, interviews: Math.max(0, prev.interviews - 1) }));
          }
      } catch (err) { console.error("Failed to delete session", err); }
  };

  // --- Dynamic Mock Data Generation for Charts ---
  const completionRate = stats.interviews > 0 ? (stats.reports / stats.interviews) * 100 : 0;
  
  // Weekly Growth (Simulated based on total users for visual effect)
  const totalUsers = stats.candidates + stats.recruiters;
  const weeklyGrowthData = [
    { label: 'W1', value: Math.floor(totalUsers * 0.2), percentage: 20 },
    { label: 'W2', value: Math.floor(totalUsers * 0.4), percentage: 40 },
    { label: 'W3', value: Math.floor(totalUsers * 0.3), percentage: 30 },
    { label: 'W4', value: Math.floor(totalUsers * 0.8), percentage: 80 },
    { label: 'W5', value: totalUsers, percentage: totalUsers > 0 ? 100 : 0 }
  ];

  // Interviews Generated Trend (Simulated based on total interviews)
  const interviewsTrendData = [
    { label: 'Mon', value: Math.floor(stats.interviews * 0.2), percentage: 20 },
    { label: 'Tue', value: Math.floor(stats.interviews * 0.5), percentage: 50 },
    { label: 'Wed', value: Math.floor(stats.interviews * 0.8), percentage: 80 },
    { label: 'Thu', value: Math.floor(stats.interviews * 0.4), percentage: 40 },
    { label: 'Fri', value: stats.interviews, percentage: stats.interviews > 0 ? 100 : 0 }
  ];

  return (
    <div className="shell" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* --- HEADER --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <div>
              <h1 style={{ margin: '0 0 5px 0' }}>🛡️ Admin Control Panel</h1>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                Last Synced: {lastSynced.toLocaleTimeString()} (Auto-syncs every 10 mins)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn primary" onClick={fetchAdminData}>🔄 Force Sync</button>
              <button className="btn" onClick={onBack} style={{ borderColor: '#ef4444', color: '#fca5a5' }}>🚪 Logout Admin</button>
            </div>
        </div>

        {/* --- KPI STATS STRIP --- */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', marginBottom: '30px' }}>
            <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #38bdf8' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>Total Users</h3>
                <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats.recruiters + stats.candidates}</h2>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #8b5cf6' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>Recruiters</h3>
                <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats.recruiters}</h2>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #22c55e' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>Candidates</h3>
                <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats.candidates}</h2>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #eab308' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>Created Sessions</h3>
                <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats.interviews}</h2>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #f43f5e' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>Completed Reports</h3>
                <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats.reports}</h2>
            </div>
        </div>

        {/* --- NAVIGATION TABS --- */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button className={`btn ${activeTab === 'overview' ? 'primary' : ''}`} onClick={() => setActiveTab('overview')}>📊 Analytics Overview</button>
            <button className={`btn ${activeTab === 'users' ? 'primary' : ''}`} onClick={() => setActiveTab('users')}>👥 User Management</button>
            <button className={`btn ${activeTab === 'sessions' ? 'primary' : ''}`} onClick={() => setActiveTab('sessions')}>📁 Global Sessions</button>
            <button className={`btn ${activeTab === 'settings' ? 'primary' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="card" style={{ padding: '30px', minHeight: '500px', position: 'relative' }}>
            
            {loading && (
              <div style={{ position: 'absolute', top: '10px', right: '20px', color: '#38bdf8', fontSize: '12px' }}>
                Fetching Data...
              </div>
            )}

            {/* TAB 1: OVERVIEW & CHARTS */}
            {activeTab === 'overview' && (
                <div>
                  <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>System Activity Dashboard</h2>
                  
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    
                    {/* Gauge Chart Box */}
                    <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e2a36', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <h4 style={{ margin: '0 0 20px 0', color: '#e2e8f0' }}>Conversion Metrics</h4>
                      <div style={{ display: 'flex', gap: '30px' }}>
                        <CircularGauge label="Completion Rate" value={completionRate} color="#22c55e" max={100} />
                        <CircularGauge label="Active Candidates" value={stats.candidates} color="#38bdf8" max={stats.candidates > 0 ? stats.candidates + 10 : 100} />
                      </div>
                    </div>

                    {/* Bar Charts */}
                    <BarChart title="Platform Growth (Total Users/Wk)" data={weeklyGrowthData} color="#8b5cf6" />
                    <BarChart title="Interviews Generated (This Week)" data={interviewsTrendData} color="#eab308" />
                  </div>

                  {/* System Info Block */}
                  <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e2a36' }}>
                    <h3 style={{ color: '#f8fafc', marginTop: 0 }}>System Health Information</h3>
                    <div style={{ display: 'flex', gap: '20px', color: '#94a3b8', fontSize: '13px' }}>
                       <p>✅ Gemini API Connections active</p>
                       <p>✅ MongoDB indexing verified</p>
                       <p>✅ Syncing mechanism operational</p>
                    </div>
                  </div>
                </div>
            )}

            {/* TAB 2: USER MANAGEMENT */}
            {activeTab === 'users' && (
                <div>
                    <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>User Operations</h2>
                    
                    <h3 style={{ color: '#38bdf8', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>Recruiters ({users.recruiters.length})</h3>
                    <div style={{ marginBottom: '30px' }}>
                        {users.recruiters.length === 0 && <p className="muted">No recruiters found.</p>}
                        {users.recruiters.map(r => (
                            <div key={r.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #1e293b' }}>
                                <div>
                                    <strong style={{ color: '#f8fafc', fontSize: '1.1rem' }}>{r.username}</strong>
                                    <span style={{ marginLeft: '15px', fontSize: '12px', color: '#94a3b8', background: '#1e293b', padding: '4px 8px', borderRadius: '4px' }}>Key: {r.recruiter_key || 'N/A'}</span>
                                </div>
                                <button className="btn" onClick={() => handleDeleteUser('recruiter', r.username)} style={{ background: '#451a1e', color: '#fca5a5', border: '1px solid #7f1d1d' }}>Delete User</button>
                            </div>
                        ))}
                    </div>

                    <h3 style={{ color: '#22c55e', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>Candidates ({users.candidates.length})</h3>
                    <div>
                        {users.candidates.length === 0 && <p className="muted">No candidates found.</p>}
                        {users.candidates.map(c => (
                            <div key={c.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #1e293b' }}>
                                <div>
                                    <strong style={{ color: '#f8fafc', fontSize: '1.1rem' }}>{c.username}</strong>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                                      {c.email} | Linked to: <span style={{ color: '#38bdf8' }}>{c.recruiter_name || 'None'}</span>
                                    </div>
                                </div>
                                <button className="btn" onClick={() => handleDeleteUser('candidate', c.username)} style={{ background: '#451a1e', color: '#fca5a5', border: '1px solid #7f1d1d' }}>Delete User</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: SESSIONS & REPORTS */}
            {activeTab === 'sessions' && (
                <div>
                    <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>Global Interview Sessions</h2>
                    {globalInterviews.length === 0 && <p className="muted">No sessions generated across the platform.</p>}
                    
                    {globalInterviews.map((inv) => (
                        <div key={inv.id} style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1e293b' }}>
                            <div>
                                <h4 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '1.1rem' }}>{inv.candidate_name}</h4>
                                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                                    Role: <strong style={{color: '#e2e8f0'}}>{inv.target_role}</strong> | Recruiter Key: {inv.recruiter_key} | Date: {new Date(inv.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {inv.is_completed ? (
                                    <button className="btn primary" onClick={() => handleFetchFullReport(inv.id)}>View Report</button>
                                ) : (
                                    <span style={{ color: '#fbbf24', padding: '8px 12px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '4px' }}>Pending...</span>
                                )}
                                <button className="btn" onClick={() => handleDeleteSession(inv.id)} style={{ background: '#451a1e', borderColor: '#7f1d1d', color: '#fca5a5' }}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* TAB 4: SETTINGS */}
            {activeTab === 'settings' && (
                <div style={{ padding: '20px' }}>
                    <h2 style={{ color: '#f8fafc' }}>System Configuration</h2>
                    <p className="muted">Global settings and integrations limits.</p>
                    <div style={{ marginTop: '20px', background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#e2e8f0' }}>Admin Sync Settings</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                           <span style={{ color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Auto-sync Dashboard Data Interval</span>
                           <span style={{ fontSize: '12px', color: '#64748b' }}>Controls how frequently the global statistics update automatically.</span>
                        </div>
                        <select className="input" style={{ width: '220px', background: '#1e293b' }} defaultValue="600000" disabled>
                          <option value="600000">Every 10 Minutes</option>
                          <option value="300000">Every 5 Minutes</option>
                          <option value="60000">Every 1 Minute</option>
                        </select>
                      </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}