<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const storedUserId = localStorage.getItem("spotifyUserId") || "";

const spotifyUserId = ref(storedUserId);
const router = useRouter();
const route = useRoute();
const UNKNOWN_ARTIST = "Unknown Artist";
const UNKNOWN_OWNER = "Unknown";
const SUGGESTION_DEBOUNCE_MS = 300;
const BLUR_DELAY_MS = 150;
const SUGGESTION_LIMIT = 5;
const QUICK_LINK_LIMIT = 6;
const MADE_FOR_YOU_LIMIT = 4;
const RELATED_VIDEO_SKIP_COUNT = 1;
const RELATED_VIDEO_DISPLAY_COUNT = 2;
const SEARCH_ROUTE_NAME = "search";
const profile = ref(null);
const profileError = ref("");
const isProfileLoading = ref(false);

const createEmptyResults = () => ({
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
});
const searchQuery = ref("");
const searchResults = ref(createEmptyResults());
const searchError = ref("");
const isSearching = ref(false);
const suggestionResults = ref({
  tracks: [],
  albums: [],
});
const suggestionError = ref("");
const isSuggestionLoading = ref(false);
const isSearchFocused = ref(false);
const lastSearchQuery = ref("");
const userPlaylists = ref([]);
const playlistError = ref("");
const isPlaylistsLoading = ref(false);
const recentlyPlayedTracks = ref([]);
const recentlyPlayedError = ref("");
const isRecentlyPlayedLoading = ref(false);
const newRelease = ref(null);
const newReleaseError = ref("");
const isNewReleaseLoading = ref(false);

const activeFilter = ref("Playlists");
const librarySearchQuery = ref("");
const sortOrder = ref("Recents");
const activeQuickFilter = ref("All");

