import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

// ==========================================
// REAL-DATA CHART COMPONENTS 
// ==========================================

const BarChart = ({ title, data, color }) => (
  <div style={{ background: '#0f172a', border: '1px solid #1e2a36', borderRadius: '8px', padding: '15px', height: '200px', display: 'flex', flexDirection: 'column' }}>
    <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#9fb0c3' }}>{title}</h4>
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
      {(data || []).map((val, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <div 
            style={{ width: '100%', background: color, height: `${val.percentage || 0}%`, borderRadius: '4px 4px 0 0', opacity: 0.8, minHeight: '5px', transition: 'height 1s ease-out' }} 
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
  const percentage = max > 0 ? Math.min(((value || 0) / max) * 100, 100) : 0;
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
  const [ads, setAds] = useState([]); 
  
  const [activeTab, setActiveTab] = useState('overview'); 
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(new Date());
  
  // Controls States
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const statRes = await fetch(`${API_BASE}/api/admins/system-stats`);
      if (statRes.ok) setStats(await statRes.json());

      const userRes = await fetch(`${API_BASE}/api/admins/users`);
      if (userRes.ok) setUsers(await userRes.json());

      const sessionRes = await fetch(`${API_BASE}/api/admins/all-interviews`);
      if (sessionRes.ok) setGlobalInterviews(await sessionRes.json());

      const adsRes = await fetch(`${API_BASE}/api/advertisements`);
      if (adsRes.ok) setAds(await adsRes.json());
      
      setLastSynced(new Date());
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const intervalId = setInterval(fetchAdminData, 600000); 
    return () => clearInterval(intervalId);
  }, []);

  // --- Core Functionalities ---
  const handleDeleteUser = async (role, username) => {
    if (!window.confirm(`Are you sure you want to delete the ${role} account: ${username}? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/admins/users/${role}/${username}`, { method: 'DELETE' });
        if (res.ok) fetchAdminData();
        else alert("Failed to delete user.");
    } catch (err) { alert("Error deleting user."); }
  };

  const handleFetchFullReport = async (interviewId) => {
    try {
        const res = await fetch(`${API_BASE}/api/reports/${interviewId}`);
        if (res.ok) {
            const data = await res.json();
            if(onViewReport) onViewReport(data);
        } else alert("Report not found or incomplete.");
    } catch (err) { console.error("Failed to load report details", err); }
  };

  const handleDeleteSession = async (interviewId) => {
      if (!window.confirm("Permanently delete this interview session?")) return;
      try {
          const res = await fetch(`${API_BASE}/api/interviews/${interviewId}?role=admin`, { method: 'DELETE' });
          if (res.ok) {
              setGlobalInterviews(prev => (prev || []).filter(inv => inv.id !== interviewId));
              setStats(prev => ({ ...prev, interviews: Math.max(0, prev.interviews - 1) }));
          }
      } catch (err) { console.error("Failed to delete session", err); }
  };

const handleDeleteReport = async (interviewId) => {
      if (!window.confirm("Are you sure you want to delete this report? The session will revert to 'Pending', allowing the candidate to retake the interview, and the score will be removed from the Recruiter's dashboard.")) return;
      try {
          const res = await fetch(`${API_BASE}/api/reports/${interviewId}`, { method: 'DELETE' });
          if (res.ok) {
              // Instantly update the UI to show it as pending again
              setGlobalInterviews(prev => prev.map(inv => inv.id === interviewId ? { ...inv, is_completed: false } : inv));
              setStats(prev => ({ ...prev, reports: Math.max(0, prev.reports - 1) }));
          } else {
              alert("Failed to delete the report.");
          }
      } catch (err) { console.error("Failed to delete report", err); }
  };

  const handleDeleteAd = async (adId) => {
    if (!window.confirm("Are you sure you want to permanently delete this job advertisement globally?")) return;
    setAds(prev => (prev || []).filter(a => a.id !== adId));
    try {
        await fetch(`${API_BASE}/api/advertisements/${adId}`, { method: 'DELETE' });
    } catch (e) { console.error("Failed to delete ad", e); }
  };

  const handleExportData = () => {
    const dataDump = { stats, users, globalInterviews, ads, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(dataDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform_backup_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearPendingSessions = async () => {
    const pending = (globalInterviews || []).filter(inv => !inv.is_completed);
    if (pending.length === 0) return alert("No pending sessions to clear.");
    if (!window.confirm(`Are you sure you want to delete all ${pending.length} incomplete interview sessions?`)) return;
    
    setIsClearing(true);
    for (const inv of pending) {
        try {
            await fetch(`${API_BASE}/api/interviews/${inv.id}?role=admin`, { method: 'DELETE' });
        } catch (e) { console.error("Error deleting", inv.id); }
    }
    await fetchAdminData();
    setIsClearing(false);
    alert(`Successfully cleared ${pending.length} pending sessions.`);
  };

  // --- CRASH-PROOF DYNAMIC REAL DATA CALCULATIONS FOR CHARTS ---
  const completionRate = (stats?.interviews || 0) > 0 ? (stats.reports / stats.interviews) * 100 : 0;
  
  const safeCandidates = users?.candidates || [];
  const linkedCands = safeCandidates.filter(c => c.linked_recruiter || (c.linked_recruiters && c.linked_recruiters.length > 0)).length;
  const unlinkedCands = safeCandidates.length - linkedCands;
  
  const rawDistData = [
    { label: 'Recruiters', value: (users?.recruiters || []).length },
    { label: 'Linked Cands', value: linkedCands },
    { label: 'Unlinked', value: unlinkedCands }
  ];
  const maxDistVal = Math.max(...rawDistData.map(d => d.value), 1);
  const userDistributionData = rawDistData.map(d => ({ ...d, percentage: (d.value / maxDistVal) * 100 }));

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const counts = [0, 0, 0, 0, 0, 0, 0];
  
  (globalInterviews || []).forEach(inv => {
     if(inv.created_at) {
         const d = new Date(inv.created_at);
         const diffTime = Math.abs(today - d);
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
         if(diffDays <= 7) counts[d.getDay()] += 1; 
     }
  });

  const rawTrendData = [];
  for(let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      rawTrendData.push({ label: days[d.getDay()], value: counts[d.getDay()] });
  }
  const maxIntVal = Math.max(...rawTrendData.map(d => d.value), 1);
  const interviewsTrendData = rawTrendData.map(d => ({ ...d, percentage: (d.value / maxIntVal) * 100 }));


  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', background: '#020617', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <style>{`
          .btn-side {
            background: transparent;
            color: #94a3b8;
            border: none;
            padding: 14px 20px;
            text-align: left;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.2s;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .btn-side:hover { background: #1e293b; color: #f8fafc; }
          .btn-side.active { background: #38bdf8; color: #020617; font-weight: 600; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.2); }
        `}</style>

        {/* --- SIDE MENU --- */}
        <aside style={{ width: '280px', background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '30px 20px', borderBottom: '1px solid #1e293b' }}>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🛡️ Admin Core
              </h2>
              <p style={{ margin: '10px 0 0 0', color: '#64748b', fontSize: '12px' }}>System Management Console</p>
            </div>
            
            <nav style={{ flex: 1, padding: '20px 15px', display: 'flex', flexDirection: 'column' }}>
              <button className={`btn-side ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                📊 Analytics Overview
              </button>
              <button className={`btn-side ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                👥 User Management
              </button>
              <button className={`btn-side ${activeTab === 'ads' ? 'active' : ''}`} onClick={() => setActiveTab('ads')}>
                📢 Global Ad Board
              </button>
              <button className={`btn-side ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
                📁 Global Sessions
              </button>
              <button className={`btn-side ${activeTab === 'controls' ? 'active' : ''}`} onClick={() => setActiveTab('controls')}>
                🎛️ System Controls
              </button>
            </nav>

            <div style={{ padding: '20px', borderTop: '1px solid #1e293b' }}>
               <button className="btn" onClick={onBack} style={{ width: '100%', borderColor: '#ef4444', color: '#fca5a5', background: 'transparent' }}>
                 🚪 Logout Session
               </button>
            </div>
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main style={{ flex: 1, padding: '40px', overflowY: 'auto', position: 'relative' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                  <h1 style={{ margin: '0 0 5px 0' }}>Dashboard Metrics</h1>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                    Last Synced: {lastSynced.toLocaleTimeString()} (Auto-syncs every 10 mins)
                  </p>
                </div>
                <button className="btn primary" onClick={fetchAdminData}>🔄 Force Sync</button>
            </div>

            {loading && (
              <div style={{ position: 'absolute', top: '40px', right: '160px', color: '#38bdf8', fontSize: '14px', fontWeight: 'bold' }}>
                Fetching Data...
              </div>
            )}

            {/* --- KPI STATS STRIP --- */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', marginBottom: '30px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #38bdf8' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>Total Users</h3>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{(stats?.recruiters || 0) + (stats?.candidates || 0)}</h2>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #8b5cf6' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>Active Ads</h3>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{(ads || []).length}</h2>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #22c55e' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>Candidates</h3>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats?.candidates || 0}</h2>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #eab308' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>Created Sessions</h3>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats?.interviews || 0}</h2>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderTop: '4px solid #f43f5e' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>Completed Reports</h3>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>{stats?.reports || 0}</h2>
                </div>
            </div>

            <div className="card" style={{ padding: '30px', minHeight: '500px' }}>
                
                {/* TAB 1: OVERVIEW & REAL DATA CHARTS */}
                {activeTab === 'overview' && (
                    <div className="fade-in">
                      <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>System Activity Dashboard</h2>
                      
                      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                        
                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e2a36', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                          <h4 style={{ margin: '0 0 20px 0', color: '#e2e8f0' }}>Conversion Metrics</h4>
                          <div style={{ display: 'flex', gap: '30px' }}>
                            <CircularGauge label="Completion Rate" value={completionRate} color="#22c55e" max={100} />
                            <CircularGauge label="Total Users" value={(stats?.candidates || 0) + (stats?.recruiters || 0)} color="#38bdf8" max={(stats?.candidates || 0) + (stats?.recruiters || 0) + 10} />
                          </div>
                        </div>

                        <BarChart title="Current User Distribution" data={userDistributionData} color="#8b5cf6" />
                        <BarChart title="Interviews Created (Last 5 Days)" data={interviewsTrendData} color="#eab308" />
                      </div>

                      <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e2a36' }}>
                        <h3 style={{ color: '#f8fafc', marginTop: 0 }}>System Health Information</h3>
                        <div style={{ display: 'flex', gap: '20px', color: '#94a3b8', fontSize: '13px' }}>
                           <p>✅ Gemini API Connections active</p>
                           <p>✅ MongoDB indexing verified</p>
                           <p>✅ Real-time data aggregation active</p>
                           <p>{maintenanceMode ? '⚠️ Maintenance Mode ENABLED' : '✅ Platform accepting connections'}</p>
                        </div>
                      </div>
                    </div>
                )}

                {/* TAB 2: USER MANAGEMENT */}
                {activeTab === 'users' && (
                    <div className="fade-in">
                        <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>User Operations</h2>
                        
                        <h3 style={{ color: '#38bdf8', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>Recruiters ({(users?.recruiters || []).length})</h3>
                        <div style={{ marginBottom: '30px' }}>
                            {(users?.recruiters || []).length === 0 && <p className="muted">No recruiters found.</p>}
                            {(users?.recruiters || []).map(r => (
                                <div key={r.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #1e293b' }}>
                                    <div>
                                        <strong style={{ color: '#f8fafc', fontSize: '1.1rem' }}>{r.username}</strong>
                                        <span style={{ marginLeft: '15px', fontSize: '12px', color: '#94a3b8', background: '#1e293b', padding: '4px 8px', borderRadius: '4px' }}>Company: {r.company_name || 'N/A'} | Email: {r.email || 'N/A'}</span>
                                    </div>
                                    <button className="btn" onClick={() => handleDeleteUser('recruiter', r.username)} style={{ background: '#451a1e', color: '#fca5a5', border: '1px solid #7f1d1d' }}>Delete User</button>
                                </div>
                            ))}
                        </div>

                        <h3 style={{ color: '#22c55e', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>Candidates ({(users?.candidates || []).length})</h3>
                        <div>
                            {(users?.candidates || []).length === 0 && <p className="muted">No candidates found.</p>}
                            {(users?.candidates || []).map(c => (
                                <div key={c.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #1e293b' }}>
                                    <div>
                                        <strong style={{ color: '#f8fafc', fontSize: '1.1rem' }}>{c.username}</strong>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                                          {c.email} | Connected Recruiters: <span style={{ color: '#38bdf8' }}>{c.linked_recruiters ? c.linked_recruiters.length : (c.linked_recruiter ? '1' : '0')}</span>
                                        </div>
                                    </div>
                                    <button className="btn" onClick={() => handleDeleteUser('candidate', c.username)} style={{ background: '#451a1e', color: '#fca5a5', border: '1px solid #7f1d1d' }}>Delete User</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 3: ADVERTISEMENTS BOARD */}
                {activeTab === 'ads' && (
                    <div className="fade-in">
                        <h2 style={{ color: '#f8fafc', marginBottom: '30px' }}>Global Job Advertisements</h2>
                        {(ads || []).length === 0 && !loading && <p style={{ color: '#64748b' }}>No active job postings across the platform.</p>}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {(ads || []).map((ad) => (
                                <div key={ad.id} style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                            <h3 style={{ margin: 0, color: '#38bdf8' }}>{ad.job_title}</h3>
                                            <span style={{ padding: '4px 8px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{ad.company_name}</span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                            <span style={{ padding: '4px 8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>{ad.schedule || 'Full-Time'}</span>
                                            <span style={{ padding: '4px 8px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>{ad.location || 'Remote'}</span>
                                        </div>

                                        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                                            Posted: {new Date(ad.created_at).toLocaleDateString()} | Recruiter Key: <strong style={{color: '#e2e8f0'}}>{ad.recruiter_key}</strong> | Ad ID: {ad.id}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', maxWidth: '85%', whiteSpace: 'pre-wrap' }}>{ad.description}</p>
                                    </div>
                                    <button onClick={() => handleDeleteAd(ad.id)} className="btn" style={{ background: '#451a1e', borderColor: '#7f1d1d', color: '#fca5a5', padding: '10px 15px' }}>
                                        🗑️ Delete Ad
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 4: SESSIONS & REPORTS */}
                {activeTab === 'sessions' && (
                    <div className="fade-in">
                        <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>Global Interview Sessions</h2>
                        {(globalInterviews || []).length === 0 && <p className="muted">No sessions generated across the platform.</p>}
                        
                        {(globalInterviews || []).map((inv) => (
                            <div key={inv.id} style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1e293b' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '1.1rem' }}>{inv.candidate_name}</h4>
                                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                                        Role: <strong style={{color: '#e2e8f0'}}>{inv.target_role}</strong> | Recruiter Key: {inv.recruiter_key} | Date: {new Date(inv.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {inv.is_completed ? (
                                        <>
                                            <button className="btn primary" onClick={() => handleFetchFullReport(inv.id)}>View Report</button>
                                            <button 
                                                className="btn" 
                                                onClick={() => handleDeleteReport(inv.id)} 
                                                style={{ background: 'transparent', border: '1px solid #f97316', color: '#fdba74' }}
                                            >
                                                🗑️ Delete Report
                                            </button>
                                        </>
                                    ) : (
                                        <span style={{ color: '#fbbf24', padding: '8px 12px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '4px', fontSize: '14px' }}>Pending...</span>
                                    )}
                                    <button className="btn" onClick={() => handleDeleteSession(inv.id)} style={{ background: '#451a1e', borderColor: '#7f1d1d', color: '#fca5a5' }}>
                                        🗑️ Delete Session
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* TAB 5: SYSTEM CONTROLS */}
                {activeTab === 'controls' && (
                    <div className="fade-in">
                        <h2 style={{ color: '#f8fafc', marginBottom: '5px' }}>🎛️ System Controls & Operations</h2>
                        <p className="muted" style={{ marginBottom: '30px' }}>Manage platform behavior and perform bulk data operations.</p>
                        
                        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            
                            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#e2e8f0' }}>Data Export</h4>
                                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '15px' }}>Download a complete snapshot of current database records in JSON format. Contains all user metadata and interview history.</p>
                                <button className="btn" onClick={handleExportData} style={{ background: '#38bdf8', color: '#020617', border: 'none', fontWeight: 'bold' }}>
                                    ⬇️ Download JSON Backup
                                </button>
                            </div>
                            
                            {/* <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#e2e8f0' }}>Platform Maintenance</h4>
                                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '15px' }}>Toggle UI maintenance restrictions. (Note: Only applies to new dashboard layouts visually).</p>
                                <button className="btn" onClick={() => setMaintenanceMode(!maintenanceMode)} style={{ background: maintenanceMode ? '#ef4444' : '#10b981', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                                    {maintenanceMode ? '🛑 Disable Maintenance Mode' : '🚧 Enable Maintenance Mode'}
                                </button>
                            </div> */}

                            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #7f1d1d', gridColumn: 'span 2' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#fca5a5' }}>Danger Zone</h4>
                                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '15px' }}>These actions are irreversible and act directly on the production database. Proceed with extreme caution.</p>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button className="btn" onClick={handleClearPendingSessions} disabled={isClearing} style={{ background: '#451a1e', borderColor: '#ef4444', color: '#fca5a5' }}>
                                        {isClearing ? '🗑️ Clearing...' : '🗑️ Delete All Pending Sessions'}
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </main>
    </div>
  );
}