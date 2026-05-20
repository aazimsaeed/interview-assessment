import React from 'react';

export default function RecruiterOptionsPage({ onSelectOption, onBack }) {
    return (
        <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                
                <button 
                    type="button" 
                    className="btn" 
                    onClick={onBack} 
                    style={{ marginBottom: '20px', display: 'block' }}
                >
                    ← Logout
                </button>
                
                <h2 style={{ marginBottom: '10px', color: '#e6edf3' }}>Select Interview Format</h2>
                <p style={{ color: '#9fb0c3', marginBottom: '30px' }}>Choose the type of assessment you want to create.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <button 
                        className="btn primary" 
                        onClick={() => onSelectOption('voice')} 
                        style={{ padding: '15px', fontSize: '1.1rem' }}
                    >
                        🎙️ AI Based Voice Interview
                    </button>
                    
                    <button 
                        className="btn primary" 
                        onClick={() => onSelectOption('video')} 
                        style={{ padding: '15px', fontSize: '1.1rem', background: '#8b5cf6', color: '#00131a' }}
                    >
                        📹 AI Based Live Video Interview
                    </button>
                </div>

            </div>
        </div>
    );
}