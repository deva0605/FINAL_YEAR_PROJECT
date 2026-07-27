import { useState } from 'react'
import './App.css'

function App() {
  const [query, setQuery] = useState("What's our risk exposure in AAPL, MSFT?")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState("")

  const fetchAnalysis = async () => {
    setLoading(true)
    setReport("")
    try {
      // Step 1: Hit the Retrieve Endpoint
      const retrieveRes = await fetch(`http://localhost:8000/retrieve/retrieve?query=${encodeURIComponent(query)}`)
      const retrieveData = await retrieveRes.json()

      if (retrieveData.error) {
        setReport(`Error: ${retrieveData.error}`)
        setLoading(false)
        return
      }

      // Step 2: Hit the Analyze Endpoint
      const analyzeRes = await fetch("http://localhost:8000/analyze/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: retrieveData })
      })
      const analyzeData = await analyzeRes.json()

      setReport(analyzeData.summary || "No summary generated.")
    } catch (error) {
      setReport("Connection failed. Make sure your FastAPI backend is running on port 8000.")
      console.error(error)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>🧠 Morning Market Brief</h1>
      
      <div style={{ display: "flex", gap: "10px", marginBottom: "2rem" }}>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: "10px", fontSize: "16px", borderRadius: "8px", border: "1px solid #ccc" }}
        />
        <button 
          onClick={fetchAnalysis} 
          disabled={loading}
          style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer", borderRadius: "8px" }}
        >
          {loading ? "Analyzing..." : "Get Brief"}
        </button>
      </div>

      {report && (
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "8px", textAlign: "left", color: "#333" }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
            {report}
          </pre>
        </div>
      )}
    </div>
  )
}

export default App