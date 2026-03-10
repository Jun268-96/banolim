import React, { useState } from 'react';
import { Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './AuthProvider';

export const AuthScreen: React.FC = () => {
    const { signInWithMagicLink } = useAuth();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!email.trim()) return;

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await signInWithMagicLink(email.trim());

        if (result.error) {
            setError(result.error);
        } else {
            setMessage('Magic link sent. Check your inbox and return to this app after signing in.');
        }

        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10 flex items-center justify-center">
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-8 lg:p-10 shadow-sm">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-sm font-medium text-sky-700">
                        <Sparkles size={15} />
                        Banollim secure access
                    </div>
                    <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">
                        Sign in to manage your research club operations.
                    </h1>
                    <p className="mt-4 max-w-2xl text-slate-600 text-lg">
                        Use your authorized email to access member operations, activity records, scoring tools, and season reporting.
                    </p>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                            <div className="text-sm font-medium text-slate-500">Member access</div>
                            <div className="mt-2 text-slate-900 font-semibold">Home, Members, Stats</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                            <div className="text-sm font-medium text-slate-500">Team leads</div>
                            <div className="mt-2 text-slate-900 font-semibold">Activity entry</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                            <div className="text-sm font-medium text-slate-500">Operators</div>
                            <div className="mt-2 text-slate-900 font-semibold">Points and settings</div>
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                        <ShieldCheck size={22} />
                    </div>
                    <h2 className="mt-5 text-2xl font-bold text-slate-950">Sign in with email</h2>
                    <p className="mt-2 text-slate-500">
                        We will send a magic link through Supabase Auth. Access depends on your assigned app role.
                    </p>

                    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">Email</span>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </label>

                        <button
                            type="submit"
                            disabled={!email.trim() || isSubmitting}
                            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? 'Sending link...' : 'Send magic link'}
                        </button>
                    </form>

                    {message && (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="mt-6 text-xs text-slate-400">
                        Local mock mode skips login automatically. Supabase mode requires a valid auth-enabled email.
                    </div>
                </section>
            </div>
        </div>
    );
};
