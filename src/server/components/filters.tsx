import type { FC } from "hono/jsx";

const SOURCES = [
  { value: "", label: "All Sources" },
  { value: "nvd", label: "NVD" },
  { value: "arxiv", label: "arXiv" },
  { value: "inoreader", label: "Inoreader" },
  { value: "cisa-kev", label: "CISA KEV" },
  { value: "github-advisories", label: "GitHub Advisories" },
];

const TYPES = [
  { value: "", label: "All Types" },
  { value: "vulnerability", label: "Vulnerability" },
  { value: "paper", label: "Paper" },
  { value: "article", label: "Article" },
  { value: "advisory", label: "Advisory" },
];

const selectClasses =
  "bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors";

const inputClasses =
  "bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 pl-9 focus:ring-blue-500 focus:border-blue-500 outline-none w-full sm:w-72 hover:border-gray-600 transition-colors placeholder-gray-500";

export const Filters: FC<{
  currentSource?: string;
  currentType?: string;
  currentQuery?: string;
}> = ({ currentSource = "", currentType = "", currentQuery = "" }) => {
  return (
    <form
      id="filter-form"
      class="flex flex-col sm:flex-row items-start sm:items-center gap-3"
    >
      {/* Search input */}
      <div class="relative flex-1 w-full sm:w-auto">
        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            class="w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          name="q"
          value={currentQuery}
          placeholder="Search items..."
          class={inputClasses}
          hx-get="/feed/items"
          hx-target="#items-list"
          hx-trigger="keyup changed delay:300ms"
          hx-include="#filter-form"
        />
      </div>

      {/* Source filter */}
      <select
        name="source"
        class={selectClasses}
        hx-get="/feed/items"
        hx-target="#items-list"
        hx-trigger="change"
        hx-include="#filter-form"
      >
        {SOURCES.map(({ value, label }) => (
          <option value={value} selected={value === currentSource}>
            {label}
          </option>
        ))}
      </select>

      {/* Type filter */}
      <select
        name="type"
        class={selectClasses}
        hx-get="/feed/items"
        hx-target="#items-list"
        hx-trigger="change"
        hx-include="#filter-form"
      >
        {TYPES.map(({ value, label }) => (
          <option value={value} selected={value === currentType}>
            {label}
          </option>
        ))}
      </select>

      {/* Indicator */}
      <span class="htmx-indicator text-xs text-gray-500">Loading...</span>
    </form>
  );
};

export default Filters;
