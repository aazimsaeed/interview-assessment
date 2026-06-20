import React, { useState, useEffect } from 'react';

export default function LandingPage({ onStartCandidate, onStartRecruiter, onStartAdmin }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/advertisements")
      .then(res => res.json())
      .then(data => setAds(data))
      .catch(err => console.error("Failed to load ads", err));
  }, []);

  const handleApplyClick = (ad) => {
    localStorage.setItem("pendingApplication", JSON.stringify(ad));
    onStartCandidate();
  };

  const scrollToJobs = () => {
    document.getElementById("job-board").scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#020617', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* --- HERO SECTION --- */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', background: 'radial-gradient(circle at center top, #1e293b 0%, #020617 80%)' }}>
        
        <div style={{ padding: '8px 16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '20px', color: '#38bdf8', fontSize: '14px', marginBottom: '25px', letterSpacing: '1px' }}>
          🚀 THE FUTURE OF HIRING IS HERE
        </div>

        <h1 style={{ fontSize: '4.5rem', fontWeight: '800', marginBottom: '20px', background: 'linear-gradient(to right, #e2e8f0, #38bdf8, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.1' }}>
          Elevate Your Career<br/>With AI Interviews
        </h1>
        
        <p style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '650px', marginBottom: '40px', lineHeight: '1.6' }}>
          Connect directly with top companies. Take AI-driven assessments on your own schedule and land your dream role faster than ever before.
        </p>
        
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn primary" onClick={scrollToJobs} style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8, #2563eb)', border: 'none', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)' }}>
            🔍 View Open Positions
          </button>
          <button className="btn" onClick={onStartCandidate} style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid #334155' }}>
            👨‍💻 Candidate Portal
          </button>
          <button className="btn" onClick={onStartRecruiter} style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid #334155' }}>
            🏢 Recruiter Login
          </button>
        </div>

        <div onClick={onStartAdmin} style={{ marginTop: '50px', fontSize: '13px', color: '#475569', cursor: 'pointer', opacity: 0.8 }}>
           🛡️ Admin Access
        </div>
      </div>

      {/* --- BEAUTIFUL JOB BOARD SECTION --- */}
      <div id="job-board" style={{ minHeight: '100vh', padding: '100px 20px', background: '#0f172a' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '3rem', margin: '0 0 15px 0', color: '#f8fafc' }}>Opportunities Board</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
              Apply instantly. Your profile will be sent to the recruiter, and your AI interview will be generated automatically upon approval.
            </p>
          </div>

          {ads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px', background: '#1e293b', borderRadius: '16px', border: '1px dashed #475569' }}>
              <p style={{ color: '#94a3b8', fontSize: '1.2rem', margin: 0 }}>No open positions currently available. Check back later!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px' }}>
              {ads.map((ad) => (
                <div key={ad.id} style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: '30px', borderRadius: '20px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(56, 189, 248, 0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)'; }}>
                  
                  {/* Company Badge & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                      {ad.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#e2e8f0' }}>{ad.company_name}</h2>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Posted {new Date(ad.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Job Title & Tags */}
                  <h3 style={{ fontSize: '1.6rem', color: '#f8fafc', margin: '0 0 15px 0' }}>{ad.job_title}</h3>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <span style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Full-Time</span>
                    <span style={{ padding: '6px 12px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Remote</span>
                  </div>

                  {/* Description */}
                  <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', flex: 1, marginBottom: '25px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical' }}>
                    {ad.description}
                  </p>
                  
                  {/* Apply Button */}
                  <button onClick={() => handleApplyClick(ad)} className="btn primary" style={{ width: '100%', padding: '15px', borderRadius: '10px', fontSize: '1.1rem', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', border: 'none' }}>
                    Apply for this Role ➔
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}