const logoIcons = {
  playlist: `
    <rect x="82" y="92" width="136" height="18" rx="9" />
    <rect x="82" y="132" width="108" height="18" rx="9" opacity="0.85" />
    <rect x="82" y="172" width="84" height="18" rx="9" opacity="0.7" />
    <polygon points="210,126 242,146 210,166" />
  `,
  album: `
    <circle cx="150" cy="150" r="68" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="16" />
    <circle cx="150" cy="150" r="18" />
  `,
  artist: `
    <circle cx="150" cy="112" r="36" />
    <path d="M82 222c0-37 30-68 68-68s68 31 68 68v10H82z" />
  `,
  mix: `
    <circle cx="120" cy="140" r="36" opacity="0.8" />
    <circle cx="180" cy="140" r="36" opacity="0.8" />
    <rect x="102" y="178" width="96" height="16" rx="8" opacity="0.9" />
  `,
  video: `
    <rect x="70" y="96" width="160" height="108" rx="16" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="12" />
    <polygon points="140,128 194,150 140,172" />
  `,
  heart: `
    <path d="M150 230l-18-16c-28-24-52-50-52-78 0-24 18-44 44-44 16 0 30 8 38 20 8-12 22-20 38-20 26 0 44 20 44 44 0 28-24 54-52 78l-18 16z" />
  `,
};
const createLogoCover = (primary, secondary, iconKey) => {
  const icon = logoIcons[iconKey] || "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${primary}"/>
          <stop offset="1" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <g fill="rgba(255,255,255,0.9)">${icon}</g>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
const quickFilters = ["All", "Music", "Podcasts"];
const artwork = {
  quickOne: createLogoCover("#1f2937", "#111827", "playlist"),
  quickTwo: createLogoCover("#0f172a", "#1e293b", "playlist"),
  quickThree: createLogoCover("#1e1b4b", "#312e81", "playlist"),
  quickFour: createLogoCover("#3f1d2f", "#111827", "playlist"),
  quickFive: createLogoCover("#0f172a", "#164e63", "playlist"),
  quickSix: createLogoCover("#111827", "#334155", "playlist"),
  coverOne: createLogoCover("#1f2937", "#0f172a", "album"),
  coverTwo: createLogoCover("#0f172a", "#312e81", "playlist"),
  coverThree: createLogoCover("#064e3b", "#0f172a", "mix"),
  coverFour: createLogoCover("#1d4ed8", "#0f172a", "mix"),
  coverFive: createLogoCover("#b45309", "#0f172a", "mix"),
  coverSix: createLogoCover("#1f2937", "#7c3aed", "album"),
  coverSeven: createLogoCover("#0f172a", "#4c1d95", "album"),
  artistOne: createLogoCover("#0f172a", "#1e293b", "artist"),
  artistTwo: createLogoCover("#111827", "#1f2937", "artist"),
  albumOne: createLogoCover("#0f172a", "#374151", "album"),
  albumTwo: createLogoCover("#111827", "#1f1f1f", "album"),
  albumThree: createLogoCover("#1f2937", "#0b1220", "album"),
  albumFour: createLogoCover("#111827", "#0b1120", "album"),
  likedSongs: createLogoCover("#4f46e5", "#1d4ed8", "heart"),
  videoOne: createLogoCover("#0f172a", "#1f2937", "video"),
  videoTwo: createLogoCover("#111827", "#0f172a", "video"),
};

const isConnected = computed(() => Boolean(spotifyUserId.value));
const displayName = computed(() => profile.value?.display_name || "Guest");
const loginUrl = computed(() => `${API_BASE_URL}/auth/spotify/login`);
const avatarUrl = computed(() => profile.value?.images?.[0]?.url || null);
const avatarInitial = computed(() => (profile.value?.display_name?.[0] || "G").toUpperCase());
const isSearchPage = computed(() => route.name === SEARCH_ROUTE_NAME);
const activeSearchQuery = computed(() =>
  typeof route.query.q === "string" ? route.query.q.trim() : ""
);
const hasResults = computed(
  () =>
    searchResults.value.tracks.length > 0 ||
    searchResults.value.artists.length > 0 ||
    searchResults.value.albums.length > 0 ||
    searchResults.value.playlists.length > 0
);
const searchSections = computed(() => [
  { title: "Tracks", badge: "Track", items: searchResults.value.tracks, isTrack: true },
  { title: "Artists", badge: "Artist", items: searchResults.value.artists, isTrack: false },
  { title: "Albums", badge: "Album", items: searchResults.value.albums, isTrack: false },
  { title: "Playlists", badge: "Playlist", items: searchResults.value.playlists, isTrack: false },
]);
const suggestionItems = computed(() => {
  const trackItems = suggestionResults.value.tracks.map((item) => ({
    ...item,
    type: "Track",
  }));
  const albumItems = suggestionResults.value.albums.map((item) => ({
    ...item,
    type: "Album",
  }));
  return [...trackItems, ...albumItems].slice(0, SUGGESTION_LIMIT);
});
const shouldShowSuggestions = computed(
  () => isSearchFocused.value && searchQuery.value.trim().length > 0
);
const suggestionMessage = computed(() => {
  if (!shouldShowSuggestions.value) {
    return "";
  }
  if (!isConnected.value) {
    return "Connect your Spotify account to search.";
  }
  if (isSuggestionLoading.value) {
    return "Searching Spotify...";
  }
  if (suggestionError.value) {
    return suggestionError.value;
  }
  if (!suggestionItems.value.length) {
    return "No matches found.";
  }
  return "";
});
const playlistCards = computed(() =>
  userPlaylists.value.map((playlist) => ({
    id: playlist.id,
    title: playlist.name,
    subtitle: formatPlaylistSubtitle(playlist),
    imageUrl: playlist.imageUrl,
  }))
);
const hasPlaylists = computed(() => playlistCards.value.length > 0);

const libraryFilters = ["Playlists", "Artists", "Albums"];

const baseLibraryItems = computed(() => {
  const items = [];
  const seenAlbums = new Set();
  const seenArtists = new Set();
  recentlyPlayedTracks.value.forEach((track) => {
    const album = track?.album;
    if (album?.id && !seenAlbums.has(album.id)) {
      seenAlbums.add(album.id);
      items.push({
        id: `album-${album.id}`,
        name: album.name,
        type: "Album",
        owner: formatArtistNames(album.artists),
        shape: "square",
        color: "#101010",
        icon: "◎",
        imageUrl: album.images?.[0]?.url || null,
      });
    }
    (track?.artists || []).forEach((artist) => {
      if (!artist?.id || seenArtists.has(artist.id)) {
        return;
      }
      seenArtists.add(artist.id);
      items.push({
        id: `artist-${artist.id}`,
        name: artist.name,
        type: "Artist",
        owner: "",
        shape: "circle",
        color: "#101010",
        icon: "◎",
        imageUrl: null,
      });
    });
  });
  return items;
});
const playlistLibraryItems = computed(() =>
  userPlaylists.value.map((playlist) => ({
    id: `spotify-${playlist.id}`,
    name: playlist.name,
    type: "Playlist",
    owner: playlist.owner,
    shape: "square",
    color: "#1db954",
    icon: "♪",
    imageUrl: playlist.imageUrl,
  }))
);
const libraryItems = computed(() => [
  ...baseLibraryItems.value,
  ...playlistLibraryItems.value,
]);

const filteredLibraryItems = computed(() => {
  let items = libraryItems.value;
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
const formatAlbumType = (type) => {
  if (!type) {
    return "Release";
  }
  return `${type[0].toUpperCase()}${type.slice(1)}`;
};
const formatPlaylistSubtitle = (playlist) => {
  if (playlist.description?.trim()) {
    return playlist.description.trim();
  }
  if (playlist.owner === "Spotify") {
    return "Spotify";
  }
  if (playlist.owner === UNKNOWN_OWNER) {
    return "By unknown creator";
  }
  return `By ${playlist.owner}`;
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
  tracks: (payload?.tracks?.items || [])
    .filter((track) => track?.id != null)
    .map((track) => ({
      id: track.id,
      title: track.name,
      subtitle: formatArtistNames(track.artists),
      imageUrl: track.album?.images?.[0]?.url || null,
    })),
  artists: (payload?.artists?.items || [])
    .filter((artist) => artist?.id != null)
    .map((artist) => ({
      id: artist.id,
      title: artist.name,
      subtitle: artist.genres?.[0] || "No genre available",
      imageUrl: artist.images?.[0]?.url || null,
    })),
  albums: (payload?.albums?.items || [])
    .filter((album) => album?.id != null)
    .map((album) => ({
      id: album.id,
      title: album.name,
      subtitle: formatArtistNames(album.artists),
      imageUrl: album.images?.[0]?.url || null,
    })),
  playlists: (payload?.playlists?.items || [])
    .filter((playlist) => playlist?.id != null)
    .map((playlist) => ({
      id: playlist.id,
      title: playlist.name,
      subtitle: playlist.owner?.display_name || UNKNOWN_OWNER,
      imageUrl: playlist.images?.[0]?.url || null,
    })),
});
const normalizePlaylists = (payload) =>
  (payload?.items || [])
    .filter((playlist) => playlist?.id && playlist?.name)
    .map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || "",
      owner: playlist.owner?.display_name || UNKNOWN_OWNER,
      imageUrl: playlist.images?.[0]?.url || null,
    }));
