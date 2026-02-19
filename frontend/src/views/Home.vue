<script setup>
import { computed, onMounted, ref } from "vue";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const storedUserId = localStorage.getItem("spotifyUserId") || "";

const spotifyUserId = ref(storedUserId);
const UNKNOWN_ARTIST = "Unknown Artist";
const profile = ref(null);
const profileError = ref("");
const isProfileLoading = ref(false);

const searchQuery = ref("");
const searchResults = ref({
  tracks: [],
  artists: [],
  albums: [],
});
const searchError = ref("");
const isSearching = ref(false);

const activeFilter = ref("Playlists");
const librarySearchQuery = ref("");
const sortOrder = ref("Recents");

const isConnected = computed(() => Boolean(spotifyUserId.value));
const displayName = computed(() => profile.value?.display_name || "Guest");
const loginUrl = computed(() => `${API_BASE_URL}/auth/spotify/login`);
const avatarUrl = computed(() => profile.value?.images?.[0]?.url || null);
const avatarInitial = computed(() => (profile.value?.display_name?.[0] || "G").toUpperCase());
const hasResults = computed(
  () =>
    searchResults.value.tracks.length > 0 ||
    searchResults.value.artists.length > 0 ||
    searchResults.value.albums.length > 0
);
const searchSections = computed(() => [
  { title: "Tracks", badge: "Track", items: searchResults.value.tracks },
  { title: "Artists", badge: "Artist", items: searchResults.value.artists },
  { title: "Albums", badge: "Album", items: searchResults.value.albums },
]);

const libraryFilters = ["Playlists", "Artists", "Albums"];

const libraryItems = [
  {
    id: 1,
    name: "Liked Songs",
    type: "Playlist",
    owner: "You",
    shape: "square",
    color: "#4338ca",
    icon: "♥",
  },
  {
    id: 2,
    name: "Daily Mix 1",
    type: "Playlist",
    owner: "Spotify",
    shape: "square",
    color: "#1db954",
    icon: "♫",
  },
  {
    id: 3,
    name: "Chill Hits",
    type: "Playlist",
    owner: "Spotify",
    shape: "square",
    color: "#e91e63",
    icon: "♪",
  },
  {
    id: 4,
    name: "Nova Echo",
    type: "Artist",
    owner: "Artist",
    shape: "circle",
    color: "#ff9800",
    icon: "🎤",
  },
  {
    id: 5,
    name: "Focus Flow",
    type: "Playlist",
    owner: "Spotify",
    shape: "square",
    color: "#00bcd4",
    icon: "🎯",
  },
  {
    id: 6,
    name: "Indie Echo",
    type: "Artist",
    owner: "Artist",
    shape: "circle",
    color: "#9c27b0",
    icon: "🎸",
  },
  {
    id: 7,
    name: "Top 50 - Global",
    type: "Playlist",
    owner: "Spotify",
    shape: "square",
    color: "#f44336",
    icon: "🌍",
  },
  {
    id: 8,
    name: "Throwback Thursday",
    type: "Playlist",
    owner: "You",
    shape: "square",
    color: "#607d8b",
    icon: "⏪",
  },
];

const filteredLibraryItems = computed(() => {
  let items = libraryItems;
  if (activeFilter.value === "Playlists") {
    items = items.filter((i) => i.type === "Playlist");
  } else if (activeFilter.value === "Artists") {
    items = items.filter((i) => i.type === "Artist");
  } else if (activeFilter.value === "Albums") {
    items = items.filter((i) => i.type === "Album");
  }
  if (librarySearchQuery.value.trim()) {
    const q = librarySearchQuery.value.trim().toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(q));
  }
  return items;
});

const formatArtistNames = (artists) => {
  const names = (artists || []).map((artist) => artist?.name).filter(Boolean);
  return names.length ? names.join(", ") : UNKNOWN_ARTIST;
};

const storeSpotifyUserId = (value) => {
  spotifyUserId.value = value;
  if (value) {
    localStorage.setItem("spotifyUserId", value);
  } else {
    localStorage.removeItem("spotifyUserId");
  }
};

