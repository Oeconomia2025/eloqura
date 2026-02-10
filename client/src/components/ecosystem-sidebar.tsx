import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

// Cookie helpers for cross-subdomain preference sharing
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; domain=.oeconomia.io; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}

const ecosystemItems = [
  { name: "OEC Pantheon", image: "/ecosystem/oec.png", url: "https://oeconomia.io/" },
  { name: "OEC Staking", image: "/ecosystem/stake.png", url: "https://staking.oeconomia.io/" },
  { name: "Eloqura", image: "/ecosystem/eloqura.png", url: "https://eloqura.oeconomia.io/dashboard" },
  { name: "Alluria", image: "/ecosystem/alur.png", url: "https://alluria.oeconomia.io/" },
  { name: "Artivya", image: "/ecosystem/art.png", url: "https://artivya.oeconomia.io/" },
  { name: "Iridescia", image: "/ecosystem/ill.png", url: "https://iridescia.oeconomia.io/" },
  { name: "Governance", image: "/ecosystem/governance.png", url: "https://governance.oeconomia.io/" },
];

export function EcosystemSidebar() {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ecosystem-sidebar-expanded") === "true";
    }
    return false;
  });

  const [openInNewTab, setOpenInNewTab] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = getCookie("ecosystem-open-new-tab");
      return saved !== "false"; // default to true (new tab)
    }
    return true;
  });

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("ecosystem-sidebar-expanded", String(next));
  };

  const toggleNewTab = () => {
    const next = !openInNewTab;
    setOpenInNewTab(next);
    setCookie("ecosystem-open-new-tab", String(next));
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full z-40 flex transition-all duration-300 ease-in-out ${
        expanded ? "w-[116px]" : "w-9"
      }`}
    >
      {/* Bar - always visible, acts as left edge handle */}
      <div
        className={`w-9 h-full shrink-0 cursor-pointer relative border-l border-violet-500/30 transition-colors duration-300 ${
          expanded
            ? "bg-gradient-to-b from-violet-600 via-cyan-600 to-violet-600"
            : "bg-gradient-to-b from-violet-500/30 via-cyan-500/20 to-violet-500/30 hover:from-violet-500/50 hover:via-cyan-500/40 hover:to-violet-500/50"
        }`}
        onClick={toggleExpanded}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Chevron indicator */}
          {expanded ? (
            <ChevronRight className="w-4 h-4 text-violet-400 mb-2" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-violet-400 animate-pulse mb-2" />
          )}
          {/* Vertical text */}
          <div
            className="text-lg font-bold tracking-tight leading-none text-white whitespace-nowrap"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            OECONOMIA DAO
          </div>
          {/* Chevron indicator */}
          {expanded ? (
            <ChevronRight className="w-4 h-4 text-violet-400 mt-2" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-violet-400 animate-pulse mt-2" />
          )}
        </div>
      </div>

      {/* Expanded images panel - appears to the right of bar */}
      <div
        className={`h-full bg-black/90 flex flex-col items-center justify-center gap-3 py-4 px-3 transition-all duration-300 ${
          expanded ? "w-[80px] opacity-100 overflow-visible" : "w-0 opacity-0 overflow-hidden"
        }`}
      >
        {ecosystemItems.map((item) => (
          <a
            key={item.name}
            href={item.url}
            target={item.url !== "#" && openInNewTab ? "_blank" : undefined}
            rel={item.url !== "#" && openInNewTab ? "noopener noreferrer" : undefined}
            onClick={(e) => {
              if (item.url === "#") {
                e.preventDefault();
                return;
              }
              if (!openInNewTab) {
                e.preventDefault();
                document.documentElement.classList.add("page-exit");
                setTimeout(() => {
                  window.location.href = item.url;
                }, 200);
              }
            }}
            className="group relative shrink-0"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 rounded-full object-cover transition-transform duration-200 hover:scale-110"
            />
            {/* Tooltip - positioned to the left of entire sidebar */}
            <div className="absolute top-1/2 -translate-y-1/2 px-2 py-1 bg-violet-900/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50" style={{ right: 'calc(100% + 52px)' }}>
              {item.name}
            </div>
          </a>
        ))}

        {/* New tab / Same tab toggle */}
        <div className="shrink-0 mt-1">
          <button
            onClick={toggleNewTab}
            className={`group relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              openInNewTab
                ? "bg-violet-500/30 border border-violet-400/50 text-violet-300"
                : "bg-white/10 border border-white/20 text-white/40"
            }`}
            title={openInNewTab ? "Opening in new tab" : "Opening in same tab"}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {/* Tooltip */}
            <div className="absolute top-1/2 -translate-y-1/2 px-2 py-1 bg-violet-900/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50" style={{ right: 'calc(100% + 52px)' }}>
              {openInNewTab ? "New tab" : "Same tab"}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
