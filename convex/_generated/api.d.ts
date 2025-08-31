/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as comments_mutations from "../comments/mutations.js";
import type * as episodes_mutations from "../episodes/mutations.js";
import type * as episodes_queries from "../episodes/queries.js";
import type * as http from "../http.js";
import type * as leaderboard_crons from "../leaderboard/crons.js";
import type * as leaderboard_queries from "../leaderboard/queries.js";
import type * as points_crons from "../points/crons.js";
import type * as points_mutations from "../points/mutations.js";
import type * as points_queries from "../points/queries.js";
import type * as shows_mutations from "../shows/mutations.js";
import type * as shows_queries from "../shows/queries.js";
import type * as speculations_mutations from "../speculations/mutations.js";
import type * as speculations_queries from "../speculations/queries.js";
import type * as tvdb_client_api from "../tvdb/client/api.js";
import type * as tvdb_crons from "../tvdb/crons.js";
import type * as tvdb_syncer_actions from "../tvdb/syncer/actions.js";
import type * as tvdb_syncer_client from "../tvdb/syncer/client.js";
import type * as tvdb_syncer_fullSync from "../tvdb/syncer/fullSync.js";
import type * as tvdb_syncer_index from "../tvdb/syncer/index.js";
import type * as tvdb_syncer_mutations from "../tvdb/syncer/mutations.js";
import type * as tvdb_syncer_publicMutations from "../tvdb/syncer/publicMutations.js";
import type * as tvdb_syncer_queries from "../tvdb/syncer/queries.js";
import type * as tvdb_syncer_types from "../tvdb/syncer/types.js";
import type * as tvdb_syncer_workpool from "../tvdb/syncer/workpool.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "comments/mutations": typeof comments_mutations;
  "episodes/mutations": typeof episodes_mutations;
  "episodes/queries": typeof episodes_queries;
  http: typeof http;
  "leaderboard/crons": typeof leaderboard_crons;
  "leaderboard/queries": typeof leaderboard_queries;
  "points/crons": typeof points_crons;
  "points/mutations": typeof points_mutations;
  "points/queries": typeof points_queries;
  "shows/mutations": typeof shows_mutations;
  "shows/queries": typeof shows_queries;
  "speculations/mutations": typeof speculations_mutations;
  "speculations/queries": typeof speculations_queries;
  "tvdb/client/api": typeof tvdb_client_api;
  "tvdb/crons": typeof tvdb_crons;
  "tvdb/syncer/actions": typeof tvdb_syncer_actions;
  "tvdb/syncer/client": typeof tvdb_syncer_client;
  "tvdb/syncer/fullSync": typeof tvdb_syncer_fullSync;
  "tvdb/syncer/index": typeof tvdb_syncer_index;
  "tvdb/syncer/mutations": typeof tvdb_syncer_mutations;
  "tvdb/syncer/publicMutations": typeof tvdb_syncer_publicMutations;
  "tvdb/syncer/queries": typeof tvdb_syncer_queries;
  "tvdb/syncer/types": typeof tvdb_syncer_types;
  "tvdb/syncer/workpool": typeof tvdb_syncer_workpool;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  tvdbSyncPool: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        },
        any
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        {
          before?: number;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        },
        any
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          config: {
            logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism: number;
          };
          fnArgs: any;
          fnHandle: string;
          fnName: string;
          fnType: "action" | "mutation" | "query";
          onComplete?: { context?: any; fnHandle: string };
          retryBehavior?: {
            base: number;
            initialBackoffMs: number;
            maxAttempts: number;
          };
          runAt: number;
        },
        string
      >;
      enqueueBatch: FunctionReference<
        "mutation",
        "internal",
        {
          config: {
            logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism: number;
          };
          items: Array<{
            fnArgs: any;
            fnHandle: string;
            fnName: string;
            fnType: "action" | "mutation" | "query";
            onComplete?: { context?: any; fnHandle: string };
            retryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            runAt: number;
          }>;
        },
        Array<string>
      >;
      status: FunctionReference<
        "query",
        "internal",
        { id: string },
        | { previousAttempts: number; state: "pending" }
        | { previousAttempts: number; state: "running" }
        | { state: "finished" }
      >;
      statusBatch: FunctionReference<
        "query",
        "internal",
        { ids: Array<string> },
        Array<
          | { previousAttempts: number; state: "pending" }
          | { previousAttempts: number; state: "running" }
          | { state: "finished" }
        >
      >;
    };
  };
};
