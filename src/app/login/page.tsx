'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      setError('Por favor complete todos los campos');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.trim(), password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // Fast transition based on role
      if (data.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/alumno/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
      setLoading(false);
    }
  };

  const handleFillDemo = (u: string, p: string) => {
    setUsuario(u);
    setPassword(p);
    setError(null);
  };

  return (
    <main className="min-h-screen relative flex items-center justify-center bg-slate-950 p-4 overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-8 transition-all duration-300">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20 mb-4 ring-1 ring-white/20">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Pagos<span className="text-cyan-400">CM</span>
          </h1>

          {/* Strictly required text below logo */}
          <p className="mt-2 text-sm text-slate-300 font-medium leading-snug">
            Portal de registro de pagos de Plataformas del Colegio Mexicano
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3 animate-shake">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-[#1.25rem] space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <span>Ingresar al Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Quick Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5 justify-center">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Credenciales de prueba disponibles:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleFillDemo('adminCM', 'admin123')}
              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 text-left transition-all hover:bg-slate-900 group"
            >
              <div className="font-semibold text-cyan-400 group-hover:text-cyan-300">Administrador</div>
              <div className="text-slate-400 text-[11px] mt-0.5">adminCM / admin123</div>
            </button>

            <button
              type="button"
              onClick={() => handleFillDemo('alumnoDemo', 'alumno123')}
              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 text-left transition-all hover:bg-slate-900 group"
            >
              <div className="font-semibold text-indigo-400 group-hover:text-indigo-300">Alumno (Padre)</div>
              <div className="text-slate-400 text-[11px] mt-0.5">alumnoDemo / alumno123</div>
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
