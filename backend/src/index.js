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
const normalizeEnv = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const spotifyClientId = normalizeEnv(SPOTIFY_CLIENT_ID);
const spotifyClientSecret = normalizeEnv(SPOTIFY_CLIENT_SECRET);
const spotifyRedirectUri = normalizeEnv(SPOTIFY_REDIRECT_URI);
const spotifyScopes =
  normalizeEnv(SPOTIFY_SCOPES) || 'user-read-email user-read-private';
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

    const expiresInSeconds = Number(tokenData.expires_in);

    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
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

    if (FRONTEND_URL) {
      res.redirect(FRONTEND_URL);
      return;
    }

    res.json({ status: 'connected', spotifyUserId: profile.id });
  }
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});