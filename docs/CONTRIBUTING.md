# Contributing to Synapse

First off, thank you for considering contributing to Synapse! 🎉

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, screenshots)
- **Describe the behavior you observed and expected**
- **Include your environment details** (OS, browser, Python/Node versions)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed feature**
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Install dependencies**:
   ```bash
   # Backend
   cd synapse-backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt

   # Frontend
   cd synapse-frontend
   npm install
   ```
3. **Make your changes** and add tests if applicable
4. **Run the test suite** to ensure nothing is broken:
   ```bash
   # Backend
   cd synapse-backend && pytest

   # Frontend
   cd synapse-frontend && npm test
   ```
5. **Format your code**:
   ```bash
   # Backend
   black . && isort .

   # Frontend
   npm run lint && npm run format
   ```
6. **Create a Pull Request** with a clear description of changes

## Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (or Docker)
- OpenAI API key (for embeddings)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/your-org/synapse.git
cd synapse

# Start with Docker
docker-compose up -d

# Or run locally (see README.md for details)
```

## Style Guides

### Python

- Follow [PEP 8](https://pep8.org/)
- Use [Black](https://black.readthedocs.io/) for formatting
- Use [isort](https://pycqa.github.io/isort/) for imports
- Write docstrings for all public functions

### TypeScript/React

- Use ESLint with the project configuration
- Use Prettier for formatting
- Prefer functional components with hooks
- Use TypeScript strictly (no `any` types)

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Start with an emoji for categorization:
  - 🎉 `:tada:` Initial commit
  - ✨ `:sparkles:` New feature
  - 🐛 `:bug:` Bug fix
  - 📝 `:memo:` Documentation
  - 🎨 `:art:` Style/format
  - ♻️ `:recycle:` Refactor
  - 🔧 `:wrench:` Configuration
  - ⬆️ `:arrow_up:` Dependencies

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

Thank you for contributing! 💜
