import { TVDBClient } from '../client/api';

// Singleton instance management
let clientInstance: TVDBClient | null = null;
let lastLoginTime: number = 0;
const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000; // 23 hours (tokens typically last 24h)

/**
 * Get or create an authenticated TVDB client instance.
 * Reuses the same client and token across all sync operations to avoid
 * unnecessary login calls that would cause rate limiting.
 */
export async function getAuthenticatedClient(): Promise<TVDBClient> {
  const apiKey = process.env.TVDB_API_KEY;

  if (!apiKey) {
    throw new Error('TVDB_API_KEY environment variable not set');
  }

  const now = Date.now();

  // Check if we need to create a new client or re-authenticate
  const needsAuth = !clientInstance || (now - lastLoginTime > TOKEN_LIFETIME_MS);

  if (needsAuth) {
    // Create new client instance
    clientInstance = new TVDBClient();
    
    // Authenticate with the API
    await clientInstance.login({ apikey: apiKey });
    
    lastLoginTime = now;
    console.log(`[TVDB] Authenticated new session at ${new Date(now).toISOString()}`);
  }

  if (!clientInstance) {
    throw new Error('Failed to initialize TVDB client');
  }

  return clientInstance;
}

/**
 * Force a new authentication (useful for error recovery)
 */
export async function refreshAuthentication(): Promise<TVDBClient> {
  clientInstance = null;
  lastLoginTime = 0;
  return getAuthenticatedClient();
}
