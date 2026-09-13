# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
- `npm start` - Start both frontend (port 3000) and backend (port 8000) automatically
- `npm run frontend` or `npm run start:frontend-only` - Start React frontend only  
- `npm run backend` or `npm run start:backend-only` - Start FastAPI backend only
- `./start_backend.sh` - Direct backend startup script

### Development Tools
- `npm run lint` - Run ESLint on source files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm test` - Run React tests
- `npm run build` - Build production React app
- `npm run clean` - Remove build artifacts and node_modules
- `npm run setup` - Install both Node.js and Python dependencies

### Testing and Deployment
- `npm run start:public` - Start with public tunneling (localtunnel)
- `npm run tunnel:frontend` - Tunnel frontend only  
- `npm run tunnel:backend` - Tunnel backend only

## Architecture Overview

This is a full-stack PDF-to-JSON conversion application for financial documents, specifically designed for Korean financial products like 채권선도 (Bond Forward) and FRN (Floating Rate Note).

### Technology Stack
- **Frontend**: React 19 with modern CSS, PDF.js for document viewing
- **Backend**: FastAPI with Python, EasyOCR for text extraction, OpenAI GPT for JSON conversion
- **Communication**: WebSocket for real-time OCR progress, REST API for file conversion

### Key Components

#### Backend Services (`backend/services/`)
- `ocr_service.py` - EasyOCR integration for PDF/DOCX text extraction
- `llm_service.py` - OpenAI API integration for text-to-JSON conversion using prompts
- `file_service.py` - File handling, storage, and processing method determination  
- `main.py` - FastAPI application with CORS, WebSocket endpoints, and file upload handling

#### Frontend Components (`src/`)
- `FileConverter.js` - Main component with OCR state management, WebSocket communication, and document viewer
- `App.js` - Root application component
- Two view modes: upload screen and analysis screen with sidebar/main content layout

#### Configuration
- `prompts/prompts.yaml` - LLM prompt templates for different financial product types
- Environment variables: OPENAI_API_KEY (required), file size limits, API URLs
- `requirements.txt` - Python dependencies including FastAPI, EasyOCR, OpenAI, PDF processing libraries

### Data Flow
1. **File Upload**: PDF/DOCX files uploaded via drag-and-drop or file picker
2. **OCR Processing**: Real-time WebSocket communication for progress updates during text extraction
3. **LLM Conversion**: Extracted text sent to OpenAI with product-specific prompts for JSON generation
4. **Result Display**: Split-screen view showing original document and converted JSON
5. **Export**: JSON and TXT file downloads available

### State Management Patterns
- Global OCR state manager for tracking multiple file processing states
- React hooks for UI state synchronization  
- WebSocket connection management with cleanup and error handling
- Automatic backend health checking with retry mechanisms

### API Endpoints
- `POST /api/convert` - Main file conversion endpoint
- `GET /api/download/{file_id}` - Download conversion results
- `WebSocket /ws/ocr-preview` - Real-time OCR progress updates
- `GET /health` - Backend service health check
- `POST /api/ocr-preview` - OCR preview without full conversion

### Environment Setup
- Requires OpenAI API key in `.env` file
- Python virtual environment recommended for backend dependencies
- Supports development with automatic backend/frontend orchestration via npm scripts
- Configurable for public access via localtunnel for remote testing

### Key Features
- Intelligent PDF page rendering with fallback text mode
- Support for both PDF and DOCX file formats
- Product type selection (채권선도/FRN) with specialized JSON schemas
- File size validation (50MB limit) and format verification
- Cross-origin resource sharing configured for multiple host environments
- Automatic OCR execution on file upload with cancellation support