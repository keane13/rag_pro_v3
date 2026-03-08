# RAG Policy Intelligence

A comprehensive Retrieval-Augmented Generation (RAG) system with built-in evaluation, guardrails, and real-time monitoring.

## Features

- **Document Ingestion**: Upload and automatically index documents (PDF, Word, TXT, Images) using Weaviate Vector Database.
- **Advanced LLM Support**: Supports various LLMs including OpenAI, Groq, and OpenRouter for both text and vision queries.
- **Arize Phoenix Monitoring**: Real-time tracing and monitoring of LLM calls, latency, and token costs.
- **RAGAS Evaluation**: Integrated evaluation framework capturing metrics like Context Precision, Answer Relevancy, and Faithfulness.
- **NeMo Guardrails**: Secure LLM operations with Input and Output filtering to prevent prompt injection and disallowed topics.
- **Modern Dashboard UI**: Next.js React frontend to interact with the chatbot, view documents, and check realtime performance metrics.

## Tech Stack

### Backend
- **FastAPI**: High-performance API framework.
- **LangChain**: LLM orchestration.
- **Weaviate**: Vector Database for document semantic search.
- **Arize Phoenix**: LLM Observability.
- **NeMo Guardrails**: Security.
- **SQLite / PostgreSQL**: Relational database for User Authentication and Chat History.

### Frontend
- **Next.js / React**: Web framework.
- **Tailwind CSS**: Styling.
- **Framer Motion**: Animations.
- **Lucide React**: Iconography.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Weaviate Instance (Cloud or Local Docker)

### 1. Clone the repository
```bash
git clone https://github.com/keane13/rag_pro_v3.git
cd rag_pro_v3
```

### 2. Backend Setup
Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Set up your `.env.local` file at the project root:
```env
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
WEAVIATE_URL=your_weaviate_url
WEAVIATE_API_KEY=your_weaviate_api_key
PHOENIX_API_KEY=your_arize_phoenix_key
```

Run the FastAPI server:
```bash
uvicorn src.interface.api:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup
Open a new terminal and navigate to the frontend folder:
```bash
cd frontend
npm install
```

Start the Next.js development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## API Documentation
Once the backend is running, visit `http://localhost:8000/docs` for the interactive Swagger UI API documentation.
