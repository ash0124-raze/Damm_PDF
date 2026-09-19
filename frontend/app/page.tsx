// import Link from "next/link";
// // import { useState } from "react";

// const tools = [
//   { name: "Compress PDF", desc: "Shrink file size via Ghostscript", href: "/compress", color: "bg-blue-50 text-blue-600 border-blue-100" },
//   { name: "Merge PDFs", desc: "Combine multiple documents into one", href: "/merge", color: "bg-green-50 text-green-600 border-green-100" },
//   { name: "Split PDF", desc: "Extract specific page ranges", href: "/split", color: "bg-purple-50 text-purple-600 border-purple-100" },
//   { name: "Images to PDF", desc: "Compile PNG or JPGs into a PDF", href: "/images-to-pdf", color: "bg-orange-50 text-orange-600 border-orange-100" },
//   { name: "Rotate PDF", desc: "Fix page orientation angles", href: "/rotate", color: "bg-pink-50 text-pink-600 border-pink-100" },
//   { name: "PDF to Images", desc: "Extract pages into a ZIP archive", href: "/pdf-to-images", color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
//   { name: "Protect PDF", desc: "Secure documents with a password", href: "/encrypt", color: "bg-red-50 text-red-600 border-lightblue-100" },
// ];

// export default function Home() {
//   return (
//     <div className="max-w-5xl mx-auto p-8 mt-12">
//       <div className="text-center mb-12">
//         <h1 className="text-4xl font-extrabold text-Green-900 mb-3">Your Cloud PDF Suite</h1>
//         <p className="text-lightgreen-500 text-lg">Fast, secure, and asynchronous document management tools powered by FastAPI & Celery.</p>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//         {tools.map((tool, index) => (
//           <Link 
//             key={index} 
//             href={tool.href}
//             className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
//           >
//             <div>
//               <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-2">{tool.name}</h3>
//               <p className="text-gray-500 text-sm">{tool.desc}</p>
//             </div>
//             <span className="mt-6 text-sm font-semibold text-blue-600 flex items-center gap-1">
//               Launch Tool &rarr;
//             </span>
//           </Link>
//         ))}
//       </div>
//     </div>
//   );
// }

import Link from "next/link";

type Tool = {
  name: string;
  desc: string;
  href: string;
  tint: string;
  ink: string;
  icon: React.ReactNode;
};

