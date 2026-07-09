import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, LogOut, Menu, ShieldAlert, Store, X } from "lucide-react";
import Login from "./StorePortal/Login";
import { apiUrl } from "./StorePortal/api";

const StorePortal = lazy(() => import("./StorePortal/StorePortalOrder"));

const MENU_ITEMS = [
  {
    id: "store-portal",
    label: "Store Portal",
    group: "Other Module",
    icon: Store,
  },
];

const MODULE_ACCESS_FIELDS = [
  "allowedModules",
  "modules",
  "MODULE_ACCESS",
  "assignedModule",
  "ASSIGNED_MODULE",
  "module",
  "modules",
  "module_access",
  "MODULE_ACCESS",
  "assigned_module",
  "ASSIGNED_MODULE",
  "access_rights",
  "ACCESS_RIGHTS",
  "user_access",
  "USER_ACCESS",
  "rights",
  "RIGHTS",
  "access",
  "ACCESS",
];

const MODULE_FLAG_FIELDS = {
  "store-portal": [
    "store_portal",
    "STORE_PORTAL",
    "storePortal",
    "store_portal_access",
    "STORE_PORTAL_ACCESS",
    "storePortalAccess",
    "store_access",
    "STORE_ACCESS",
    "can_store_portal",
    "CAN_STORE_PORTAL",
  ],
};

const normalizeModuleText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

const isTruthyAccessFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  return ["Y", "YES", "TRUE", "T", "1", "ALLOW", "ALLOWED", "ENABLE", "ENABLED", "ACTIVE", "A"].includes(
    normalizeModuleText(value),
  );
};

const modulesFromText = (value) => {
  const modules = new Set();
  const parts = String(value || "").split(/[,;|/]+/);

  parts.forEach((part) => {
    const normalized = normalizeModuleText(part);
    if (!normalized) return;

    if (["ALL", "BOTH", "ADMIN", "FULLACCESS"].includes(normalized)) {
      modules.add("store-portal");
      return;
    }

    if (
      normalized === "STORE" ||
      normalized.includes("STOREPORTAL") ||
      normalized.includes("STOREORDER") ||
      normalized.includes("STOREFORECAST")
    ) {
      modules.add("store-portal");
    }

  });

  return Array.from(modules);
};

const modulesFromValue = (value) => {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => modulesFromValue(item));
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [
      ...(isTruthyAccessFlag(item) ? modulesFromText(key) : []),
      ...modulesFromValue(item),
    ]);
  }

  return modulesFromText(value);
};

const modulesFromAnyObjectValues = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];

  seen.add(value);

  return Object.entries(value).flatMap(([key, item]) => [
    ...modulesFromText(key),
    ...modulesFromValue(item),
    ...modulesFromAnyObjectValues(item, seen),
  ]);
};

const modulesFromPrivilegedRole = (user) => {
  const userType = normalizeModuleText(user?.userType || user?.user_type || user?.USER_TYPE);
  const role = normalizeModuleText(user?.role || user?.ROLE);

  if (["S", "X", "ADMIN", "SUPERADMIN"].includes(userType) || ["ADMIN", "APPROVER", "SUPERADMIN"].includes(role)) {
    return ["store-portal"];
  }

  return [];
};

const getAllowedModuleIds = (user) => {
  const modules = new Set();

  MODULE_ACCESS_FIELDS.forEach((field) => {
    modulesFromValue(user?.[field]).forEach((moduleId) => modules.add(moduleId));
  });

  modulesFromValue(user?.moduleAccess?.modules).forEach((moduleId) => modules.add(moduleId));
  modulesFromValue(user?.moduleAccess?.primaryModule).forEach((moduleId) => modules.add(moduleId));
  modulesFromValue(user?.moduleAccess?.labels).forEach((moduleId) => modules.add(moduleId));

  Object.entries(MODULE_FLAG_FIELDS).forEach(([moduleId, fields]) => {
    if (fields.some((field) => isTruthyAccessFlag(user?.[field]))) {
      modules.add(moduleId);
    }
  });

  modulesFromAnyObjectValues(user).forEach((moduleId) => modules.add(moduleId));
  modulesFromPrivilegedRole(user).forEach((moduleId) => modules.add(moduleId));

  return Array.from(modules);
};

const getAllowedMenuItems = (user) => {
  const allowedModules = getAllowedModuleIds(user);

  return MENU_ITEMS.filter((item) => allowedModules.includes(item.id));
};

const getStoredMenu = () => localStorage.getItem("activeMenu") || "";

const getFirstAllowedMenuId = (user, preferredMenu = getStoredMenu()) => {
  const allowedItems = getAllowedMenuItems(user);

  if (allowedItems.some((item) => item.id === preferredMenu)) {
    return preferredMenu;
  }

  return allowedItems[0]?.id || "";
};

const getUserCode = (user) =>
  user?.userCode ||
  user?.user_code ||
  user?.USER_CODE ||
  user?.userId ||
  user?.user_id ||
  user?.USER_ID ||
  "";

const clearStoredAuth = () => {
  localStorage.removeItem("authUser");
  localStorage.removeItem("user");
  localStorage.removeItem("USER_CODE");
  localStorage.removeItem("activeMenu");
};

const PageFallback = ({ label = "Loading module..." }) => (
  <div className="flex min-h-screen items-center justify-center px-4 pt-[54px]">
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <span className="h-5 w-5 rounded-full border-2 border-blue-200 border-t-blue-700 motion-safe:animate-spin" />
      <span>{label}</span>
    </div>
  </div>
);