const normalizeRecentlyPlayed = (payload) =>
  (payload?.items || [])
    .map((item) => item?.track)
    .filter((track) => track?.id != null);
const normalizeNewReleases = (payload) =>
  (payload?.albums?.items || []).filter((album) => album?.id != null);

const quickPlaylistLinks = computed(() =>
  playlistCards.value.slice(0, QUICK_LINK_LIMIT).map((playlist) => ({
    id: playlist.id,
    title: playlist.title,
    imageUrl: playlist.imageUrl || artwork.quickOne,
  }))
);
const madeForYouPlaylists = computed(() =>
  userPlaylists.value.filter((playlist) => playlist.owner === "Spotify")
);
const madeForYouItems = computed(() =>
  madeForYouPlaylists.value.slice(0, MADE_FOR_YOU_LIMIT).map((playlist) => ({
    id: playlist.id,
    title: playlist.name,
    subtitle: formatPlaylistSubtitle(playlist),
    imageUrl: playlist.imageUrl || artwork.coverTwo,
  }))
);
const recentlyPlayedItems = computed(() =>
  recentlyPlayedTracks.value.map((track) => ({
    id: track.id,
    title: track.name,
    imageUrl: track.album?.images?.[0]?.url || artwork.coverOne,
  }))
);
const relatedVideos = computed(() =>
  recentlyPlayedTracks.value
    .slice(
      RELATED_VIDEO_SKIP_COUNT,
      RELATED_VIDEO_SKIP_COUNT + RELATED_VIDEO_DISPLAY_COUNT
    )
    .map((track) => ({
      id: track.id,
      title: track.name,
      artist: formatArtistNames(track.artists),
      imageUrl: track.album?.images?.[0]?.url || artwork.videoOne,
    }))
);
const nowPlaying = computed(() => {
  const track = recentlyPlayedTracks.value[0];
  const fallbackImage = newRelease.value?.imageUrl || artwork.coverSix;
  if (!track) {
    return {
      album: isConnected.value ? "No recent playback" : "Connect to Spotify",
      track: isConnected.value ? "Play something in Spotify" : "Sign in to see now playing",
      artist: isConnected.value ? "Recently played will appear here" : "",
      imageUrl: fallbackImage,
    };
  }
  return {
    album: track.album?.name || "Unknown album",
    track: track.name || "Unknown track",
    artist: formatArtistNames(track.artists),
    imageUrl: track.album?.images?.[0]?.url || fallbackImage,
  };
});
const hasQuickPlaylistLinks = computed(() => quickPlaylistLinks.value.length > 0);
const hasMadeForYou = computed(() => madeForYouItems.value.length > 0);
const hasRecentlyPlayed = computed(() => recentlyPlayedItems.value.length > 0);
const hasRelatedVideos = computed(() => relatedVideos.value.length > 0);

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

