<script setup></script>

<template>
  <main class="app">
    <div class="layout">
      <aside class="sidebar">
        <div class="logo">
          <span class="logo-dot" aria-hidden="true"></span>
          <span>Spotify</span>
        </div>
        <nav class="nav">
          <button class="nav-link active" type="button">Home</button>
          <button class="nav-link" type="button">Search</button>
          <button class="nav-link" type="button">Your Library</button>
        </nav>
        <div class="playlist-section">
          <p class="section-title">Playlists</p>
          <ul class="playlist-list">
            <li>Daily Mix 1</li>
            <li>Chill Hits</li>
            <li>Top 50 - Global</li>
            <li>Focus Flow</li>
            <li>Throwback Thursday</li>
          </ul>
        </div>
        <button class="create-playlist">+ Create Playlist</button>
      </aside>

      <section class="content">
        <header class="topbar">
          <div class="nav-buttons">
            <button class="icon-button" aria-label="Go back">
              <span aria-hidden="true">‹</span>
            </button>
            <button class="icon-button" aria-label="Go forward">
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div class="search">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              placeholder="What do you want to listen to?"
              aria-label="Search"
            />
          </div>
          <button class="profile">
            <span class="profile-dot" aria-hidden="true"></span>
            <span>Guest</span>
          </button>
        </header>

        <div class="content-body">
          <section class="highlight">
            <p class="label">Recently Played</p>
            <h1>Good afternoon</h1>
            <p class="subtitle">Jump back into your favorite albums and playlists.</p>
            <button class="primary">Play All</button>
          </section>

          <section class="grid-section">
            <h2>Made for you</h2>
            <div class="card-grid">
              <article class="card">
                <div class="card-image">Daily Mix</div>
                <h3>Daily Mix 4</h3>
                <p>Moody, mellow, and thoughtful.</p>
              </article>
              <article class="card">
                <div class="card-image">Chill</div>
                <h3>Chill Vibes</h3>
                <p>Take it easy with relaxed beats.</p>
              </article>
              <article class="card">
                <div class="card-image">Focus</div>
                <h3>Focus Flow</h3>
                <p>Stay in the zone without distraction.</p>
              </article>
              <article class="card">
                <div class="card-image">Indie</div>
                <h3>Indie Pop</h3>
                <p>New music and rising indie artists.</p>
              </article>
            </div>
          </section>

          <section class="grid-section">
            <h2>Popular albums</h2>
            <div class="card-grid">
              <article class="card">
                <div class="card-image">Top 50</div>
                <h3>Top 50 Global</h3>
                <p>The hottest tracks right now.</p>
              </article>
              <article class="card">
                <div class="card-image">Acoustic</div>
                <h3>Acoustic Hits</h3>
                <p>Smooth acoustic favorites.</p>
              </article>
              <article class="card">
                <div class="card-image">Workout</div>
                <h3>Workout Energy</h3>
                <p>High tempo, high energy.</p>
              </article>
              <article class="card">
                <div class="card-image">Throwback</div>
                <h3>Throwback Mix</h3>
                <p>Classic tracks you love.</p>
              </article>
            </div>
          </section>
        </div>
      </section>
    </div>

    <footer class="player">
      <div class="now-playing">
        <div class="album-art"></div>
        <div>
          <p class="track">Dreaming Awake</p>
          <p class="artist">Nova Echo</p>
        </div>
      </div>
      <div class="controls">
        <div class="control-row">
          <button class="icon-button" aria-label="Shuffle">⟲</button>
          <button class="icon-button" aria-label="Previous track">⟸</button>
          <button class="play" aria-label="Play">▶</button>
          <button class="icon-button" aria-label="Next track">⟹</button>
          <button class="icon-button" aria-label="Repeat">⟳</button>
        </div>
        <div class="progress">
          <span>1:12</span>
          <div class="progress-bar">
            <span class="progress-fill"></span>
          </div>
          <span>3:48</span>
        </div>
      </div>
      <div class="volume" role="group" aria-label="Volume controls">
        <span aria-hidden="true">🔊</span>
        <div class="volume-bar">
          <span class="volume-fill"></span>
        </div>
      </div>
    </footer>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background: #0e0f11;
  color: #f5f5f5;
}

