require("node:dns").setServers(["1.1.1.1", "8.8.8.8"]);

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('node:crypto');
const os = require('node:os');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
app.use(express.json());

const {
  MONGODB_URI,
  PORT = 3000,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  SPOTIFY_TOKEN_ENCRYPTION_KEY,
  SPOTIFY_TOKEN_ENCRYPTION_SALT,
  FRONTEND_URL,
} = process.env;

const isProduction = process.env.NODE_ENV === 'production';
const stripWrappingQuotes = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length >= 2) {
    const firstChar = trimmedValue[0];
    const lastChar = trimmedValue[trimmedValue.length - 1];
    const hasMatchingQuotes =
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === "'" && lastChar === "'");
    if (hasMatchingQuotes) {
      return trimmedValue.slice(1, -1);
    }
  }
  return trimmedValue;
};
const normalizeEnv = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  const sanitized = stripWrappingQuotes(value);
  return sanitized.length > 0 ? sanitized : undefined;
};
const isPlaceholderValue = (value, placeholder) => {
  if (typeof value !== 'string') {
    return false;
  }
  // Compare case-insensitively to catch placeholder values copied from templates.
  return value.toLowerCase() === placeholder.toLowerCase();
};
const resolveOrigin = (value) => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch (error) {
    console.warn(
      `FRONTEND_URL "${value}" is invalid; CORS will allow all origins. Please check your configuration.`,
      error
    );
    return null;
  }
};
const frontendUrl = normalizeEnv(FRONTEND_URL);
const frontendOrigin = resolveOrigin(frontendUrl);
if (isProduction && !frontendOrigin) {
  console.error(
    'ERROR: FRONTEND_URL must be set to a valid URL in production. Exiting.'
  );
  process.exit(1);
}
const spotifyClientId = normalizeEnv(SPOTIFY_CLIENT_ID);
const spotifyClientSecret = normalizeEnv(SPOTIFY_CLIENT_SECRET);
const spotifyRedirectUri = normalizeEnv(SPOTIFY_REDIRECT_URI);
const placeholderClientId = 'your-spotify-client-id';
const placeholderClientSecret = 'your-spotify-client-secret';
const spotifyScopes =
  normalizeEnv(SPOTIFY_SCOPES) ||
  'user-read-email user-read-private playlist-read-private playlist-read-collaborative';
const tokenEncryptionKeyValue = normalizeEnv(SPOTIFY_TOKEN_ENCRYPTION_KEY);
const tokenEncryptionSaltValue = normalizeEnv(SPOTIFY_TOKEN_ENCRYPTION_SALT);
const encryptionKeyPattern = /^[0-9a-fA-F]{64}$/;
const deriveEncryptionKey = (value, salt) => {
  if (!value) {
    return null;
  }
  if (encryptionKeyPattern.test(value)) {
    return Buffer.from(value, 'hex');
  }
  if (!salt) {
    return null;
  }
  try {
    return crypto.scryptSync(value, salt, 32);
  } catch (error) {
    console.error('Token encryption key derivation failed:', error);
    return null;
  }
};
const isPassphraseKey =
  Boolean(tokenEncryptionKeyValue) && !encryptionKeyPattern.test(tokenEncryptionKeyValue);
const fallbackSalt =
  !isProduction && isPassphraseKey && !tokenEncryptionSaltValue
    ? crypto.createHash('sha256').update(`spotify-token:${os.hostname()}`).digest('hex')
    : null;
const tokenEncryptionSalt = tokenEncryptionSaltValue || fallbackSalt;
const tokenEncryptionKey = deriveEncryptionKey(
  tokenEncryptionKeyValue,
  tokenEncryptionSalt
);
const hasValidEncryptionKey = Boolean(tokenEncryptionKey);
const corsOrigin = frontendOrigin || '*';
if (!frontendOrigin) {
  console.warn('FRONTEND_URL is not set or invalid; CORS will allow all origins.');
}
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
if (fallbackSalt) {
  console.warn(
    'WARNING: SPOTIFY_TOKEN_ENCRYPTION_SALT is not set when using a passphrase. Deterministic hostname-based salt fallback is less secure and intended for development only.'
  );
}
if (isProduction && isPassphraseKey && !tokenEncryptionSaltValue) {
  console.error(
    'ERROR: SPOTIFY_TOKEN_ENCRYPTION_SALT is required for passphrase encryption in production.'
  );
  process.exit(1);
}

