# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Privacy Mode & Local LLM**
  - Ollama integration for local embeddings (nomic-embed-text, all-minilm, mxbai-large, bge-m3)
  - ChromaDB local vector store
  - Privacy mode toggle in settings
  - Unified embedding service with OpenAI/Ollama fallback

- **Semantic Clustering**
  - DBSCAN and K-means clustering algorithms
  - LLM-powered cluster naming
  - Cluster visualization on canvas

- **File Handling**
  - PDF text extraction (PyMuPDF)
  - Image OCR (Tesseract)
  - CLIP embeddings for images
  - S3/MinIO storage support

- **Authentication**
  - JWT authentication (access + refresh tokens)
  - PostgreSQL with SQLAlchemy async
  - GitHub OAuth flow
  - Workspace management

- **Frontend Redesign**
  - Professional landing page
  - Login/Register pages
  - Dashboard with workspace management
  - Infinite canvas with pan/zoom

## [0.1.0] - 2026-02-02

### Added
- 🎉 Initial release
- Infinite 2D canvas workspace
- Semantic gravity physics engine
- OpenAI text-embedding-3-small integration
- Pinecone vector database support
- Real-time multi-user collaboration
- Glassmorphism UI with dark theme
- Docker Compose deployment
