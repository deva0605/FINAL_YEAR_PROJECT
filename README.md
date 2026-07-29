# 📈 Market Intelligence & Multi-Agent AI Finance Assistant

> **An institutional-grade financial analytics and market intelligence platform** for **Indian (NSE/BSE)** and **global financial markets**, powered by **FastAPI**, **React**, **Google Gemini AI**, and **Retrieval-Augmented Generation (RAG)**.

---

## 🚀 Overview

This platform combines **real-time market data**, **AI-powered financial analysis**, **news intelligence**, and **risk assessment** into a unified dashboard.

It leverages a **multi-agent architecture** where specialized AI agents collaborate to:

- 📊 Analyze live stock market data
- 📰 Summarize financial news
- ⚠️ Generate investment risk briefs
- 🤖 Answer market-related queries using RAG
- 📈 Deliver institutional-style market intelligence

---

# 🏗️ Architecture

```text
                  ┌──────────────────────────┐
                  │     React Dashboard      │
                  │ (Vite + Tailwind CSS)    │
                  └─────────────┬────────────┘
                                │
                         REST API Calls
                                │
                  ┌─────────────▼────────────┐
                  │      FastAPI Server      │
                  │     (Orchestrator)       │
                  └─────────────┬────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
        ▼                       ▼                        ▼
  📈 Stock Agent          📰 News Agent           📚 RAG Agent
   (yfinance)          (Web Scraping)          (Knowledge Base)
                                │
                                ▼
                     🤖 Google Gemini AI
                                │
                                ▼
                  📊 Financial Insights & Reports
```

---

# 🛠 Tech Stack

| Layer | Technologies |
|--------|--------------|
| **Backend** | FastAPI, Python |
| **Frontend** | React (Vite), Tailwind CSS |
| **AI** | Google Gemini |
| **Market Data** | yfinance |
| **Knowledge Retrieval** | RAG |
| **News Processing** | Web Scraping |
| **API Communication** | REST APIs |

---

# ✨ Features

- 📈 Live NSE/BSE stock tracking
- 🌍 Global market monitoring
- 🤖 AI-powered financial assistant
- 📰 Real-time financial news aggregation
- 📚 Retrieval-Augmented Generation (RAG)
- ⚠️ AI-generated investment risk analysis
- 📊 Interactive stock dashboard
- 🔍 Company snapshot evaluation
- ⚡ FastAPI backend with modular multi-agent architecture
- 🎨 Responsive React UI built with Tailwind CSS

---

# 📂 Project Structure

```text
FINAL_YEAR_PROJECT
│
├── agents/                 # AI agents
│
├── orchestrator/           # FastAPI backend
│
├── frontend/               # React + Vite application
│
├── requirements.txt
├── .env
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

Make sure the following tools are installed:

- Python **3.10+**
- Node.js **18+**
- npm

---

# 1️⃣ Clone the Repository

```bash
git clone https://github.com/DeveshBanote/FINAL_YEAR_PROJECT.git

cd FINAL_YEAR_PROJECT
```

---

# 2️⃣ Backend Setup (FastAPI)

### Create a Virtual Environment

**PowerShell**

```powershell
python -m venv .venv

Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

.\.venv\Scripts\Activate.ps1
```

---

### Install Dependencies

```powershell
pip install -r requirements.txt
```

---

### Configure Environment Variables

Create a `.env` file in the project root.

```text
FINAL_YEAR_PROJECT/.env
```

Add your Google Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note**
>
> Do **not** surround the API key with quotation marks.

---

### Start the Backend Server

```powershell
uvicorn orchestrator.orchestrator:app --reload --port 8000
```

The FastAPI server will be available at:

```text
http://localhost:8000
```

---

# 3️⃣ Frontend Setup (React + Vite)

Open a **new terminal**.

Navigate to the frontend folder:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

The React application will be available at:

```text
http://localhost:5173
```

---

# 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API Key |

---

# 🌐 Running the Application

| Service | URL |
|----------|-----|
| Backend API | http://localhost:8000 |
| Frontend | http://localhost:5173 |

---

# 🤝 Contributing

1. Fork the repository
2. Create a new feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

# 📜 License

This project is developed as part of a **Final Year Engineering Project**.

---

## 👨‍💻 Author

**Devesh Banote**

Built with ❤️ using **FastAPI**, **React**, **Google Gemini AI**, and **Modern Web Technologies**.