const spotifyTokenSchema = new mongoose.Schema(
  {
    spotifyUserId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    tokenType: { type: String, required: true },
    scope: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const SpotifyToken =
  mongoose.models.SpotifyToken || mongoose.model('SpotifyToken', spotifyTokenSchema);

const STATE_TTL_SECONDS = 10 * 60;
const spotifyAuthStateSchema = new mongoose.Schema({
  state: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: STATE_TTL_SECONDS },
});

const SpotifyAuthState =
  mongoose.models.SpotifyAuthState ||
  mongoose.model('SpotifyAuthState', spotifyAuthStateSchema);

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('MongoDB connected');
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
    });
} else {
  console.warn('MONGODB_URI is not set. Skipping MongoDB connection.');
}

const requireSpotifyConfig = (req, res, next) => {
  const missing = [];
  if (!spotifyClientId) {
    missing.push('SPOTIFY_CLIENT_ID');
  }
  if (!spotifyClientSecret) {
    missing.push('SPOTIFY_CLIENT_SECRET');
  }
  if (!spotifyRedirectUri) {
    missing.push('SPOTIFY_REDIRECT_URI');
  }
  if (!tokenEncryptionKeyValue) {
    missing.push('SPOTIFY_TOKEN_ENCRYPTION_KEY');
  }
  if (missing.length > 0) {
    res.status(500).json({
      error: `Missing required Spotify configuration. Please set ${missing.join(
        ', '
      )} in your environment.`,
    });
    return;
  }
  const placeholderFields = [];
  if (isPlaceholderValue(spotifyClientId, placeholderClientId)) {
    placeholderFields.push('SPOTIFY_CLIENT_ID');
  }
  if (isPlaceholderValue(spotifyClientSecret, placeholderClientSecret)) {
    placeholderFields.push('SPOTIFY_CLIENT_SECRET');
  }
  if (placeholderFields.length > 0) {
    res.status(400).json({
      error: `The following environment variables are still set to placeholder values: ${placeholderFields.join(
        ', '
      )}. Update them with your actual Spotify app credentials from the Spotify Developer Dashboard.`,
    });
    return;
  }
  if (!hasValidEncryptionKey) {
    res.status(500).json({
      error:
        'Unable to derive the token encryption key. Use a 64-character hex SPOTIFY_TOKEN_ENCRYPTION_KEY or provide a passphrase with SPOTIFY_TOKEN_ENCRYPTION_SALT configured.',
    });
    return;
  }
  next();
};

const requireMongoConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(500).json({
      error:
        'Database connection required. Please ensure MONGODB_URI is configured and the database is accessible.',
    });
    return;
  }
  next();
};

