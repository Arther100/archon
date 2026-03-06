import React from 'react'

export default function TestCasesView({ testCases }) {
  if (!testCases || testCases.length === 0) {
    return <div style={{ padding: 24, color: '#8896b3' }}>No test cases generated for this module.</div>
  }
  return (
    <div style={{ padding: 24, overflowY: 'auto', maxHeight: '100%' }}>
      <h2 style={{ fontSize: '1.1rem', color: '#f0f4ff', marginBottom: 18 }}>🧪 Test Case Summary</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
        <thead>
          <tr style={{ background: '#1e2a3d', color: '#c7d3e8' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #222b3a' }}>Title</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #222b3a' }}>Description</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #222b3a' }}>Steps</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #222b3a' }}>Expected Result</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #1e2a3d' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f0f4ff' }}>{tc.title}</td>
              <td style={{ padding: '10px 12px', color: '#c7d3e8' }}>{tc.description}</td>
              <td style={{ padding: '10px 12px', color: '#a5b4d8' }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {tc.steps && tc.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ul>
              </td>
              <td style={{ padding: '10px 12px', color: '#4ade80' }}>{tc.expected_result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
