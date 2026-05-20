import React, { useState } from 'react';

// --- Helper Components for the Dashboard ---

// 1. Circular Gauge Component
const CircularGauge = ({ label, value, color }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

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
          {value}%
        </text>
      </svg>
      <span style={{ color: '#9fb0c3', fontSize: '12px', marginTop: '8px', fontWeight: '500', textAlign: 'center' }}>{label}</span>
    </div>
  );
};

// 2. Simple Mock Chart Placeholder
const MockChart = ({ title, color, dataPoints }) => (
  <div style={{ background: '#0a0f14', border: '1px solid #1e2a36', borderRadius: '8px', padding: '15px', height: '160px', position: 'relative' }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#9fb0c3' }}>{title}</h4>
    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100px', gap: '4px' }}>
      {dataPoints.map((val, i) => (
        <div key={i} style={{ flex: 1, background: color, height: `${val}%`, borderRadius: '2px 2px 0 0', opacity: 0.8 }} />
      ))}
    </div>
  </div>
);

// --- Main Dashboard Component ---

export default function DashboardPage({ studentName, report, onExit }) {
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!report) {
    return (
      <div className="flex-center shell">
        <h2>Loading Report...</h2>
      </div>
    );
  }

  // --- MAP REAL DATA VALUES FOR GAUGES ---
  const realConfidence = report?.metrics?.confidenceScore || 0;
  const realFocus = report?.metrics?.eyeContactPercentage || 0;
  const realStress = report?.metrics?.facialExpressionFrequency?.nervous || 0;

  // --- EXTRACT REAL TIMELINE & SNAPSHOT DATA ---
  const timelineData = report?.report?.timeline || report?.timeline || [];
  const snapshotsData = report?.report?.snapshots || report?.snapshots || [];

  // --- DYNAMIC PDF DOWNLOAD LOGIC ---
  const handleDownloadPDF = () => {
    setIsDownloading(true);
    const element = document.getElementById('report-content');
    
    const generate = () => {
      const opt = {
        margin:       0.3,
        filename:     `${studentName}_Interview_Report.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      window.html2pdf().set(opt).from(element).save().then(() => {
        setIsDownloading(false);
      });
    };

    // Dynamically load the library so you don't need to npm install anything
    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = generate;
      document.body.appendChild(script);
    } else {
      generate();
    }
  };

  // Helper to highlight stuttering/filler words
  const highlightStuttering = (text) => {
    if (!text) return <span dangerouslySetInnerHTML={{ __html: "(No audible answer detected)" }} />;
    const fillers = ["um", "uh", "like", "basically", "you know"];
    let highlightedText = text;
    fillers.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<span style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 0 4px; border-radius: 4px;">$&</span>`);
    });
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  // --- DYNAMIC SPEECH ANALYSIS BASED ON REAL DATA ---
  const analyzeDysfluencies = (timeline) => {
    if (!timeline || timeline.length === 0) return ["No spoken answers recorded yet."];

    const dysfluencies = [];
    let totalFillers = 0;
    let repeatedWords = 0;
    const fillers = ["um", "uh", "like", "basically", "you know"];

    timeline.forEach(item => {
      const text = (item.answer || "").toLowerCase();
      
      // Count Fillers manually in timeline to find exact occurrences
      fillers.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) totalFillers += matches.length;
      });

      // Count Stutters/Repeats (e.g., "I I", "the the")
      const words = text.split(/\s+/).map(w => w.replace(/[.,!?]/g, ''));
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i] && words[i] === words[i + 1] && !["that", "had"].includes(words[i])) {
          repeatedWords++;
        }
      }
    });

    if (totalFillers > 5) {
      dysfluencies.push(`Frequent use of filler words (<strong>${totalFillers}</strong> detected in transcript).`);
    } else if (totalFillers > 0) {
      dysfluencies.push(`Occasional use of filler words like "um" or "uh" (<strong>${totalFillers}</strong> detected).`);
    } else {
      dysfluencies.push(`Excellent fluency. No filler words detected in transcript.`);
    }

    if (repeatedWords > 2) {
      dysfluencies.push(`Detected <strong>${repeatedWords}</strong> instances of repeated words or stuttering across answers.`);
    } else if (repeatedWords > 0) {
      dysfluencies.push(`Minor word repetition detected (<strong>${repeatedWords}</strong> times).`);
    } else {
      dysfluencies.push(`No stuttering or repeated words detected.`);
    }

    // Pace Evaluation
    const pace = report.metrics?.speech?.wpm || 0;
    if (pace > 170) {
      dysfluencies.push(`Overall speaking pace was unusually fast (<strong>${pace} WPM</strong>), indicating potential nervousness.`);
    } else if (pace > 0 && pace < 100) {
      dysfluencies.push(`Overall speaking pace was slow (<strong>${pace} WPM</strong>), indicating hesitation or long pauses between thoughts.`);
    } else if (pace > 0) {
      dysfluencies.push(`Healthy and consistent speaking pace (<strong>${pace} WPM</strong>).`);
    }

    return dysfluencies;
  };

  const dynamicDysfluencies = analyzeDysfluencies(timelineData);

  return (
    <main className="app" style={{ display: 'block', minHeight: '100vh', padding: '20px' }}>
      
      {/* HEADER ACTIONS */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 20px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
        <button 
            className="btn" 
            onClick={handleDownloadPDF} 
            disabled={isDownloading}
            style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 'bold' }}
        >
            {isDownloading ? "⏳ Generating PDF..." : "📥 Download PDF"}
        </button>
        <button className="btn primary" onClick={onExit}>← Return to Home</button>
      </div>

      {/* CONTENT TO BE CAPTURED FOR PDF */}
      <div id="report-content" style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: '#0f172a', borderRadius: '12px' }}>
        
        {/* SECTION 1: INTERVIEW SUMMARY CARD */}
        <section className="card" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e2a36', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#f8fafc' }}>{studentName}'s Report</h2>
              <div style={{ color: '#9fb0c3', display: 'flex', gap: '20px', fontSize: '14px' }}>
                <span>📅 Date: {new Date().toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span>⏱️ Duration: {report.duration}s</span>
                <span>📝 Questions: {timelineData.length}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '30px' }}>
              <CircularGauge label="Confidence" value={realConfidence} color="#22c55e" />
              <CircularGauge label="Attention" value={realFocus} color="#38bdf8" />
              <CircularGauge label="Stress / Nervousness" value={realStress} color="#ef4444" />
            </div>
          </div>
        </section>

        {/* SECTION 3: BEHAVIORAL ANALYTICS (CHARTS) */}
        <section className="card" style={{ padding: '30px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc' }}>📊 Behavioral Analytics Timeline</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <MockChart title="Attention Over Time" color="#38bdf8" dataPoints={[60, 80, 90, 85, 95, 100, 80, 90, 70, 85]} />
            <MockChart title="Confidence Over Time" color="#22c55e" dataPoints={[70, 75, 80, 85, 90, 85, 88, 92, 95, 90]} />
            <MockChart title="Nervousness Over Time" color="#ef4444" dataPoints={[40, 30, 20, 15, 10, 15, 25, 10, 5, 10]} />
          </div>
        </section>

        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          
          {/* SECTION 2: Q&A TRANSCRIPT TIMELINE */}
          <section className="card" style={{ padding: '30px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc' }}>💬 Q&A Transcript Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {timelineData.length === 0 ? (
                 <p style={{ color: '#9fb0c3' }}>No questions were answered during this session.</p>
              ) : (
                timelineData.map((item, idx) => (
                  <div key={idx} style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid #1e2a36' }}>
                    
                    <div style={{ background: '#0a0f14', padding: '15px', borderRadius: '8px', border: '1px solid #1e2a36', marginBottom: '15px' }}>
                      <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase' }}>AI Interviewer</span>
                      <p style={{ margin: '8px 0 0 0', color: '#e6edf3' }}>{item.question}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 'bold', textTransform: 'uppercase' }}>Candidate Response</span>
                        <p style={{ margin: '8px 0 15px 0', color: '#9fb0c3', lineHeight: '1.6' }}>
                          {highlightStuttering(item.answer)}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <div style={{ flex: 1 }}><span style={{ fontSize: '10px', color: '#9fb0c3' }}>Confidence</span><div style={{ height: '4px', background: '#22c55e', width: `${item.metrics?.confidence || 0}%`, borderRadius: '2px' }} /></div>
                          <div style={{ flex: 1 }}><span style={{ fontSize: '10px', color: '#9fb0c3' }}>Focus</span><div style={{ height: '4px', background: '#38bdf8', width: `${item.metrics?.focus || 0}%`, borderRadius: '2px' }} /></div>
                          <div style={{ flex: 1 }}><span style={{ fontSize: '10px', color: '#9fb0c3' }}>Stress</span><div style={{ height: '4px', background: '#ef4444', width: `${item.metrics?.stress || 0}%`, borderRadius: '2px' }} /></div>
                        </div>
                      </div>
                      
                      {item.snapshot && (
                        <div style={{ position: 'relative', width: '140px', height: '100px', flexShrink: 0 }}>
                          <img src={item.snapshot} alt="Answer snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #1e2a36' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', padding: '4px', fontSize: '11px', textAlign: 'center', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }}>
                            <span style={{ 
                                color: item.phase === "Nervous" ? '#fca5a5' : 
                                      (item.phase === "Confident" ? '#86efac' : '#38bdf8'),
                                fontWeight: 'bold'
                            }}>
                                {item.phase || 'Focused'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* SECTION 5: STUTTERING & SPEECH SUMMARY */}
            <section className="card" style={{ padding: '30px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#f8fafc' }}>🗣️ Speech & Fluency</h3>
              
              <div className="kv" style={{ marginBottom: '15px' }}>
                <span className="muted">Average Pace</span>
                <b style={{ color: '#e6edf3' }}>{report.metrics.speech?.wpm || 0} WPM</b>
              </div>
              <div className="kv" style={{ marginBottom: '15px' }}>
                <span className="muted">Total Filler Words</span>
                <b style={{ color: '#ef4444' }}>{report.metrics.speech?.fillerCount || 0} Detected</b>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '15px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#fca5a5', fontSize: '13px' }}>Detected Dysfluencies</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#f8fafc', fontSize: '13px', lineHeight: '1.6' }}>
                  {dynamicDysfluencies.map((point, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: point }} />
                  ))}
                </ul>
              </div>
            </section>

            {/* SECTION 4: REAL SNAPSHOT GALLERY */}
            <section className="card" style={{ padding: '30px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#f8fafc' }}>📸 Session Snapshots</h3>
              
              {snapshotsData.length === 0 ? (
                 <p style={{ color: '#9fb0c3', fontSize: '14px' }}>No specific behavior snapshots captured.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {snapshotsData.map((snap, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedSnapshot(snap)}
                      style={{ position: 'relative', cursor: 'pointer', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1e2a36' }}
                    >
                      <img src={snap.url} alt={snap.phase} style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ 
                            color: snap.phase === "Nervous" ? '#fca5a5' : 
                                  (snap.phase === "Confident" ? '#86efac' : '#38bdf8'),
                            fontWeight: 'bold'
                        }}>
                            {snap.phase}
                        </span>
                        <span style={{ color: '#9fb0c3' }}>{snap.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

        </div>
      </div>

      {/* FULL-SIZE SNAPSHOT MODAL */}
      {selectedSnapshot && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedSnapshot(null)}>
          <div style={{ position: 'relative', maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <img src={selectedSnapshot.url} alt="Full size" style={{ width: '100%', borderRadius: '12px', border: '2px solid #38bdf8' }} />
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(15, 23, 32, 0.9)', padding: '15px 25px', borderRadius: '8px', border: '1px solid #1e2a36' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#f8fafc' }}>Phase: {selectedSnapshot.phase}</h3>
              <p style={{ margin: 0, color: '#9fb0c3', fontSize: '13px' }}>Captured at {selectedSnapshot.time}</p>
            </div>
            <button onClick={() => setSelectedSnapshot(null)} style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>✖</button>
          </div>
        </div>
      )}

    </main>
  );
}