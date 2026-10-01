"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
// Hardcode it explicitly for local testing
// const API_BASE = "http://localhost:8000";

interface Message {
  role: "user" | "ai";
  content: string;
}

export default function RagChatPage() {
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !question.trim() || loading) return;

    const userQuery = question.trim();
    setQuestion("");
    setError(null);

    // Append user question to the local chat transcript
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("question", userQuery);

    try {
      const res = await fetch(`${API_BASE}/api/v1/rag-chat`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "RAG processing failed.");
      }

      const data = await res.json();
      // Append AI response containing vector-searched RAG context
      setMessages((prev) => [...prev, { role: "ai", content: data.answer }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#241F42] px-5 py-14 font-sans text-[#FFF6E6] sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <Link
          href="/"
          className="mb-8 text-sm font-bold text-[#CFC5EC] underline-offset-4 hover:text-[#FFD166] hover:underline"
        >
          ← Back to all tools
        </Link>

        <div className="w-full rounded-[26px] border-[3px] border-[#241F42] bg-[#FFF6E6] p-7 text-[#241F42] shadow-[8px_9px_0_#241F42] sm:p-9">
          <h1 className="text-3xl font-extrabold sm:text-4xl"> PDF Chat (Ask any Questions)</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5C5470]">
            Upload a document to split, embed, and query context using vector similarity matching.
          </p>

          {/* File Picker */}
          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-[3px] border-dashed border-[#241F42] bg-[#FDF0D5] px-5 py-6 text-center hover:bg-[#FFE9BF]">
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setMessages([]); // Reset history when a new document is selected
              }}
            />
            {file ? (
              <>
                <span className="text-base font-bold text-[#241F42]">📄 {file.name}</span>
                <span className="mt-1 text-xs text-[#5C5470]">Click or drop to replace document</span>
              </>
            ) : (
              <>
                <span className="text-base font-bold text-[#241F42]">Choose a PDF Document</span>
                <span className="mt-1 text-xs text-[#5C5470]">Ready for smart vector embedding chunks</span>
              </>
            )}
          </label>

          {/* Chat / Q&A Workspace */}
          {file && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="max-h-[380px] space-y-3 overflow-y-auto pr-2">
                {messages.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-[#8A81A3] p-4 text-center text-sm text-[#8A81A3]">
                    Ask anything! .
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col rounded-2xl border-[2px] border-[#241F42] p-4 text-sm ${
                      msg.role === "user"
                        ? "ml-8 bg-[#E4D4FF] text-[#241F42]"
                        : "mr-8 bg-[#EDE4FA] text-[#332B57]"
                    }`}
                  >
                    <span className="mb-1 text-xs font-bold uppercase tracking-wider opacity-70">
                      {msg.role === "user" ? "You" : "Vector RAG AI"}
                    </span>
                    <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                  </div>
                ))}

                {loading && (
                  <div className="mr-8 rounded-2xl border-[2px] border-[#241F42] bg-[#EDE4FA] p-4 text-sm text-[#5C5470] animate-pulse">
                    Thinking... 🔍🤖
                  </div>
                )}
              </div>

              {/* Question Input Form */}
              <form onSubmit={handleSend} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about the document contents..."
                  disabled={loading}
                  className="flex-1 rounded-full border-[3px] border-[#241F42] bg-[#FDF0D5] px-4 py-3 text-sm font-medium text-[#241F42] outline-none focus:ring-2 focus:ring-[#C9AFFF]"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || loading}
                  className="rounded-full border-[3px] border-[#241F42] bg-[#C9AFFF] px-6 py-3 font-bold text-[#241F42] shadow-[4px_4px_0_#241F42] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[6px_6px_0_#241F42] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#241F42] disabled:opacity-50"
                >
                  Ask
                </button>
              </form>
            </div>
          )}

          {error && <p className="mt-4 text-center text-sm font-semibold text-[#A63A5C]">{error}</p>}
        </div>
      </div>
    </main>
  );
}