const pageVariants = {
  initial: (direction) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.24,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: (direction) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

// How long the desktop rail stays expanded after the pointer/focus leaves it.
const SIDEBAR_COLLAPSE_DELAY_MS = 350;

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("authUser"));
    } catch {
      return null;
    }
  });
  const [activeMenu, setActiveMenu] = useState(() => {
    const savedMenu = getStoredMenu();
    return MENU_ITEMS.some((item) => item.id === savedMenu) ? savedMenu : "";
  });
  const [accessRefreshing, setAccessRefreshing] = useState(() => Boolean(localStorage.getItem("authUser")));
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  // Desktop-only: the rail sits collapsed (icon-only) by default and expands
  // as a floating overlay while the user is actually hovering/focusing it.
  const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false);
  const [navDirection, setNavDirection] = useState(1);
  const menuHistoryRef = useRef([]);
  const sidebarCollapseTimeoutRef = useRef(null);

  const clearSidebarCollapseTimeout = useCallback(() => {
    if (sidebarCollapseTimeoutRef.current) {
      clearTimeout(sidebarCollapseTimeoutRef.current);
      sidebarCollapseTimeoutRef.current = null;
    }
  }, []);

  const expandDesktopSidebar = useCallback(() => {
    clearSidebarCollapseTimeout();
    setIsDesktopSidebarExpanded(true);
  }, [clearSidebarCollapseTimeout]);

  const scheduleDesktopSidebarCollapse = useCallback(() => {
    clearSidebarCollapseTimeout();
    sidebarCollapseTimeoutRef.current = setTimeout(() => {
      setIsDesktopSidebarExpanded(false);
    }, SIDEBAR_COLLAPSE_DELAY_MS);
  }, [clearSidebarCollapseTimeout]);

  useEffect(() => clearSidebarCollapseTimeout, [clearSidebarCollapseTimeout]);

  const handleLoginSuccess = (user) => {
    const firstAllowedMenu = getFirstAllowedMenuId(user);

    localStorage.setItem("authUser", JSON.stringify(user));
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem(
      "USER_CODE",
      user?.userCode || user?.user_code || user?.USER_CODE || ""
    );

    if (firstAllowedMenu) {
      localStorage.setItem("activeMenu", firstAllowedMenu);
    } else {
      localStorage.removeItem("activeMenu");
    }

    setAuthUser(user);
    setActiveMenu(firstAllowedMenu);
    setAccessRefreshing(false);
    setIsSidebarVisible(false);
    menuHistoryRef.current = firstAllowedMenu ? [firstAllowedMenu] : [];
  };

  const allowedMenuItems = useMemo(() => getAllowedMenuItems(authUser), [authUser]);
  const allowedMenuIds = useMemo(() => allowedMenuItems.map((item) => item.id), [allowedMenuItems]);
  const resolvedActiveMenu = allowedMenuIds.includes(activeMenu) ? activeMenu : allowedMenuItems[0]?.id || "";

  useEffect(() => {
    if (authUser) return;
    setIsSidebarVisible(false);
    setIsDesktopSidebarExpanded(false);
    clearSidebarCollapseTimeout();
    menuHistoryRef.current = [];
  }, [authUser, clearSidebarCollapseTimeout]);

  useEffect(() => {
    document.body.style.overflow = isSidebarVisible ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarVisible]);

  useEffect(() => {
    if (!resolvedActiveMenu) return;

    const history = menuHistoryRef.current;
    const currentIndex = history.indexOf(resolvedActiveMenu);
    const lastMenu = history[history.length - 1];

    if (resolvedActiveMenu === lastMenu) return;

    if (currentIndex !== -1) {
      setNavDirection(-1);
      menuHistoryRef.current = history.slice(0, currentIndex + 1);
      return;
    }

    setNavDirection(1);
    menuHistoryRef.current = [...history, resolvedActiveMenu];
  }, [resolvedActiveMenu]);

  useEffect(() => {
    if (!authUser || resolvedActiveMenu === activeMenu) return;

    setActiveMenu(resolvedActiveMenu);

    if (resolvedActiveMenu) {
      localStorage.setItem("activeMenu", resolvedActiveMenu);
    } else {
      localStorage.removeItem("activeMenu");
    }
  }, [activeMenu, authUser, resolvedActiveMenu]);

  useEffect(() => {
    if (!authUser) return;

    let isMounted = true;
    setAccessRefreshing(true);

    const refreshCurrentUser = async () => {
      try {
        const response = await fetch(apiUrl("/me"), {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const user = await response.json().catch(() => ({}));

        if (!isMounted) return;

        if (!response.ok) {
          if (response.status === 401) {
            clearStoredAuth();

            setAuthUser(null);
            setActiveMenu("");
            setIsSidebarVisible(false);
            setAccessRefreshing(false);
          }

          return;
        }

        const nextUser = user?.data || user;
        const nextActiveMenu = getFirstAllowedMenuId(nextUser, activeMenu);

        localStorage.setItem("authUser", JSON.stringify(nextUser));
        localStorage.setItem("user", JSON.stringify(nextUser));
        localStorage.setItem("USER_CODE", getUserCode(nextUser));

        if (nextActiveMenu) {
          localStorage.setItem("activeMenu", nextActiveMenu);
        } else {
          localStorage.removeItem("activeMenu");
        }

        setAuthUser(nextUser);
        setActiveMenu(nextActiveMenu);
      } catch (error) {
        console.warn("User access refresh failed:", error);
      } finally {
        if (isMounted) {
          setAccessRefreshing(false);
        }
      }
    };

    refreshCurrentUser();

    return () => {
      isMounted = false;
    };
    // Refresh once after restoring the cached user so stale localStorage gets the latest module access.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMenuChange = useCallback((menuId) => {
    if (!allowedMenuIds.includes(menuId)) return;

    setActiveMenu(menuId);
    setIsSidebarVisible(false);
    setIsDesktopSidebarExpanded(false);
    clearSidebarCollapseTimeout();
    localStorage.setItem("activeMenu", menuId);
  }, [allowedMenuIds, clearSidebarCollapseTimeout]);

  const handleLogout = useCallback(async () => {
    setIsSidebarVisible(false);

    try {
      await fetch(apiUrl("/logout"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.warn("Logout API failed:", error);
    } finally {
      clearStoredAuth();

      setAuthUser(null);
      setActiveMenu("");
      setAccessRefreshing(false);
      menuHistoryRef.current = [];
    }
  }, []);

  if (!authUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="fixed left-0 right-0 top-0 z-[1000] h-[54px] border-b border-blue-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-white">
        <div className="flex h-full min-w-0 items-center gap-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={() => setIsSidebarVisible((value) => !value)}
            aria-expanded={isSidebarVisible}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 md:hidden"
            title={isSidebarVisible ? "Close menu" : "Open menu"}
          >
            {isSidebarVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="flex min-w-0 shrink-0 items-center gap-2 pr-1 sm:pr-3">
            <img
              src="/naysa_logo.png"
              alt="NAYSA"
              className="h-8 w-auto shrink-0"
            />
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-xs font-black uppercase text-blue-900 dark:text-blue-100">
                NAYSA Financial
              </div>
              <div className="truncate text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                Store Operations
              </div>
            </div>
          </div>

          <div className="ml-auto hidden min-w-0 items-center gap-2 md:flex">
            <div className="flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Building2 className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
              <span className="truncate">{getUserCode(authUser) || "User"}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-red-900 dark:hover:bg-red-950 dark:hover:text-red-200"
            title="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {isSidebarVisible && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed bottom-0 left-0 right-0 top-[54px] z-[850] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarVisible(false)}
        />
      )}

      <aside
        onMouseEnter={expandDesktopSidebar}
        onMouseLeave={scheduleDesktopSidebarCollapse}
        onFocus={expandDesktopSidebar}
        onBlur={scheduleDesktopSidebarCollapse}
        className={`fixed bottom-0 left-0 top-[54px] z-[900] border-r border-slate-200 bg-white transition-[width,box-shadow] duration-200 dark:border-slate-800 dark:bg-slate-950 ${
          isSidebarVisible ? "w-64 shadow-sm" : "w-16 shadow-sm"
        } md:w-16 ${isDesktopSidebarExpanded ? "md:w-64 md:shadow-xl" : "md:shadow-none"}`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-2 py-3 md:px-4">
            <p
              className={`${isSidebarVisible ? "block" : "hidden"} text-[10px] font-black uppercase tracking-wider text-slate-400 ${
                isDesktopSidebarExpanded ? "md:block" : "md:hidden"
              }`}
            >
              Module Group
            </p>
            <h2
              className={`${isSidebarVisible ? "block" : "hidden"} text-sm font-extrabold text-slate-800 dark:text-slate-100 ${
                isDesktopSidebarExpanded ? "md:block" : "md:hidden"
              }`}
            >
              Other Module
            </h2>
            <h2
              className={`${isSidebarVisible ? "hidden" : "block"} text-center text-[10px] font-black uppercase text-slate-500 ${
                isDesktopSidebarExpanded ? "md:hidden" : "md:block"
              }`}
            >
              Other
            </h2>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 md:px-3">
            {allowedMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = resolvedActiveMenu === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMenuChange(item.id)}
                  title={item.label}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg border text-left text-sm font-bold transition ${
                    isSidebarVisible ? "justify-start px-3" : "justify-center px-0"
                  } md:justify-center md:px-0 ${
                    isDesktopSidebarExpanded ? "md:justify-start md:px-3" : ""
                  } ${
                    isActive
                      ? "border-blue-700 bg-blue-700 text-white shadow-sm shadow-blue-900/20"
                      : "border-transparent text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span
                    className={`${isSidebarVisible ? "inline" : "hidden"} truncate ${
                      isDesktopSidebarExpanded ? "md:inline" : "md:hidden"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}

            {allowedMenuItems.length === 0 && (
              <div
                className={`${isSidebarVisible ? "block" : "hidden"} rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs font-semibold leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 ${
                  isDesktopSidebarExpanded ? "md:block" : "md:hidden"
                }`}
              >
                No modules assigned to this user.
              </div>
            )}
          </nav>
        </div>
      </aside>

      <main className="min-h-screen overflow-hidden pl-16">
        <AnimatePresence mode="wait" initial={false} custom={navDirection}>
          <motion.div
            key={resolvedActiveMenu || "no-module-access"}
            custom={navDirection}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen"
          >
            <Suspense fallback={<PageFallback />}>
              {resolvedActiveMenu === "store-portal" && <StorePortal user={authUser} />}
              {!resolvedActiveMenu && <NoModuleAccess isLoading={accessRefreshing} onLogout={handleLogout} />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NoModuleAccess({ isLoading, onLogout }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-[54px]">
      <div className="w-full max-w-md rounded-lg border border-amber-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-extrabold text-slate-900">
          {isLoading ? "Checking module access" : "No module access"}
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
          {isLoading
            ? "Please wait while the system refreshes your assigned modules."
            : "Your account is not assigned to Store Portal."}
        </p>
        {!isLoading && (
          <button
            type="button"
            onClick={onLogout}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-extrabold text-white transition hover:bg-blue-800"
          >
            Log Out
          </button>
        )}
      </div>
    </div>
  );
}