const encryptToken = (token) => {
  if (!hasValidEncryptionKey) {
    return null;
  }
  try {
    // 12-byte initialization vectors (IVs) are recommended for AES-256-GCM; always generate a fresh IV.
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenEncryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString(
      'base64'
    )}`;
  } catch (error) {
    console.error('Token encryption failed:', error);
    return null;
  }
};

const decryptToken = (payload) => {
  if (!hasValidEncryptionKey || !payload) {
    return null;
  }
  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split('.');
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      tokenEncryptionKey,
      Buffer.from(ivEncoded, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Token decryption failed:', error);
    return null;
  }
};

const spotifyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const DEFAULT_PLAYLIST_LIMIT = 8;
const MIN_PLAYLIST_LIMIT = 1;
const MAX_PLAYLIST_LIMIT = 50;

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // 60 seconds (in milliseconds)

const parseExpiresInSeconds = (value) => {
  // Spotify may return integer or decimal seconds; Number() handles both.
  const expiresInSeconds = Number(value);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return null;
  }
  return expiresInSeconds;
};

const getSpotifyUserId = (req) => {
  const rawUserId = req.query.spotifyUserId;
  if (Array.isArray(rawUserId)) {
    const value = rawUserId[0];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return null;
  }
  if (typeof rawUserId === 'string') {
    const trimmed = rawUserId.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const refreshSpotifyAccessToken = async (tokenRecord) => {
  const decryptedRefreshToken = decryptToken(tokenRecord.refreshToken);
  if (!decryptedRefreshToken) {
    console.error(
      `Failed to decrypt stored Spotify refresh token for user ${tokenRecord.spotifyUserId}. The token may be corrupted or encrypted with a different key. User will need to re-authenticate.`
    );
    return null;
  }

  let tokenData;
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${spotifyClientId}:${spotifyClientSecret}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptedRefreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Spotify token refresh failed:', errorText);
      return null;
    }

    tokenData = await tokenResponse.json();
  } catch (error) {
    console.error('Spotify token refresh error:', error);
    return null;
  }

  if (!tokenData?.access_token) {
    console.error('Spotify token refresh response missing access token.');
    return null;
  }

  const expiresInSeconds = parseExpiresInSeconds(tokenData.expires_in);
  if (!expiresInSeconds) {
    console.error('Spotify token refresh response has invalid expiry.');
    return null;
  }

  // According to Spotify's API docs, refresh_token may be omitted; retain the existing one.
  const refreshToken = tokenData.refresh_token || decryptedRefreshToken;
  const encryptedAccessToken = encryptToken(tokenData.access_token);
  const encryptedRefreshToken = encryptToken(refreshToken);
  if (!encryptedAccessToken || !encryptedRefreshToken) {
    console.error('Spotify token refresh encryption failed.');
    return null;
  }

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  try {
    await SpotifyToken.findOneAndUpdate(
      { spotifyUserId: tokenRecord.spotifyUserId },
      {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenType: tokenData.token_type || tokenRecord.tokenType,
        scope: tokenData.scope || tokenRecord.scope,
        expiresAt,
      },
      { new: true }
    );
  } catch (error) {
    console.error('Spotify refreshed token storage failed:', error);
    return null;
  }

  return tokenData.access_token;
};

const resolveSpotifyAccessToken = async (spotifyUserId) => {
  const tokenRecord = await SpotifyToken.findOne({ spotifyUserId });
  if (!tokenRecord) {
    return { error: 'Spotify account not connected. Please log in again.', status: 401 };
  }

  const decryptedAccessToken = decryptToken(tokenRecord.accessToken);
  if (!decryptedAccessToken) {
    return {
      error:
        'Stored Spotify access token is invalid or could not be decrypted. Please re-authenticate.',
      status: 500,
    };
  }

  const expiresAt = tokenRecord.expiresAt ? new Date(tokenRecord.expiresAt) : null;
  if (!expiresAt) {
    console.warn('Spotify token record missing expiresAt; refreshing token.');
  }
  const shouldRefresh =
    !expiresAt || expiresAt.getTime() <= Date.now() + TOKEN_REFRESH_BUFFER_MS;

  if (!shouldRefresh) {
    return { accessToken: decryptedAccessToken };
  }

  const refreshedAccessToken = await refreshSpotifyAccessToken(tokenRecord);
  if (!refreshedAccessToken) {
    return { error: 'Failed to refresh Spotify access token.', status: 502 };
  }

  return { accessToken: refreshedAccessToken };
};

const createState = async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = crypto.randomBytes(16).toString('hex');
    try {
      await SpotifyAuthState.create({ state });
      return state;
    } catch (error) {
      if (error?.code === 11000) {
        continue;
      }
      console.error('Spotify auth state creation failed:', error);
      return null;
    }
  }
  console.error('Spotify auth state creation failed: unable to generate unique state.');
  return null;
};

const consumeState = async (state) => {
  if (!state) {
    return false;
  }
  const storedState = await SpotifyAuthState.findOneAndDelete({ state });
  return Boolean(storedState);
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get(
  '/api/spotify/me',
  requireSpotifyConfig,
  requireMongoConnection,
  spotifyRateLimiter,
  async (req, res) => {
    const spotifyUserId = getSpotifyUserId(req);
    if (!spotifyUserId) {
      res.status(400).json({ error: 'Missing spotifyUserId query parameter.' });
      return;
    }

    const { accessToken, error, status } = await resolveSpotifyAccessToken(spotifyUserId);
    if (!accessToken) {
      res.status(status || 502).json({ error });
      return;
    }

    try {
      const profileResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error('Spotify profile fetch failed:', errorText);
        res.status(profileResponse.status === 401 ? 401 : 502).json({
          error: 'Failed to fetch Spotify profile.',
        });
        return;
      }

      const profile = await profileResponse.json();
      res.json(profile);
    } catch (error) {
      console.error('Spotify profile fetch error:', error);
      res.status(502).json({ error: 'Failed to fetch Spotify profile.' });
    }
  }
);

app.get(
  '/api/spotify/search',
  requireSpotifyConfig,
  requireMongoConnection,
  spotifyRateLimiter,
  async (req, res) => {
    const spotifyUserId = getSpotifyUserId(req);
    if (!spotifyUserId) {
      res.status(400).json({ error: 'Missing spotifyUserId query parameter.' });
      return;
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      res.status(400).json({ error: 'Missing search query.' });
      return;
    }

    const { accessToken, error, status } = await resolveSpotifyAccessToken(spotifyUserId);
    if (!accessToken) {
      res.status(status || 502).json({ error });
      return;
    }

    const params = new URLSearchParams({
      q: query,
      type: 'track,artist,album',
      limit: '6',
    });

    try {
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Spotify search failed:', errorText);
        res.status(searchResponse.status === 401 ? 401 : 502).json({
          error: 'Failed to search Spotify.',
        });
        return;
      }

      const results = await searchResponse.json();
      res.json(results);
    } catch (error) {
      console.error('Spotify search error:', error);
      res.status(502).json({ error: 'Failed to search Spotify.' });
    }
  }
);

app.get(
  '/api/spotify/playlists',
  requireSpotifyConfig,
  requireMongoConnection,
  spotifyRateLimiter,
  async (req, res) => {
    const spotifyUserId = getSpotifyUserId(req);
    if (!spotifyUserId) {
      res.status(400).json({ error: 'Missing spotifyUserId query parameter.' });
      return;
    }

    const { accessToken, error, status } = await resolveSpotifyAccessToken(spotifyUserId);
    if (!accessToken) {
      res.status(status || 502).json({ error });
      return;
    }

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const parsedLimit =
      rawLimit === undefined || rawLimit === '' ? Number.NaN : Number(rawLimit);
    const limitValue = Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_PLAYLIST_LIMIT;
    const limit = Math.max(
      MIN_PLAYLIST_LIMIT,
      Math.min(limitValue, MAX_PLAYLIST_LIMIT)
    );
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    try {
      const playlistResponse = await fetch(
        `https://api.spotify.com/v1/me/playlists?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!playlistResponse.ok) {
        const errorText = await playlistResponse.text();
        console.error('Spotify playlists fetch failed:', errorText);
        res.status(playlistResponse.status === 401 ? 401 : 502).json({
          error: 'Failed to fetch Spotify playlists.',
        });
        return;
      }

      const results = await playlistResponse.json();
      res.json(results);
    } catch (error) {
      console.error('Spotify playlists fetch error:', error);
      res.status(502).json({ error: 'Failed to fetch Spotify playlists.' });
    }
  }
);

