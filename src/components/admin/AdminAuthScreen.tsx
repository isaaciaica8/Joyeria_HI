import { useState } from 'react';
import { ArrowLeft, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import type { AuthStatusResponse } from '../../types';
import { loginAdmin, setupAdminAccount } from '../../services/api';

interface AdminAuthScreenProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (token: string, username: string) => void;
  onBackToStore: () => void;
}

export function AdminAuthScreen({
  authStatus,
  onAuthenticated,
  onBackToStore,
}: AdminAuthScreenProps) {
  const isSetupMode = !authStatus.initialized && !authStatus.envConfigured;

  const [username, setUsername] = useState(isSetupMode ? 'admin' : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isSetupMode) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      setLoading(true);
      try {
        const res = await setupAdminAccount(username, password);
        onAuthenticated(res.token, res.username);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await loginAdmin(username, password);
      onAuthenticated(res.token, res.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-black/10 p-7 sm:p-9 shadow-sm">
        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#18181B] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Joyería HI</span>
        </button>

        <div className="mt-6">
          <div className="w-10 h-10 rounded-xl bg-[#18181B] text-[#FAF9F7] flex items-center justify-center">
            {isSetupMode ? <KeyRound className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-[#18181B]">
            {isSetupMode
              ? 'Configurar acceso administrativo'
              : 'Acceso Administrador'}
          </h1>
          <p className="mt-1.5 text-sm text-[#52525B]">
            {isSetupMode
              ? 'Crea el usuario y contraseña inicial del personal de Joyería HI para gestionar catálogo, publicidad y clientes.'
              : 'Ingresa tus credenciales de personal autorizado de Joyería HI.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#3F3F46] mb-1.5">
              Usuario
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F3F46] mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              autoComplete={isSetupMode ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSetupMode ? 'Mínimo 6 caracteres' : '••••••••'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
            />
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-xs font-medium text-[#3F3F46] mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#18181B] text-[#FAF9F7] text-sm font-medium hover:bg-[#2E2E33] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading
              ? 'Verificando...'
              : isSetupMode
              ? 'Guardar credenciales y entrar'
              : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-black/8 flex items-center gap-2 text-xs text-[#6B6B73]">
          <ShieldCheck className="w-4 h-4 text-[#8C6D2E] shrink-0" />
          <span>Sesión cifrada en servidor · Uso exclusivo de Joyería HI</span>
        </div>
      </div>
    </div>
  );
}
