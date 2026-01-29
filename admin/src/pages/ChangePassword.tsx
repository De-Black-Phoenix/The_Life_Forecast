type ChangePasswordProps = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  loading: boolean;
  error: string | null;
  showOldPassword: boolean;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  onOldPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleOldPassword: () => void;
  onToggleNewPassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function ChangePassword({
  oldPassword,
  newPassword,
  confirmPassword,
  loading,
  error,
  showOldPassword,
  showNewPassword,
  showConfirmPassword,
  onOldPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleOldPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onSubmit
}: ChangePasswordProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Temporary Password
        <div className="relative mt-1">
          <input
            type={showOldPassword ? "text" : "password"}
            value={oldPassword}
            onChange={(event) => onOldPasswordChange(event.target.value)}
            className="w-full rounded-xl border border-[#e4d7c8] bg-white/90 px-3 py-2.5 pr-10 text-sm text-neutral-900 shadow-sm transition focus:border-[#593c1e] focus:outline-none focus:ring-2 focus:ring-[#593c1e]/25"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={onToggleOldPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-500 transition hover:text-neutral-800"
            aria-label={showOldPassword ? "Hide password" : "Show password"}
          >
            {showOldPassword ? (
              <span className="text-xs">🙈</span>
            ) : (
              <span className="text-xs">👁️</span>
            )}
          </button>
        </div>
      </label>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        New Password
        <div className="relative mt-1">
          <input
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            className="w-full rounded-xl border border-[#e4d7c8] bg-white/90 px-3 py-2.5 pr-10 text-sm text-neutral-900 shadow-sm transition focus:border-[#593c1e] focus:outline-none focus:ring-2 focus:ring-[#593c1e]/25"
            placeholder="At least 8 characters"
            required
          />
          <button
            type="button"
            onClick={onToggleNewPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-500 transition hover:text-neutral-800"
            aria-label={showNewPassword ? "Hide password" : "Show password"}
          >
            {showNewPassword ? (
              <span className="text-xs">🙈</span>
            ) : (
              <span className="text-xs">👁️</span>
            )}
          </button>
        </div>
      </label>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Confirm New Password
        <div className="relative mt-1">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            className="w-full rounded-xl border border-[#e4d7c8] bg-white/90 px-3 py-2.5 pr-10 text-sm text-neutral-900 shadow-sm transition focus:border-[#593c1e] focus:outline-none focus:ring-2 focus:ring-[#593c1e]/25"
            placeholder="Re-enter new password"
            required
          />
          <button
            type="button"
            onClick={onToggleConfirmPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-500 transition hover:text-neutral-800"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? (
              <span className="text-xs">🙈</span>
            ) : (
              <span className="text-xs">👁️</span>
            )}
          </button>
        </div>
      </label>
      <p className="text-[11px] text-neutral-500">
        Use a strong password you’ll remember.
      </p>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#593c1e] via-[#6b4421] to-[#593c1e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {loading ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
