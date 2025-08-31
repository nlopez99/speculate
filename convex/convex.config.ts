import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();

// Configure workpool for TVDB syncing with appropriate parallelism limits
app.use(workpool, { 
  name: "tvdbSyncPool",
  // Limit parallelism to avoid overwhelming TVDB API
  // Can be adjusted based on your API rate limits
});

export default app;