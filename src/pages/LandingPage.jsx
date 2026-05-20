import React from 'react';

export default function LandingPage({ onStartCandidate, onStartRecruiter }) {
  return (
    <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
      <div className="card" style={{ padding: '40px', maxWidth: '500px', width: '100%' }}>
        <h1 style={{ marginBottom: '10px', color: '#f8fafc' }}>AI Interview System</h1>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Secure portals for candidates and recruiters.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* These onClick handlers MUST match the props passed from App.jsx */}
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