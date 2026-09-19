"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Status = "idle" | "uploading" | "processing" | "success" | "error";
type Angle = 90 | 180 | 270;

const ANGLE_OPTIONS: { value: Angle; label: string; sub: string }[] = [
  { value: 90, label: "90°", sub: "Clockwise" },
  { value: 180, label: "180°", sub: "Upside down" },
  { value: 270, label: "270°", sub: "Counter-clockwise" },
];

export default function PdfRotator() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState<Angle>(90);
  const [status, setStatus] = useState<Status>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const busy = status === "uploading" || status === "processing";

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
    setDownloadUrl(null);
    setErrorMessage("");
  };

  const fail = (message: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMessage(message);
    setStatus("error");
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setStatus("idle");
    setDownloadUrl(null);
    setErrorMessage("");
  };

  const handleRotation = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/api/v1/rotate?angle=${angle}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Backend rejection details:", errorBody);
        fail("The server wouldn't take that file. It may be corrupted.");
        return;
      }

      const data = await response.json();
      setStatus("processing");
      pollJobStatus(data.job_id);
    } catch (error) {
      console.error(error);
      fail("We couldn't reach the server. Check your connection and try again.");
    }
  };

  const pollJobStatus = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const startedAt = Date.now();

    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        fail("This is taking longer than expected. The job may still finish — check back shortly.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/v1/tasks/${jobId}`);
        const data = await res.json();

        if (data.status === "SUCCESS") {
          if (pollRef.current) clearInterval(pollRef.current);
          setDownloadUrl(`${API_BASE}${data.result.file_url}`);
          setStatus("success");
        } else if (data.status === "FAILURE" || data.status === "ERROR") {
          fail("Couldn't rotate that file. It may be corrupted or password-protected.");
        }
      } catch (error) {
        console.error("Polling error", error);
      }
    }, 2000);
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

        .angle-card {
          border: 3px solid #241F42;
          box-shadow: 3px 4px 0 #241F42;
          transition: transform .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .angle-card:hover { transform: translateY(-2px); }
        .angle-card--active {
          background-color: #FFE9BF;
          box-shadow: 3px 4px 0 #241F42, 0 0 0 3px #FFD166 inset;
        }

        .preview-page {
          transition: transform .3s cubic-bezier(.34,1.56,.64,1);
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
          .scrap, .working-dots span { animation: none; }
          .toon-btn, .angle-card, .preview-page { transition: none; }
          .toon-btn:hover, .toon-btn:focus-visible, .angle-card:hover { transform: none; }
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
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#241F42] bg-[#FFD3DE] text-[#A63A5C]">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
              <rect x="12" y="12" width="24" height="24" rx="4" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
              <path d="M24 6a18 18 0 0 1 14 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M39 6v8h-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <h1 className="display mt-5 text-3xl font-extrabold text-[#241F42] sm:text-4xl">Rotate a PDF</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">
            Pick a file and a direction — every page turns the same way, all at once.
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

          {/* Angle picker with live preview */}
          {file && (
            <div className="mt-7">
              <p className="display text-base font-bold text-[#241F42]">Which way?</p>

              <div className="mt-4 flex items-center gap-6">
                {/* live preview page */}
                <div className="flex h-24 w-20 shrink-0 items-center justify-center">
                  <div
                    className="preview-page flex h-16 w-12 items-center justify-center rounded-md border-[3px] border-[#241F42] bg-white text-xs font-bold text-[#8A81A3]"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    A
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-3 gap-2">
                  {ANGLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      onClick={() => setAngle(opt.value)}
                      className={`angle-card rounded-xl bg-white px-2 py-3 text-center ${
                        angle === opt.value ? "angle-card--active" : ""
                      }`}
                    >
                      <span className="display block text-lg font-bold text-[#241F42]">{opt.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-[#5C5470]">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action / progress */}
          {busy ? (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#EDE4FA] px-5 py-4 text-center">
              <div className="working-dots">
                <span />
                <span />
                <span />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#5C5470]">
                {status === "uploading" ? "Sending your file over…" : "Turning the pages…"}
              </p>
            </div>
          ) : status === "success" && downloadUrl ? (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#C8F2D6] p-5 text-center">
              <h2 className="display text-xl font-bold text-[#1E6B44]">All turned around</h2>
              <a
                href={downloadUrl}
                download="rotated_document.pdf"
                className="toon-btn display mt-4 inline-block rounded-full bg-[#FFF6E6] px-5 py-2 font-bold text-[#241F42]"
              >
                Download rotated PDF
              </a>
              <button
                onClick={reset}
                className="mt-3 block w-full text-sm font-semibold text-[#1E6B44] underline underline-offset-4"
              >
                Rotate another file
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleRotation}
                disabled={!file}
                className="toon-btn display mt-6 w-full rounded-full bg-[#FF9AA2] px-5 py-3 text-lg font-bold text-[#241F42] outline-none focus-visible:ring-4 focus-visible:ring-[#FFD166]"
              >
                Rotate it
              </button>

              {status === "error" && (
                <div className="mt-5 rounded-2xl border-[3px] border-[#241F42] bg-[#FFD3DE] p-5 text-center">
                  <h2 className="display text-lg font-bold text-[#A63A5C]">That didn&rsquo;t work</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#7A2D45]">{errorMessage}</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
// "use client";
// import { useState } from "react";

// export default function PdfRotator() {
//   const [file, setFile] = useState<File | null>(null);
//   const [angle, setAngle] = useState<number>(90);
//   const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
//   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setFile(e.target.files[0]);
//     }
//   };

//   const handleRotation = async () => {
//     if (!file) {
//       alert("Please select a PDF file first!");
//       return;
//     }

//     setStatus("uploading");
    
//     const formData = new FormData();
//     formData.append("file", file);

//     try {
//       const response = await fetch(`http://localhost:8000/api/v1/rotate?angle=${angle}`, {
//         method: "POST",
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorBody = await response.text();
//         console.error("Backend rejection details:", errorBody);
//         throw new Error(`Failed to start rotation job: ${errorBody}`);
//       }

//       const data = await response.json();
//       setStatus("processing");
//       pollJobStatus(data.job_id);
      
//     } catch (error) {
//       console.error(error);
//       setStatus("error");
//     }
//   };

//   const pollJobStatus = async (jobId: string) => {
//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(`http://localhost:8000/api/v1/tasks/${jobId}`);
//         const data = await res.json();

//         if (data.status === "SUCCESS") {
//           clearInterval(interval);
//           setDownloadUrl(`http://localhost:8000${data.result.file_url}`);
//           setStatus("success");
//         } else if (data.status === "FAILURE" || data.status === "ERROR") {
//           clearInterval(interval);
//           setStatus("error");
//         }
//       } catch (error) {
//         console.error("Polling error", error);
//       }
//     }, 2000);
//   };

//   return (
//     <div className="max-w-2xl mx-auto p-8 mt-12 bg-white rounded-xl shadow-md border border-gray-100">
//       <h1 className="text-3xl font-bold text-gray-800 mb-2">Rotate PDF</h1>
//       <p className="text-gray-500 mb-8">Rotate all pages in your PDF document by 90, 180, or 270 degrees.</p>

//       {/* Dropzone Area */}
//       <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:bg-blue-50 transition-colors mb-6">
//         <input
//           type="file"
//           accept=".pdf"
//           onChange={handleFileChange}
//           className="hidden"
//           id="rotate-file-upload"
//         />
//         <label
//           htmlFor="rotate-file-upload"
//           className="cursor-pointer flex flex-col items-center justify-center"
//         >
//           <svg className="w-12 h-12 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
//           </svg>
//           <span className="text-blue-600 font-semibold text-lg">
//             {file ? file.name : "Click to select a PDF"}
//           </span>
//           <span className="text-gray-400 text-sm mt-1">Select document to rotate</span>
//         </label>
//       </div>

//       {/* Angle Selector */}
//       {file && (
//         <div className="mb-8">
//           <label className="block text-sm font-semibold text-gray-700 mb-2">Rotation Angle</label>
//           <select
//             value={angle}
//             onChange={(e) => setAngle(parseInt(e.target.value))}
//             className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white"
//           >
//             <option value={90}>90° Clockwise</option>
//             <option value={180}>180° (Upside Down)</option>
//             <option value={270}>270° Clockwise (90° Counter-Clockwise)</option>
//           </select>
//         </div>
//       )}

//       {/* Action Button */}
//       <div>
//         {status === "idle" || status === "error" ? (
//           <button
//             onClick={handleRotation}
//             disabled={!file}
//             className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
//           >
//             {status === "error" ? "Rotation Failed - Try Again" : "Rotate PDF Now"}
//           </button>
//         ) : status === "success" && downloadUrl ? (
//           <a
//             href={downloadUrl}
//             download="rotated_document.pdf"
//             className="w-full block text-center py-3 px-4 bg-green-500 text-white rounded-lg font-bold text-lg hover:bg-green-600 transition-colors"
//           >
//             Download Rotated PDF
//           </a>
//         ) : (
//           <div className="w-full py-3 px-4 bg-blue-100 text-blue-700 rounded-lg font-bold text-lg text-center flex justify-center items-center gap-2">
//             <div className="w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
//             {status === "uploading" ? "Uploading file..." : "Worker is rotating..."}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }