import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  clearStoredJwt,
  fetchJson,
  getApiConfig,
  getAuthToken,
  getStoredJwt,
  normalizeArrayResponse,
  setStoredJwt
} from "./api";
import type { Payment, User, UserProfileResponse } from "./types";
import { AuthLayout } from "./components/AuthLayout";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import logo from "./assets/Astro_Devaraj_Logo.png";

type UsersResponse = { users: User[] };
type PaymentsResponse = { payments: Payment[] };
type LoginResponse = { token: string; force_password_change: boolean };
type ChangePasswordResponse = { token: string; force_password_change: boolean };
type PaymentRow = Payment & { updated_at?: string };
type DashboardTab = "INBOX" | "VERIFIED" | "COMPLETED";

const viewTabs: Array<{ label: string; value: DashboardTab }> = [
  { label: "Inbox", value: "INBOX" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Completed", value: "COMPLETED" }
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function App() {
  const { adminToken } = getApiConfig();
  const [authToken, setAuthToken] = useState<string>(() => getStoredJwt());
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [changeOldPassword, setChangeOldPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeView, setActiveView] = useState<DashboardTab>("INBOX");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>(
    {}
  );
  const [screenshotLoading, setScreenshotLoading] = useState<
    Record<string, boolean>
  >({});
  const [screenshotError, setScreenshotError] = useState<
    Record<string, boolean>
  >({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectAmount, setRejectAmount] = useState<Record<string, string>>({});
  const [rejectSendError, setRejectSendError] = useState(false);
  const [activeRejectPaymentId, setActiveRejectPaymentId] = useState<
    string | null
  >(null);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<
    Array<{ id: string; type: "success" | "error"; message: string }>
  >([]);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(
    null
  );
  const [unexpectedShape, setUnexpectedShape] = useState(false);
  const [usersCount, setUsersCount] = useState(0);
  const [paymentsCount, setPaymentsCount] = useState(0);
  const [searchVerified, setSearchVerified] = useState("");
  const activeToken = authToken || adminToken;
  const isAuthenticated = Boolean(activeToken);

  function handleUnauthorized() {
    clearStoredJwt();
    setAuthToken("");
    setIsUnauthorized(true);
    setForcePasswordChange(false);
    setLoginError("Session expired. Please sign in again.");
  }

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [users]
  );

  async function loadData() {
    setIsLoading(true);
    setHasError(false);
    setUnexpectedShape(false);
    try {
      const [usersResponse, paymentsResponse] = await Promise.all([
        fetchJson<UsersResponse>("/admin/users"),
        fetchJson<PaymentsResponse>("/admin/payments?verified=false")
      ]);
      const usersParsed = normalizeArrayResponse<User>(usersResponse, [
        "users",
        "data"
      ]);
      const paymentsParsed = normalizeArrayResponse<Payment>(paymentsResponse, [
        "payments",
        "data"
      ]);
      setUsers(usersParsed.items);
      setPayments(paymentsParsed.items);
      setUsersCount(usersParsed.items.length);
      setPaymentsCount(paymentsParsed.items.length);
      setUnexpectedShape(usersParsed.unexpected || paymentsParsed.unexpected);
    } catch (error) {
      if ((error as Error).message === "unauthorized") {
        handleUnauthorized();
      } else {
        setHasError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!activeToken) {
      return;
    }
    if (forcePasswordChange) {
      return;
    }
    setIsUnauthorized(false);
    loadData();
  }, [activeToken, forcePasswordChange]);

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: loginEmail.trim().toLowerCase(),
            password: loginPassword
          })
        }
      );
      if (!response.ok) {
        setLoginError("Invalid email or password.");
        return;
      }
      const payload = (await response.json()) as LoginResponse;
      setStoredJwt(payload.token);
      setAuthToken(payload.token);
      setForcePasswordChange(Boolean(payload.force_password_change));
      setLoginPassword("");
      setLoginError(null);
      setIsUnauthorized(false);
    } catch (error) {
      setLoginError("Unable to reach server. Try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (!changeNewPassword || changeNewPassword !== changeConfirmPassword) {
      setLoginError("Passwords do not match.");
      return;
    }
    setChangeLoading(true);
    setLoginError(null);
    try {
      const response = await fetchJson<ChangePasswordResponse>(
        "/admin/change-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldPassword: changeOldPassword,
            newPassword: changeNewPassword
          })
        }
      );
      setStoredJwt(response.token);
      setAuthToken(response.token);
      setForcePasswordChange(false);
      setChangeOldPassword("");
      setChangeNewPassword("");
      setChangeConfirmPassword("");
      pushToast("success", "Password updated ✅");
    } catch (error) {
      if ((error as Error).message === "unauthorized") {
        handleUnauthorized();
      } else {
        setLoginError("Could not update password. Try again.");
      }
    } finally {
      setChangeLoading(false);
    }
  }

  async function handleVerify(userId: string) {
    try {
      setVerifying((prev) => ({ ...prev, [userId]: true }));
      await fetchJson(`/admin/verify/${userId}`, { method: "POST" });
      setPayments((prev) => prev.filter((payment) => payment.user_id !== userId));
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, status: "VERIFIED" } : user
        )
      );
      pushToast("success", "Payment verified ✅");
    } catch (error) {
      if ((error as Error).message === "unauthorized") {
        handleUnauthorized();
      } else {
        setHasError(true);
        pushToast("error", "Request failed. Try again.");
      }
    } finally {
      setVerifying((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function handleReject(payment: Payment) {
    const reason = rejectReason[payment.id];
    if (!reason) {
      setHasError(true);
      pushToast("error", "Request failed. Try again.");
      return;
    }

    const payload: Record<string, unknown> = {
      reason
    };
    if (rejectNote[payment.id]) {
      payload.note = rejectNote[payment.id];
    }
    if (reason === "UNDERPAID") {
      const amount = Number(rejectAmount[payment.id]);
      if (!amount || Number.isNaN(amount)) {
        setHasError(true);
        return;
      }
      payload.receivedAmountGhs = amount;
    }

    try {
      setRejecting((prev) => ({ ...prev, [payment.id]: true }));
      const token = getAuthToken();
      if (!token) {
        handleUnauthorized();
        return;
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/reject/${payment.user_id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(adminToken && token === adminToken
              ? { "X-Admin-Token": adminToken }
              : {}),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        setRejectSendError(true);
        pushToast("error", "Request failed. Try again.");
        return;
      }
      setRejectSendError(false);
      await loadData();
      pushToast("success", "Rejection sent ✅");
    } catch (error) {
      if ((error as Error).message === "unauthorized") {
        setIsUnauthorized(true);
      } else {
        setHasError(true);
        pushToast("error", "Request failed. Try again.");
      }
    } finally {
      setRejecting((prev) => ({ ...prev, [payment.id]: false }));
    }
  }

  async function handleComplete(userId: string) {
    try {
      setCompleting((prev) => ({ ...prev, [userId]: true }));
      const token = getAuthToken();
      if (!token) {
        handleUnauthorized();
        return;
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/complete/${userId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(adminToken && token === adminToken
              ? { "X-Admin-Token": adminToken }
              : {})
          }
        }
      );
      if (response.status === 401 || response.status === 403) {
        setIsUnauthorized(true);
        return;
      }
      if (!response.ok) {
        if (response.status === 502) {
          setUsers((prev) =>
            prev.map((user) =>
              user.id === userId ? { ...user, status: "COMPLETED" } : user
            )
          );
          pushToast("error", "Marked completed, message failed.");
          return;
        }
        pushToast("error", "Request failed. Try again.");
        return;
      }
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, status: "COMPLETED" } : user
        )
      );
      pushToast("success", "Marked completed ✅");
    } catch (error) {
      if ((error as Error).message === "unauthorized") {
        setIsUnauthorized(true);
      } else {
        pushToast("error", "Request failed. Try again.");
      }
    } finally {
      setCompleting((prev) => ({ ...prev, [userId]: false }));
    }
  }

  function pushToast(type: "success" | "error", message: string) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }

  async function loadPaymentScreenshot(paymentId: string): Promise<string> {
    if (screenshotUrls[paymentId]) {
      return screenshotUrls[paymentId];
    }
    const token = getAuthToken();
    if (!token) {
      throw new Error("unauthorized");
    }
    setScreenshotLoading((prev) => ({ ...prev, [paymentId]: true }));
    setScreenshotError((prev) => ({ ...prev, [paymentId]: false }));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/payments/${paymentId}/screenshot`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(adminToken && token === adminToken
              ? { "X-Admin-Token": adminToken }
              : {})
          }
        }
      );
      if (response.status === 401 || response.status === 403) {
        throw new Error("unauthorized");
      }
      if (!response.ok) {
        throw new Error("image_error");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setScreenshotUrls((prev) => ({ ...prev, [paymentId]: url }));
      return url;
    } finally {
      setScreenshotLoading((prev) => ({ ...prev, [paymentId]: false }));
    }
  }

  useEffect(() => {
    return () => {
      Object.values(screenshotUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [screenshotUrls]);

  async function openProfile(userId: string) {
    try {
      const response = await fetchJson<UserProfileResponse>(
        `/admin/users/${userId}/profile`
      );
      setProfileUserId(userId);
      setProfileData(response);
    } catch (error) {
      if ((error as Error).message === "unauthorized") {
        setIsUnauthorized(true);
      } else {
        setHasError(true);
      }
    }
  }

  function closeProfile() {
    setProfileUserId(null);
    setProfileData(null);
  }

  const verifiedUsers = useMemo(
    () => sortedUsers.filter((user) => user.status === "VERIFIED"),
    [sortedUsers]
  );

  const completedUsers = useMemo(
    () => sortedUsers.filter((user) => user.status === "COMPLETED"),
    [sortedUsers]
  );

  const verifiedFiltered = useMemo(() => {
    const query = searchVerified.trim().toLowerCase();
    if (!query) {
      return verifiedUsers;
    }
    return verifiedUsers.filter((user) =>
      user.phone.toLowerCase().includes(query)
    );
  }, [verifiedUsers, searchVerified]);

  const notCompletedGroups = useMemo(() => {
    const groups: Record<string, User[]> = {
      NEW: [],
      AWAITING_PAYMENT: [],
      PAYMENT_SUBMITTED: []
    };
    sortedUsers.forEach((user) => {
      if (user.status === "NEW") groups.NEW.push(user);
      if (user.status === "AWAITING_PAYMENT") groups.AWAITING_PAYMENT.push(user);
      if (user.status === "PAYMENT_SUBMITTED")
        groups.PAYMENT_SUBMITTED.push(user);
    });
    return groups;
  }, [sortedUsers]);

  if (!isAuthenticated) {
    return (
      <AuthLayout
        title="Admin Sign In"
        subtitle="Use your email and temporary password to continue."
        footer={
          <span>
            Need a reset? Ask the developer to run the admin reset-password
            command.
          </span>
        }
      >
        <Login
          email={loginEmail}
          password={loginPassword}
          loading={loginLoading}
          error={loginError}
          showPassword={showLoginPassword}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPassword}
          onTogglePassword={() => setShowLoginPassword((prev) => !prev)}
          onSubmit={handleLoginSubmit}
        />
      </AuthLayout>
    );
  }

  if (forcePasswordChange) {
    return (
      <AuthLayout
        title="Change Password"
        subtitle="Please set a new password before continuing."
      >
        <ChangePassword
          oldPassword={changeOldPassword}
          newPassword={changeNewPassword}
          confirmPassword={changeConfirmPassword}
          loading={changeLoading}
          error={loginError}
          showOldPassword={showTempPassword}
          showNewPassword={showNewPassword}
          showConfirmPassword={showConfirmPassword}
          onOldPasswordChange={setChangeOldPassword}
          onNewPasswordChange={setChangeNewPassword}
          onConfirmPasswordChange={setChangeConfirmPassword}
          onToggleOldPassword={() => setShowTempPassword((prev) => !prev)}
          onToggleNewPassword={() => setShowNewPassword((prev) => !prev)}
          onToggleConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
          onSubmit={handleChangePassword}
        />
      </AuthLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f2ec] text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-[#e8dfd4] bg-[#f9f4ee]/95 backdrop-blur">
  <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
    <div className="flex items-center justify-between gap-3">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-20 items-center justify-center rounded-xl bg-white/70 shadow-sm sm:h-10 sm:w-28">
          <img
            src={logo}
            alt="Astro Deva-Raj"
            className="h-full w-full object-contain"
          />
        </div>

        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-sm font-black text-neutral-950 sm:text-lg">
            The Life Forecast
          </p>
          <p className="truncate text-[11px] font-medium text-neutral-600 sm:text-sm">
            Admin Dashboard
          </p>
        </div>
      </div>

      {/* Right: Pills */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex items-center rounded-full border border-[#e4d7c8] bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-600">
          Internal use only
        </span>

        {/* Mobile compact pill */}
        <span className="inline-flex sm:hidden items-center rounded-full border border-[#e4d7c8] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
          Internal
        </span>

        {authToken && (
          <button
            onClick={() => {
              clearStoredJwt();
              setAuthToken("");
              setForcePasswordChange(false);
            }}
            className="hidden sm:inline-flex items-center rounded-full border border-[#e4d7c8] bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-white"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  </div>

  {/* slim brand accent line */}
  <div className="h-1 w-full bg-[#593c1e]" />
</header>


      {hasError && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3 text-sm text-amber-900">
            <span>
              We could not reach the API. Please check your connection and try
              again.
            </span>
            <button
              onClick={loadData}
              className="rounded-full border border-amber-300 bg-white px-4 py-1 text-xs font-medium text-amber-900"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {rejectSendError && (
        <div className="border-b border-red-200 bg-red-50">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-2 text-xs text-red-700">
            Rejection saved but message failed to send.
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 space-y-2 sm:bottom-auto sm:left-auto sm:top-4 sm:right-4 sm:translate-x-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-2 text-sm shadow-sm transition ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {unexpectedShape && (
        <div className="border-b border-neutral-200 bg-neutral-50">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-2 text-xs text-neutral-600">
            Unexpected API response shape detected. Showing best-effort data.
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:space-y-10 sm:px-6 sm:py-8">
        <section className="relative overflow-hidden rounded-3xl border border-[#e0d3c2] bg-gradient-to-r from-[#6b4a28] via-[#8b6337] to-[#5a3b1f] p-4 text-white shadow-[0_18px_50px_-28px_rgba(89,60,30,0.6)] sm:p-8">
          <div className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute inset-y-0 right-0 hidden w-40 bg-white/5 sm:block" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              The Life Forecast
            </p>
            <h1 className="font-heading text-xl font-black text-white sm:text-4xl">
              Sacred insights, guided with care and confidentiality.
            </h1>
            <p className="text-[13px] text-white/80 sm:text-base">
              Verify payments, protect privacy, and guide each reading forward.
            </p>
          </div>
        </section>
        <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#e8dfd4] bg-[#fbf8f4] p-2">
          <div className="flex w-full overflow-x-auto">
            <div className="flex w-max gap-2">
              {viewTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveView(tab.value)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition sm:px-4 ${
                    activeView === tab.value
                      ? "border-[#593c1e] bg-[#593c1e] text-white"
                      : "border-[#e4d7c8] bg-white/70 text-neutral-600 hover:border-[#593c1e]/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeView === "INBOX" && (
          <>

        <section className="rounded-2xl border border-[#e8dfd4] bg-[#fbf8f4] p-4 shadow-[0_12px_30px_-24px_rgba(89,60,30,0.35)] sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-black text-neutral-950 sm:text-2xl">
                Payments to Verify
              </h2>
              <p className="text-xs text-neutral-600 sm:text-sm">
                Review payment screenshots and verify.
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-[#eadfce] sm:mt-5">
            {isLoading ? (
              <div className="rounded-xl border border-[#e8dfd4] bg-white/70 p-3 text-xs text-neutral-500 sm:p-6 sm:text-sm">
                Loading payments...
              </div>
            ) : payments.length === 0 ? (
              <div className="rounded-xl border border-[#e8dfd4] bg-white/70 p-3 text-xs text-neutral-500 sm:p-6 sm:text-sm">
                No unverified payments. Users: {usersCount}, Payments:{" "}
                {paymentsCount}
              </div>
            ) : (
              payments.map((payment: PaymentRow) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-3 border-b border-[#eadfce] py-3 text-[13px] text-neutral-700 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1 text-xs text-neutral-600">
                    <p className="text-sm font-semibold text-neutral-900">
                      {payment.user?.phone || "Unknown user"}
                    </p>
                    <p>Plan: {payment.user?.selected_plan || "—"}</p>
                    <p>
                      Last Updated:{" "}
                      {formatDate(payment.updated_at || payment.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      onClick={async () => {
                        try {
                          const url = await loadPaymentScreenshot(payment.id);
                          setActiveImage(url);
                        } catch (error) {
                          if ((error as Error).message === "unauthorized") {
                            setIsUnauthorized(true);
                          } else {
                            setScreenshotError((prev) => ({
                              ...prev,
                              [payment.id]: true
                            }));
                          }
                        }
                      }}
                      className="flex items-center gap-2 rounded-xl border border-[#e4d7c8] bg-[#f6f0e8] px-3 py-2 text-xs text-neutral-700 transition hover:bg-[#efe6da]"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-[#e4d7c8] bg-white/80">
                        {screenshotLoading[payment.id] ? (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                            Loading
                          </div>
                        ) : screenshotUrls[payment.id] ? (
                          <img
                            src={screenshotUrls[payment.id]}
                            alt="Payment screenshot"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                            Preview
                          </div>
                        )}
                      </div>
                      <span>
                        {screenshotError[payment.id]
                          ? "Screenshot unavailable"
                          : "View Screenshot"}
                      </span>
                    </button>
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleVerify(payment.user_id)}
                        disabled={verifying[payment.user_id]}
                        className="rounded-full bg-[#593c1e] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#4a3219] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#593c1e]/50 sm:text-xs"
                      >
                        {verifying[payment.user_id] ? "Verifying..." : "Verify"}
                      </button>
                      <button
                        onClick={() => setActiveRejectPaymentId(payment.id)}
                        className="rounded-full border border-[#593c1e]/40 bg-[#f6f0e8] px-3 py-1.5 text-xs font-semibold text-[#593c1e] transition hover:bg-[#efe6da]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dfd4] bg-[#fbf8f4] p-4 shadow-[0_12px_30px_-24px_rgba(89,60,30,0.35)] sm:p-6">
          <div>
            <h2 className="font-heading text-lg font-black text-neutral-950 sm:text-2xl">
              ⏳ Users Pending
            </h2>
            <p className="text-xs text-neutral-600 sm:text-sm">
              Users with pending steps grouped by status.
            </p>
          </div>

          <div className="mt-4 space-y-4 sm:mt-6 sm:grid sm:grid-cols-2 sm:items-stretch sm:gap-6 lg:grid-cols-3">
            {Object.entries(notCompletedGroups).map(([status, group]) => (
              <div
                key={status}
                className="border-b border-[#e8dfd4] pb-4 last:border-b-0 sm:flex sm:h-full sm:min-h-[220px] sm:flex-col sm:rounded-2xl sm:border sm:border-[#e8dfd4] sm:bg-white/70 sm:p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-black text-neutral-900 sm:text-lg">
                    {status.replace("_", " ")}
                  </h3>
                  <span className="rounded-full border border-[#593c1e]/30 px-2 py-0.5 text-[11px] font-semibold text-[#593c1e]">
                    {group.length}
                  </span>
                </div>
                <div className="mt-3 flex-1">
                  {group.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-[#eadfce] bg-white/60 px-3 py-6 text-xs text-neutral-500">
                      No users.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#eadfce]">
                      {group.map((user) => (
                        <div
                          key={user.id}
                          className="py-2 text-xs text-neutral-700 hover:bg-[#f8f1e8] sm:py-3 sm:text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-neutral-900">
                              {user.phone}
                            </p>
                            <button
                              onClick={() => openProfile(user.id)}
                              className="rounded-full border border-[#593c1e]/40 px-2 py-0.5 text-[11px] font-semibold text-[#593c1e] hover:bg-[#593c1e]/5 sm:px-3 sm:py-1 sm:text-xs"
                            >
                              View
                            </button>
                          </div>
                          <div className="mt-1 space-y-1 text-[11px] text-neutral-600 sm:text-xs">
                            <p>Plan: {user.selected_plan || "—"}</p>
                            <p>Created: {formatDate(user.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </>
        )}

        {activeView === "COMPLETED" && (
          <section className="rounded-2xl border border-[#e8dfd4] bg-[#fbf8f4] p-4 shadow-[0_12px_30px_-24px_rgba(89,60,30,0.35)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-black text-neutral-950 sm:text-2xl">
                  Completed
                </h2>
                <p className="text-xs text-neutral-600 sm:text-sm">
                  Archived users with completed readings.
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[#eadfce] sm:mt-5">
              {completedUsers.length === 0 ? (
                <div className="rounded-xl border border-[#e8dfd4] bg-white/70 p-3 text-xs text-neutral-500 sm:p-4 sm:text-sm">
                  No completed users found.
                </div>
              ) : (
                completedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-2 border-b border-[#eadfce] py-3 text-[13px] text-neutral-700 sm:flex-row sm:items-center sm:justify-between sm:py-4 sm:text-sm"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-neutral-900">
                        {user.phone}
                      </p>
                      <p>Plan: {user.selected_plan || "—"}</p>
                      <p>Created: {formatDate(user.created_at)}</p>
                    </div>
                    <button
                      onClick={() => openProfile(user.id)}
                      className="whitespace-nowrap rounded-full border border-[#593c1e]/40 px-2 py-1 text-[11px] font-semibold text-[#593c1e] hover:bg-[#593c1e]/5 sm:px-3 sm:py-1.5 sm:text-xs"
                    >
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeView === "VERIFIED" && (
        <section className="rounded-2xl border border-[#e8dfd4] bg-[#fbf8f4] p-4 shadow-[0_12px_30px_-24px_rgba(89,60,30,0.35)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-black text-neutral-950 sm:text-2xl">
                ✅ Verified — Ready for Reading
              </h2>
              <p className="text-xs text-neutral-600 sm:text-sm">
                Verified users ready to begin their reading.
              </p>
            </div>
            <input
              value={searchVerified}
              onChange={(event) => setSearchVerified(event.target.value)}
              placeholder="Search by phone"
              className="w-full rounded-xl border border-[#e4d7c8] bg-white/80 px-3 py-2 text-sm sm:w-64"
            />
          </div>

          <div className="mt-4 divide-y divide-[#eadfce] sm:mt-5">
            {verifiedFiltered.length === 0 ? (
              <div className="rounded-xl border border-[#e8dfd4] bg-white/70 p-3 text-xs text-neutral-500 sm:p-4 sm:text-sm">
                No verified users found.
              </div>
            ) : (
              verifiedFiltered.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-2 border-b border-[#eadfce] py-3 text-[13px] text-neutral-700 sm:flex-row sm:items-center sm:justify-between sm:py-4 sm:text-sm"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-neutral-900">
                      {user.phone}
                    </p>
                    <p>Plan: {user.selected_plan || "—"}</p>
                    <p>Created: {formatDate(user.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openProfile(user.id)}
                      className="whitespace-nowrap rounded-full border border-[#593c1e]/40 px-2 py-1 text-[11px] font-semibold text-[#593c1e] hover:bg-[#593c1e]/5 sm:px-3 sm:py-1.5 sm:text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleComplete(user.id)}
                      disabled={completing[user.id]}
                      className="whitespace-nowrap rounded-full bg-[#593c1e] px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-[#4a3219] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#593c1e]/50 sm:px-3 sm:py-1.5 sm:text-xs"
                    >
                      {completing[user.id] ? "Completing..." : "Complete"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        )}
      </main>

      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setActiveImage(null)}
        >
          <div className="max-w-3xl rounded-2xl border border-white/30 bg-[#faf6f1] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 text-xs text-neutral-600">
              <span>Payment Screenshot</span>
              <button
                className="rounded-full border border-[#e4d7c8] bg-white/70 px-3 py-1"
                aria-label="Close"
              >
                X
              </button>
            </div>
            <img
              src={activeImage}
              alt="Payment screenshot full"
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {profileUserId && profileData && (
        <div
          className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/55 backdrop-blur-sm sm:justify-end"
          onClick={closeProfile}
        >
          <div
            className="h-full w-full overflow-y-auto border border-[#e8dfd4] bg-[#fbf8f4] p-4 shadow-2xl sm:w-[420px] sm:max-w-[420px] sm:rounded-l-2xl sm:border-l sm:border-t-0 sm:border-b-0 sm:border-r-0 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-xl font-black text-neutral-950 sm:text-2xl">
                  User Profile
                </h3>
                <p className="text-xs text-neutral-500 sm:text-sm">
                  {profileData.user.phone}
                </p>
              </div>
              <button
                onClick={closeProfile}
                className="rounded-full border border-[#e4d7c8] bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-600"
                aria-label="Close"
              >
                X
              </button>
            </div>

            <div className="mt-4 grid gap-4 text-xs text-neutral-700 sm:mt-6 sm:text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-neutral-500">Status</p>
                <p className="font-semibold">
                  {profileData.user.status.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500">Plan</p>
                <p className="font-semibold">
                  {profileData.user.selected_plan || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500">Created At</p>
                <p className="font-semibold">
                  {formatDate(profileData.user.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500">Current Step</p>
                <p className="font-semibold">
                  {profileData.conversation?.current_step || "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#e4d7c8] bg-white/70 p-4 sm:mt-6">
              <h4 className="font-heading text-lg font-black text-neutral-900">
                Collected Details
              </h4>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Full Name", "full_name"],
                  ["Date of Birth", "dob"],
                  ["Time of Birth Type", "timeOfBirthType"],
                  ["Time of Birth", "timeOfBirthValue"],
                  ["Place of Birth", "birth_place"],
                  ["Current Location", "current_location"],
                  ["Gender", "gender"]
                ].map(([label, key]) => (
                  <div key={key}>
                    <p className="text-xs uppercase text-neutral-500">{label}</p>
                    <p className="font-semibold">
                      {String(
                        profileData.conversation?.collected_data?.[key] ?? "—"
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#e4d7c8] bg-white/70 p-4 sm:mt-6">
              <h4 className="font-heading text-lg font-black text-neutral-900">
                Latest Payment Proof
              </h4>
              {profileData.latestPayment ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-neutral-600">
                    {formatDate(
                      profileData.latestPayment.updated_at ||
                        profileData.latestPayment.created_at
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const url = await loadPaymentScreenshot(
                          profileData.latestPayment!.id
                        );
                        setActiveImage(url);
                      } catch (error) {
                        pushToast("error", "Request failed. Try again.");
                      }
                    }}
                    className="rounded-full border border-[#593c1e]/40 px-3 py-1 text-xs font-semibold text-[#593c1e] hover:bg-[#593c1e]/5"
                  >
                    View Proof
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">No proof found.</p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[#e4d7c8] bg-white/70 p-4 sm:mt-6">
              {profileData.user.status === "PAYMENT_SUBMITTED" &&
                profileData.latestPayment && (
                  <div className="space-y-3 text-xs text-neutral-700">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerify(profileData.user.id)}
                        disabled={verifying[profileData.user.id]}
                        className="rounded-full bg-[#593c1e] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4a3219] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#593c1e]/50"
                      >
                        {verifying[profileData.user.id]
                          ? "Verifying..."
                          : "Verify"}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <select
                        value={rejectReason[profileData.latestPayment.id] || ""}
                        onChange={(event) =>
                          setRejectReason((prev) => ({
                            ...prev,
                            [profileData.latestPayment!.id]: event.target.value
                          }))
                        }
                        className="w-full rounded-lg border border-[#e4d7c8] bg-white/80 px-3 py-1 text-xs"
                      >
                        <option value="">Reject reason</option>
                        <option value="INVALID_PROOF">Invalid Proof</option>
                        <option value="UNDERPAID">Underpaid</option>
                      </select>
                      {rejectReason[profileData.latestPayment.id] ===
                        "UNDERPAID" && (
                        <input
                          value={rejectAmount[profileData.latestPayment.id] || ""}
                          onChange={(event) =>
                            setRejectAmount((prev) => ({
                              ...prev,
                              [profileData.latestPayment!.id]: event.target.value
                            }))
                          }
                          placeholder="Received amount (GHS)"
                          className="w-full rounded-lg border border-[#e4d7c8] bg-white/80 px-3 py-1 text-xs"
                        />
                      )}
                      <input
                        value={rejectNote[profileData.latestPayment.id] || ""}
                        onChange={(event) =>
                          setRejectNote((prev) => ({
                            ...prev,
                            [profileData.latestPayment!.id]: event.target.value
                          }))
                        }
                        placeholder="Optional note"
                        className="w-full rounded-lg border border-[#e4d7c8] bg-white/80 px-3 py-1 text-xs"
                      />
                      <button
                        onClick={() =>
                          handleReject(profileData.latestPayment as Payment)
                        }
                        disabled={rejecting[profileData.latestPayment.id]}
                        className="w-full rounded-full border border-[#593c1e]/40 bg-[#f6f0e8] px-3 py-1.5 text-xs font-semibold text-[#593c1e] transition hover:bg-[#efe6da] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rejecting[profileData.latestPayment.id]
                          ? "Sending..."
                          : "Send Rejection"}
                      </button>
                    </div>
                  </div>
                )}

              {(profileData.user.status === "VERIFIED" ||
                profileData.user.status === "COMPLETED") && (
                <button
                  onClick={() =>
                    profileData.user.status === "COMPLETED"
                      ? undefined
                      : handleComplete(profileData.user.id)
                  }
                  disabled={
                    profileData.user.status === "COMPLETED" ||
                    completing[profileData.user.id]
                  }
                  className="rounded-full bg-[#593c1e] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4a3219] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#593c1e]/50"
                >
                  {profileData.user.status === "COMPLETED"
                    ? "Reading Complete"
                    : completing[profileData.user.id]
                      ? "Completing..."
                      : "Mark Completed"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeRejectPaymentId && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setActiveRejectPaymentId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#e8dfd4] bg-[#fbf8f4] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-black text-neutral-950">
                  Reject Payment
                </h3>
                <p className="text-xs text-neutral-600">
                  Choose a reason and add an optional note.
                </p>
              </div>
              <button
                onClick={() => setActiveRejectPaymentId(null)}
                className="rounded-full border border-[#e4d7c8] bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-600"
                aria-label="Close"
              >
                X
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <select
                value={rejectReason[activeRejectPaymentId] || ""}
                onChange={(event) =>
                  setRejectReason((prev) => ({
                    ...prev,
                    [activeRejectPaymentId]: event.target.value
                  }))
                }
                className="w-full rounded-lg border border-[#e4d7c8] bg-white/80 px-3 py-2 text-xs"
              >
                <option value="">Select reason</option>
                <option value="INVALID_PROOF">Invalid Proof</option>
                <option value="UNDERPAID">Underpaid</option>
              </select>
              {rejectReason[activeRejectPaymentId] === "UNDERPAID" && (
                <input
                  value={rejectAmount[activeRejectPaymentId] || ""}
                  onChange={(event) =>
                    setRejectAmount((prev) => ({
                      ...prev,
                      [activeRejectPaymentId]: event.target.value
                    }))
                  }
                  placeholder="Received amount (GHS)"
                  className="w-full rounded-lg border border-[#e4d7c8] bg-white/80 px-3 py-2 text-xs"
                />
              )}
              <input
                value={rejectNote[activeRejectPaymentId] || ""}
                onChange={(event) =>
                  setRejectNote((prev) => ({
                    ...prev,
                    [activeRejectPaymentId]: event.target.value
                  }))
                }
                placeholder="Optional note"
                className="w-full rounded-lg border border-[#e4d7c8] bg-white/80 px-3 py-2 text-xs"
              />
              <button
                onClick={() => {
                  const payment = payments.find(
                    (item) => item.id === activeRejectPaymentId
                  );
                  if (!payment) return;
                  handleReject(payment);
                  setActiveRejectPaymentId(null);
                }}
                disabled={rejecting[activeRejectPaymentId]}
                className="w-full rounded-full border border-[#593c1e]/40 bg-[#f6f0e8] px-3 py-2 text-xs font-semibold text-[#593c1e] transition hover:bg-[#efe6da] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejecting[activeRejectPaymentId]
                  ? "Sending..."
                  : "Send Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
