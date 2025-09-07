import { defineApp } from 'convex/server';
import workpool from '@convex-dev/workpool/convex.config';

const app = defineApp();

// Configure workpool for TVDB syncing with appropriate parallelism limits
app.use(workpool, {
  name: 'tvdbSyncPool',
});

export default app;