app.get(
  '/auth/spotify/login',
  requireSpotifyConfig,
  requireMongoConnection,
  spotifyRateLimiter,
  async (req, res) => {
    const state = await createState();
    if (!state) {
      res.status(500).json({ error: 'Failed to initialize Spotify login.' });
      return;
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: spotifyClientId,
      scope: spotifyScopes,
      redirect_uri: spotifyRedirectUri,
      state,
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  }
);

app.get(
  '/auth/spotify/callback',
  requireSpotifyConfig,
  requireMongoConnection,
  spotifyRateLimiter,
  async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      res.status(400).json({ error: `Spotify authorization error: ${error}` });
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Missing Spotify authorization code.' });
      return;
    }

    if (!(await consumeState(state))) {
      res.status(400).json({ error: 'Invalid or expired Spotify state.' });
      return;
    }

    let tokenData;

    try {
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${spotifyClientId}:${spotifyClientSecret}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: spotifyRedirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Spotify token exchange failed:', errorText);
        let errorPayload;
        try {
          errorPayload = JSON.parse(errorText);
        } catch {
          errorPayload = null;
        }
        if (errorPayload?.error === 'invalid_client') {
          res.status(401).json({
            error:
              'Invalid Spotify client credentials. Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.',
          });
          return;
        }
        res.status(502).json({ error: 'Failed to exchange Spotify token.' });
        return;
      }

      tokenData = await tokenResponse.json();
    } catch (error) {
      console.error('Spotify token exchange error:', error);
      res.status(502).json({ error: 'Failed to exchange Spotify token.' });
      return;
    }

    let profile;

    try {
      const profileResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error('Spotify profile fetch failed:', errorText);
        res.status(502).json({ error: 'Failed to fetch Spotify profile.' });
        return;
      }

      profile = await profileResponse.json();
    } catch (error) {
      console.error('Spotify profile fetch error:', error);
      res.status(502).json({ error: 'Failed to fetch Spotify profile.' });
      return;
    }

    if (tokenData.expires_in === undefined) {
      res.status(502).json({ error: 'Spotify token expiration is missing.' });
      return;
    }

    const expiresInSeconds = parseExpiresInSeconds(tokenData.expires_in);
    if (!expiresInSeconds) {
      res.status(502).json({ error: 'Spotify token expiration must be a positive number.' });
      return;
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    let plainRefreshToken = tokenData.refresh_token;

    if (!plainRefreshToken) {
      // Spotify omits refresh_token if access was previously granted and not revoked.
      let existingToken = await SpotifyToken.findOne({ spotifyUserId: profile.id });
      if (!existingToken || !existingToken.refreshToken) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        existingToken = await SpotifyToken.findOne({ spotifyUserId: profile.id });
      }
      if (!existingToken || !existingToken.refreshToken) {
        res.status(502).json({
          error:
            'Spotify refresh token was not returned and no stored token was found. Please revoke access in Spotify settings and re-authorize.',
        });
        return;
      }
      const decryptedRefreshToken = decryptToken(existingToken.refreshToken);
      if (!decryptedRefreshToken) {
        res.status(502).json({ error: 'Stored Spotify refresh token is invalid.' });
        return;
      }
      console.warn(
        `Spotify refresh token missing for user ${profile.id}; retaining existing token.`
      );
      plainRefreshToken = decryptedRefreshToken;
    }

    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(plainRefreshToken);
    if (!encryptedAccessToken || !encryptedRefreshToken) {
      res.status(500).json({ error: 'Failed to secure Spotify tokens.' });
      return;
    }

    try {
      await SpotifyToken.findOneAndUpdate(
        { spotifyUserId: profile.id },
        {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenType: tokenData.token_type,
          scope: tokenData.scope,
          expiresAt,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      console.error('Spotify token storage failed:', error);
      res.status(500).json({ error: 'Failed to store Spotify tokens.' });
      return;
    }

    if (frontendUrl) {
      try {
        const redirectUrl = new URL(frontendUrl);
        redirectUrl.searchParams.set('spotify_user', profile.id);
        res.redirect(redirectUrl.toString());
      } catch (error) {
        console.error('FRONTEND_URL is invalid; unable to redirect.', error);
        res.status(500).json({ error: 'Invalid FRONTEND_URL configuration.' });
      }
      return;
    }

    res.json({ status: 'connected', spotifyUserId: profile.id });
  }
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});