const normalizeSearchResults = (payload) => ({
  tracks: (payload?.tracks?.items || []).map((track) => ({
    id: track.id,
    title: track.name,
    subtitle: formatArtistNames(track.artists),
  })),
  artists: (payload?.artists?.items || []).map((artist) => ({
    id: artist.id,
    title: artist.name,
    subtitle: artist.genres?.[0] || "No genre available",
  })),
  albums: (payload?.albums?.items || []).map((album) => ({
    id: album.id,
    title: album.name,
    subtitle: formatArtistNames(album.artists),
  })),
});

const fetchProfile = async () => {
  if (!spotifyUserId.value) {
    return;
  }
  isProfileLoading.value = true;
  profileError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/me?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Unable to load Spotify profile (HTTP ${response.status}).`
      );
    }
    profile.value = await response.json();
  } catch (error) {
    profile.value = null;
    profileError.value = error?.message || "Unable to load Spotify profile.";
  } finally {
    isProfileLoading.value = false;
  }
};

const handleProfileClick = () => {
  if (!isConnected.value) {
    window.location.href = loginUrl.value;
  }
};

const handleSearch = async () => {
  const trimmedQuery = searchQuery.value.trim();
  if (!trimmedQuery) {
    searchError.value = "Enter a search term to look up music.";
    searchResults.value = { tracks: [], artists: [], albums: [] };
    return;
  }
  if (!spotifyUserId.value) {
    searchError.value = "Connect your Spotify account to search.";
    return;
  }
  isSearching.value = true;
  searchError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/search?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}&q=${encodeURIComponent(trimmedQuery)}`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Spotify search failed (HTTP ${response.status}).`
      );
    }
    const payload = await response.json();
    searchResults.value = normalizeSearchResults(payload);
  } catch (error) {
    searchResults.value = { tracks: [], artists: [], albums: [] };
    searchError.value = error?.message || "Spotify search failed.";
  } finally {
    isSearching.value = false;
  }
};

onMounted(() => {
  const url = new URL(window.location.href);
  const userId = url.searchParams.get("spotify_user");
  if (userId) {
    storeSpotifyUserId(userId);
    url.searchParams.delete("spotify_user");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  if (spotifyUserId.value) {
    fetchProfile();
  }
});
</script>

<template>
  <main class="app">
    <header class="topbar">
      <div class="topbar-left">
        <button class="topbar-home-btn" type="button" aria-label="Home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </button>
      </div>
      <div class="topbar-center">
        <form class="search" @submit.prevent="handleSearch">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="What do you want to listen to?"
            aria-label="Search"
            v-model="searchQuery"
          />
          <button class="sr-only" type="submit">Search</button>
        </form>
      </div>
      <div class="topbar-right">
        <button class="topbar-action-btn" type="button" aria-label="Install App">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          <span>Install App</span>
        </button>
        <button class="topbar-icon-btn" type="button" aria-label="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
        </button>
        <button class="topbar-icon-btn" type="button" aria-label="Friends Activity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </button>
        <button class="profile" type="button" @click="handleProfileClick">
          <img v-if="avatarUrl" :src="avatarUrl" class="profile-avatar" alt="Profile avatar" />
          <span v-else class="profile-dot" aria-hidden="true">{{ avatarInitial }}</span>
          <span>{{ isConnected ? displayName : "Connect" }}</span>
        </button>
      </div>
    </header>

    <div class="layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- Your Library panel -->
        <div class="library-panel">
          <div class="library-header">
            <div class="library-title">
              <span class="library-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 22V3h2v19H3zm4 0V3h2v19H7zm4-19h2v13.28a4 4 0 1 0 2 3.5V8.6l5-1.6V4l-7 2.24V19a4 4 0 1 1-2-3.46V3z"/>
                </svg>
              </span>
              <span>Your Library</span>
            </div>
            <button class="library-create" type="button" aria-label="Create playlist or folder">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5a.5.5 0 0 1 .5.5v5.5H14a.5.5 0 0 1 0 1H8.5V14a.5.5 0 0 1-1 0V8.5H2a.5.5 0 0 1 0-1h5.5V2a.5.5 0 0 1 .5-.5z"/>
              </svg>
              Create
            </button>
          </div>

          <!-- Filter pills -->
          <div class="filter-pills" role="group" aria-label="Filter library">
            <button
              v-for="filter in libraryFilters"
              :key="filter"
              class="filter-pill"
              :class="{ active: activeFilter === filter }"
              type="button"
              @click="activeFilter = filter"
            >
              {{ filter }}
            </button>
          </div>

          <!-- Search & sort row -->
          <div class="library-search-row">
            <div class="lib-search-input-wrap">
              <svg class="lib-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M6.5 0a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 1a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm7.854 10.146a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708-.708l1.5-1.5a.5.5 0 0 1 .708 0z"/>
              </svg>
              <input
                v-model="librarySearchQuery"
                class="lib-search-input"
                type="text"
                placeholder="Search in Your Library"
                aria-label="Search in Your Library"
              />
            </div>
            <button class="sort-btn" type="button">
              {{ sortOrder }}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="margin-left:4px">
                <path d="M1 3l4 4 4-4H1z"/>
              </svg>
            </button>
          </div>

          <!-- Library items list -->
          <ul class="library-list" role="list">
            <li
              v-for="item in filteredLibraryItems"
              :key="item.id"
              class="library-item"
              role="listitem"
              tabindex="0"
            >
              <div
                class="lib-avatar"
                :class="item.shape === 'circle' ? 'lib-avatar--circle' : 'lib-avatar--square'"
                :style="{ background: item.color }"
                aria-hidden="true"
              >
                {{ item.icon }}
              </div>
              <div class="lib-info">
                <span class="lib-name">{{ item.name }}</span>
                <span class="lib-meta">{{ item.type }} · {{ item.owner }}</span>
              </div>
            </li>
            <li v-if="filteredLibraryItems.length === 0" class="lib-empty">
              No items found
            </li>
          </ul>
        </div>
      </aside>

      <section class="content">
        <div class="content-body">
          <section class="highlight">
            <p class="label">Recently Played</p>
            <h1>{{ isConnected ? "Welcome back" : "Connect to Spotify" }}</h1>
            <p class="subtitle">
              {{
                isConnected
                  ? "Jump back into your favorite albums and playlists."
                  : "Link your account to start searching, saving, and playing music."
              }}
            </p>
            <button class="primary" type="button" @click="handleProfileClick">
              {{ isConnected ? "Play All" : "Connect account" }}
            </button>
          </section>

          <section class="grid-section">
            <h2>Search results</h2>
            <p v-if="profileError" class="status error" role="status" aria-live="polite">
              {{ profileError }}
            </p>
            <p v-else-if="isProfileLoading" class="status" role="status" aria-live="polite">
              Loading Spotify profile...
            </p>
            <p v-else-if="searchError" class="status error" role="status" aria-live="polite">
              {{ searchError }}
            </p>
            <p v-else-if="isSearching" class="status" role="status" aria-live="polite">
              Searching Spotify...
            </p>
            <p v-else-if="!isConnected" class="status" role="status" aria-live="polite">
              Connect your Spotify account to unlock search results.
            </p>
            <p v-else-if="!hasResults" class="status" role="status" aria-live="polite">
              Try searching for a track, artist, or album.
            </p>
            <div v-else class="search-results">
              <div
                v-for="section in searchSections"
                :key="section.title"
                class="search-section"
                v-show="section.items.length"
              >
                <h3>{{ section.title }}</h3>
                <div class="card-grid">
                  <article v-for="item in section.items" :key="item.id" class="card">
                    <div
                      class="card-image"
                      role="img"
                      :aria-label="section.badge + ': ' + item.title"
                    >
                      {{ section.badge }}
                    </div>
                    <h4 class="card-title">{{ item.title }}</h4>
                    <p>{{ item.subtitle }}</p>
                  </article>
                </div>
              </div>
            </div>
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

/* ── Sidebar ── */
.sidebar {
  width: 280px;
  background: #000000;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0 0;
  overflow: hidden;
}

/* ── Library Panel ── */
.library-panel {
  flex: 1;
  background: #0a0a0a;
  border-radius: 8px;
  margin: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.5rem;
}

.library-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #b3b3b3;
  font-size: 0.9rem;
  font-weight: 700;
}

.library-icon {
  color: #b3b3b3;
  display: flex;
  align-items: center;
}

.library-create {
  background: none;
  border: none;
  color: #b3b3b3;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
}

.library-create:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.07);
}

/* Filter pills */
.filter-pills {
  display: flex;
  gap: 0.4rem;
  padding: 0.25rem 1rem 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-pills::-webkit-scrollbar {
  display: none;
}

.filter-pill {
  background: #1f1f1f;
  border: none;
  color: #ffffff;
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.filter-pill.active {
  background: #ffffff;
  color: #000000;
}

.filter-pill:hover:not(.active) {
  background: #3a3a3a;
}

/* Search & sort row */
.library-search-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 1rem 0.5rem;
  gap: 0.5rem;
}

.lib-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 6px;
  padding: 4px 8px;
  flex: 1;
}

.lib-search-icon {
  color: #b3b3b3;
  flex-shrink: 0;
}

.lib-search-input {
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 0.82rem;
  width: 100%;
}

.lib-search-input::placeholder {
  color: #b3b3b3;
}

.sort-btn {
  background: none;
  border: none;
  color: #b3b3b3;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  padding: 4px 4px;
  border-radius: 4px;
}

.sort-btn:hover {
  color: #ffffff;
}

/* Library list */
.library-list {
  list-style: none;
  padding: 0 0.5rem;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.library-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
}

.library-item:hover,
.library-item:focus-visible {
  background: rgba(255, 255, 255, 0.07);
  outline: none;
}

.lib-avatar {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.lib-avatar--square {
  border-radius: 6px;
}

.lib-avatar--circle {
  border-radius: 50%;
}

.lib-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.lib-name {
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lib-meta {
  color: #b3b3b3;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lib-empty {
  color: #b3b3b3;
  font-size: 0.85rem;
  padding: 1rem 0.75rem;
}

/* ── Content area ── */
.content {
  flex: 1;
  padding: 2rem 2.5rem;
  background: linear-gradient(180deg, #111315 0%, #0a0b0d 55%, #080909 100%);
  overflow-y: auto;
}

.topbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: #000000;
  border-bottom: 1px solid #181818;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topbar-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  flex-shrink: 0;
}

.topbar-home-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: #111111;
  color: #ffffff;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.topbar-home-btn:hover {
  background: #1e1e1e;
}

.topbar-action-btn {
  background: none;
  border: none;
  color: #b3b3b3;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
}

.topbar-action-btn:hover {
  color: #ffffff;
}

.topbar-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: none;
  color: #b3b3b3;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.topbar-icon-btn:hover {
  color: #ffffff;
}

.search-icon {
  flex-shrink: 0;
  color: #b3b3b3;
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
  width: 340px;
  background: #1a1a1a;
  border-radius: 999px;
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  gap: 0.5rem;
}

.search input {
  background: transparent;
  border: none;
  outline: none;
  color: #f5f5f5;
  width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.profile {
  background: #111111;
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
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
}

.profile-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
}

.status {
  margin: 0 0 1rem;
  color: #b8b8b8;
  font-size: 0.95rem;
}

.status.error {
  color: #ff9c9c;
}

.search-results {
  display: grid;
  gap: 2rem;
}

.search-section h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
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
  background: #111315;
  border-radius: 18px;
  padding: 1.2rem;
  display: grid;
  gap: 0.6rem;
  min-height: 190px;
}

.card-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
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

/* ── Player ── */
.player {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: #000000;
  border-top: 1px solid #181818;
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
    padding: 1rem;
  }

  .library-panel {
    flex-basis: 100%;
    margin: 0;
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