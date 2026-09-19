"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Status = "idle" | "uploading" | "processing" | "success" | "error";

export default function PdfMerger() {
  const [files, setFiles] = useState<File[]>([]);
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
    if (!e.target.files) return;

    const incoming = Array.from(e.target.files);
    const accepted = incoming.filter((f) => f.type === "application/pdf");
    const rejected = incoming.length - accepted.length;

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
    }

    setErrorMessage(
      rejected > 0
        ? `${rejected} file${rejected > 1 ? "s" : ""} skipped — only PDFs can be merged.`
        : "",
    );

    // allow picking the same file again after removing it
    e.target.value = "";
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const fail = (message: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMessage(message);
    setStatus("error");
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFiles([]);
    setStatus("idle");
    setDownloadUrl(null);
    setErrorMessage("");
  };

  const handleMerge = async () => {
    if (files.length < 2) return;

    setStatus("uploading");
    setErrorMessage("");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${API_BASE}/api/v1/merge`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Backend rejection details:", errorBody);
        fail("The server wouldn't take those files. Try a smaller batch.");
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
          fail("Couldn't merge those files. One of them may be corrupted or password-protected.");
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

        .file-row {
          border: 3px solid #241F42;
          box-shadow: 3px 4px 0 #241F42;
        }

        .stepper-btn {
          border: 2px solid #241F42;
          transition: transform .12s ease, background-color .12s ease;
        }
        .stepper-btn:not(:disabled):hover { background-color: #FFE9BF; }
        .stepper-btn:not(:disabled):active { transform: translateY(1px); }
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

      <main className="relative mx-auto flex max-w-2xl flex-col items-center">
        <Link
          href="/"
          className="display mb-8 text-sm font-bold text-[#CFC5EC] underline-offset-4 hover:text-[#FFD166] hover:underline"
        >
          Back to all tools
        </Link>

        <div className="toon-panel w-full rounded-[26px] bg-[#FFF6E6] p-7 sm:p-9">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#241F42] bg-[#C8F2D6] text-[#1E6B44]">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-11 w-11">
              <rect x="6" y="12" width="20" height="26" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
              <rect x="18" y="6" width="20" height="26" rx="3" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 22h8M12 28h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>

          <h1 className="display mt-5 text-3xl font-extrabold text-[#241F42] sm:text-4xl">Merge PDFs</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">
            Add at least two PDFs, put them in the order you want, and we&rsquo;ll stitch them into one file.
          </p>

          {/* File picker */}
          <label
            className={`mt-7 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-[3px] border-dashed border-[#241F42] bg-[#FDF0D5] px-5 py-8 text-center ${
              busy ? "pointer-events-none opacity-55" : "hover:bg-[#FFE9BF]"
            }`}
          >
            <input
              type="file"
              multiple
              accept="application/pdf"
              className="sr-only"
              disabled={busy}
              onChange={handleFileChange}
            />
            <span className="display text-lg font-bold text-[#241F42]">Choose PDFs</span>
            <span className="mt-1 text-sm text-[#5C5470]">Pick two or more · order can be changed after</span>
          </label>

          {errorMessage && status !== "error" && (
            <p className="mt-3 text-sm font-semibold text-[#A63A5C]">{errorMessage}</p>
          )}

          {/* File queue with reordering */}
          {files.length > 0 && (
            <div className="mt-7">
              <h2 className="display text-base font-bold text-[#241F42]">
                {files.length} file{files.length > 1 ? "s" : ""}, in this order
              </h2>
              <ul className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="file-row flex items-center gap-3 rounded-xl bg-white px-3 py-2.5"
                  >
                    <span className="display flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDE4FA] text-sm font-bold text-[#5B3A9B]">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#241F42]">{file.name}</p>
                      <p className="text-xs text-[#8A81A3]">{prettySize(file.size)}</p>
                    </div>

                    {!busy && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => moveFile(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${file.name} up`}
                          className="stepper-btn flex h-7 w-7 items-center justify-center rounded-md bg-[#FDF0D5] text-[#241F42]"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveFile(index, 1)}
                          disabled={index === files.length - 1}
                          aria-label={`Move ${file.name} down`}
                          className="stepper-btn flex h-7 w-7 items-center justify-center rounded-md bg-[#FDF0D5] text-[#241F42]"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeFile(index)}
                          aria-label={`Remove ${file.name}`}
                          className="stepper-btn flex h-7 w-7 items-center justify-center rounded-md bg-[#FFD3DE] text-[#A63A5C]"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {files.length === 1 && (
                <p className="mt-2 text-sm font-semibold text-[#8A5A00]">Add one more PDF to merge.</p>
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
                {status === "uploading" ? "Sending your files over…" : "Stitching pages together…"}
              </p>
            </div>
          ) : status === "success" && downloadUrl ? (
            <div className="mt-6 rounded-2xl border-[3px] border-[#241F42] bg-[#C8F2D6] p-5 text-center">
              <h2 className="display text-xl font-bold text-[#1E6B44]">Merged</h2>
              <a
                href={downloadUrl}
                download="merged_document.pdf"
                className="toon-btn display mt-4 inline-block rounded-full bg-[#FFF6E6] px-5 py-2 font-bold text-[#241F42]"
              >
                Download merged PDF
              </a>
              <button
                onClick={reset}
                className="mt-3 block w-full text-sm font-semibold text-[#1E6B44] underline underline-offset-4"
              >
                Merge another set
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleMerge}
                disabled={files.length < 2}
                className="toon-btn display mt-6 w-full rounded-full bg-[#7ED6A5] px-5 py-3 text-lg font-bold text-[#241F42] outline-none focus-visible:ring-4 focus-visible:ring-[#FFD166]"
              >
                Merge PDFs
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

// export default function PdfMerger() {
//   const [files, setFiles] = useState<File[]>([]);
//   const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
//   const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

//   // 1. Handle Multiple File Selection
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files) {
//       const selectedFiles = Array.from(e.target.files);
//       setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
//     }
//   };

//   // 2. Remove a file if the user picked the wrong one
//   const removeFile = (indexToRemove: number) => {
//     setFiles(files.filter((_, index) => index !== indexToRemove));
//   };

//   // 3. Submit to FastAPI
//   const handleMerge = async () => {
//     if (files.length < 2) {
//       alert("Please select at least 2 PDFs to merge!");
//       return;
//     }

//     setStatus("uploading");
    
//     const formData = new FormData();
//     files.forEach((file) => {
//       formData.append("files", file);
//     });

//     try {
//       const response = await fetch("http://localhost:8000/api/v1/merge", {
//         method: "POST",
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorBody = await response.text();
//         console.error("Backend rejection details:", errorBody);
//         throw new Error(`Failed to start merge job: ${errorBody}`);
//       }

//       const data = await response.json();
//       setStatus("processing");
      
//       pollJobStatus(data.job_id);
      
//     } catch (error) {
//       console.error(error);
//       setStatus("error");
//     }
//   };

//   // 4. Poll the worker for completion using the task endpoint
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
//       <h1 className="text-3xl font-bold text-gray-800 mb-2">Merge PDFs</h1>
//       <p className="text-gray-500 mb-8">Combine multiple PDF files into a single document.</p>

//       {/* Styled Dropzone/Input Area */}
//       <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:bg-blue-50 transition-colors">
//         <input
//           type="file"
//           multiple
//           accept=".pdf"
//           onChange={handleFileChange}
//           className="hidden"
//           id="file-upload"
//         />
//         <label
//           htmlFor="file-upload"
//           className="cursor-pointer flex flex-col items-center justify-center"
//         >
//           <svg className="w-12 h-12 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
//           </svg>
//           <span className="text-blue-600 font-semibold text-lg">Click to select PDFs</span>
//           <span className="text-gray-400 text-sm mt-1">You can select multiple files at once</span>
//         </label>
//       </div>

//       {/* File List Queue */}
//       {files.length > 0 && (
//         <div className="mt-8">
//           <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
//             Files to Merge ({files.length})
//           </h3>
//           <ul className="space-y-2">
//             {files.map((file, index) => (
//               <li key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
//                 <span className="text-gray-700 truncate font-medium">{file.name}</span>
//                 <button 
//                   onClick={() => removeFile(index)}
//                   className="text-red-500 hover:text-red-700 text-sm font-semibold"
//                 >
//                   Remove
//                 </button>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}

//       {/* Action Button */}
//       <div className="mt-8">
//         {status === "idle" || status === "error" ? (
//           <button
//             onClick={handleMerge}
//             disabled={files.length < 2}
//             className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
//           >
//             {status === "error" ? "Merge Failed - Try Again" : "Merge PDFs Now"}
//           </button>
//         ) : status === "success" && downloadUrl ? (
//           <a
//             href={downloadUrl}
//             download="merged_document.pdf"
//             className="w-full block text-center py-3 px-4 bg-green-500 text-white rounded-lg font-bold text-lg hover:bg-green-600 transition-colors"
//           >
//             Download Merged PDF
//           </a>
//         ) : (
//           <div className="w-full py-3 px-4 bg-blue-100 text-blue-700 rounded-lg font-bold text-lg text-center flex justify-center items-center gap-2">
//             <div className="w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
//             {status === "uploading" ? "Uploading files..." : "Worker is merging..."}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }