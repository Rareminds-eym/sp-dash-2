// open-next.config.ts for @opennextjs/cloudflare
//
// R2-backed incremental cache is intentionally not enabled here — that
// requires creating an R2 bucket first (see wrangler.toml). Enable it later
// by adding the NEXT_INC_CACHE_R2_BUCKET binding to wrangler.toml and
// uncommenting the import/option below.
// See https://opennext.js.org/cloudflare/caching for details.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
	// incrementalCache: r2IncrementalCache,
});
