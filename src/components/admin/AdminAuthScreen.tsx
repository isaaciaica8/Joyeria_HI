import { useState } from 'react';
import { ArrowLeft, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { User } from 'firebase/auth';
import { BOOTSTRAP_ADMIN_EMAIL, signInWithGoogle, signOutAdmin } from '../../firebase';

interface AdminAuthScreenProps {
  currentUser: User | null;
  isAuthorizedAdmin: boolean;
  onBackToStore: () => void;
}

export function AdminAuthScreen({
  currentUser,
  isAuthorizedAdmin,
  onBackToStore,
}: AdminAuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el inicio de sesión con Google.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchAccount() {
    setError('');
    await signOutAdmin();
    await handleGoogleSignIn();
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
            {currentUser && !isAuthorizedAdmin ? (
              <ShieldAlert className="w-5 h-5 text-amber-300" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-[#18181B]">
            Acceso Administrador
          </h1>
          <p className="mt-1.5 text-sm text-[#52525B]">
            Inicia sesión con tu cuenta de Google autorizada para gestionar el catálogo, campañas publicitarias, promociones y clientes de Joyería HI.
          </p>
        </div>

        {currentUser && !isAuthorizedAdmin ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-1">
              <p className="font-semibold">Cuenta sin permisos administrativos</p>
              <p>
                Sesión iniciada como <span className="font-medium">{currentUser.email}</span>. El acceso administrativo está reservado para el personal autorizado ({BOOTSTRAP_ADMIN_EMAIL}).
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#18181B] text-white text-sm font-medium hover:bg-[#2E2E33] cursor-pointer"
              >
                Cambiar cuenta
              </button>
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-black/12 text-sm font-medium text-[#3F3F46] hover:bg-[#FAF9F7] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {error && (
              <p
                className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#18181B] text-[#FAF9F7] text-sm font-medium hover:bg-[#2E2E33] disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{loading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            </button>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-black/8 flex items-center gap-2 text-xs text-[#6B6B73]">
          <ShieldCheck className="w-4 h-4 text-[#8C6D2E] shrink-0" />
          <span>Autenticado con Firebase Auth · Reglas Firestore activas</span>
        </div>
      </div>
    </div>
  );
}
