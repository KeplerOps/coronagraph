import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { getScheduledJobs, getSources } from "../../db/queries-web.ts";
import type { ScheduledJob, Source } from "../../db/schema.ts";
import BaseLayout from "../layouts/base.tsx";
import { formatDate } from "../lib/format.ts";

const settingsApp = new Hono();

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const SourceRow: FC<{ source: Source }> = ({ source }) => (
  <div class="flex items-center justify-between py-3 border-b border-gray-800/50 last:border-0">
    <div class="flex items-center gap-3">
      <div
        class={`w-2 h-2 rounded-full flex-shrink-0 ${source.enabled ? "bg-emerald-400" : "bg-gray-600"}`}
      />
      <div>
        <p class="text-sm font-medium text-gray-200">{source.name}</p>
        <p class="text-xs text-gray-500">
          {source.type} -- {source.id}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-4 text-xs text-gray-500">
      <span>Every {source.fetchIntervalMinutes ?? 30}m</span>
      <span>
        {source.lastFetched
          ? `Last: ${formatDate(source.lastFetched)}`
          : "Never fetched"}
      </span>
      <span
        class={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
          source.enabled
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
            : "bg-gray-500/15 text-gray-400 border-gray-500/20"
        }`}
      >
        {source.enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  </div>
);

const JobRow: FC<{ job: ScheduledJob }> = ({ job }) => (
  <div class="flex items-center justify-between py-3 border-b border-gray-800/50 last:border-0">
    <div class="flex items-center gap-3">
      <div
        class={`w-2 h-2 rounded-full flex-shrink-0 ${job.enabled ? "bg-emerald-400" : "bg-gray-600"}`}
      />
      <div>
        <p class="text-sm font-medium text-gray-200">{job.name}</p>
        <p class="text-xs text-gray-500">
          Prompt: {job.promptKey} -- Schedule: {job.schedule}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-4 text-xs text-gray-500">
      <span>
        {job.lastRun ? `Last run: ${formatDate(job.lastRun)}` : "Never run"}
      </span>
      <span
        class={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
          job.enabled
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
            : "bg-gray-500/15 text-gray-400 border-gray-500/20"
        }`}
      >
        {job.enabled ? "Active" : "Paused"}
      </span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// GET /settings - Settings overview
// ---------------------------------------------------------------------------

settingsApp.get("/settings", async (c) => {
  let sourcesData: Source[] = [];
  let jobsData: ScheduledJob[] = [];

  try {
    sourcesData = await getSources();
  } catch {
    // Table may be empty or not exist yet
  }

  try {
    jobsData = await getScheduledJobs();
  } catch {
    // Table may be empty or not exist yet
  }

  return c.html(
    <BaseLayout title="Settings">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-white">Settings</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Platform configuration and monitoring (read-only)
        </p>
      </div>

      <div class="space-y-6 max-w-4xl">
        {/* Configured Sources */}
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-white">Configured Sources</h2>
            <span class="text-xs text-gray-500">
              {sourcesData.length} source{sourcesData.length !== 1 ? "s" : ""}
            </span>
          </div>

          {sourcesData.length > 0 ? (
            <div>
              {sourcesData.map((src) => (
                <SourceRow source={src} />
              ))}
            </div>
          ) : (
            <p class="text-sm text-gray-500 italic">
              No sources configured. Add sources via the configuration file or
              API.
            </p>
          )}
        </div>

        {/* Scheduled Jobs */}
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-white">Scheduled Jobs</h2>
            <span class="text-xs text-gray-500">
              {jobsData.length} job{jobsData.length !== 1 ? "s" : ""}
            </span>
          </div>

          {jobsData.length > 0 ? (
            <div>
              {jobsData.map((job) => (
                <JobRow job={job} />
              ))}
            </div>
          ) : (
            <p class="text-sm text-gray-500 italic">
              No scheduled jobs configured. Jobs are defined in the platform
              configuration.
            </p>
          )}
        </div>

        {/* System Info */}
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 class="text-sm font-semibold text-white mb-4">
            System Information
          </h2>
          <div class="space-y-0">
            <div class="flex items-center gap-3 py-2 border-b border-gray-800/50">
              <span class="text-xs text-gray-500 font-medium w-32 flex-shrink-0 uppercase tracking-wider">
                Runtime
              </span>
              <span class="text-sm text-gray-300">Bun + Hono</span>
            </div>
            <div class="flex items-center gap-3 py-2 border-b border-gray-800/50">
              <span class="text-xs text-gray-500 font-medium w-32 flex-shrink-0 uppercase tracking-wider">
                Database
              </span>
              <span class="text-sm text-gray-300">PostgreSQL + pgvector</span>
            </div>
            <div class="flex items-center gap-3 py-2 border-b border-gray-800/50">
              <span class="text-xs text-gray-500 font-medium w-32 flex-shrink-0 uppercase tracking-wider">
                ORM
              </span>
              <span class="text-sm text-gray-300">Drizzle ORM</span>
            </div>
            <div class="flex items-center gap-3 py-2">
              <span class="text-xs text-gray-500 font-medium w-32 flex-shrink-0 uppercase tracking-wider">
                UI
              </span>
              <span class="text-sm text-gray-300">
                Hono JSX + HTMX + Tailwind CSS
              </span>
            </div>
          </div>
        </div>

        {/* API Endpoints */}
        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 class="text-sm font-semibold text-white mb-4">API Endpoints</h2>
          <div class="space-y-2">
            <EndpointRow method="GET" path="/health" desc="Health check" />
            <EndpointRow
              method="GET"
              path="/api/items"
              desc="List items (source, type, limit, offset)"
            />
            <EndpointRow
              method="GET"
              path="/api/items/:id"
              desc="Get single item"
            />
          </div>
        </div>
      </div>
    </BaseLayout>,
  );
});

const EndpointRow: FC<{ method: string; path: string; desc: string }> = ({
  method,
  path,
  desc,
}) => (
  <div class="flex items-center gap-3 py-1.5">
    <span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded w-10 text-center">
      {method}
    </span>
    <code class="text-xs text-gray-300 font-mono">{path}</code>
    <span class="text-xs text-gray-600">-- {desc}</span>
  </div>
);

export default settingsApp;
