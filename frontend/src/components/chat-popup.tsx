import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Paperclip, Send, Sparkles, Trash2, User, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  fileName?: string;
};

const ACCEPTED = ".pdf,.txt,.md,.rtf,.docx";
const MAX_FILE_MB = 20;
const SESSION_KEY = "clause_chat_history";
const INTRO: Message = { id: "intro", role: "assistant", content: "Hi! Ask me anything about contracts, or upload a document to discuss." };

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatPopup() {
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState<Message[]>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) return JSON.parse(stored) as Message[];
    } catch { /* ignore */ }
    return [INTRO];
  });
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileError, setFileError]     = useState<string | null>(null);

  const bottomRef    = useRef<HTMLDivElement | null>(null);
  const fileRef      = useRef<HTMLInputElement | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef  = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const saveable = messages.filter((m) => !m.pending);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(saveable));
  }, [messages]);

  const clearChat = () => {
    setMessages([INTRO]);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const clearFile = () => {
    setPendingFile(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!file) { setPendingFile(null); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File exceeds ${MAX_FILE_MB} MB`);
      setPendingFile(null);
      return;
    }
    setPendingFile(file);
  };

  const send = async () => {
    const q = input.trim();
    if ((!q && !pendingFile) || loading) return;

    const question = q || `Analyze this document: ${pendingFile!.name}`;
    const fileName = pendingFile?.name;
    const file     = pendingFile;

    setInput("");
    clearFile();
    setLoading(true);

    const userMsg: Message    = { id: createId(), role: "user",      content: question, fileName };
    const pendingMsg: Message = { id: createId(), role: "assistant", content: "Thinking…", pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);

    try {
      const data = file
        ? await api.chatWithFile(question, file)
        : await api.chat(question);

      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : "I couldn't generate a response right now.";

      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsg.id ? { ...m, content: answer, pending: false } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { ...m, content: "Request failed — please try again.", pending: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-200",
          "bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white",
          "hover:scale-105 hover:shadow-indigo-400/40",
          open && "scale-95 opacity-80"
        )}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0F1320]" style={{ height: "min(520px, calc(100vh - 7rem))" }}>
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 dark:border-white/10">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Clause AI</p>
              <p className="text-[11px] text-white/70">Contract assistant</p>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[85%] items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5",
                      isUser
                        ? "bg-slate-900 text-white dark:bg-slate-700"
                        : "border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300"
                    )}>
                      {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    <div className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm",
                      isUser
                        ? "bg-slate-900 text-white dark:bg-indigo-600"
                        : "border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                    )}>
                      {msg.fileName && (
                        <p className={cn("mb-1 flex items-center gap-1 text-xs font-medium", isUser ? "text-slate-300" : "text-indigo-500")}>
                          <Paperclip className="h-3 w-3" />{msg.fileName}
                        </p>
                      )}
                      {isUser ? (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      ) : (
                        <div className="prose-chat">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                      {msg.pending && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* File badge */}
          {pendingFile && (
            <div className="mx-4 mb-1 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
              <button onClick={clearFile} className="shrink-0 opacity-60 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {fileError && (
            <p className="mx-4 mb-1 text-xs text-red-500">{fileError}</p>
          )}

          {/* Input */}
          <div className="border-t border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/4">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/6">
              <textarea
                ref={textareaRef}
                className="min-h-[36px] max-h-[120px] flex-1 resize-none overflow-y-auto bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about contracts…"
                rows={1}
              />
              <div className="flex shrink-0 items-center gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  title="Attach document"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={send}
                  disabled={loading || (!input.trim() && !pendingFile)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">Enter to send · Shift+Enter for new line · PDF, DOCX, TXT</p>
          </div>
        </div>
      )}
    </>
  );
}
