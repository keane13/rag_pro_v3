"use client";

import { useState, useRef, useEffect } from "react";
import {
    Send, Bot, Trash2, FileText,
    ChevronDown, ChevronUp, Zap, Brain, LogOut, Upload, Database, CheckCircle2, Activity,
    BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Message, Session, FileItem } from "@/types/chat";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import KnowledgeBase from "./KnowledgeBase";
import Documentation from "./Documentation";
import { AuthUser } from "@/lib/useAuth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatInterfaceProps {
    user: AuthUser;
    onLogout: () => void;
}

const MODE_CONFIG = {
    fast: { label: "Fast", icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    thinking: { label: "Deep", icon: Brain, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
} as const;

export default function ChatInterface({ user, onLogout }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<"fast" | "thinking">("fast");
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"chat" | "knowledge" | "dashboard" | "documentation">("documentation");
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { fetchSessions(); }, []);
    useEffect(() => { scrollToBottom(); }, [messages]);

    const fetchSessions = async () => {
        try {
            const res = await fetch("http://localhost:8000/history");
            setSessions(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleSelectSession = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/history/${id}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setCurrentSessionId(id);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const handleNewChat = () => { setMessages([]); setCurrentSessionId(null); setSelectedFiles([]); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user" as const, content: userMessage }, { role: "assistant" as const, content: "" }]);
        setIsLoading(true);

        // ── RAG path ──────────────────────────────────────────────────────
        try {
            const response = await fetch("http://localhost:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: userMessage,
                    session_id: currentSessionId,
                    mode,
                    selected_files: selectedFiles
                }),
            });
            if (!response.ok) {
                let errorMsg = "Failed";
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.detail) {
                        errorMsg = errorData.detail;
                    }
                } catch (e) {
                    console.error("Could not parse error response", e);
                }
                throw new Error(errorMsg);
            }
            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                for (const line of chunk.split("\n\n")) {
                    if (line.startsWith("event: session_id")) {
                        const sid = line.replace("event: session_id\ndata: ", "").trim();
                        if (sid && sid !== currentSessionId) { setCurrentSessionId(sid); setTimeout(fetchSessions, 1000); }
                    } else if (line.startsWith("event: context")) {
                        try {
                            const parsed = JSON.parse(line.replace("event: context\ndata: ", ""));
                            const ctxArray: string[] = Array.isArray(parsed?.contexts) ? parsed.contexts : [];
                            const metaArray: any[] = Array.isArray(parsed?.source_docs) ? parsed.source_docs : [];

                            // Map metadata to contexts
                            const sources = ctxArray.map((content, i) => ({
                                filename: metaArray[i]?.source?.split(/[\\/]/).pop() || "Unknown Document",
                                content: content
                            }));

                            setMessages(prev => {
                                const m = [...prev];
                                m[m.length - 1].sources = sources;
                                return m;
                            });
                        } catch (err) {
                            console.error("Context parse error:", err);
                        }
                    } else if (line.startsWith("event: token")) {
                        try {
                            const token = JSON.parse(line.replace("event: token\ndata: ", ""));
                            assistantMessage += token;

                            // Detect if we are currently inside <think> tags
                            const isStillThinking = assistantMessage.includes("<think>") && !assistantMessage.includes("</think>");

                            // Filter out <think>...</think> content
                            const displayMessage = assistantMessage
                                .replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "")
                                .trimStart();

                            setMessages(prev => {
                                const m = [...prev];
                                const last = m[m.length - 1];
                                last.content = displayMessage;
                                last.isThinking = isStillThinking;
                                return m;
                            });
                        } catch { }
                    } else if (line.startsWith("event: metrics")) {
                        try {
                            const metrics = JSON.parse(line.replace("event: metrics\ndata: ", ""));
                            setMessages(prev => {
                                const m = [...prev];
                                m[m.length - 1].metrics = metrics;
                                return m;
                            });
                        } catch { }
                    }
                }
            }
            setMessages(prev => {
                const m = [...prev];
                const last = m[m.length - 1];
                last.isComplete = true; // Mark as complete when stream ends
                return m;
            });
            fetchSessions();
        } catch (error: any) {
            console.error(error);
            setMessages(prev => {
                const m = [...prev];
                const last = m[m.length - 1];
                if (last && last.role === "assistant") {
                    last.content = error.message || "Sorry, something went wrong.";
                    last.isComplete = true;
                    return m;
                }
                return [...prev, { role: "assistant", content: error.message || "Sorry, something went wrong.", isComplete: true }];
            });
        } finally {
            setIsLoading(false);
        }
    };

    const ActiveMode = MODE_CONFIG[mode];


    return (
        <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 relative font-sans overflow-hidden">
            {/* Background ambience */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] left-[-5%] w-[45%] h-[45%] bg-violet-200/40 rounded-full blur-[130px]" />
                <div className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[45%] bg-cyan-200/35 rounded-full blur-[130px]" />
                <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-indigo-200/20 rounded-full blur-[100px]" />
            </div>

            <Sidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                user={user}
                onLogout={onLogout}
                activeView={activeView}
                onViewChange={setActiveView}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full z-10 relative min-w-0">

                {/* Header */}
                <header className="flex items-center justify-between py-3.5 px-6 border-b border-slate-200 bg-white/80 backdrop-blur-xl shrink-0 h-16">
                    <div className="flex items-center gap-3">
                        {activeView === "knowledge" ? (
                            <div className="flex items-center gap-2 text-slate-800 font-semibold text-lg">
                                <Database className="w-5 h-5 text-blue-500" />
                                Knowledge Base
                            </div>
                        ) : activeView === "dashboard" ? (
                            <div className="flex items-center gap-2 text-slate-800 font-semibold text-lg">
                                <Activity className="w-5 h-5 text-indigo-500" />
                                Dashboard
                            </div>
                        ) : activeView === "documentation" ? (
                            <div className="flex items-center gap-2 text-slate-800 font-semibold text-lg">
                                <BookOpen className="w-5 h-5 text-blue-500" />
                                Documentation
                            </div>
                        ) : (
                            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", ActiveMode.bg, ActiveMode.color)}>
                                <ActiveMode.icon className="w-3 h-3" />
                                {ActiveMode.label} mode
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-slate-700 font-medium hidden sm:inline">{user.name}</span>
                        </div>
                        {activeView === "chat" && (
                            <button
                                onClick={handleNewChat}
                                title="New Chat"
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={onLogout}
                            title="Sign out"
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {activeView === "knowledge" ? (
                    <KnowledgeBase onSelectionChange={setSelectedFiles} selectedFiles={selectedFiles} />
                ) : activeView === "dashboard" ? (
                    <Dashboard />
                ) : activeView === "documentation" ? (
                    <Documentation />
                ) : (
                    <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 light-scrollbar">
                            {messages.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="flex flex-col items-center justify-center h-full text-center gap-6"
                                >
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xl shadow-slate-200/50 backdrop-blur-sm">
                                            <Bot className="w-10 h-10 text-violet-500" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-800 mb-1">
                                            Hello, <span className="gradient-text">{user.name}</span> 👋
                                        </h2>
                                        <p className="text-slate-500 text-sm max-w-xs">
                                            Ask me anything about your documents. I&apos;ll retrieve and reason over them for you.
                                        </p>
                                    </div>
                                    <div className="flex gap-2 flex-wrap justify-center">
                                        {(["fast", "thinking"] as const).map((m) => {
                                            const cfg = MODE_CONFIG[m];
                                            return (
                                                <button
                                                    key={m}
                                                    onClick={() => setMode(m)}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                                        mode === m ? cn(cfg.bg, cfg.color) : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm"
                                                    )}
                                                >
                                                    <cfg.icon className="w-3 h-3" /> {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}

                            {messages.map((msg, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    key={idx}
                                    className={cn(
                                        "w-full max-w-4xl mx-auto",
                                        msg.role === "user" ? "flex justify-end" : ""
                                    )}
                                >
                                    {msg.role === "user" ? (
                                        /* ── User bubble ─────────────────────────── */
                                        <div className="flex items-end gap-2.5 flex-row-reverse max-w-[75%]">
                                            <div className="w-7 h-7 rounded-full shrink-0 bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-sky-400/30 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="px-4 py-3 text-sm leading-relaxed bg-gradient-to-br from-sky-400 to-blue-500 text-white rounded-2xl rounded-br-sm shadow-md shadow-sky-400/20">
                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Assistant full-width prose ─────────── */
                                        <div className="w-full flex flex-col gap-2 py-1">
                                            {/* Label row */}
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <div className="w-5 h-5 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center">
                                                    <Bot className="w-3 h-3 text-violet-500" />
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">AI</span>
                                            </div>

                                            {/* Content */}
                                            {msg.content || msg.isThinking ? (
                                                <div className="flex flex-col gap-3">
                                                    {msg.isThinking && (
                                                        <div className="flex items-center gap-2 py-2 px-3 bg-violet-50/50 rounded-xl border border-violet-100/50 w-fit animate-pulse">
                                                            <div className="flex gap-1">
                                                                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" />
                                                            </div>
                                                            <span className="text-[10px] font-medium text-violet-500 uppercase tracking-wider">Thinking</span>
                                                        </div>
                                                    )}
                                                    {msg.content && (
                                                        <div className="text-sm leading-[1.8] text-slate-700 w-full prose prose-slate prose-sm max-w-none 
                                                            prose-p:leading-[1.8] prose-p:mb-4 
                                                            prose-headings:text-slate-900 prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3
                                                            prose-ul:my-4 prose-ul:list-disc prose-ul:pl-5
                                                            prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-5
                                                            prose-li:my-1 prose-strong:text-slate-900 prose-strong:font-bold">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex gap-1 items-center h-6">
                                                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
                                                </div>
                                            )}

                                            {/* Detailed Sources UI - Only show when complete */}
                                            {msg.isComplete && msg.sources && msg.sources.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <div className="flex items-center gap-1.5 mb-2.5">
                                                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sources</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {msg.sources.map((src, sidx) => (
                                                            <div
                                                                key={sidx}
                                                                className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60 hover:border-violet-200 hover:bg-violet-50/30 transition-all cursor-help"
                                                                title={src.content}
                                                            >
                                                                <div className={cn("shrink-0 w-1.5 h-1.5 rounded-full", idx % 2 === 0 ? "bg-violet-400" : "bg-indigo-400")} />
                                                                <span className="text-[10px] font-medium text-slate-600 group-hover:text-violet-700 truncate max-w-[140px]">
                                                                    {src.filename}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Metrics - Only show when complete */}
                                            {msg.isComplete && msg.metrics && (
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500">
                                                        ⏱ Latency: <span className="text-slate-700 font-medium">{msg.metrics.latency.toFixed(2)}s</span>
                                                    </span>
                                                    {msg.metrics.faithfulness != null && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500">
                                                            🎯 Faithful: <span className="text-slate-700 font-medium">{msg.metrics.faithfulness.toFixed(2)}</span>
                                                        </span>
                                                    )}
                                                    {msg.metrics.answer_relevancy != null && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500">
                                                            🔗 Relevance: <span className="text-slate-700 font-medium">{msg.metrics.answer_relevancy.toFixed(2)}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            <div ref={scrollRef} />
                        </div>

                        {/* Input Area */}
                        <div className="py-5 px-4 bg-gradient-to-t from-white via-white/95 to-transparent">
                            <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto w-full group">
                                <div className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50 rounded-2xl flex flex-col focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all overflow-hidden">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask anything about your documents…"
                                        className="w-full bg-transparent px-5 py-4 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 resize-none min-h-[56px] max-h-48"
                                        rows={Math.min(5, Math.max(1, input.split("\n").length))}
                                        disabled={isLoading}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (input.trim() && !isLoading) handleSubmit(e);
                                            }
                                        }}
                                    />

                                    <div className="flex items-center justify-between px-3 pb-3">
                                        {/* Mode pills */}
                                        <div className="flex gap-2">
                                            {(["fast", "thinking"] as const).map((m) => {
                                                const cfg = MODE_CONFIG[m];
                                                return (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => setMode(m)}
                                                        className={cn(
                                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                                                            mode === m
                                                                ? cn(cfg.bg, cfg.color)
                                                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm"
                                                        )}
                                                    >
                                                        <cfg.icon className="w-3.5 h-3.5" />
                                                        {cfg.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl text-white shadow hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shrink-0"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </form>
                            <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">
                                AI responses may contain errors · Always verify critical information
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div >
    );
}
