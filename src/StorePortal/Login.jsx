import { useState } from "react";
import { apiUrl } from "./api";

export default function Login({ onLoginSuccess }) {
  const [form, setForm] = useState({
    userId: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setNotice("");

    const userId = String(form.userId || "").trim().toUpperCase();
    const password = String(form.password || "");

    if (!userId || !password) {
      setError("Please enter your User ID and Password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl("/authorized-login"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          user_code: userId,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || "Invalid user ID or password.");
      }

      const user = result?.data || result;

      localStorage.setItem("authUser", JSON.stringify(user));
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("USER_CODE", user?.userCode || user?.user_code || userId);

      onLoginSuccess?.(user);
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 pt-6 pb-20 text-slate-900 sm:px-6 lg:px-8"
      style={{
        backgroundImage: "url('/NAYSABG.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-slate-950/35" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/55 via-sky-950/25 to-blue-900/20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_18%,rgba(56,189,248,.25),transparent_28%),radial-gradient(circle_at_75%_30%,rgba(147,197,253,.16),transparent_26%)]" />

      {/* Ambient floating accents — signature touch, kept subtle */}
      <div className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl animate-[pulse_7s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -right-10 bottom-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl animate-[pulse_9s_ease-in-out_infinite]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-7xl items-center justify-center">
        <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <section className="hidden lg:block animate-[fadeSlideIn_.6s_ease-out]">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/50 bg-white/16 px-6 py-2.5 text-xs font-extrabold uppercase tracking-[0.28em] text-white shadow-xl backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
              </span>
              NAYSA-SOLUTIONS INCORPORATED
            </div>

            <h1 className="whitespace-nowrap text-4xl font-black uppercase leading-none tracking-[0.06em] text-white drop-shadow-[0_5px_18px_rgba(0,0,0,.45)] xl:text-5xl 2xl:text-6xl">
              WE MAKE LIFE EASIER
            </h1>

            <p className="mt-5 max-w-2xl text-2xl font-bold uppercase tracking-[0.18em] text-sky-100 drop-shadow-[0_3px_12px_rgba(0,0,0,.45)]">
              THROUGH BUSINESS APPLICATIONS
            </p>

            <div className="my-7 h-1 w-28 rounded-full bg-sky-400 shadow-[0_0_22px_rgba(56,189,248,.8)]" />
          </section>

          <section className="flex items-center justify-center">
            <div className="relative w-full max-w-md animate-[fadeSlideUp_.55s_ease-out]">
              <div className="mb-4 flex flex-col items-center text-center">
                <img
                  src="/naysa_logo.png"
                  alt="NAYSA Logo"
                  className="mb-1 w-36 drop-shadow-[0_6px_18px_rgba(0,0,0,.35)] md:w-40"
                />

                {/* Mobile-only brand line, since the hero copy is hidden below lg */}
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-sky-100 backdrop-blur-md lg:hidden">
                  <i className="fas fa-bolt text-sky-300" />
                  We Make Life Easier
                </div>

                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_15px_rgba(0,0,0,.5)] md:text-3xl">
                  Store Ordering Portal
                </h1>

                <p className="mt-2 text-sm font-medium text-white/85">
                  Sign in using your User ID and Password.
                </p>
              </div>

              <div
                className="relative w-full overflow-hidden rounded-3xl p-7"
                style={{
                  background: "rgba(255,255,255,0.90)",
                  border: "1px solid rgba(255,255,255,0.68)",
                  backdropFilter: "blur(18px)",
                  WebkitBackdropFilter: "blur(18px)",
                  boxShadow:
                    "0 24px 70px rgba(2,6,23,.32), inset 0 1px 0 rgba(255,255,255,.9)",
                }}
              >
                {/* Signature top accent bar, echoes the design system's gradient */}
                <div
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{
                    background: "linear-gradient(90deg,#1a3a5c,#2a5298,#38bdf8)",
                  }}
                />

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <LoginInput
                    label="User ID"
                    icon="fa-user"
                    value={form.userId}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        userId: value.toUpperCase(),
                      }))
                    }
                    placeholder="Enter your user ID"
                    autoComplete="username"
                  />

                  <LoginInput
                    label="Password"
                    icon="fa-lock"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        password: value,
                      }))
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    right={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="flex items-center gap-1 text-xs font-bold text-sky-700 transition hover:text-blue-700"
                      >
                        <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    }
                  />

                  {notice && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 animate-[fadeSlideUp_.25s_ease-out]">
                      <i className="fas fa-circle-check mt-0.5 text-emerald-500" />
                      <span>{notice}</span>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 animate-[fadeSlideUp_.25s_ease-out]">
                      <i className="fas fa-triangle-exclamation mt-0.5 text-amber-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 overflow-hidden rounded-lg px-3 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    style={{
                      background:
                        "linear-gradient(135deg,#0369a1 0%,#1d4ed8 100%)",
                    }}
                  >
                    {/* Subtle shimmer sweep on hover */}
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                    {loading ? (
                      <>
                        <i className="fas fa-circle-notch animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        Sign In <i className="fas fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 w-full">
        <div className="w-full border-t border-white/20 bg-slate-950/75 px-4 py-3 shadow-lg backdrop-blur-md">
          <p className="text-center text-xs font-semibold tracking-wide text-white sm:text-sm">
            © 2026 NAYSA-SOLUTIONS, INC. All rights reserved.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function LoginInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  right,
  icon,
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
          {label}
        </span>
        {right}
      </div>

      <div className="relative">
        {icon && (
          <i
            className={`fas ${icon} pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400`}
          />
        )}
        <input
          type={type}
          value={value || ""}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-white py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 ${
            icon ? "pl-10 pr-4" : "px-4"
          }`}
        />
      </div>
    </label>
  );
}