const tools: Tool[] = [
  {
    name: "Compress PDF",
    desc: "Squeeze a heavy file down to something you can actually email.",
    href: "/compress",
    tint: "#BFE3FF",
    ink: "#1B4F72",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="9" y="6" width="30" height="16" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <rect x="13" y="30" width="22" height="12" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 23v4M20 25l4 3 4-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Merge PDFs",
    desc: "Stack a pile of documents into one tidy file, in the order you choose.",
    href: "/merge",
    tint: "#C8F2D6",
    ink: "#1E6B44",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="6" y="12" width="20" height="26" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <rect x="18" y="6" width="20" height="26" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
        <path d="M12 22h8M12 28h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Split PDF",
    desc: "Pull out just the pages you need and leave the rest behind.",
    href: "/split",
    tint: "#E4D4FF",
    ink: "#5B3A9B",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="7" y="9" width="15" height="30" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <rect x="26" y="9" width="15" height="30" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 5v38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 5" />
      </svg>
    ),
  },
  {
    name: "Images to PDF",
    desc: "Turn a folder of photos or scans into a single document.",
    href: "/images-to-pdf",
    tint: "#FFDDB0",
    ink: "#9A5A12",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="7" y="11" width="34" height="26" rx="4" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="17" cy="20" r="3.2" fill="currentColor" />
        <path d="M10 33l9-9 7 7 5-4 7 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Rotate PDF",
    desc: "Set every page the right way up, one quarter turn at a time.",
    href: "/rotate",
    tint: "#FFD3DE",
    ink: "#A63A5C",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="12" y="12" width="24" height="24" rx="4" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 6a18 18 0 0 1 14 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M39 6v8h-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "PDF to Images",
    desc: "Get every page as a picture, bundled up in one zip.",
    href: "/pdf-to-images",
    tint: "#CFD6FF",
    ink: "#3A44A0",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="8" y="7" width="22" height="28" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <rect x="19" y="18" width="21" height="23" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
        <path d="M23 34l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Protect PDF",
    desc: "Lock a document behind a password before you send it on.",
    href: "/encrypt",
    tint: "#FFE7A3",
    ink: "#8A5A00",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
        <rect x="11" y="21" width="26" height="19" rx="4" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
        <path d="M17 21v-5a7 7 0 0 1 14 0v5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="30" r="2.6" fill="currentColor" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="paper-desk relative min-h-screen overflow-hidden px-5 pb-24 pt-14 sm:px-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700&display=swap');

        .paper-desk {
          background:
            radial-gradient(120% 90% at 50% -10%, #4A3E77 0%, #332B57 45%, #241F42 100%);
          background-color: #241F42;
          font-family: 'Nunito', ui-sans-serif, system-ui, sans-serif;
          color: #FFF6E6;
        }

        .lamp-glow {
          background: radial-gradient(closest-side, rgba(255,209,102,.38), rgba(255,209,102,0) 100%);
          filter: blur(2px);
        }

        .display { font-family: 'Baloo 2', 'Nunito', cursive; letter-spacing: -0.5px; }

        /* chunky cartoon card: thick outline + hard offset shadow, no blur */
        .toon-card {
          border: 3px solid #241F42;
          box-shadow: 6px 7px 0 #241F42;
          transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease;
        }
        .toon-card:hover, .toon-card:focus-visible {
          transform: translate(-3px, -4px) rotate(-.6deg);
          box-shadow: 10px 12px 0 #241F42;
        }
        .toon-card:active { transform: translate(2px, 3px); box-shadow: 3px 3px 0 #241F42; }

        .toon-badge {
          border: 3px solid #241F42;
          box-shadow: 4px 5px 0 #241F42;
        }

        /* drifting paper scraps behind the content */
        .scrap {
          position: absolute;
          border: 3px solid #241F42;
          border-radius: 10px;
          opacity: .5;
          animation: drift 17s ease-in-out infinite;
        }
        @keyframes drift {
          0%, 100% { transform: translateY(0) rotate(var(--r, -6deg)); }
          50%      { transform: translateY(-22px) rotate(calc(var(--r, -6deg) * -1)); }
        }

        @media (prefers-reduced-motion: reduce) {
          .scrap { animation: none; }
          .toon-card { transition: none; }
          .toon-card:hover, .toon-card:focus-visible { transform: none; }
        }
      `}</style>

      {/* desk-lamp pool of light behind the heading */}
      <div className="lamp-glow pointer-events-none absolute left-1/2 top-[-120px] h-[520px] w-[820px] -translate-x-1/2" />

      {/* paper scraps drifting in the background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="scrap left-[6%] top-[22%] h-16 w-12 bg-[#FFD166]" style={{ ["--r" as string]: "-8deg", animationDelay: "0s" }} />
        <span className="scrap right-[9%] top-[16%] h-14 w-16 bg-[#7ED6A5]" style={{ ["--r" as string]: "7deg", animationDelay: "2.4s" }} />
        <span className="scrap left-[14%] bottom-[14%] h-20 w-14 bg-[#7CC5F0]" style={{ ["--r" as string]: "5deg", animationDelay: "4.1s" }} />
        <span className="scrap right-[12%] bottom-[20%] h-12 w-12 bg-[#FF9AA2]" style={{ ["--r" as string]: "-11deg", animationDelay: "1.3s" }} />
      </div>

      <main className="relative mx-auto max-w-5xl">
        <header className="mb-14 text-center">
          <span className="toon-badge display inline-block rotate-[-2deg] rounded-full bg-[#FFD166] px-5 py-1.5 text-sm font-bold text-[#241F42]">
            the little paper workshop
            {/* Damm PDF */}
          </span>

          <h1 className="display mt-6 text-5xl font-extrabold leading-[1.05] text-[#FFF6E6] sm:text-6xl">
            Everything you do
            <br />
            to a PDF, in one place
          </h1>

          <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-relaxed text-[#E4DCF5]">
            Drop a file in, pick a tool, and we&rsquo;ll get to work in the background.
            Nothing to install, nothing left sitting on our servers.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="toon-card group flex flex-col justify-between rounded-[22px] bg-[#FFF6E6] p-6 outline-none focus-visible:ring-4 focus-visible:ring-[#FFD166]"
            >
              <div>
                <span
                  className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#241F42]"
                  style={{ background: tool.tint, color: tool.ink }}
                >
                  {tool.icon}
                </span>

                <h2 className="display text-2xl font-bold text-[#241F42]">{tool.name}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">{tool.desc}</p>
              </div>

              <span className="mt-6 inline-flex w-fit rounded-full border-[3px] border-[#241F42] bg-[#241F42] px-4 py-1.5 text-sm font-bold text-[#FFF6E6] transition-colors group-hover:bg-[#FFD166] group-hover:text-[#241F42]">
                Open {tool.name.split(" ")[0].toLowerCase()}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-14 text-center text-sm text-[#BDB4D8]">
          Big files are handled in the background, so you can close the tab and come back for the result.
        </p>
      </main>
    </div>
  );
}