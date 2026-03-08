"use client";

import { useState, useRef, useEffect } from "react";
import {
    FileText, Trash2, Zap, Upload, Database, CheckCircle2, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileItem } from "@/types/chat";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface KnowledgeBaseProps {
    onSelectionChange: (selectedFiles: string[]) => void;
    selectedFiles: string[];
}

export default function KnowledgeBase({ onSelectionChange, selectedFiles }: KnowledgeBaseProps) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [summary, setSummary] = useState<{ filename: string; text: string } | null>(null);
    const [isSummarizing, setIsSummarizing] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const res = await fetch("http://localhost:8000/files");
            const data = await res.json();
            const fileList = (data.files || []).map((f: string) => ({
                filename: f,
                checked: selectedFiles.includes(f)
            }));
            setFiles(fileList);
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch("http://localhost:8000/upload", { method: "POST", body: formData });
            if (res.ok) fetchFiles();
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleToggleFile = (filename: string) => {
        setFiles(prev => {
            const updated = prev.map(f => f.filename === filename ? { ...f, checked: !f.checked } : f);
            const selected = updated.filter(f => f.checked).map(f => f.filename);
            onSelectionChange(selected);
            return updated;
        });
    };

    const handleDeleteFile = async (e: React.MouseEvent, filename: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${filename}"? This will also remove it from the search index.`)) return;

        try {
            const res = await fetch(`http://localhost:8000/files/${filename}`, { method: "DELETE" });
            if (res.ok) {
                setFiles(prev => {
                    const updated = prev.filter(f => f.filename !== filename);
                    const selected = updated.filter(f => f.checked).map(f => f.filename);
                    onSelectionChange(selected);
                    return updated;
                });
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail || "Failed to delete file"}`);
            }
        } catch (e) {
            console.error(e);
            alert("Network error while deleting file");
        }
    };

    const handleSummarizeFile = async (e: React.MouseEvent, filename: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSummarizing(filename);
        try {
            const res = await fetch(`http://localhost:8000/files/${filename}/summarize`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setSummary({ filename, text: data.summary });
            } else {
                const err = await res.json();
                alert(`Error: ${err.detail || "Failed to summarize file"}`);
            }
        } catch (e) {
            console.error(e);
            alert("Network error while summarizing file");
        } finally {
            setIsSummarizing(null);
        }
    };

    const getFileColor = (filename: string) => {
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        const colors: Record<string, string> = {
            pdf: "text-red-500 bg-red-50 border-red-100",
            txt: "text-blue-500 bg-blue-50 border-blue-100",
            md: "text-purple-500 bg-purple-50 border-purple-100",
            doc: "text-emerald-600 bg-emerald-50 border-emerald-100",
            docx: "text-emerald-600 bg-emerald-50 border-emerald-100",
            png: "text-amber-500 bg-amber-50 border-amber-100",
            jpg: "text-amber-500 bg-amber-50 border-amber-100",
            jpeg: "text-amber-500 bg-amber-50 border-amber-100",
            webp: "text-amber-500 bg-amber-50 border-amber-100",
            bmp: "text-amber-500 bg-amber-50 border-amber-100",
        };
        return colors[ext] ?? "text-slate-500 bg-slate-50 border-slate-200";
    };

    return (
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center bg-[#f8fafc]/50">
            <div className="w-full max-w-6xl py-10 px-6 sm:px-8 lg:px-10">
                {/* Unified Header Card */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Knowledge Base</h2>
                        <p className="text-slate-500 mt-2 text-lg">Manage and select documents or images to provide context for AI reasoning.</p>
                    </div>

                    <div className="shrink-0">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUpload}
                            className="hidden"
                            accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.webp,.bmp"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="h-12 px-8 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all flex items-center justify-center gap-3 text-sm font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
                        >
                            {isUploading ? (
                                <span className="animate-pulse flex items-center gap-2">
                                    <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" />
                                    Uploading…
                                </span>
                            ) : (
                                <><Upload className="w-5 h-5" /> Upload Files</>
                            )}
                        </button>
                    </div>
                </div>

                {files.length === 0 ? (
                    <div className="bg-white/50 border-2 border-slate-200 border-dashed rounded-[3rem] p-24 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center mb-8">
                            <Database className="w-12 h-12 text-indigo-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">No documents yet</h3>
                        <p className="text-slate-500 max-w-md mb-8 text-lg">Upload PDFs, text, or images to start building your knowledge base.</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-indigo-600 font-bold hover:text-indigo-700 text-lg hover:underline transition-all"
                        >
                            Click here to browse files
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="font-bold text-slate-700 text-xl">All Documents</h3>
                            <span className="text-sm font-bold text-indigo-600 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                                {files.filter(f => f.checked).length} selected for context
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {files.map((file, idx) => {
                                const fileColor = getFileColor(file.filename);
                                const busy = isSummarizing === file.filename;
                                return (
                                    <motion.div
                                        key={idx}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="relative group"
                                    >
                                        <label
                                            className={cn(
                                                "flex flex-col p-6 rounded-[2rem] border-2 transition-all cursor-pointer overflow-hidden h-full min-h-[160px]",
                                                file.checked
                                                    ? "bg-indigo-50/40 border-indigo-300 shadow-md shadow-indigo-100/50"
                                                    : "bg-white border-slate-200/80 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/30"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={file.checked || false}
                                                onChange={() => handleToggleFile(file.filename)}
                                                className="absolute opacity-0"
                                            />

                                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border-2 transition-colors", fileColor)}>
                                                <FileText className="w-7 h-7" />
                                            </div>

                                            <div className="flex-1">
                                                <h4 className="text-base font-bold text-slate-800 line-clamp-2 mb-1 pr-4" title={file.filename}>
                                                    {file.filename}
                                                </h4>
                                                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                                                    {file.filename.split('.').pop()} Document
                                                </p>
                                            </div>

                                            {/* Checkmark indicator */}
                                            {file.checked && (
                                                <div className="absolute top-6 right-6">
                                                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            )}
                                        </label>

                                        {/* Quick Actions Overlay */}
                                        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 flex gap-2">
                                            <button
                                                onClick={(e) => handleSummarizeFile(e, file.filename)}
                                                disabled={!!isSummarizing}
                                                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 shadow-lg hover:shadow-indigo-100 transition-all"
                                                title="Summarize"
                                            >
                                                {busy ? <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block" /> : <Zap className="w-5 h-5" />}
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteFile(e, file.filename)}
                                                disabled={!!isSummarizing}
                                                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-red-500 hover:border-red-200 shadow-lg hover:shadow-red-100 transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Summary Modal */}
                <AnimatePresence>
                    {summary && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setSummary(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                                            <FileText className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Document Analysis</h3>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{summary.filename}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSummary(null)}
                                        className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all"
                                    >
                                        <ChevronDown className="w-6 h-6 text-slate-400 rotate-180" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-10 bg-white">
                                    <div className="prose prose-slate prose-lg max-w-none text-slate-700 leading-relaxed italic-style-fix">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {summary.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                                    <button
                                        onClick={() => setSummary(null)}
                                        className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-300"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
