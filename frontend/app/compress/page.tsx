"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Status = "IDLE" | "UPLOADING" | "PROCESSING" | "COMPLETED" | "ERROR";

export default function PDFCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("IDLE");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling if the user navigates away mid-job
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const busy = status === "UPLOADING" || status === "PROCESSING";

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setStatus("IDLE");
    setDownloadUrl(null);
    setUploadProgress(0);
    setErrorMessage("");
  };

  const fail = (message: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMessage(message);
    setStatus("ERROR");
  };

  const handleProcess = async () => {
    if (!file) return;
    setStatus("UPLOADING");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      const createRes = await fetch(`${API_BASE}/api/v1/jobs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, task_type: "compress" }),
      });

      if (!createRes.ok) {
        fail("We couldn't start the job. Check that the server is running and try again.");
        return;
      }

      const jobData = await createRes.json();

      await axios.put(jobData.upload_url, file, {
        headers: { "Content-Type": "application/pdf" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });

      setStatus("PROCESSING");

      const processRes = await fetch(`${API_BASE}/api/v1/jobs/${jobData.id}/process`, {
        method: "POST",
      });

      if (!processRes.ok) {
        fail("The file uploaded, but the compressor didn't pick it up. Try again in a moment.");
        return;
      }

      pollStatus(jobData.id);
    } catch (error) {
      console.error("Pipeline failed:", error);
      fail("Something broke on the way. Your file wasn't changed — try again.");
    }
  };

  const pollStatus = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const startedAt = Date.now();

    pollRef.current = setInterval(async () => {
      // Give up after five minutes rather than polling forever
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        fail("This is taking longer than expected. The job may still finish — check back shortly.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/v1/jobs/${id}`);
        const currentJob = await res.json();
        const backendStatus = String(currentJob.status).toUpperCase();

        if (backendStatus === "COMPLETED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setDownloadUrl(currentJob.processed_file_url);
          setStatus("COMPLETED");
        } else if (backendStatus === "FAILED") {
          fail("The compressor couldn't read that file. It may be corrupted or password-protected.");
        }
      } catch (error) {
        console.error("Polling error:", error);
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

        .toon-track {
          border: 3px solid #241F42;
          background: #EDE4FA;
          border-radius: 999px;
          overflow: hidden;
          height: 22px;
        }
        .toon-fill {
          height: 100%;
          background: repeating-linear-gradient(
            -45deg,
            #FFD166 0 12px,
            #FFC133 12px 24px
          );
          transition: width .25s ease;
        }

        /* indeterminate stripe crawl while the worker chews on the file */
        .toon-fill--working {
          width: 100%;
          animation: crawl 1s linear infinite;
        }
        @keyframes crawl {
          from { background-position: 0 0; }
          to   { background-position: 34px 0; }
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

        @media (prefers-reduced-motion: reduce) {
          .scrap, .toon-fill--working { animation: none; }
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
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#241F42] bg-[#BFE3FF] text-[#1B4F72]">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
              <rect x="9" y="6" width="30" height="16" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
              <rect x="13" y="30" width="22" height="12" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
              <path d="M24 23v4M20 25l4 3 4-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <h1 className="display mt-5 text-3xl font-extrabold text-[#241F42] sm:text-4xl">Compress a PDF</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">
            Pick a file and we&rsquo;ll shrink it down while keeping the text readable. Large files
            keep working in the background.
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
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setStatus("IDLE");
                setDownloadUrl(null);
                setErrorMessage("");
              }}
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

          {/* Action */}
          <button
            className="toon-btn display mt-6 w-full rounded-full bg-[#7ED6A5] px-5 py-3 text-lg font-bold text-[#241F42] outline-none focus-visible:ring-4 focus-visible:ring-[#FFD166]"
            onClick={handleProcess}
            disabled={!file || busy}
          >
            {status === "UPLOADING"
              ? "Sending it over…"
              : status === "PROCESSING"
                ? "Squeezing…"
                : "Compress it"}
          </button>

          {/* Progress */}
          {busy && (
            <div className="mt-6">
              <div className="toon-track">
                <div
                  className={`toon-fill ${status === "PROCESSING" ? "toon-fill--working" : ""}`}
                  style={status === "UPLOADING" ? { width: `${uploadProgress}%` } : undefined}
                />
              </div>
              <p className="mt-2 text-center text-sm font-semibold text-[#5C5470]">
                {status === "UPLOADING"
                  ? `Uploading — ${uploadProgress}%`
                  : "Working on it. You can leave this tab open."}
              </p>
            </div>
          )}

          {/* Done */}
          {status === "COMPLETED" && downloadUrl && (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#C8F2D6] p-5 text-center">
              <h2 className="display text-xl font-bold text-[#1E6B44]">All squeezed</h2>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="toon-btn display mt-4 inline-block rounded-full bg-[#FFF6E6] px-5 py-2 font-bold text-[#241F42]"
              >
                Download your PDF
              </a>
              <button
                onClick={reset}
                className="mt-3 block w-full text-sm font-semibold text-[#1E6B44] underline underline-offset-4"
              >
                Compress another file
              </button>
            </div>
          )}

          {/* Error */}
          {status === "ERROR" && (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#FFD3DE] p-5 text-center">
              <h2 className="display text-xl font-bold text-[#A63A5C]">That didn&rsquo;t go through</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#7A2D45]">{errorMessage}</p>
              <button
                onClick={reset}
                className="toon-btn display mt-4 rounded-full bg-[#FFF6E6] px-5 py-2 font-bold text-[#241F42]"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
// "use client";
// import { useState } from "react";
// import axios from "axios";

// export default function PDFCompressor() {
//   const [file, setFile] = useState<File | null>(null);
//   const [status, setStatus] = useState<"IDLE" | "UPLOADING" | "PROCESSING" | "COMPLETED" | "ERROR">("IDLE");
//   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
//   // New state to track the exact percentage (0 to 100)
//   const [uploadProgress, setUploadProgress] = useState<number>(0);

//   const handleProcess = async () => {
//     if (!file) return;
//     setStatus("UPLOADING");
//     setUploadProgress(0); // Reset progress

//     try {
//       // 1. Create the Job & Get Presigned URL (Standard Fetch is fine here)
//       // const createRes = await fetch("http://127.0.0.1:8000/api/v1/jobs/", {
//       const createRes = await fetch("http://localhost:8000/api/v1/jobs/", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ filename: file.name, task_type: "compress" })
//       });
//       const jobData = await createRes.json();

//       // 2. Upload file directly to Backblaze using Axios
//       await axios.put(jobData.upload_url, file, {
//         headers: { "Content-Type": "application/pdf" },
//         onUploadProgress: (progressEvent) => {
//           if (progressEvent.total) {
//             const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
//             setUploadProgress(percentCompleted);
//           }
//         }
//       });

//       // 3. Tell Celery worker to start processing
//       setStatus("PROCESSING");
//       await fetch(`http://localhost:8000/api/v1/jobs/${jobData.id}/process`, {
//         method: "POST"
//       });

//       // 4. Begin polling the status
//       pollStatus(jobData.id);

//     } catch (error) {
//       console.error("Pipeline failed:", error);
//       setStatus("ERROR");
//     }
//   };

//   const pollStatus = (id: number) => {
//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(`http://localhost:8000/api/v1/jobs/${id}`);
//         const currentJob = await res.json();

//         // Convert backend status to uppercase to prevent case-mismatch bugs
//         const backendStatus = currentJob.status.toUpperCase();

//         if (backendStatus === "COMPLETED") {
//           setDownloadUrl(currentJob.processed_file_url);
//           setStatus("COMPLETED");
//           clearInterval(interval);
//         } else if (backendStatus === "FAILED") {
//           setStatus("ERROR");
//           clearInterval(interval);
//         }
//       } catch (error) {
//         console.error("Polling error:", error);
//       }
//     }, 2000);
//   };

//   return (
//     <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
//       <div className="card w-full max-w-md bg-base-100 shadow-xl">
//         <div className="card-body items-center text-center">
//           <h2 className="card-title text-2xl font-bold mb-4">Damm PDF Compressor</h2>
          
//           <input 
//             type="file" 
//             accept="application/pdf"
//             className="file-input file-input-bordered file-input-primary w-full max-w-xs" 
//             onChange={(e) => setFile(e.target.files?.[0] || null)}
//             disabled={status !== "IDLE" && status !== "ERROR"}
//           />

//           <div className="card-actions mt-6 w-full">
//             <button 
//               className="btn btn-primary w-full"
//               onClick={handleProcess}
//               disabled={!file || (status !== "IDLE" && status !== "ERROR")}
//             >
//               {status === "IDLE" || status === "ERROR" ? "Upload and Compress" : status}
//             </button>
//           </div>

//           {/* Dynamic Progress Bar */}
//           {(status === "UPLOADING" || status === "PROCESSING") && (
//             <div className="w-full mt-4">
//               {status === "UPLOADING" ? (
//                 <>
//                   {/* Smooth bar that fills based on Axios percentage */}
//                   <progress 
//                     className="progress progress-primary w-full transition-all duration-300" 
//                     value={uploadProgress} 
//                     max="100"
//                   ></progress>
//                   <p className="text-sm text-gray-500 mt-2">
//                     Uploading... {uploadProgress}%
//                   </p>
//                 </>
//               ) : (
//                 <>
//                   {/* Indeterminate bar for backend processing */}
//                   <progress className="progress progress-primary w-full"></progress>
//                   <p className="text-sm text-gray-500 mt-2">
//                     Worker is compressing your file...
//                   </p>
//                 </>
//               )}
//             </div>
//           )}

//           {status === "COMPLETED" && downloadUrl && (
//             <div className="alert alert-success mt-4 shadow-sm">
//               <div>
//                 <h3 className="font-bold">Success!</h3>
//                 <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline mt-2">
//                   Download Compressed PDF
//                 </a>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }






// // "use client";
// // import { useState, useEffect } from "react";

// // export default function PDFCompressor() {
// //   const [file, setFile] = useState<File | null>(null);
// //   const [status, setStatus] = useState<"IDLE" | "UPLOADING" | "PROCESSING" | "COMPLETED" | "ERROR">("IDLE");
// //   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
// //   const [jobId, setJobId] = useState<number | null>(null);

// //   // We will define the handleProcess function in the next step
// //   const handleProcess = async () => {
// //   if (!file) return;
// //   setStatus("UPLOADING");

// //   try {
// //     // 1. Create the Job & Get Presigned URL
// //     const createRes = await fetch("http://127.0.0.1:8000/api/v1/jobs/", {
// //       method: "POST",
// //       headers: { "Content-Type": "application/json" },
// //       body: JSON.stringify({ filename: file.name, task_type: "compress" })
// //     });
// //     const jobData = await createRes.json();

// //     console.log("Job data:", jobData);
// //     console.log("Upload URL:", jobData.upload_url);
// //     setJobId(jobData.id);

// //     // 2. Upload file directly to Cloudflare R2
// //     await fetch(jobData.upload_url, {
// //       method: "PUT",
// //       body: file,
// //       headers: { "Content-Type": "application/pdf" }
// //     });

// //     // 3. Tell Celery worker to start processing
// //     setStatus("PROCESSING");
// //     await fetch(`http://127.0.0.1:8000/api/v1/jobs/${jobData.id}/process`, {
// //       method: "POST"
// //     });

// //     // 4. Begin polling the status
// //     pollStatus(jobData.id);

// //   } catch (error) {
// //     console.error("Pipeline failed:", error);
// //     setStatus("ERROR");
// //   }
// // };

// // const pollStatus = (id: number) => {
// //   const interval = setInterval(async () => {
// //     try {
// //       const res = await fetch(`http://127.0.0.1:8000/api/v1/jobs/${id}`);
// //       const currentJob = await res.json();

// //       if (currentJob.status === "COMPLETED") {
// //         setDownloadUrl(currentJob.processed_file_url);
// //         setStatus("COMPLETED");
// //         clearInterval(interval);
// //       } else if (currentJob.status === "FAILED") {
// //         setStatus("ERROR");
// //         clearInterval(interval);
// //       }
// //     } catch (error) {
// //       console.error("Polling error:", error);
// //     }
// //   }, 2000); // Check every 2 seconds
// // };
  
// //   return (
// //     <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
// //       <div className="card w-full max-w-md bg-base-100 shadow-xl">
// //         <div className="card-body items-center text-center">
// //           <h2 className="card-title text-2xl font-bold mb-4">Compress PDF</h2>
          
// //           <input 
// //             type="file" 
// //             accept="application/pdf"
// //             className="file-input file-input-bordered file-input-primary w-full max-w-xs" 
// //             onChange={(e) => setFile(e.target.files?.[0] || null)}
// //             disabled={status !== "IDLE" && status !== "ERROR"}
// //           />

// //           <div className="card-actions mt-6 w-full">
// //             <button 
// //               className="btn btn-primary w-full"
// //               onClick={handleProcess}
// //               disabled={!file || (status !== "IDLE" && status !== "ERROR")}
// //             >
// //               {status === "IDLE" || status === "ERROR" ? "Upload and Compress" : status}
// //             </button>
// //           </div>

// //           {/* Progress Indicators */}
// //           {(status === "UPLOADING" || status === "PROCESSING") && (
// //             <div className="w-full mt-4">
// //               <progress className="progress progress-primary w-full"></progress>
// //               <p className="text-sm text-gray-500 mt-2">
// //                 {status === "UPLOADING" ? "Uploading to secure storage..." : "Worker is compressing your file..."}
// //               </p>
// //             </div>
// //           )}

// //           {/* Success State */}
// //           {status === "COMPLETED" && downloadUrl && (
// //             <div className="alert alert-success mt-4 shadow-sm">
// //               <div>
// //                 <h3 className="font-bold">Success!</h3>
// //                 <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline mt-2">
// //                   Download Compressed PDF
// //                 </a>
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // "use client";
// // import { useState } from "react";

// // export default function PDFCompressor() {
// //   const [file, setFile] = useState<File | null>(null);
// //   const [status, setStatus] = useState<"IDLE" | "UPLOADING" | "PROCESSING" | "COMPLETED" | "ERROR">("IDLE");
// //   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

// //   const handleProcess = async () => {
// //     if (!file) return;
// //     setStatus("UPLOADING");

// //     try {
// //       // 1. Create the Job & Get Presigned URL
// //       const createRes = await fetch("http://127.0.0.1:8000/api/v1/jobs/", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({ filename: file.name, task_type: "compress" })
// //       });
// //       const jobData = await createRes.json();

// //       // 2. Upload file directly to Backblaze B2
// //       const uploadRes = await fetch(jobData.upload_url, {
// //         method: "PUT",
// //         body: file,
// //         headers: { "Content-Type": "application/pdf" }
// //       });
      
// //       if (!uploadRes.ok) throw new Error("Cloud upload failed");

// //       // 3. Tell Celery worker to start processing
// //       setStatus("PROCESSING");
// //       await fetch(`http://127.0.0.1:8000/api/v1/jobs/${jobData.id}/process`, {
// //         method: "POST"
// //       });

// //       // 4. Begin polling the status
// //       pollStatus(jobData.id);

// //     } catch (error) {
// //       console.error("Pipeline failed:", error);
// //       setStatus("ERROR");
// //     }
// //   };

// //   const pollStatus = (id: number) => {
// //     const interval = setInterval(async () => {
// //       try {
// //         const res = await fetch(`http://127.0.0.1:8000/api/v1/jobs/${id}`);
// //         const currentJob = await res.json();

// //         if (currentJob.status === "COMPLETED") {
// //           setDownloadUrl(currentJob.processed_file_url);
// //           setStatus("COMPLETED");
// //           clearInterval(interval);
// //         } else if (currentJob.status === "FAILED") {
// //           setStatus("ERROR");
// //           clearInterval(interval);
// //         }
// //       } catch (error) {
// //         console.error("Polling error:", error);
// //       }
// //     }, 2000); // Check every 2 seconds
// //   };

// //   return (
// //     <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
// //       <div className="card w-full max-w-md bg-base-100 shadow-xl">
// //         <div className="card-body items-center text-center">
// //           <h2 className="card-title text-2xl font-bold mb-4">Damm PDF Compressor</h2>
          
// //           <input 
// //             type="file" 
// //             accept="application/pdf"
// //             className="file-input file-input-bordered file-input-primary w-full max-w-xs" 
// //             onChange={(e) => setFile(e.target.files?.[0] || null)}
// //             disabled={status !== "IDLE" && status !== "ERROR"}
// //           />

// //           <div className="card-actions mt-6 w-full">
// //             <button 
// //               className="btn btn-primary w-full"
// //               onClick={handleProcess}
// //               disabled={!file || (status !== "IDLE" && status !== "ERROR")}
// //             >
// //               {status === "IDLE" || status === "ERROR" ? "Upload and Compress" : status}
// //             </button>
// //           </div>

// //           {/* Progress Indicators */}
// //           {(status === "UPLOADING" || status === "PROCESSING") && (
// //             <div className="w-full mt-4">
// //               <progress className="progress progress-primary w-full"></progress>
// //               <p className="text-sm text-gray-500 mt-2">
// //                 {status === "UPLOADING" ? "Uploading to Backblaze B2..." : "Celery worker is compressing your file..."}
// //               </p>
// //             </div>
// //           )}

// //           {/* Success State */}
// //           {status === "COMPLETED" && downloadUrl && (
// //             <div className="alert alert-success mt-4 shadow-sm">
// //               <div>
// //                 <h3 className="font-bold">Success!</h3>
// //                 <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline mt-2">
// //                   Download Compressed PDF
// //                 </a>
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

