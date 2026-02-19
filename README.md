# spotify_clone_test

Initial scaffold for a Spotify web clone with a Node.js/Express backend, MongoDB, and a Vue frontend.

## Project structure

- `server/` - Express API with MongoDB (Mongoose)
- `client/` - Vue 3 frontend (Vite)

## Backend setup

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The API exposes a basic health check at `GET /health`.

## Frontend setup

```bash
cd client
npm install
npm run dev
```
