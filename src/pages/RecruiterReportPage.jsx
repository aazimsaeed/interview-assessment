import React, { useState } from 'react';

export default function RecruiterReportPage() {
  const [interviewId, setInterviewId] = useState("");
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    if (!interviewId.trim()) {
      setError("Please enter an Interview ID.");
      return;
    }

    setIsLoading(true);
    setError("");
    setReportData(null);

    try {
      // Fetch the completed report from the FastAPI backend
      const response = await fetch(`http://localhost:8000/api/reports/${interviewId}`);
      
      if (!response.ok) {
        throw new Error("Report not found. The candidate may not have finished yet.");
      }

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-center shell" style={{ alignItems: reportData ? 'stretch' : 'center', padding: '20px' }}>
      
      {/* Search Input Section */}
      {!reportData && (
        <div className="setup-card" style={{ maxWidth: '400px', textAlign: 'center', margin: 'auto' }}>
          <h2>Lookup Candidate Report</h2>
          <p style={{ color: '#9fb0c3', marginBottom: '20px' }}>
            Enter the Interview ID to view the candidate's final AI assessment.
          </p>
          
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label>Interview ID:</label>
            <input 
              type="text" 
              placeholder="e.g. 12345-abcde" 
              value={interviewId} 
              onChange={(e) => {
                setInterviewId(e.target.value);
                if (error) setError(""); 
              }}
              style={{ borderColor: error ? '#ef4444' : '' }}
            />
            {error && <span style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px', display: 'block' }}>{error}</span>}
          </div>

          <button className="btn primary block" onClick={fetchReport} disabled={isLoading || !interviewId.trim()}>
            {isLoading ? "Fetching..." : "View Report"}
          </button>
        </div>
      )}

      {/* Report Display Section (Reused from DashboardPage) */}
      {reportData && (
        <main className="app interview-container" style={{ display: 'block', background: 'white', color: 'black', borderRadius: '12px' }}>
          <section className="card report-section" style={{ padding: '30px', background: 'white', maxWidth: '1000px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Performance Report: {reportData.candidate_name}</h2>
              <button className="btn" onClick={() => setReportData(null)} style={{ background: '#0f1720', color: 'white' }}>
                Search Another
              </button>
            </div>
            
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px' }}>
              <div>
                <h3>Quantitative Metrics</h3>
                <div className="kv">
                  <span className="muted">Final Confidence Score</span>
                  <b style={{ fontSize: '1.5em' }} className={reportData.metrics.confidenceScore > 70 ? 'text-green' : 'text-red'}>
                    {reportData.metrics.confidenceScore}/100
                  </b>
                </div>
                <div className="kv"><span className="muted">Speech Pace</span><b>{reportData.metrics.speech?.wpm || 0} WPM</b></div>
                <div className="kv"><span className="muted">Filler Words</span><b>{reportData.metrics.speech?.fillerCount || 0}</b></div>
                <div className="kv"><span className="muted">Eye Contact</span><b>{reportData.metrics.eyeContactPercentage}%</b></div>
                <div className="kv"><span className="muted">Happy Expression</span><b>{reportData.metrics.facialExpressionFrequency.happy}%</b></div>
                <div className="kv"><span className="muted">Nervous Expression</span><b>{reportData.metrics.facialExpressionFrequency.nervous}%</b></div>
                <div className="kv"><span className="muted">Duration</span><b>{reportData.duration} seconds</b></div>
              </div>
              
              <div>
                <h3>Detailed Feedback</h3>
                <h4 className="text-green" style={{ marginTop: '10px' }}>Strengths</h4>
                <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>{reportData.report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                
                <h4 className="text-red">Areas for Improvement</h4>
                <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>{reportData.report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
                
                <h4 className="text-blue">Suggestions</h4>
                <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>{reportData.report.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}