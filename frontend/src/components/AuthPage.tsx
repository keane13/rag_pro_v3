"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowRight, AlertCircle } from "lucide-react";

export default function AuthPage({ login, register }: { login: (email: string, password: string) => Promise<{ success: boolean; error?: string; }> | { success: boolean; error?: string; }; register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; }> | { success: boolean; error?: string; }; }) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const switchMode = (newMode: "login" | "register") => {
        setMode(newMode);
        setError("");
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        await new Promise((r) => setTimeout(r, 400)); // subtle UX delay

        if (mode === "register") {
            if (!name.trim()) { setError("Please enter your name."); setIsSubmitting(false); return; }
            if (password !== confirmPassword) { setError("Passwords do not match."); setIsSubmitting(false); return; }
            const result = await register(name.trim(), email.trim(), password);
            if (!result.success) { setError(result.error || "Registration failed."); setIsSubmitting(false); return; }
        } else {
            const result = await login(email.trim(), password);
            if (!result.success) { setError(result.error || "Login failed."); setIsSubmitting(false); return; }
        }
        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#050508]">
            {/* Animated gradient background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="aurora-blob top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/30" />
                <div className="aurora-blob bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/25" />
                <div className="aurora-blob top-[40%] left-[40%] w-[40%] h-[40%] bg-cyan-900/15" />
            </div>

            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }}
            />

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-[0_0_40px_rgba(139,92,246,0.4)] mb-4">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Knowledge Inteligence Policy</h1>
                    <p className="text-sm text-gray-500 mt-1">Your intelligent document assistant</p>
                </div>

                {/* Glass Card */}
                <div className="auth-card rounded-2xl p-8 border border-white/[0.08] shadow-2xl">

                    {/* Tab switcher */}
                    <div className="flex bg-white/5 rounded-xl p-1 mb-8">
                        {(["login", "register"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => switchMode(tab)}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${mode === tab
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-300"
                                    }`}
                            >
                                {tab === "login" ? "Sign In" : "Create Account"}
                            </button>
                        ))}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {mode === "register" && (
                                <motion.div
                                    key="name-field"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div className="auth-input-wrap">
                                        <User className="auth-input-icon" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Full name"
                                            className="auth-input"
                                            autoComplete="name"
                                            required={mode === "register"}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="auth-input-wrap">
                            <Mail className="auth-input-icon" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="auth-input"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="auth-input-wrap">
                            <Lock className="auth-input-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="auth-input pr-10"
                                autoComplete={mode === "login" ? "current-password" : "new-password"}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            {mode === "register" && (
                                <motion.div
                                    key="confirm-field"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div className="auth-input-wrap">
                                        <Lock className="auth-input-icon" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm password"
                                            className="auth-input"
                                            autoComplete="new-password"
                                            required={mode === "register"}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm"
                                >
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="auth-submit-btn w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
                        >
                            {isSubmitting ? (
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce [animation-delay:300ms]" />
                                </span>
                            ) : (
                                <>
                                    {mode === "login" ? "Sign In" : "Create Account"}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Switch */}
                    <p className="text-center text-xs text-gray-600 mt-6">
                        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => switchMode(mode === "login" ? "register" : "login")}
                            className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                        >
                            {mode === "login" ? "Create one" : "Sign in"}
                        </button>
                    </p>
                </div>

                <p className="text-center text-[10px] text-gray-700 mt-4">
                    Demo mode · Credentials stored locally in your browser
                </p>
            </motion.div>
        </div>
    );
}
