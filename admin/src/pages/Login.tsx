type LoginProps = {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  showPassword: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function Login({
  email,
  password,
  loading,
  error,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit
}: LoginProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="mt-1 w-full rounded-xl border border-[#e4d7c8] bg-white/90 px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition focus:border-[#593c1e] focus:outline-none focus:ring-2 focus:ring-[#593c1e]/25"
          placeholder="admin@example.com"
          required
        />
      </label>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Password
        <div className="relative mt-1">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="w-full rounded-xl border border-[#e4d7c8] bg-white/90 px-3 py-2.5 pr-10 text-sm text-neutral-900 shadow-sm transition focus:border-[#593c1e] focus:outline-none focus:ring-2 focus:ring-[#593c1e]/25"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-500 transition hover:text-neutral-800"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <span className="text-xs">🙈</span>
            ) : (
              <span className="text-xs">👁️</span>
            )}
          </button>
        </div>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#593c1e] via-[#6b4421] to-[#593c1e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