const fetchPlaylists = async () => {
  if (!spotifyUserId.value) {
    return;
  }
  isPlaylistsLoading.value = true;
  playlistError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/playlists?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Unable to load Spotify playlists (HTTP ${response.status}).`
      );
    }
    const payload = await response.json();
    userPlaylists.value = normalizePlaylists(payload);
  } catch (error) {
    userPlaylists.value = [];
    playlistError.value = error?.message || "Unable to load Spotify playlists.";
  } finally {
    isPlaylistsLoading.value = false;
  }
};

const fetchRecentlyPlayed = async () => {
  if (!spotifyUserId.value) {
    return;
  }
  isRecentlyPlayedLoading.value = true;
  recentlyPlayedError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/recently-played?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}&limit=12`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Unable to load recently played (HTTP ${response.status}).`
      );
    }
    const payload = await response.json();
    recentlyPlayedTracks.value = normalizeRecentlyPlayed(payload);
  } catch (error) {
    recentlyPlayedTracks.value = [];
    recentlyPlayedError.value = error?.message || "Unable to load recently played.";
  } finally {
    isRecentlyPlayedLoading.value = false;
  }
};

const fetchNewReleases = async () => {
  if (!spotifyUserId.value) {
    return;
  }
  isNewReleaseLoading.value = true;
  newReleaseError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/new-releases?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}&limit=10`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Unable to load new releases (HTTP ${response.status}).`
      );
    }
    const payload = await response.json();
    const releases = normalizeNewReleases(payload);
    const featuredRelease = releases[0];
    newRelease.value = featuredRelease
      ? {
          id: featuredRelease.id,
          artist: formatArtistNames(featuredRelease.artists),
          title: featuredRelease.name,
          meta: `${formatAlbumType(featuredRelease.album_type)} · ${formatArtistNames(
            featuredRelease.artists
          )}`,
          imageUrl: featuredRelease.images?.[0]?.url || artwork.coverOne,
        }
      : null;
  } catch (error) {
    newRelease.value = null;
    newReleaseError.value = error?.message || "Unable to load new releases.";
  } finally {
    isNewReleaseLoading.value = false;
  }
};

const handleProfileClick = () => {
  if (!isConnected.value) {
    window.location.href = loginUrl.value;
  } else {
    router.push("/account");
  }
};

const suggestionTimeoutId = ref(null);
const suggestionRequestId = ref(0);
const blurTimeoutId = ref(null);

const resetSearchResults = () => {
  searchResults.value = createEmptyResults();
};
const resetSuggestions = () => {
  suggestionResults.value = { tracks: [], albums: [] };
  suggestionError.value = "";
  isSuggestionLoading.value = false;
};
const clearTimeoutRef = (timeoutRef) => {
  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value);
    timeoutRef.value = null;
  }
};
const suggestionIcon = (type) => {
  if (type === "Album") {
    return "◎";
  }
  if (type === "Track") {
    return "♪";
  }
  return "•";
};
const validateSearchQuery = (value) => {
  const trimmedQuery = value.trim();
  if (!trimmedQuery) {
    resetSearchResults();
    searchError.value = "Enter a search term to look up music.";
    return null;
  }
  if (!spotifyUserId.value) {
    resetSearchResults();
    searchError.value = "Connect your Spotify account to search.";
    return null;
  }
  searchError.value = "";
  return trimmedQuery;
};

const fetchSuggestions = async (query) => {
  if (!spotifyUserId.value || !query) {
    resetSuggestions();
    return;
  }
  suggestionRequestId.value += 1;
  const currentRequestId = suggestionRequestId.value;
  isSuggestionLoading.value = true;
  suggestionError.value = "";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/search?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}&q=${encodeURIComponent(query)}&limit=${SUGGESTION_LIMIT}`
    );
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error || `Spotify search failed (HTTP ${response.status}).`
      );
    }
    const payload = await response.json();
    if (currentRequestId !== suggestionRequestId.value) {
      return;
    }
    const normalized = normalizeSearchResults(payload);
    suggestionResults.value = {
      tracks: normalized.tracks,
      albums: normalized.albums,
    };
  } catch (error) {
    if (currentRequestId !== suggestionRequestId.value) {
      return;
    }
    resetSuggestions();
    suggestionError.value = error?.message || "Unable to fetch suggestions.";
  } finally {
    if (currentRequestId === suggestionRequestId.value) {
      isSuggestionLoading.value = false;
    }
  }
};

const scheduleSuggestionFetch = (value) => {
  const trimmed = value.trim();
  if (!trimmed || !isConnected.value) {
    resetSuggestions();
    return;
  }
  clearTimeoutRef(suggestionTimeoutId);
  suggestionTimeoutId.value = window.setTimeout(() => {
    fetchSuggestions(trimmed);
  }, SUGGESTION_DEBOUNCE_MS);
};

const performSearch = async (query) => {
  const trimmedQuery = validateSearchQuery(query);
  if (!trimmedQuery) {
    return;
  }
  isSearching.value = true;
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/search?spotifyUserId=${encodeURIComponent(
        spotifyUserId.value
      )}&q=${encodeURIComponent(trimmedQuery)}&limit=24`
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
    resetSearchResults();
    searchError.value = error?.message || "Spotify search failed.";
  } finally {
    isSearching.value = false;
  }
};

const handleSearch = async (providedQuery) => {
  const trimmedQuery = validateSearchQuery(providedQuery ?? searchQuery.value);
  if (!trimmedQuery) {
    return;
  }
  const shouldSearchInPlace =
    route.name === SEARCH_ROUTE_NAME && activeSearchQuery.value === trimmedQuery;
  if (shouldSearchInPlace) {
    await performSearch(trimmedQuery);
    return;
  }
  isSearchFocused.value = false;
  router.push({ name: "search", query: { q: trimmedQuery } });
};

const handleSuggestionSelect = (item) => {
  if (item?.type === "Track") {
    searchQuery.value = item.title;
    isSearchFocused.value = false;
    resetSuggestions();
    if (item.id) {
      router.push({ name: "track", params: { id: item.id } });
    }
    return;
  }
  searchQuery.value = item.title;
  isSearchFocused.value = false;
  resetSuggestions();
  handleSearch(item.title);
};

const handleTrackSelect = (track) => {
  if (!track?.id) {
    return;
  }
  router.push({ name: "track", params: { id: track.id } });
};

const handleSearchFocus = () => {
  clearTimeoutRef(blurTimeoutId);
  isSearchFocused.value = true;
  scheduleSuggestionFetch(searchQuery.value);
};

const handleSearchBlur = () => {
  blurTimeoutId.value = window.setTimeout(() => {
    isSearchFocused.value = false;
  }, BLUR_DELAY_MS);
};

watch(searchQuery, (value, previousValue) => {
  if (!isSearchFocused.value) {
    return;
  }
  if (!value.trim() && !previousValue?.trim()) {
    return;
  }
  scheduleSuggestionFetch(value);
});

watch(isSearchFocused, (value) => {
  if (!value) {
    clearTimeoutRef(suggestionTimeoutId);
    resetSuggestions();
  }
});

onBeforeUnmount(() => {
  clearTimeoutRef(suggestionTimeoutId);
  clearTimeoutRef(blurTimeoutId);
});

watchEffect(() => {
  if (!isSearchPage.value) {
    lastSearchQuery.value = "";
    return;
  }
  searchQuery.value = activeSearchQuery.value;
  if (!activeSearchQuery.value) {
    searchError.value = "";
    resetSearchResults();
    lastSearchQuery.value = "";
    return;
  }
  if (activeSearchQuery.value === lastSearchQuery.value) {
    return;
  }
  lastSearchQuery.value = activeSearchQuery.value;
  performSearch(activeSearchQuery.value);
});

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
    fetchPlaylists();
    fetchRecentlyPlayed();
    fetchNewReleases();
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
            placeholder="What do you want to play?"
            aria-label="Search"
            v-model="searchQuery"
            @focus="handleSearchFocus"
            @blur="handleSearchBlur"
          />
          <button class="sr-only" type="submit">Search</button>
          <div v-if="shouldShowSuggestions" class="search-suggestions" role="listbox">
            <p
              v-if="suggestionMessage"
              class="suggestion-status"
              :class="{ error: suggestionError }"
              role="status"
            >
              {{ suggestionMessage }}
            </p>
            <ul v-else class="suggestion-list">
              <li
                v-for="item in suggestionItems"
                :key="item.id"
                class="suggestion-item"
                role="option"
                tabindex="0"
                @mousedown.prevent="handleSuggestionSelect(item)"
                @keydown.enter.prevent="handleSuggestionSelect(item)"
                @keydown.space.prevent="handleSuggestionSelect(item)"
              >
                <div class="suggestion-art">
                  <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" />
                  <span v-else aria-hidden="true">{{ suggestionIcon(item.type) }}</span>
                </div>
                <div class="suggestion-text">
                  <span class="suggestion-title">{{ item.title }}</span>
                  <span class="suggestion-subtitle">{{ item.subtitle }}</span>
                </div>
                <span class="suggestion-badge">{{ item.type }}</span>
              </li>
            </ul>
          </div>
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
        <div class="sidebar-brand" aria-label="Spotify">
          <svg class="spotify-logo" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.784 17.347a.748.748 0 0 1-1.03.253c-2.82-1.725-6.37-2.115-10.55-1.158a.75.75 0 0 1-.33-1.463c4.54-1.04 8.48-.6 11.58 1.299a.75.75 0 0 1 .253 1.069zm1.472-3.27a.935.935 0 0 1-1.287.316c-3.23-1.984-8.16-2.56-11.97-1.398a.937.937 0 0 1-.547-1.791c4.35-1.321 9.75-.68 13.45 1.612a.936.936 0 0 1 .35 1.261zm.126-3.401c-3.87-2.298-10.27-2.51-13.96-1.41a1.12 1.12 0 0 1-.65-2.141c4.2-1.275 11.19-1.03 15.62 1.53a1.12 1.12 0 0 1-1.01 2.02z"
              fill="currentColor"
            />
          </svg>
          <span>Spotify</span>
        </div>
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
                :style="item.imageUrl ? null : { background: item.color }"
                aria-hidden="true"
              >
                <img v-if="item.imageUrl" :src="item.imageUrl" alt="" class="media-cover" />
                <span v-else>{{ item.icon }}</span>
              </div>
              <div class="lib-info">
                <span class="lib-name">{{ item.name }}</span>
                <span class="lib-meta">
                  <template v-if="item.owner">{{ item.type }} · {{ item.owner }}</template>
                  <template v-else>{{ item.type }}</template>
                </span>
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
          <template v-if="isSearchPage">
            <section class="search-hero">
              <p class="label">Search results</p>
              <h1 v-if="activeSearchQuery">Results for “{{ activeSearchQuery }}”</h1>
              <h1 v-else>Search Spotify</h1>
              <p class="subtitle">
                {{
                  activeSearchQuery
                    ? "Showing top matches across tracks, albums, artists, and playlists."
                    : "Start typing to discover songs, albums, and playlists."
                }}
              </p>
            </section>

            <section class="grid-section">
              <h2>All results</h2>
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
                Try searching for a track, artist, album, or playlist.
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
                  <article
                    v-for="item in section.items"
                    :key="item.id"
                    class="card"
                    :class="{ 'card--interactive': section.isTrack }"
                    :role="section.isTrack ? 'button' : undefined"
                    :tabindex="section.isTrack ? 0 : undefined"
                    :aria-label="section.isTrack ? `Open track ${item.title}` : undefined"
                    @click="section.isTrack && handleTrackSelect(item)"
                    @keydown.enter.prevent="section.isTrack && handleTrackSelect(item)"
                    @keydown.space.prevent="section.isTrack && handleTrackSelect(item)"
                  >
                      <div
                        class="card-image"
                        role="img"
                        :aria-label="section.badge + ': ' + item.title"
                      >
                        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" class="media-cover" />
                        <span v-else>{{ section.badge }}</span>
                      </div>
                      <h4 class="card-title">{{ item.title }}</h4>
                      <p>{{ item.subtitle }}</p>
                    </article>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else>
            <section class="quick-filters" role="tablist" aria-label="Browse filters">
              <button
                v-for="filter in quickFilters"
                :key="filter"
                class="quick-filter-pill"
                :class="{ active: activeQuickFilter === filter }"
                type="button"
                role="tab"
                @click="activeQuickFilter = filter"
              >
                {{ filter }}
              </button>
            </section>

            <section class="quick-links" aria-label="Quick picks">
              <p v-if="!isConnected" class="status">Connect your Spotify account to load shortcuts.</p>
              <p v-else-if="isPlaylistsLoading" class="status">Loading playlists...</p>
              <p v-else-if="playlistError" class="status error">{{ playlistError }}</p>
              <p v-else-if="!hasQuickPlaylistLinks" class="status">No playlists found yet.</p>
              <button v-else v-for="item in quickPlaylistLinks" :key="item.id" class="quick-link" type="button">
                <img :src="item.imageUrl" :alt="item.title" class="quick-link-art" />
                <span>{{ item.title }}</span>
              </button>
            </section>

            <section class="home-row">
              <article class="new-release">
                <template v-if="newRelease">
                  <p class="label">New release from</p>
                  <p class="release-artist">{{ newRelease.artist }}</p>
                  <div class="release-card">
                    <img :src="newRelease.imageUrl" :alt="newRelease.title" class="release-art" />
                    <div class="release-info">
                      <p class="release-meta">{{ newRelease.meta }}</p>
                      <h3 class="release-title">{{ newRelease.title }}</h3>
                      <div class="release-actions">
                        <button class="release-play" type="button" aria-label="Play new release">▶</button>
                        <button class="release-save" type="button" aria-label="Save new release">+</button>
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <p class="label">New release</p>
                  <p v-if="!isConnected" class="status">Connect your Spotify account to see new releases.</p>
                  <p v-else-if="isNewReleaseLoading" class="status">Loading new releases...</p>
                  <p v-else-if="newReleaseError" class="status error">{{ newReleaseError }}</p>
                  <p v-else class="status">No new releases available yet.</p>
                </template>
              </article>

              <div class="made-for-you">
                <div class="section-header">
                  <h2>Made For You</h2>
                  <button class="show-all" type="button">Show all</button>
                </div>
                <p v-if="!isConnected" class="status">Connect your Spotify account to see mixes.</p>
                <p v-else-if="isPlaylistsLoading" class="status">Loading playlists...</p>
                <p v-else-if="playlistError" class="status error">{{ playlistError }}</p>
                <p v-else-if="!hasMadeForYou" class="status">No Spotify mixes available yet.</p>
                <div v-else class="media-grid">
                  <article v-for="item in madeForYouItems" :key="item.id" class="media-card">
                    <img :src="item.imageUrl" :alt="item.title" class="media-art" />
                    <h4>{{ item.title }}</h4>
                    <p>{{ item.subtitle }}</p>
                  </article>
                </div>
              </div>
            </section>

            <section class="recently-played">
              <div class="section-header">
                <h2>Recently played</h2>
                <button class="show-all" type="button">Show all</button>
              </div>
              <p v-if="!isConnected" class="status">Connect your Spotify account to see your history.</p>
              <p v-else-if="isRecentlyPlayedLoading" class="status">Loading recently played...</p>
              <p v-else-if="recentlyPlayedError" class="status error">{{ recentlyPlayedError }}</p>
              <p v-else-if="!hasRecentlyPlayed" class="status">Play something to populate this list.</p>
              <div v-else class="recent-grid">
                <article v-for="item in recentlyPlayedItems" :key="item.id" class="recent-card">
                  <img :src="item.imageUrl" :alt="item.title" class="media-art" />
                  <p>{{ item.title }}</p>
                </article>
              </div>
            </section>
          </template>

        </div>
      </section>
      <aside class="now-panel">
        <div class="now-card">
          <h3 class="now-album">{{ nowPlaying.album }}</h3>
          <img :src="nowPlaying.imageUrl" :alt="nowPlaying.album" class="now-cover" />
          <button class="ghost-button" type="button">
            <span aria-hidden="true">▶</span>
            Switch to video
          </button>
          <div class="now-meta">
            <div>
              <p class="now-track">{{ nowPlaying.track }}</p>
              <p class="now-artist">{{ nowPlaying.artist }}</p>
            </div>
            <span class="now-like" aria-hidden="true">✓</span>
          </div>
        </div>

        <div class="related">
          <p class="related-title">Related music videos</p>
          <p v-if="!isConnected" class="status">Connect your Spotify account to see related tracks.</p>
          <p v-else-if="isRecentlyPlayedLoading" class="status">Loading related tracks...</p>
          <p v-else-if="recentlyPlayedError" class="status error">{{ recentlyPlayedError }}</p>
          <p v-else-if="!hasRelatedVideos" class="status">No related tracks yet.</p>
          <div v-else class="related-grid">
            <article v-for="item in relatedVideos" :key="item.id" class="related-card">
              <img :src="item.imageUrl" :alt="item.title" class="related-art" />
              <div>
                <p class="related-name">{{ item.title }}</p>
                <p class="related-artist">{{ item.artist }}</p>
              </div>
            </article>
          </div>
        </div>
      </aside>
    </div>

    <footer class="player">
      <div class="now-playing">
        <div class="album-art"></div>
        <div>
          <p class="track">{{ nowPlaying.track }}</p>
          <p class="artist">{{ nowPlaying.artist }}</p>
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
  gap: 0.75rem;
  padding: 0.5rem;
}

/* ── Sidebar ── */
.sidebar {
  width: 280px;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0;
  overflow: hidden;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #ffffff;
  font-weight: 700;
  padding: 0.75rem 1rem;
  background: #0a0a0a;
  border-radius: 12px;
}

.spotify-logo {
  width: 28px;
  height: 28px;
}

/* ── Library Panel ── */
.library-panel {
  flex: 1;
  background: #0a0a0a;
  border-radius: 8px;
  margin: 0;
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
  overflow: hidden;
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
  padding: 1.75rem 2rem 7rem;
  background: linear-gradient(180deg, #111315 0%, #0a0b0d 55%, #080909 100%);
  border-radius: 12px;
  overflow-y: auto;
}

.now-panel {
  width: 320px;
  background: #0a0a0a;
  border-radius: 12px;
  padding: 1.5rem 1.25rem 7rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
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
  position: relative;
}

.search input {
  background: transparent;
  border: none;
  outline: none;
  color: #f5f5f5;
  width: 100%;
}

.search-suggestions {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background: #0f0f10;
  border: 1px solid #262626;
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.45);
  z-index: 30;
}

.suggestion-status {
  margin: 0;
  padding: 0.45rem 0.5rem;
  font-size: 0.8rem;
  color: #b3b3b3;
}

.suggestion-status.error {
  color: #ff9c9c;
}

.suggestion-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.35rem;
}

.suggestion-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.5rem;
  border-radius: 10px;
  cursor: pointer;
}

.suggestion-item:hover,
.suggestion-item:focus-visible {
  background: rgba(255, 255, 255, 0.08);
  outline: none;
}

.suggestion-art {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(29, 185, 84, 0.7), rgba(73, 97, 252, 0.9));
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #ffffff;
  overflow: hidden;
  flex-shrink: 0;
}

.suggestion-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.suggestion-text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.suggestion-title {
  font-size: 0.85rem;
  color: #ffffff;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-subtitle {
  font-size: 0.72rem;
  color: #b3b3b3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-badge {
  font-size: 0.63rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: #1db954;
  color: #0a0a0a;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
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
  gap: 2rem;
}

.search-hero {
  background: linear-gradient(120deg, rgba(73, 97, 252, 0.25), rgba(11, 14, 18, 0.92));
  padding: 2rem;
  border-radius: 24px;
}

.search-hero h1 {
  margin: 0.4rem 0 0.6rem;
  font-size: 2.3rem;
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.7rem;
  color: #a0a0a0;
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

.quick-filters {
  display: flex;
  gap: 0.5rem;
}

.quick-filter-pill {
  background: #1f1f1f;
  border: none;
  color: #ffffff;
  border-radius: 999px;
  padding: 0.35rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.quick-filter-pill.active {
  background: #ffffff;
  color: #000000;
}

.quick-filter-pill:hover:not(.active) {
  background: #3a3a3a;
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.7rem;
  background: #1b1b1b;
  border: none;
  border-radius: 10px;
  color: #ffffff;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.quick-link:hover {
  background: #262626;
}

.quick-link-art {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.home-row {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 2rem;
  align-items: start;
}

.new-release {
  background: linear-gradient(135deg, rgba(28, 32, 36, 0.9), rgba(12, 14, 17, 0.95));
  border-radius: 16px;
  padding: 1.5rem;
  display: grid;
  gap: 0.75rem;
}

.release-artist {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.release-card {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.release-art {
  width: 110px;
  height: 110px;
  border-radius: 12px;
  object-fit: cover;
}

.release-info {
  display: grid;
  gap: 0.4rem;
}

.release-meta {
  margin: 0;
  color: #b3b3b3;
  font-size: 0.8rem;
}

.release-title {
  margin: 0;
  font-size: 1.2rem;
}

.release-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.release-play {
  background: #ffffff;
  border: none;
  color: #000000;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  font-weight: 700;
}

.release-save {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #ffffff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
}

.made-for-you {
  display: grid;
  gap: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.show-all {
  background: none;
  border: none;
  color: #b3b3b3;
  font-weight: 600;
  cursor: pointer;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1.2rem;
}

.media-card {
  background: #111315;
  border-radius: 14px;
  padding: 1rem;
  display: grid;
  gap: 0.5rem;
}

.media-card h4 {
  margin: 0;
  font-size: 1rem;
}

.media-card p {
  margin: 0;
  font-size: 0.82rem;
  color: #b3b3b3;
}

.media-art {
  width: 100%;
  height: 150px;
  border-radius: 10px;
  object-fit: cover;
}

.recently-played {
  display: grid;
  gap: 1rem;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.recent-card {
  background: #111315;
  border-radius: 12px;
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.recent-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #d0d0d0;
}

.now-card {
  display: grid;
  gap: 1rem;
}

.now-album {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.now-cover {
  width: 100%;
  border-radius: 12px;
  object-fit: cover;
}

.ghost-button {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #ffffff;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.now-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.now-track {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.now-artist {
  margin: 0;
  color: #b3b3b3;
  font-size: 0.85rem;
}

.now-like {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1db954;
  color: #0a0a0a;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  font-weight: 700;
}

.related-title {
  margin: 0 0 0.75rem;
  color: #b3b3b3;
  font-size: 0.9rem;
  font-weight: 700;
}

.related-grid {
  display: grid;
  gap: 0.75rem;
}

.related-card {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: #111315;
  border-radius: 12px;
  padding: 0.5rem;
}

.related-art {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.related-name {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.related-artist {
  margin: 0;
  font-size: 0.78rem;
  color: #b3b3b3;
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

.card--interactive {
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.card--interactive:hover {
  background: #1a1d1f;
  transform: translateY(-2px);
}

.card--interactive:focus-visible {
  outline: 2px solid #1db954;
  outline-offset: 2px;
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
  overflow: hidden;
  color: #ffffff;
}

.media-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
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
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
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
    padding: 0;
  }

  .library-panel {
    flex-basis: 100%;
    margin: 0;
  }

  .now-panel {
    width: 100%;
    padding-bottom: 6rem;
  }

  .home-row {
    grid-template-columns: 1fr;
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