import React from 'react';

export default function LandingPage({ onStartCandidate, onStartRecruiter, onStartAdmin }) {
  return (
    <div className="shell" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
      
      {/* DISCREET ADMIN LINK (Top Left) */}
      <div 
        onClick={onStartAdmin} 
        style={{ position: 'absolute',padding: '5px', top: '15px', left: '20px', fontSize: '1.3rem', background: '#006aff', color: '#ffffff', cursor: 'pointer', opacity: 0.6, userSelect: 'none' }}
        title="Admin Portal"
      >
        Admin
      </div>

      <div className="card" style={{ padding: '40px', maxWidth: '500px', width: '100%' }}>
        <h1 style={{ marginBottom: '10px', color: '#f8fafc' }}>AI Interview System</h1>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Secure portals for candidates and recruiters.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button className="btn primary" onClick={onStartCandidate} style={{ padding: '15px', fontSize: '1.1rem' }}>
            👨‍💻 Candidate Portal
          </button>
          
          <button className="btn" onClick={onStartRecruiter} style={{ padding: '15px', fontSize: '1.1rem', background: '#1e293b', borderColor: '#334155' }}>
            🏢 Recruiter Portal
          </button>
        </div>
      </div>
    </div>
  );
}