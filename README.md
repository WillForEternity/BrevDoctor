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
- Brev CLI installed (optional - for automatic GPU provisioning)
- Brev account and token (optional - for automatic GPU provisioning)

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

# Brev Token (Optional - for automatic GPU provisioning)
BREV_TOKEN=your_brev_auth_token
```

4. Run the development server:

```bash
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000)

### Getting a Brev Token (for GPU Provisioning)

If you want the app to automatically provision GPUs via Brev CLI, you'll need a Brev authentication token:

#### Option 1: Login via Brev CLI (Recommended)

1. **Install Brev CLI**:

```bash
# macOS/Linux
curl -fsSL https://brev.sh/install.sh | bash

# Or with Homebrew
brew install brevdev/tap/brev
```

2. **Login to Brev**:

```bash
brev login
```

This will open your browser for authentication.

3. **Extract your token**:

After logging in, Brev stores your auth token. You can find it in:
- **macOS/Linux**: `~/.brev/credentials.json`

```bash
cat ~/.brev/credentials.json
```

Look for the `token` field and copy its value.

4. **Add to `.env.local`**:

```env
BREV_TOKEN=your_token_here
```

#### Option 2: Get Token from Brev Console

1. Go to [console.brev.dev](https://console.brev.dev) or [brev.nvidia.com](https://brev.nvidia.com)
2. Sign in to your Brev account
3. Navigate to **Settings** → **API Tokens** or **Developer Settings**
4. Generate a new token or copy your existing token
5. Add it to your `.env.local` file

**Note**: Brev tokens typically expire after 1 hour. The CLI will handle re-authentication automatically, but if you're using a manual token, you may need to refresh it periodically.

**Automatic Token Refresh**: Brev Doctor automatically detects expired tokens and refreshes them using the Brev CLI's refresh mechanism. You don't need to manually update the token - the app will:
- Check token expiration before each API call
- Automatically refresh if expired or expiring within 5 minutes
- Fall back to reading fresh tokens from `~/.brev/credentials.json`
- Retry failed operations with refreshed tokens

#### How Provisioning Works

With `BREV_TOKEN` configured, Brev Doctor can:

1. **Automatically provision GPUs** after analysis
2. **Retry with alternatives** if a GPU is out of stock
3. **Report real-time availability** based on actual provisioning attempts

The agent is given the full list of available Brev GPUs:
- **Blackwell**: B300, B200 (192GB)
- **Hopper**: H200 (141GB), H100 (80GB)  
- **Ampere**: A100, A40, A10, A10G, A6000, A5000, A4000, A16
- **Ada Lovelace**: L40s, L40, L4, RTX 6000/4000 Ada
- **Turing**: T4
- **Volta**: V100
- **Pascal**: P4
- **Maxwell**: M60

If provisioning fails (e.g., GPU out of stock), the agent intelligently selects an alternative GPU and retries.

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
