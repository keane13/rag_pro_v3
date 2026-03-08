"use client";

import { useEffect, useState } from "react";
import {
    Activity,
    FileText,
    Zap,
    CheckCircle,
    Clock,
    DollarSign,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardMetrics {
    avg_retrieval_latency: number;
    avg_rerank_latency: number;
    avg_generation_latency: number;
    avg_bert_score: number;
    total_documents: number;
    total_cost: number;
}

export default function Dashboard() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("http://localhost:8000/dashboard/metrics");
            if (!res.ok) throw new Error("Failed to fetch metrics");
            const data = await res.json();
            setMetrics(data);
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    const MetricCard = ({ title, value, unit, icon: Icon, description, trend }: any) => (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />

            <div className="flex justify-between items-start mb-4 relative">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            <div className="relative">
                <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-800 tracking-tight">
                        {loading ? "-" : value}
                    </span>
                    {unit && <span className="text-slate-500 font-medium">{unit}</span>}
                </div>
                {description && (
                    <p className="text-xs text-slate-400 mt-2">{description}</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-y-auto w-full">
            <div className="max-w-6xl mx-auto w-full p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Monitoring</h1>
                        <p className="text-slate-500 text-sm mt-1">Real-time performance and evaluation metrics</p>
                    </div>
                    <button
                        onClick={fetchMetrics}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Refresh
                    </button>
                </div>

                {error ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">
                        Failed to load metrics: {error}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Primary Metrics Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <MetricCard
                                title="RAGAS Score F1"
                                value={metrics?.avg_bert_score ? (metrics.avg_bert_score * 100).toFixed(1) : "0.0"}
                                unit="%"
                                icon={CheckCircle}
                                description="Average semantic similarity across batch evaluations (RAGAS target: >80%)"
                            />
                            <MetricCard
                                title="Total Estimated Cost"
                                value={`$${metrics?.total_cost?.toFixed(4) || "0.0000"}`}
                                icon={DollarSign}
                                description="Estimated API usage cost based on input/output tokens"
                            />
                            <MetricCard
                                title="Knowledge Base"
                                value={metrics?.total_documents || "0"}
                                unit="files"
                                icon={FileText}
                                description="Total number of documents currently indexed"
                            />
                        </div>

                        {/* Latency Section */}
                        <h2 className="text-lg font-semibold text-slate-800 mt-8 mb-4 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            Average Latency Breakdown
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MetricCard
                                title="Retrieval Phase"
                                value={metrics?.avg_retrieval_latency ? (metrics.avg_retrieval_latency).toFixed(3) : "0.000"}
                                unit="s"
                                icon={Clock}
                                description="Average time to fetch chunks (seconds)"
                            />
                            <MetricCard
                                title="Reranker Phase"
                                value={metrics?.avg_rerank_latency ? (metrics.avg_rerank_latency).toFixed(3) : "0.000"}
                                unit="s"
                                icon={Clock}
                                description="Average time to rerank chunks (seconds)"
                            />
                            <MetricCard
                                title="Generation Phase"
                                value={metrics?.avg_generation_latency ? (metrics.avg_generation_latency).toFixed(2) : "0.00"}
                                unit="s"
                                icon={Zap}
                                description="Average LLM generation time (seconds)"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
