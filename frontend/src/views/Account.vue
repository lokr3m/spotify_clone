<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const router = useRouter();
const spotifyUserId = ref(localStorage.getItem("spotifyUserId") || "");
const profile = ref(null);
const profileError = ref("");
const isProfileLoading = ref(false);
const isLoggingOut = ref(false);

const isConnected = computed(() => Boolean(spotifyUserId.value));
const loginUrl = computed(() => `${API_BASE_URL}/auth/spotify/login`);
const avatarUrl = computed(() => profile.value?.images?.[0]?.url || null);
const displayName = computed(() => profile.value?.display_name || "Spotify Listener");
const displayInitial = computed(() => displayName.value?.[0] || "S");

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

const handleConnect = () => {
  window.location.href = loginUrl.value;
};

const handleLogout = async () => {
  if (!spotifyUserId.value) {
    router.push("/");
    return;
  }
  isLoggingOut.value = true;
  profileError.value = "";
  try {
    const response = await fetch(`${API_BASE_URL}/auth/spotify/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spotifyUserId: spotifyUserId.value }),
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Unable to log out (HTTP ${response.status}).`
      );
    }
    localStorage.removeItem("spotifyUserId");
    spotifyUserId.value = "";
    profile.value = null;
    router.push("/");
  } catch (error) {
    profileError.value = error?.message || "Unable to log out.";
  } finally {
    isLoggingOut.value = false;
  }
};

onMounted(() => {
  if (spotifyUserId.value) {
    fetchProfile();
  }
});
</script>

<template>
  <main class="account-page">
    <header class="account-header">
      <button class="back-button" type="button" @click="router.push('/')">Back</button>
      <h1>Account</h1>
    </header>

    <section class="account-card">
      <p v-if="profileError" class="status error" role="status" aria-live="polite">
        {{ profileError }}
      </p>
      <p v-else-if="isProfileLoading" class="status" role="status" aria-live="polite">
        Loading your Spotify profile...
      </p>
      <div v-else class="profile-content">
        <template v-if="isConnected">
          <div class="profile-summary">
            <div class="profile-avatar">
              <img v-if="avatarUrl" :src="avatarUrl" alt="Profile avatar" />
              <span v-else>{{ displayInitial }}</span>
            </div>
            <div>
              <h2>{{ displayName }}</h2>
              <p v-if="profile?.email">{{ profile.email }}</p>
              <p v-if="profile?.country">Country: {{ profile.country }}</p>
              <p v-if="profile?.followers?.total !== undefined">
                Followers: {{ profile.followers.total }}
              </p>
            </div>
          </div>
        </template>
        <p v-else class="status">
          Connect your Spotify account to view your profile details.
        </p>
      </div>

      <div class="account-actions">
        <button v-if="!isConnected" class="primary" type="button" @click="handleConnect">
          Connect account
        </button>
        <button
          v-else
          class="danger"
          type="button"
          :disabled="isLoggingOut"
          @click="handleLogout"
        >
          {{ isLoggingOut ? "Logging out..." : "Log out" }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #111315 0%, #0a0b0d 55%, #080909 100%);
  color: #ffffff;
  font-family: "Helvetica Neue", system-ui, sans-serif;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.account-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.account-header h1 {
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

.account-card {
  background: #0a0a0a;
  border-radius: 16px;
  padding: 2rem;
  display: grid;
  gap: 1.5rem;
  max-width: 640px;
}

.profile-summary {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  background: #1db954;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 1.4rem;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-summary h2 {
  margin: 0 0 0.3rem;
}

.profile-summary p {
  margin: 0.15rem 0;
  color: #b3b3b3;
}

.account-actions {
  display: flex;
  gap: 1rem;
}

.primary,
.danger {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.4rem;
  font-weight: 600;
  cursor: pointer;
}

.primary {
  background: #1db954;
  color: #000000;
}

.danger {
  background: #3a3a3a;
  color: #ffffff;
}

.danger:disabled {
  opacity: 0.6;
  cursor: wait;
}

.status {
  color: #b8b8b8;
  margin: 0;
}

.status.error {
  color: #ff9c9c;
}
</style>