.app {
  font-family: "Helvetica Neue", system-ui, sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 240px;
  padding: 2rem 1.5rem;
  background: #0b0b0c;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 700;
  font-size: 1.4rem;
}

.logo-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1db954;
  box-shadow: 0 0 12px rgba(29, 185, 84, 0.6);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nav-link {
  background: none;
  border: none;
  color: #c7c7c7;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
  font-weight: 600;
  text-align: left;
  padding: 0;
}

.nav-link.active,
.nav-link:hover {
  color: #ffffff;
}

.playlist-section {
  flex: 1;
}

.section-title {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.7rem;
  color: #8a8a8a;
  margin-bottom: 1rem;
}

.playlist-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
  color: #b0b0b0;
  font-size: 0.95rem;
}

.create-playlist {
  background: transparent;
  border: 1px solid #2b2b2b;
  color: #f5f5f5;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 2rem 2.5rem;
  background: linear-gradient(180deg, #1a1d22 0%, #0f1115 55%, #0c0d10 100%);
  overflow-y: auto;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.nav-buttons {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  display: grid;
  place-items: center;
}

.search {
  flex: 1;
  background: #24262c;
  border-radius: 999px;
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  gap: 0.5rem;
}

.search input {
  background: transparent;
  border: none;
  outline: none;
  color: #f5f5f5;
  width: 100%;
}

.profile {
  background: #1b1d22;
  border: none;
  color: #f5f5f5;
  border-radius: 999px;
  padding: 0.4rem 0.75rem 0.4rem 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 600;
}

.profile-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #7a7cff;
}

.content-body {
  display: grid;
  gap: 2.5rem;
}

.highlight {
  background: linear-gradient(120deg, rgba(29, 185, 84, 0.18), rgba(11, 14, 18, 0.9));
  padding: 2rem;
  border-radius: 24px;
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.7rem;
  color: #a0a0a0;
}

.highlight h1 {
  margin: 0.4rem 0 0.6rem;
  font-size: 2.5rem;
}

.subtitle {
  color: #d0d0d0;
  max-width: 420px;
  margin-bottom: 1.5rem;
}

.primary {
  background: #1db954;
  border: none;
  color: #0b0b0c;
  padding: 0.75rem 1.6rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}

.grid-section h2 {
  margin: 0 0 1rem;
  font-size: 1.4rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  max-width: 1200px;
}

.card {
  background: #1a1d22;
  border-radius: 18px;
  padding: 1.2rem;
  display: grid;
  gap: 0.6rem;
  min-height: 190px;
}

.card-image {
  height: 90px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(29, 185, 84, 0.8), rgba(73, 97, 252, 0.9));
  display: grid;
  place-items: center;
  font-weight: 700;
}

.card p {
  color: #b8b8b8;
  font-size: 0.9rem;
}

.player {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: #0b0c0f;
  border-top: 1px solid #1f1f1f;
}

.now-playing {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.album-art {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1db954, #0f9d58);
}

.track {
  margin: 0;
  font-weight: 600;
}

.artist {
  margin: 0;
  color: #9e9e9e;
  font-size: 0.85rem;
}

.controls {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.play {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: #1db954;
  color: #0b0b0c;
  font-weight: 700;
  cursor: pointer;
}

.progress {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  color: #9e9e9e;
  font-size: 0.8rem;
}

.progress-bar,
.volume-bar {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: #2c2c2c;
  position: relative;
}

.progress-fill,
.volume-fill {
  position: absolute;
  height: 100%;
  border-radius: inherit;
  background: #1db954;
}

.progress-fill {
  width: 45%;
}

.volume {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  justify-self: end;
}

.volume-bar {
  width: 120px;
}

.volume-fill {
  width: 65%;
}

@media (max-width: 1024px) {
  .layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .playlist-section {
    flex-basis: 100%;
  }

  .player {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .volume {
    justify-self: center;
  }
}
</style>