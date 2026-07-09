import { useEffect, useMemo, useState } from "react";
import { Building2, LogOut, ShieldAlert, Store, Warehouse } from "lucide-react";
import Login from "./StorePortal/Login";
import StorePortal from "./StorePortal/StorePortalOrder";
import Commissary from "./StorePortal/Commissary";
import { apiUrl } from "./StorePortal/api";

const MENU_ITEMS = [
  {
    id: "store-portal",
    label: "Store Portal",
    group: "Other Module",
    icon: Store,
  },
  {
    id: "commissary",
    label: "Commissary",
    group: "Other Module",
    icon: Warehouse,
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
  commissary: [
    "commissary",
    "COMMISSARY",
    "commissary_access",
    "COMMISSARY_ACCESS",
    "commissaryAccess",
    "can_commissary",
    "CAN_COMMISSARY",
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
      modules.add("commissary");
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

    if (
      normalized.includes("COMMISSARY") ||
      normalized.includes("COMISSARY") ||
      normalized.includes("COMMISARY") ||
      normalized.includes("COMISARY") ||
      normalized.includes("COMMISARRY") ||
      ["CM", "COM", "COMM", "COMMI", "CMS", "CMSRY", "CMY"].includes(normalized)
    ) {
      modules.add("commissary");
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
    return ["store-portal", "commissary"];
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
  };

  const allowedMenuItems = useMemo(() => getAllowedMenuItems(authUser), [authUser]);
  const allowedMenuIds = useMemo(() => allowedMenuItems.map((item) => item.id), [allowedMenuItems]);
  const resolvedActiveMenu = allowedMenuIds.includes(activeMenu) ? activeMenu : allowedMenuItems[0]?.id || "";

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
            localStorage.removeItem("authUser");
            localStorage.removeItem("user");
            localStorage.removeItem("USER_CODE");
            localStorage.removeItem("activeMenu");

            setAuthUser(null);
            setActiveMenu("");
            setAccessRefreshing(false);
          }

          return;
        }

        const nextUser = user?.data || user;
        const nextActiveMenu = getFirstAllowedMenuId(nextUser, activeMenu);

        localStorage.setItem("authUser", JSON.stringify(nextUser));
        localStorage.setItem("user", JSON.stringify(nextUser));

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

  const handleMenuChange = (menuId) => {
    if (!allowedMenuIds.includes(menuId)) return;

    setActiveMenu(menuId);
    localStorage.setItem("activeMenu", menuId);
  };

  const handleLogout = async () => {
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
      localStorage.removeItem("authUser");
      localStorage.removeItem("user");
      localStorage.removeItem("USER_CODE");
      localStorage.removeItem("activeMenu");

      setAuthUser(null);
      setActiveMenu("store-portal");
      setAccessRefreshing(false);
    }
  };

  if (!authUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="fixed left-0 right-0 top-0 z-[1000] h-[54px] border-b border-blue-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-white">
        <div className="flex h-full min-w-0 items-center gap-2 px-2 sm:px-4">
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

      <aside className="fixed bottom-0 left-0 top-[54px] z-[900] w-16 border-r border-slate-200 bg-white shadow-sm md:w-64">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-2 py-3 md:px-4">
            <p className="hidden text-[10px] font-black uppercase tracking-wider text-slate-400 md:block">
              Module Group
            </p>
            <h2 className="hidden text-sm font-extrabold text-slate-800 md:block">Other Module</h2>
            <h2 className="text-center text-[10px] font-black uppercase text-slate-500 md:hidden">Other</h2>
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
                  className={`flex h-10 w-full items-center justify-center gap-3 rounded-lg border px-0 text-left text-sm font-bold transition md:justify-start md:px-3 ${
                    isActive
                      ? "border-blue-700 bg-blue-700 text-white shadow-sm shadow-blue-900/20"
                      : "border-transparent text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden truncate md:inline">{item.label}</span>
                </button>
              );
            })}

            {allowedMenuItems.length === 0 && (
              <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs font-semibold leading-5 text-slate-500 md:block">
                No modules assigned to this user.
              </div>
            )}
          </nav>
        </div>
      </aside>

      <main className="min-h-screen pl-16 md:pl-64">
        {resolvedActiveMenu === "commissary" && <Commissary user={authUser} />}
        {resolvedActiveMenu === "store-portal" && <StorePortal user={authUser} />}
        {!resolvedActiveMenu && <NoModuleAccess isLoading={accessRefreshing} onLogout={handleLogout} />}
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
            : "Your account is not assigned to Store Portal or Commissary."}
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
