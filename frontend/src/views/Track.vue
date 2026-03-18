<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const route = useRoute();
const router = useRouter();

const spotifyUserId = ref(localStorage.getItem("spotifyUserId") || "");
const track = ref(null);
const trackError = ref("");
const isTrackLoading = ref(false);

const trackId = computed(() => (typeof route.params.id === "string" ? route.params.id : ""));
const isConnected = computed(() => Boolean(spotifyUserId.value));
const loginUrl = computed(() => `${API_BASE_URL}/auth/spotify/login`);
const trackTitle = computed(() => track.value?.name || "Track");
const artistNames = computed(() => {
  const names = (track.value?.artists || []).map((artist) => artist?.name).filter(Boolean);
  return names.length ? names.join(", ") : "Unknown Artist";
});
const albumTitle = computed(() => track.value?.album?.name || "Unknown album");
const albumImage = computed(() => track.value?.album?.images?.[0]?.url || null);
const releaseDate = computed(() => track.value?.album?.release_date || "");
const previewUrl = computed(() => track.value?.preview_url || "");
const spotifyUrl = computed(() => track.value?.external_urls?.spotify || "");

const formatDuration = (durationMs) => {
  if (!Number.isFinite(durationMs)) {
    return "";
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const durationLabel = computed(() => formatDuration(track.value?.duration_ms));

const fetchTrack = async () => {
  if (!trackId.value) {
    trackError.value = "Track not found.";
    track.value = null;
    return;
  }
  if (!spotifyUserId.value) {
    track.value = null;
    trackError.value = "";
    return;
  }
  isTrackLoading.value = true;
  trackError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/tracks/${encodeURIComponent(
        trackId.value
      )}?spotifyUserId=${encodeURIComponent(spotifyUserId.value)}`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Unable to load Spotify track (HTTP ${response.status}).`
      );
    }
    track.value = await response.json();
  } catch (error) {
    track.value = null;
    trackError.value = error?.message || "Unable to load Spotify track.";
  } finally {
    isTrackLoading.value = false;
  }
};

const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
};

const handleConnect = () => {
  window.location.href = loginUrl.value;
};

watch(trackId, () => {
  fetchTrack();
});

onMounted(() => {
  fetchTrack();
});
</script>

<template>
  <main class="track-page">
    <header class="track-header">
      <button class="back-button" type="button" @click="handleBack">Back</button>
      <h1>Track</h1>
    </header>

    <section class="track-card">
      <p v-if="trackError" class="status error" role="status" aria-live="polite">
        {{ trackError }}
      </p>
      <p v-else-if="!isConnected" class="status" role="status" aria-live="polite">
        Connect your Spotify account to view track details.
      </p>
      <p v-else-if="isTrackLoading" class="status" role="status" aria-live="polite">
        Loading track details...
      </p>
      <div v-else-if="track" class="track-content">
        <div class="track-art" aria-hidden="true">
          <img v-if="albumImage" :src="albumImage" :alt="trackTitle" />
          <span v-else>♪</span>
        </div>
        <div class="track-details">
          <p class="track-label">Now Viewing</p>
          <h2>{{ trackTitle }}</h2>
          <p class="track-artist">{{ artistNames }}</p>
          <div class="track-meta">
            <span>{{ albumTitle }}</span>
            <span v-if="durationLabel">· {{ durationLabel }}</span>
            <span v-if="releaseDate">· {{ releaseDate }}</span>
          </div>
          <div class="track-actions">
            <a v-if="spotifyUrl" class="primary-link" :href="spotifyUrl" target="_blank" rel="noreferrer">
              Open in Spotify
            </a>
            <audio v-if="previewUrl" class="track-audio" controls :src="previewUrl">
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      </div>
      <div v-else class="status">Select a track to see details.</div>
    </section>

    <button v-if="!isConnected" class="primary" type="button" @click="handleConnect">
      Connect account
    </button>
  </main>
</template>

<style scoped>
.track-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #111315 0%, #0a0b0d 55%, #080909 100%);
  color: #ffffff;
  font-family: "Helvetica Neue", system-ui, sans-serif;
  padding: 2.5rem 2rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.track-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.track-header h1 {
  margin: 0;
  font-size: 2rem;
}

.back-button {
  background: #1f1f1f;
  border: none;
  color: #ffffff;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
}

.back-button:hover {
  background: #2d2d2d;
}

.track-card {
  background: #0a0a0a;
  border-radius: 16px;
  padding: 2rem;
  display: grid;
  gap: 1.5rem;
  max-width: 820px;
}

.track-content {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
}

.track-art {
  width: 190px;
  height: 190px;
  border-radius: 16px;
  background: #1a1d1f;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 2.5rem;
}

.track-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.track-details {
  display: grid;
  gap: 0.6rem;
  min-width: 240px;
}

.track-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.7rem;
  color: #a0a0a0;
  margin: 0;
}

.track-details h2 {
  margin: 0;
  font-size: 2rem;
}

.track-artist {
  margin: 0;
  color: #d0d0d0;
  font-size: 1rem;
}

.track-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #b3b3b3;
  font-size: 0.9rem;
}

.track-actions {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.primary {
  background: #1db954;
  border: none;
  color: #0b0b0c;
  padding: 0.75rem 1.6rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  width: fit-content;
}

.primary-link {
  background: #1db954;
  color: #0b0b0c;
  text-decoration: none;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-weight: 700;
  width: fit-content;
}

.track-audio {
  width: 100%;
}

.status {
  margin: 0;
  color: #b8b8b8;
  font-size: 0.95rem;
}

.status.error {
  color: #ff9c9c;
}
</style>