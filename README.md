# Brev Doctor 🩺

AI-powered GPU provisioning tool that analyzes your ML repository and automatically configures the perfect Brev.dev environment.

## Features

- **🔍 Smart Analysis** - AI Scout scans your repo for configs, dependencies, and model architectures
- **🎯 GPU Matching** - Recommends the perfect GPU (L4 to H100) based on your compute needs
- **🚀 One-Click Deploy** - Creates a PR with setup scripts ready for Brev.dev

## Tech Stack

- **Framework:** Next.js 14+ with App Router
- **Auth:** NextAuth.js (GitHub OAuth)
- **AI:** Vercel AI SDK + OpenAI (GPT-4)
- **Styling:** Tailwind CSS
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- GitHub OAuth App credentials
- OpenAI API key

### Setup

1. Clone the repository:

```bash
git clone https://github.com/your-username/brev-doctor.git
cd brev-doctor
```

2. Install dependencies:

```bash
bun install
```

3. Configure environment variables:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:

```env
# GitHub OAuth - Get these from https://github.com/settings/developers
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_generate_with_openssl_rand_base64_32

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key
```

4. Run the development server:

```bash
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/app
  /api/auth/[...nextauth]  - NextAuth.js route handler
  /dashboard               - Dashboard UI entry point
    /actions               - Server actions
/lib
  scout.ts                 - Scout agent (file path filtering)
  specialist.ts            - Specialist agent (compute analysis)
  brev-api.ts              - Brev inventory fetcher
  broker.ts                - Broker agent (GPU matchmaking)
  github.ts                - GitHub API utilities (fork, commit, PR)
/components                - React UI components
/types                     - Zod schemas + TypeScript types
```

## How It Works

1. **Authentication** - User signs in with GitHub OAuth (with repo scope)
2. **Repository Scan** - Fetches the file tree from the selected GitHub repo
3. **Scout Agent** - AI selects relevant files (configs, dependencies, model code)
4. **Specialist Agent** - Analyzes file contents to estimate GPU requirements
5. **Broker Agent** - Matches requirements to Brev.dev GPU inventory
6. **PR Creation** - Creates a pull request with `.brev/setup.sh` and `brev-launchable.yaml`

## Generated Files

### `.brev/setup.sh`

A bash script with environment setup commands:

```bash
#!/bin/bash
set -e
pip install torch transformers
# ... more setup commands
```

### `brev-launchable.yaml`

Brev.dev configuration file:

```yaml
name: brev-launchable
version: "1.0"
compute:
  gpu: A100-80GB
  gpuCount: 1
```

## License

MIT
