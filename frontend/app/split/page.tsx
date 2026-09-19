"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
// import { downloadFile } from "@/utils/download";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Status = "idle" | "uploading" | "processing" | "success" | "error";

export default function PdfSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
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
  const rangeInvalid = endPage < startPage;
  const pageCount = rangeInvalid ? 0 : endPage - startPage + 1;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;

    if (picked && picked.type !== "application/pdf") {
      setFile(null);
      setErrorMessage("That's not a PDF — pick a .pdf file.");
      e.target.value = "";
      return;
    }

    setFile(picked);
    setStartPage(1);
    setEndPage(1);
    setStatus("idle");
    setDownloadUrl(null);
    setErrorMessage("");
  };

  const clampPage = (value: number) => (Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1);

  const step = (which: "start" | "end", delta: number) => {
    if (which === "start") {
      setStartPage((p) => clampPage(p + delta));
    } else {
      setEndPage((p) => clampPage(p + delta));
    }
  };

  const fail = (message: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMessage(message);
    setStatus("error");
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setStartPage(1);
    setEndPage(1);
    setStatus("idle");
    setDownloadUrl(null);
    setErrorMessage("");
  };

  const handleSplit = async () => {
    if (!file || rangeInvalid) return;

    setStatus("uploading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${API_BASE}/api/v1/split?start_page=${startPage}&end_page=${endPage}`,
        { method: "POST", body: formData },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Backend rejection details:", errorBody);
        fail("The server wouldn't take that page range — check it's within the document.");
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
          fail("Couldn't split that file. The page range may be outside the document.");
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

        .page-stepper {
          border: 3px solid #241F42;
          border-radius: 14px;
          background: #FDF0D5;
        }
        .page-stepper input {
          -moz-appearance: textfield;
        }
        .page-stepper input::-webkit-outer-spin-button,
        .page-stepper input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .stepper-btn {
          transition: background-color .12s ease, transform .12s ease;
        }
        .stepper-btn:hover { background-color: #FFE9BF; }
        .stepper-btn:active { transform: translateY(1px); }
        .stepper-btn:disabled { opacity: .35; }

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
          .toon-btn, .stepper-btn { transition: none; }
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
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#241F42] bg-[#E4D4FF] text-[#5B3A9B]">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
              <rect x="7" y="9" width="15" height="30" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
              <rect x="26" y="9" width="15" height="30" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
              <path d="M24 5v38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 5" />
            </svg>
          </span>

          <h1 className="display mt-5 text-3xl font-extrabold text-[#241F42] sm:text-4xl">Split a PDF</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">
            Pick a page range and we&rsquo;ll pull just those pages into a new document.
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

          {/* Page range steppers */}
          {file && (
            <div className="mt-7">
              <p className="display text-base font-bold text-[#241F42]">Which pages?</p>

              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A81A3]">
                    From
                  </span>
                  <div className="page-stepper flex items-center">
                    <button
                      type="button"
                      disabled={busy || startPage <= 1}
                      onClick={() => step("start", -1)}
                      className="stepper-btn flex h-11 w-10 items-center justify-center text-lg font-bold text-[#241F42]"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={startPage}
                      disabled={busy}
                      onChange={(e) => setStartPage(clampPage(parseInt(e.target.value, 10)))}
                      className="w-full bg-transparent text-center text-lg font-bold text-[#241F42] outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => step("start", 1)}
                      className="stepper-btn flex h-11 w-10 items-center justify-center text-lg font-bold text-[#241F42]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <span className="display mt-5 text-xl font-bold text-[#8A81A3]">–</span>

                <div className="flex-1">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8A81A3]">
                    To
                  </span>
                  <div className="page-stepper flex items-center">
                    <button
                      type="button"
                      disabled={busy || endPage <= 1}
                      onClick={() => step("end", -1)}
                      className="stepper-btn flex h-11 w-10 items-center justify-center text-lg font-bold text-[#241F42]"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={endPage}
                      disabled={busy}
                      onChange={(e) => setEndPage(clampPage(parseInt(e.target.value, 10)))}
                      className="w-full bg-transparent text-center text-lg font-bold text-[#241F42] outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => step("end", 1)}
                      className="stepper-btn flex h-11 w-10 items-center justify-center text-lg font-bold text-[#241F42]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {rangeInvalid ? (
                <p className="mt-2 text-sm font-semibold text-[#A63A5C]">
                  The end page needs to be the same as or after the start page.
                </p>
              ) : (
                <p className="mt-2 text-sm text-[#8A81A3]">
                  That&rsquo;s {pageCount} page{pageCount === 1 ? "" : "s"} in the new document.
                </p>
              )}
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
                {status === "uploading" ? "Sending your file over…" : "Pulling out those pages…"}
              </p>
            </div>
          ) : status === "success" && downloadUrl ? (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#C8F2D6] p-5 text-center">
              <h2 className="display text-xl font-bold text-[#1E6B44]">Pages pulled</h2>
              
              <a
                href={downloadUrl}
                download="split_document.pdf"
                className="toon-btn display mt-4 inline-block rounded-full bg-[#FFF6E6] px-5 py-2 font-bold text-[#241F42]"
              >
                Download split PDF
              </a>
              <button
                onClick={reset}
                className="mt-3 block w-full text-sm font-semibold text-[#1E6B44] underline underline-offset-4"
              >
                Split another file
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleSplit}
                disabled={!file || rangeInvalid}
                className="toon-btn display mt-6 w-full rounded-full bg-[#C9AFFF] px-5 py-3 text-lg font-bold text-[#241F42] outline-none focus-visible:ring-4 focus-visible:ring-[#FFD166]"
              >
                Split it
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

// export default function PdfSplitter() {
//   const [file, setFile] = useState<File | null>(null);
//   const [startPage, setStartPage] = useState<number>(1);
//   const [endPage, setEndPage] = useState<number>(1);
//   const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
//   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setFile(e.target.files[0]);
//     }
//   };

//   const handleSplit = async () => {
//     if (!file) {
//       alert("Please select a PDF file first!");
//       return;
//     }

//     setStatus("uploading");
    
//     const formData = new FormData();
//     formData.append("file", file);

//     try {
//       // Pass page numbers as query parameters
//       const response = await fetch(`http://localhost:8000/api/v1/split?start_page=${startPage}&end_page=${endPage}`, {
//         method: "POST",
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorBody = await response.text();
//         console.error("Backend rejection details:", errorBody);
//         throw new Error(`Failed to start split job: ${errorBody}`);
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
//       <h1 className="text-3xl font-bold text-gray-800 mb-2">Split PDF</h1>
//       <p className="text-gray-500 mb-8">Extract specific page ranges into a new document.</p>

//       {/* Dropzone Area */}
//       <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:bg-blue-50 transition-colors mb-6">
//         <input
//           type="file"
//           accept=".pdf"
//           onChange={handleFileChange}
//           className="hidden"
//           id="split-file-upload"
//         />
//         <label
//           htmlFor="split-file-upload"
//           className="cursor-pointer flex flex-col items-center justify-center"
//         >
//           <svg className="w-12 h-12 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
//           </svg>
//           <span className="text-blue-600 font-semibold text-lg">
//             {file ? file.name : "Click to select a PDF"}
//           </span>
//           <span className="text-gray-400 text-sm mt-1">Select the source document</span>
//         </label>
//       </div>

//       {/* Page Range Inputs */}
//       {file && (
//         <div className="grid grid-cols-2 gap-4 mb-8">
//           <div>
//             <label className="block text-sm font-semibold text-gray-700 mb-2">Start Page</label>
//             <input
//               type="number"
//               min={1}
//               value={startPage}
//               onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
//               className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-semibold text-gray-700 mb-2">End Page</label>
//             <input
//               type="number"
//               min={1}
//               value={endPage}
//               onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
//               className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
//             />
//           </div>
//         </div>
//       )}

//       {/* Action Button */}
//       <div>
//         {status === "idle" || status === "error" ? (
//           <button
//             onClick={handleSplit}
//             disabled={!file}
//             className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
//           >
//             {status === "error" ? "Split Failed - Try Again" : "Split PDF Now"}
//           </button>
//         ) : status === "success" && downloadUrl ? (
//           <a
//             href={downloadUrl}
//             download="split_document.pdf"
//             className="w-full block text-center py-3 px-4 bg-green-500 text-white rounded-lg font-bold text-lg hover:bg-green-600 transition-colors"
//           >
//             Download Split PDF
//           </a>
//         ) : (
//           <div className="w-full py-3 px-4 bg-blue-100 text-blue-700 rounded-lg font-bold text-lg text-center flex justify-center items-center gap-2">
//             <div className="w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
//             {status === "uploading" ? "Uploading file..." : "Worker is splitting..."}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }