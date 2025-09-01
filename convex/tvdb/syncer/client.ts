import { TVDBClient } from '../client/api';
import { ActionCtx } from '../../_generated/server';
import { internal } from '../../_generated/api';

/**
 * Get or create an authenticated TVDB client instance.
 * Uses stored tokens from the database to avoid unnecessary login calls.
 */
export async function getAuthenticatedClient(ctx: ActionCtx): Promise<TVDBClient> {
  const apiKey = process.env.TVDB_API_KEY;

  if (!apiKey) {
    throw new Error('TVDB_API_KEY environment variable not set');
  }

  // Check for existing valid token in the database
  const storedAuth = await ctx.runQuery(internal.tvdb.syncer.queries.getStoredAuthToken);

  const client = new TVDBClient();

  if (storedAuth) {
    // Use existing token
    client.setToken(storedAuth.token);
    return client;
  }

  // Need to authenticate and get a new token
  const loginResponse = await client.login({ apikey: apiKey });

  if (!loginResponse.data?.token) {
    throw new Error('Failed to authenticate with TVDB API');
  }

  // Store the token for future use (tokens typically last 24 hours)
  const expiresAt = Date.now() + 23 * 60 * 60 * 1000; // 23 hours from now
  await ctx.runMutation(internal.tvdb.syncer.internalMutations.storeAuthToken, {
    token: loginResponse.data.token,
    expiresAt,
  });

  console.log(`[TVDB] New token stored (expires at ${new Date(expiresAt).toISOString()})`);

  return client;
}

/**
 * Force a new authentication (useful for error recovery)
 */
export async function refreshAuthentication(ctx: ActionCtx): Promise<TVDBClient> {
  const apiKey = process.env.TVDB_API_KEY;

  if (!apiKey) {
    throw new Error('TVDB_API_KEY environment variable not set');
  }

  const client = new TVDBClient();

  // Force new authentication
  console.log(`[TVDB] Force refreshing authentication`);
  const loginResponse = await client.login({ apikey: apiKey });

  if (!loginResponse.data?.token) {
    throw new Error('Failed to authenticate with TVDB API');
  }

  // Store the new token
  const expiresAt = Date.now() + 23 * 60 * 60 * 1000; // 23 hours from now
  await ctx.runMutation(internal.tvdb.syncer.internalMutations.storeAuthToken, {
    token: loginResponse.data.token,
    expiresAt,
  });

  console.log(
    `[TVDB] New token stored after refresh (expires at ${new Date(expiresAt).toISOString()})`
  );

  return client;
}
