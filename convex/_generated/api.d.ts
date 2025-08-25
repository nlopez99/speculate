/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as comments_mutations from "../comments/mutations.js";
import type * as episodes_mutations from "../episodes/mutations.js";
import type * as episodes_queries from "../episodes/queries.js";
import type * as leaderboard_crons from "../leaderboard/crons.js";
import type * as leaderboard_queries from "../leaderboard/queries.js";
import type * as points_crons from "../points/crons.js";
import type * as points_mutations from "../points/mutations.js";
import type * as points_queries from "../points/queries.js";
import type * as speculations_mutations from "../speculations/mutations.js";
import type * as speculations_queries from "../speculations/queries.js";
import type * as users_mutations from "../users/mutations.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "comments/mutations": typeof comments_mutations;
  "episodes/mutations": typeof episodes_mutations;
  "episodes/queries": typeof episodes_queries;
  "leaderboard/crons": typeof leaderboard_crons;
  "leaderboard/queries": typeof leaderboard_queries;
  "points/crons": typeof points_crons;
  "points/mutations": typeof points_mutations;
  "points/queries": typeof points_queries;
  "speculations/mutations": typeof speculations_mutations;
  "speculations/queries": typeof speculations_queries;
  "users/mutations": typeof users_mutations;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
