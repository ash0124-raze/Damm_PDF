"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Status = "idle" | "loading" | "success" | "error";

export default function SummarizePage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const busy = status === "loading";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;

    if (picked && picked.type !== "application/pdf") {
      setFile(null);
      setErrorMessage("That's not a PDF — pick a .pdf file.");
      e.target.value = "";
      return;
    }

    setFile(picked);
    setStatus("idle");
    setSummary(null);
    setErrorMessage("");
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setSummary(null);
    setErrorMessage("");
  };

  const handleSummarize = async () => {
    if (!file) return;

    setStatus("loading");
    setErrorMessage("");
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/v1/summarize`, {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await res.json() : null;

      if (!res.ok) {
        throw new Error(data?.detail || `The server returned an error (${res.status}).`);
      }
      if (!data?.summary) {
        throw new Error("The server didn't return a summary. Try again.");
      }

      setSummary(data.summary);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while summarizing that file.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const prettySize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="paper-desk relative min-h-screen overflow-hidden px-5 py-14 sm:px-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700&display=swap');

        .paper-desk {
          background: radial-gradient(120% 90% at 50% -10%, #4A3E77 0%, #332B57 45%, #241F42 100%);
          background-color: #241F42;
          font-family: 'Nunito', ui-sans-serif, system-ui, sans-serif;
          color: #FFF6E6;
        }

        .display { font-family: 'Baloo 2', 'Nunito', cursive; letter-spacing: -0.5px; }

        .lamp-glow {
          background: radial-gradient(closest-side, rgba(255,209,102,.34), rgba(255,209,102,0) 100%);
          filter: blur(2px);
        }

        .toon-panel {
          border: 3px solid #241F42;
          box-shadow: 8px 9px 0 #241F42;
        }

        .toon-btn {
          border: 3px solid #241F42;
          box-shadow: 5px 6px 0 #241F42;
          transition: transform .16s cubic-bezier(.34,1.56,.64,1), box-shadow .16s ease, background-color .16s ease;
        }
        .toon-btn:not(:disabled):hover,
        .toon-btn:not(:disabled):focus-visible {
          transform: translate(-2px, -3px);
          box-shadow: 8px 10px 0 #241F42;
        }
        .toon-btn:not(:disabled):active {
          transform: translate(3px, 4px);
          box-shadow: 2px 2px 0 #241F42;
        }
        .toon-btn:disabled { opacity: .55; }

        .sparkle {
          display: inline-block;
          animation: twinkle 2.4s ease-in-out infinite;
        }
        @keyframes twinkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50%      { transform: scale(1.25) rotate(12deg); opacity: .75; }
        }

        .scrap {
          position: absolute;
          border: 3px solid #241F42;
          border-radius: 10px;
          opacity: .45;
          animation: drift 17s ease-in-out infinite;
        }
        @keyframes drift {
          0%, 100% { transform: translateY(0) rotate(var(--r, -6deg)); }
          50%      { transform: translateY(-20px) rotate(calc(var(--r, -6deg) * -1)); }
        }

        .working-dots span {
          display: inline-block;
          width: 9px; height: 9px;
          margin: 0 3px;
          border: 2px solid #241F42;
          border-radius: 50%;
          background: #FFD166;
          animation: hop .9s ease-in-out infinite;
        }
        .working-dots span:nth-child(2) { animation-delay: .15s; }
        .working-dots span:nth-child(3) { animation-delay: .3s; }
        @keyframes hop {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-7px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .scrap, .working-dots span, .sparkle { animation: none; }
          .toon-btn { transition: none; }
          .toon-btn:hover, .toon-btn:focus-visible { transform: none; }
        }
      `}</style>

      <div className="lamp-glow pointer-events-none absolute left-1/2 top-[-140px] h-[480px] w-[760px] -translate-x-1/2" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="scrap left-[8%] top-[26%] h-16 w-12 bg-[#FFD166]" style={{ ["--r" as string]: "-8deg" }} />
        <span className="scrap right-[10%] top-[18%] h-14 w-16 bg-[#7ED6A5]" style={{ ["--r" as string]: "7deg", animationDelay: "2.4s" }} />
        <span className="scrap left-[13%] bottom-[16%] h-20 w-14 bg-[#7CC5F0]" style={{ ["--r" as string]: "5deg", animationDelay: "4.1s" }} />
        <span className="scrap right-[14%] bottom-[22%] h-12 w-12 bg-[#FF9AA2]" style={{ ["--r" as string]: "-11deg", animationDelay: "1.3s" }} />
      </div>

      <main className="relative mx-auto flex max-w-xl flex-col items-center">
        <Link
          href="/"
          className="display mb-8 text-sm font-bold text-[#CFC5EC] underline-offset-4 hover:text-[#FFD166] hover:underline"
        >
          Back to all tools
        </Link>

        <div className="toon-panel w-full rounded-[26px] bg-[#FFF6E6] p-7 sm:p-9">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#241F42] bg-[#FFE7A3] text-[#8A5A00]">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
              <rect x="10" y="6" width="28" height="36" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
              <path d="M16 16h16M16 23h16M16 30h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M31 4l3 3-10 10-4 1 1-4z" fill="#FFD166" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>

          <h1 className="display mt-5 text-3xl font-extrabold text-[#241F42] sm:text-4xl">
            Summarize a PDF <span className="sparkle">✨</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">
            Upload a dense document and get a clear, short summary with the key points pulled out.
          </p>

          {/* File picker */}
          <label
            className={`mt-7 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-[3px] border-dashed border-[#241F42] bg-[#FDF0D5] px-5 py-8 text-center ${
              busy ? "pointer-events-none opacity-55" : "hover:bg-[#FFE9BF]"
            }`}
          >
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={busy}
              onChange={handleFileChange}
            />
            {file ? (
              <>
                <span className="display text-lg font-bold text-[#241F42]">{file.name}</span>
                <span className="mt-1 text-sm text-[#5C5470]">{prettySize(file.size)} · tap to pick another</span>
              </>
            ) : (
              <>
                <span className="display text-lg font-bold text-[#241F42]">Choose a PDF</span>
                <span className="mt-1 text-sm text-[#5C5470]">or drop one here</span>
              </>
            )}
          </label>

          {errorMessage && status !== "error" && (
            <p className="mt-3 text-sm font-semibold text-[#A63A5C]">{errorMessage}</p>
          )}

          {/* Action */}
          <button
            onClick={handleSummarize}
            disabled={!file || busy}
            className="toon-btn display mt-6 w-full rounded-full bg-[#FFD166] px-5 py-3 text-lg font-bold text-[#241F42] outline-none focus-visible:ring-4 focus-visible:ring-[#7ED6A5]"
          >
            {busy ? "Reading it over…" : "Summarize it"}
          </button>

          {/* Working */}
          {busy && (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#EDE4FA] px-5 py-4 text-center">
              <div className="working-dots">
                <span />
                <span />
                <span />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#5C5470]">
                Reading through the document — longer files take a bit more time.
              </p>
            </div>
          )}

          {/* Success */}
          {status === "success" && summary && (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-white p-5">
              <div className="flex items-center justify-between gap-3 border-b-2 border-[#F1E7D4] pb-3">
                <h2 className="display text-lg font-bold text-[#241F42]">Here&rsquo;s the gist</h2>
                <button
                  onClick={reset}
                  className="shrink-0 text-sm font-semibold text-[#5C5470] underline underline-offset-4"
                >
                  Summarize another
                </button>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#3A3550]">{summary}</p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="mt-5 rounded-2xl border-[3px] border-[#241F42] bg-[#FFD3DE] p-5 text-center">
              <h2 className="display text-lg font-bold text-[#A63A5C]">That didn&rsquo;t work</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#7A2D45]">{errorMessage}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}