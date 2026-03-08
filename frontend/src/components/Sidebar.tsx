"use client";

import { useState, useRef, useEffect } from "react";
import {
    FolderOpen, MessageSquare, Upload, FileText,
    Plus, Clock, ChevronLeft, ChevronRight, LogOut, Database, Activity,
    BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Session, FileItem } from "@/types/chat";
import { motion, AnimatePresence } from "framer-motion";
import { AuthUser } from "@/lib/useAuth";

interface SidebarProps {
    sessions: Session[];
    currentSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
    user: AuthUser;
    onLogout: () => void;
    activeView: "chat" | "knowledge" | "dashboard" | "documentation";
    onViewChange: (view: "chat" | "knowledge" | "dashboard" | "documentation") => void;
}

const FILE_EXT_COLORS: Record<string, string> = {
    pdf: "text-red-400 bg-red-400/10",
    txt: "text-blue-400 bg-blue-400/10",
    md: "text-purple-400 bg-purple-400/10",
    doc: "text-emerald-500 bg-emerald-500/10",
    docx: "text-emerald-500 bg-emerald-500/10",
    png: "text-amber-500 bg-amber-500/10",
    jpg: "text-amber-500 bg-amber-500/10",
    jpeg: "text-amber-500 bg-amber-500/10",
    webp: "text-amber-500 bg-amber-500/10",
    bmp: "text-amber-500 bg-amber-500/10",
};

function getFileColor(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return FILE_EXT_COLORS[ext] ?? "text-slate-500 bg-slate-500/10";
}

export default function Sidebar({
    sessions, currentSessionId,
    onSelectSession, onNewChat,
    user, onLogout,
    activeView, onViewChange
}: SidebarProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const formatDate = (timestamp: string) => {
        if (!mounted) return "";
        try {
            const d = new Date(timestamp);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
            if (diffDays === 0) return "Today";
            if (diffDays === 1) return "Yesterday";
            return d.toLocaleDateString();
        } catch { return ""; }
    };



    return (
        <>
            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full border-r border-blue-100 bg-gradient-to-b from-blue-50 to-white flex flex-col shrink-0 overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] relative z-20"
                    >
                        {/* Brand Header */}
                        <div className="p-4 border-b border-blue-100/50 bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-xs">
                                    PI
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-slate-800 leading-none">Knowledge Inteligence</h1>
                                    <p className="text-[10px] text-slate-500 leading-none mt-0.5">Document Intelligence</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Menu */}
                        <div className="p-3 pb-0 space-y-1 z-10">
                            <button
                                onClick={() => onViewChange("knowledge")}
                                className={cn(
                                    "w-full py-2.5 px-3 rounded-xl transition-all flex items-center gap-2.5 text-xs font-semibold",
                                    activeView === "knowledge"
                                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20"
                                        : "text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 bg-white/50 border border-transparent hover:border-blue-100"
                                )}
                            >
                                <Database className="w-4 h-4" />
                                Knowledge Base
                            </button>

                            <button
                                onClick={() => onViewChange("dashboard")}
                                className={cn(
                                    "w-full py-2.5 px-3 rounded-xl transition-all flex items-center gap-2.5 text-xs font-semibold",
                                    activeView === "dashboard"
                                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20"
                                        : "text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 bg-white/50 border border-transparent hover:border-blue-100"
                                )}
                            >
                                <Activity className="w-4 h-4" />
                                Dashboard Metrics
                            </button>

                            <button
                                onClick={() => onViewChange("documentation")}
                                className={cn(
                                    "w-full py-2.5 px-3 rounded-xl transition-all flex items-center gap-2.5 text-xs font-semibold",
                                    activeView === "documentation"
                                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20"
                                        : "text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 bg-white/50 border border-transparent hover:border-blue-100"
                                )}
                            >
                                <BookOpen className="w-4 h-4" />
                                Documentation
                            </button>


                            <button
                                onClick={() => {
                                    onViewChange("chat");
                                    onNewChat();
                                }}
                                className={cn(
                                    "w-full py-2.5 px-3 rounded-xl transition-all flex items-center gap-2.5 text-xs font-semibold",
                                    activeView === "chat" && !currentSessionId
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : "text-slate-600 border border-dashed border-slate-300 hover:text-blue-600 hover:border-blue-400 hover:bg-white"
                                )}
                            >
                                <Plus className="w-4 h-4" />
                                New Conversation
                            </button>
                        </div>

                        {/* Recent Chats Content */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1 light-scrollbar relative z-10 mt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                                Recent Chats
                            </p>
                            {sessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <MessageSquare className="w-8 h-8 text-blue-200 mb-2 opacity-50" />
                                    <p className="text-[11px] text-slate-400">No conversations yet</p>
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <button
                                        key={session.id}
                                        onClick={() => {
                                            onViewChange("chat");
                                            onSelectSession(session.id);
                                        }}
                                        className={cn(
                                            "w-full p-3 rounded-xl text-left transition-all group relative",
                                            activeView === "chat" && currentSessionId === session.id
                                                ? "bg-white border border-blue-200 text-blue-900 shadow-sm"
                                                : "hover:bg-white/80 text-slate-600 hover:text-slate-900 border border-transparent"
                                        )}
                                    >
                                        {activeView === "chat" && currentSessionId === session.id && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-blue-500 rounded-r-full" />
                                        )}
                                        <p className="text-xs font-medium truncate pr-2">{session.title}</p>
                                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatDate(session.timestamp)}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* User Footer */}
                        <div className="p-3 border-t border-blue-100/50 bg-white/50 backdrop-blur-sm z-20">
                            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white shadow-sm transition-all group border border-transparent hover:border-blue-100">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                                    <p className="text-[10px] font-medium text-slate-500 truncate">{user.email}</p>
                                </div>
                                <button
                                    onClick={onLogout}
                                    title="Sign out"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                animate={{ left: isOpen ? 280 : 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-1/2 -translate-y-1/2 z-50 p-1.5 bg-white border border-slate-200 rounded-r-lg text-slate-500 hover:text-blue-600 transition-colors shadow-md"
                style={{ left: isOpen ? 280 : 0 }}
            >
                {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </motion.button>
        </>
    );
}
