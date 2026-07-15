# ForgeNet Setup Guide

## Prerequisites

Before running ForgeNet, install:

- Node.js
- npm
- Git

## Clone the repository

```bash
git clone <repository-url>
cd ForgeNet
```

Replace `<repository-url>` with the actual GitHub repository URL.

## Frontend setup

Move into the client directory:

```bash
cd client
```

Install the frontend dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

## Backend setup

Open another terminal and move into the server directory:

```bash
cd server
```

Install the backend dependencies:

```bash
npm install
```

Create `.env` by copying `.env.example`, then provide the required values:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

Start the backend development server:

```bash
npm run dev
```

The backend runs at:

```text
http://localhost:5000
```

## Verify the backend

Send a GET request to:

```text
http://localhost:5000/api/v1/health
```

A successful request returns `200 OK`.