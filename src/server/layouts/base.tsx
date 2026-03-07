import { html } from "hono/html";
import type { FC } from "hono/jsx";

const BaseLayout: FC<{ title?: string; children: any }> = ({
  title,
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title ? `${title} - Coronagraph` : "Coronagraph"}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {html`
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ["Inter", "system-ui", "sans-serif"],
                  },
                },
              },
            };
          </script>
          <style>
            body {
              font-family: "Inter", system-ui, sans-serif;
            }
            .item-card {
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .item-card:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            .htmx-indicator {
              display: none;
            }
            .htmx-request .htmx-indicator {
              display: inline-block;
            }
            .htmx-request.htmx-indicator {
              display: inline-block;
            }
            .fade-in {
              animation: fadeIn 0.2s ease-in;
            }
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .pulse-dot {
              animation: pulse 2s infinite;
            }
            @keyframes pulse {
              0%,
              100% {
                opacity: 1;
              }
              50% {
                opacity: 0.4;
              }
            }
          </style>
        `}
      </head>
      <body class="bg-gray-950 text-gray-100 min-h-screen font-sans">
        {/* Navigation */}
        <nav class="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-14">
              <a href="/" class="flex items-center gap-2.5 group">
                <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                  C
                </div>
                <span class="text-lg font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                  Coronagraph
                </span>
              </a>
              <div class="flex items-center gap-1">
                <NavLink href="/" label="Feed" />
                <NavLink href="/briefs" label="Briefs" />
                <NavLink href="/collections" label="Collections" />
                <NavLink href="/settings" label="Settings" />
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer class="border-t border-gray-800 mt-12">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p class="text-xs text-gray-600 text-center">
              Coronagraph Intelligence Platform
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
};

const NavLink: FC<{ href: string; label: string }> = ({ href, label }) => {
  return (
    <a
      href={href}
      class="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
    >
      {label}
    </a>
  );
};

export default BaseLayout;
