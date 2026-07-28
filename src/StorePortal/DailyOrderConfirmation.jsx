import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { fetchData, postRequest } from "./api";

const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const tomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

const shortDate = (iso) => {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getRowValue = (row, keys, fallback = "") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value).trim();
    }
  }

  return fallback;
};

const getCurrentUserCode = (currentUserRow, user) =>
  getRowValue(
    currentUserRow,
    [
      "userCode",
      "USER_CODE",
      "user_code",
      "UserCode",
      "USERCODE",
      "usercode",
      "USERID",
      "userid",
      "userId",
      "UserID",
      "USER_ID",
      "user_id",
      "LOGIN_ID",
      "loginId",
      "ACTCODE",
      "actCode",
      "USERNAME",
      "username",
    ],
    getRowValue(
      user,
      [
        "USER_CODE",
        "userCode",
        "user_code",
        "UserCode",
        "USERCODE",
        "usercode",
        "USERID",
        "userid",
        "userId",
        "UserID",
        "USER_ID",
        "user_id",
        "LOGIN_ID",
        "loginId",
        "ACTCODE",
        "actCode",
        "USERNAME",
        "username",
        "name",
      ],
      "",
    ),
  );

const getCurrentUserName = (currentUserRow, user) =>
  getRowValue(
    currentUserRow,
    [
      "userName",
      "USER_NAME",
      "user_name",
      "UserName",
      "name",
      "fullName",
      "FULL_NAME",
    ],
    getRowValue(user, ["USER_NAME", "name", "fullName"], ""),
  );

const getCurrentUserBranchCode = (currentUserRow) =>
  getRowValue(currentUserRow, [
    "branchCode",
    "BRANCH_CODE",
    "branch_code",
    "BranchCode",
    "branch",
    "BRANCH",
  ]);

const getCurrentUserBranchName = (currentUserRow) =>
  getRowValue(currentUserRow, [
    "branchName",
    "BRANCH_NAME",
    "branch_name",
    "BranchName",
    "branchDesc",
    "BRANCH_DESC",
  ]);

const unwrapDataArray = (response) => {
  const raw =
    response?.data ??
    response?.Data ??
    response?.result ??
    response?.RESULT ??
    [];

  if (Array.isArray(raw)) {
    const firstResult = raw?.[0]?.result ?? raw?.[0]?.RESULT;
    if (typeof firstResult === "string") {
      try {
        const parsed = JSON.parse(firstResult);
        return Array.isArray(parsed) ? parsed : raw;
      } catch {
        return raw;
      }
    }

    return raw;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const normalizeDate = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const dateOnly = value.split("T")[0]?.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  }

  return formatDate(value);
};

const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  ["1", "true", "y", "yes"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );

const getCategoryLabel = (item = {}) => {
  const categoryName = getRowValue(item, [
    "categDesc",
    "CATEG_DESC",
    "categ_desc",
    "categName",
    "CATEG_NAME",
    "categoryName",
    "CATEGORY_NAME",
    "categoryDesc",
    "CATEGORY_DESC",
  ]);
  const categoryCode = String(item?.categCode ?? "").trim();
  return categoryName || categoryCode || "Uncategorized";
};

const getApiErrorMessage = (
  error,
  fallback = "Unable to complete request.",
) => {
  const data = error?.response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  const errors = data?.errors;

  if (errors?.errorMessage) {
    return String(errors.errorMessage);
  }

  if (typeof errors === "string" && errors.trim()) {
    return errors;
  }

  if (Array.isArray(errors)) {
    const first = errors.flat().find(Boolean);
    if (first) return String(first);
  }

  if (errors && typeof errors === "object") {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }

  return error?.message || fallback;
};

const normalizeForecastRow = (row = {}) => ({
  ...row,
  forecastId: getRowValue(row, [
    "forecastId",
    "FORECAST_ID",
    "forecast_id",
    "ORDER_ID",
    "orderId",
  ]),
  detailId: getRowValue(row, [
    "detailId",
    "DETAIL_ID",
    "detail_id",
    "DT1_ID",
    "dt1Id",
  ]),
  weeklyForecastNo: getRowValue(
    row,
    ["weeklyForecastNo", "WEEKLY_FORECAST_NO", "ORDER_NO", "orderNo"],
    "",
  ),
  itemCode: getRowValue(row, [
    "itemCode",
    "ITEM_CODE",
    "item_code",
    "ItemCode",
    "ITEM_NO",
    "itemNo",
  ]),
  itemName: getRowValue(row, [
    "itemName",
    "ITEM_NAME",
    "item_name",
    "ItemName",
    "ITEM_DESC",
    "itemDesc",
  ]),
  categCode: getRowValue(
    row,
    [
      "categCode",
      "CATEG_CODE",
      "categ_code",
      "CategCode",
      "CATEGORY_CODE",
      "categoryCode",
    ],
    "",
  ),
  categDesc: getRowValue(
    row,
    [
      "categDesc",
      "CATEG_DESC",
      "categ_desc",
      "categName",
      "CATEG_NAME",
      "categoryName",
      "CATEGORY_NAME",
      "categoryDesc",
      "CATEGORY_DESC",
    ],
    "",
  ),
  uomCode: getRowValue(row, [
    "uomCode",
    "UOM_CODE",
    "uom_code",
    "UomCode",
    "UOM",
    "uom",
  ]),
  deliveryDate: normalizeDate(
    row.deliveryDate ??
      row.DELIVERY_DATE ??
      row.delivery_date ??
      row.DeliveryDate ??
      row.ORDER_DATE ??
      row.orderDate,
  ),
  orderQty: toNumber(
    row.orderQty ??
      row.ORDER_QTY ??
      row.order_qty ??
      row.OrderQty ??
      row.QTY ??
      row.qty,
  ),
  confirmed: toBoolean(
    row.confirmed ?? row.CONFIRMED ?? row.isConfirmed ?? row.IS_CONFIRMED,
  ),
  confirmedBy: getRowValue(
    row,
    ["confirmedBy", "CONFIRMED_BY", "confirmed_by"],
    "",
  ),
  confirmedDate: normalizeDate(
    row.confirmedDate ?? row.CONFIRMED_DATE ?? row.confirmed_date,
  ),
  revisionDate: normalizeDate(
    row.revisionDate ??
      row.REVISION_DATE ??
      row.revision_date ??
      row.DATE_STAMP ??
      row.dateStamp,
  ),
  revisionTime: getRowValue(
    row,
    [
      "revisionTime",
      "REVISION_TIME",
      "revision_time",
      "TIME_STAMP",
      "timeStamp",
    ],
    "",
  ),
  revisionUser: getRowValue(
    row,
    ["revisionUser", "REVISION_USER", "revision_user", "USER_CODE", "userCode"],
    "",
  ),
});

const normalizeConfirmationRow = (row = {}, fallbackDate = "") => {
  const normalized = normalizeForecastRow(row);

  return {
    ...normalized,
    deliveryDate: normalized.deliveryDate || fallbackDate,
    forecastQty: toNumber(
      row.forecastQty ??
        row.FORECAST_QTY ??
        row.forecast_qty ??
        normalized.orderQty,
    ),
  };
};

const normalizeStoreContextRow = (row = {}) => ({
  storeCode: getRowValue(
    row,
    ["storeCode", "STORE_CODE", "branchCode", "BRANCH_CODE"],
    "",
  ),
  storeName: getRowValue(
    row,
    [
      "storeName",
      "STORE_NAME",
      "store_name",
      "branchName",
      "BRANCH_NAME",
      "branchDesc",
      "BRANCH_DESC",
    ],
    "",
  ),
  storeType: getRowValue(
    row,
    ["storeType", "STORE_TYPE", "branchStoreType", "BRANCH_STORE_TYPE"],
    "",
  ),
});

const StatusPill = ({ children, variant = "default", className = "" }) => {
  const variantClass =
    variant === "success"
      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800"
      : variant === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800"
        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800";

  return (
    <span
      className={`inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:whitespace-nowrap ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
};

const FloatingField = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  readOnly = false,
  disabled = false,
  children,
}) => {
  if (type === "select") {
    return (
      <div className="relative min-w-0 p-1 sm:p-2">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled || readOnly}
          className="peer global-tran-textbox-ui"
        >
          {children}
        </select>
        <label htmlFor={id} className="global-tran-floating-label px-1 !left-3">
          {label}
        </label>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 p-1 sm:p-2">
      <input
        id={id}
        type={type}
        placeholder=" "
        value={value || ""}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className={`peer global-tran-textbox-ui ${readOnly || disabled ? "cursor-default bg-gray-50 dark:bg-gray-700" : ""}`}
      />
      <label htmlFor={id} className="global-tran-floating-label px-1 !left-3">
        {label}
      </label>
    </div>
  );
};

const ActionButton = ({
  children,
  icon: Icon,
  onClick,
  disabled = false,
  variant = "primary",
}) => {
  const colorClass =
    variant === "success"
      ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
      : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors sm:w-auto sm:px-4 sm:text-sm ${
        disabled
          ? "cursor-not-allowed bg-gray-400 hover:bg-gray-400 dark:bg-gray-700"
          : colorClass
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
};

const focusNextQuantityInput = (event) => {
  if (event.key !== "Enter") return;

  event.preventDefault();

  const currentInput = event.currentTarget;
  const currentGroup = currentInput.dataset.qtyGroup;
  const currentCol = currentInput.dataset.qtyCol;
  const currentRow = Number(currentInput.dataset.qtyRow);

  const quantityInputs = Array.from(
    document.querySelectorAll('[data-store-portal-qty="true"]'),
  ).filter(
    (input) =>
      !input.disabled &&
      !input.readOnly &&
      (input.offsetWidth > 0 ||
        input.offsetHeight > 0 ||
        input.getClientRects().length > 0),
  );

  let nextInput;

  if (currentGroup && currentCol !== undefined && Number.isFinite(currentRow)) {
    nextInput = quantityInputs
      .filter(
        (input) =>
          input.dataset.qtyGroup === currentGroup &&
          input.dataset.qtyCol === currentCol &&
          Number(input.dataset.qtyRow) > currentRow,
      )
      .sort((a, b) => Number(a.dataset.qtyRow) - Number(b.dataset.qtyRow))[0];
  } else {
    const currentIndex = quantityInputs.indexOf(currentInput);
    nextInput = quantityInputs[currentIndex + 1];
  }

  if (nextInput) {
    nextInput.focus();
    nextInput.select?.();
  }
};

const formatQuantityWithSeparator = (value) => {
  if (value === null || value === undefined || value === "") return "";

  const stringValue = String(value).replace(/,/g, "");
  if (!/^\d*(\.\d*)?$/.test(stringValue)) return stringValue;

  const [wholePart = "", decimalPart] = stringValue.split(".");
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, "") || "0";
  const formattedWhole = normalizedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimalPart !== undefined
    ? `${formattedWhole}.${decimalPart}`
    : formattedWhole;
};

const QuantityInput = ({
  value,
  onChange,
  tone = "blue",
  navGroup,
  navRow,
  navCol,
  disabled = false,
  max,
  compact = false,
}) => {
  const displayValue = formatQuantityWithSeparator(value ?? 0);

  const valueClass =
    Number(value || 0) > 0
      ? tone === "green"
        ? "font-semibold text-green-700 dark:text-green-200"
        : "font-semibold text-slate-900 dark:text-white"
      : "text-slate-900 dark:text-white";

  const handleChange = (event) => {
    let sanitizedValue = event.target.value.replace(/[^0-9.]/g, "");

    const parts = sanitizedValue.split(".");
    if (parts.length > 2) {
      sanitizedValue = `${parts[0]}.${parts.slice(1).join("")}`;
    }

    if (/^\d*(\.\d{0,4})?$/.test(sanitizedValue)) {
      onChange(sanitizedValue);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      max={max ?? undefined}
      data-store-portal-qty="true"
      data-qty-group={navGroup}
      data-qty-row={navRow}
      data-qty-col={navCol}
      value={displayValue}
      disabled={disabled}
      onChange={handleChange}
      onKeyDown={focusNextQuantityInput}
      className={`${compact ? "h-6 px-0.5 text-[11px]" : "h-7 px-1 text-xs"} w-full border-0 bg-transparent text-right outline-none transition focus:outline-none focus:ring-0 ${disabled ? "cursor-not-allowed opacity-70" : ""} ${valueClass}`}
    />
  );
};

const DateInput = ({ value, onChange, disabled = false, compact = false }) => (
  <input
    type="date"
    value={value || ""}
    disabled={disabled}
    onChange={(event) => onChange(event.target.value)}
    className={`${compact ? "h-6 px-0.5 text-[11px]" : "h-7 px-1 text-xs"} w-full border-0 bg-transparent text-left text-slate-900 outline-none transition focus:outline-none focus:ring-0 dark:text-white ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
  />
);

const Toast = ({ toast }) => {
  if (!toast) return null;

  const toneClass =
    toast.type === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100"
      : "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-100";

  return (
    <div
      className={`fixed left-3 right-3 top-16 z-[9999] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl sm:left-auto sm:right-4 sm:max-w-sm ${toneClass}`}
    >
      {toast.message}
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xl dark:border-slate-700 dark:bg-gray-900 dark:text-slate-100">
      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
      Loading...
    </div>
  </div>
);

const TableHeaderFilter = ({
  value,
  onChange,
  placeholder = "Filter...",
  ariaLabel,
  compact = false,
}) => (
  <input
    type="search"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    onClick={(event) => event.stopPropagation()}
    placeholder={placeholder}
    aria-label={ariaLabel || placeholder}
    className={`${compact ? "mt-0.5 h-6 px-1.5 text-[10px]" : "mt-1 h-7 px-2 text-[11px]"} w-full rounded border border-blue-200 bg-white font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-900 dark:text-slate-100 dark:placeholder:text-slate-500`}
  />
);

const containsFilterText = (value, filter) =>
  String(value ?? "")
    .toLowerCase()
    .includes(
      String(filter ?? "")
        .trim()
        .toLowerCase(),
    );

export default function DailyOrderConfirmation({ user: authUser }) {
  const currentUserRow = useMemo(() => {
    const source = authUser?.user ?? authUser?.data ?? authUser;
    return Array.isArray(source) ? source[0] || {} : source || {};
  }, [authUser]);
  const user = authUser;

  const userCode = useMemo(
    () => getCurrentUserCode(currentUserRow, user),
    [currentUserRow, user],
  );
  const userName = useMemo(
    () => getCurrentUserName(currentUserRow, user),
    [currentUserRow, user],
  );
  const branchCode = useMemo(
    () => getCurrentUserBranchCode(currentUserRow),
    [currentUserRow],
  );
  const branchName = useMemo(
    () => getCurrentUserBranchName(currentUserRow),
    [currentUserRow],
  );
  const storeCode = branchCode;

  const [storeType, setStoreType] = useState("");
  const [storeName, setStoreName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(tomorrowDate());
  const [confirmationCategoryFilter, setConfirmationCategoryFilter] =
    useState("");
  const [confirmationColumnFilters, setConfirmationColumnFilters] = useState({
    itemCode: "",
    itemName: "",
    category: "",
    uom: "",
    deliveryDate: "",
  });
  const [collapsedConfirmationCategories, setCollapsedConfirmationCategories] =
    useState([]);
  const [confirmationRows, setConfirmationRows] = useState([]);
  const [loadedConfirmationRows, setLoadedConfirmationRows] = useState([]);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const confirmationRequestIdRef = useRef(0);

  const hasTaggedBranch = Boolean(storeCode);
  const isBusy = confirmLoading || confirmSubmitting;
  const userDisplay =
    userName && userName !== userCode ? `${userCode} - ${userName}` : userCode;
  const resolvedStoreName = storeName || branchName;
  const branchDisplay = resolvedStoreName || branchCode;

  const confirmationCategoryOptions = useMemo(() => {
    const categories = new Set();

    confirmationRows.forEach((row) => {
      categories.add(getCategoryLabel(row));
    });

    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [confirmationRows]);

  const filteredConfirmationRows = useMemo(() => {
    const rows = confirmationRows.map((row, index) => ({
      ...row,
      __originalIndex: index,
    }));
    const categoryRows = confirmationCategoryFilter
      ? rows.filter(
          (row) => getCategoryLabel(row) === confirmationCategoryFilter,
        )
      : rows;
    const filteredRows = categoryRows.filter(
      (row) =>
        containsFilterText(row.itemCode, confirmationColumnFilters.itemCode) &&
        containsFilterText(row.itemName, confirmationColumnFilters.itemName) &&
        containsFilterText(
          `${getCategoryLabel(row)} ${row.categCode || ""}`,
          confirmationColumnFilters.category,
        ) &&
        containsFilterText(row.uomCode, confirmationColumnFilters.uom) &&
        containsFilterText(
          row.deliveryDate,
          confirmationColumnFilters.deliveryDate,
        ),
    );

    return [...filteredRows].sort((a, b) => {
      const categoryCompare = getCategoryLabel(a).localeCompare(
        getCategoryLabel(b),
      );
      if (categoryCompare !== 0) return categoryCompare;

      return String(a.itemName || a.itemCode || "").localeCompare(
        String(b.itemName || b.itemCode || ""),
      );
    });
  }, [confirmationRows, confirmationCategoryFilter, confirmationColumnFilters]);

  const groupedConfirmationRows = useMemo(() => {
    const groups = new Map();

    filteredConfirmationRows.forEach((row, index) => {
      const category = getCategoryLabel(row);

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push({ ...row, __displayIndex: index });
    });

    return Array.from(groups, ([category, rows]) => ({ category, rows }));
  }, [filteredConfirmationRows]);

  const collapsedConfirmationCategorySet = useMemo(
    () => new Set(collapsedConfirmationCategories),
    [collapsedConfirmationCategories],
  );

  const isConfirmationCategoryCollapsed = useCallback(
    (category) => collapsedConfirmationCategorySet.has(category),
    [collapsedConfirmationCategorySet],
  );

  const toggleConfirmationCategoryCollapse = useCallback((category) => {
    setCollapsedConfirmationCategories((prev) =>
      prev.includes(category)
        ? prev.filter((value) => value !== category)
        : [...prev, category],
    );
  }, []);

  const visibleCollapsedConfirmationCategoryCount = useMemo(
    () =>
      groupedConfirmationRows.filter((group) =>
        collapsedConfirmationCategorySet.has(group.category),
      ).length,
    [groupedConfirmationRows, collapsedConfirmationCategorySet],
  );

  const handleToggleAllConfirmationCategories = useCallback(() => {
    if (groupedConfirmationRows.length === 0) return;

    setCollapsedConfirmationCategories((prev) => {
      const visibleCategories = groupedConfirmationRows.map(
        (group) => group.category,
      );
      const allVisibleCollapsed = visibleCategories.every((category) =>
        prev.includes(category),
      );

      if (allVisibleCollapsed) {
        return prev.filter((category) => !visibleCategories.includes(category));
      }

      return Array.from(new Set([...prev, ...visibleCategories]));
    });
  }, [groupedConfirmationRows]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadStoreContext = useCallback(
    async ({ silent = false } = {}) => {
      if (!hasTaggedBranch) {
        setStoreType("");
        setStoreName("");
        return;
      }

      try {
        const res = await fetchData("store-portal/store-context", {
          userCode,
          storeCode,
        });

        const contextRow = unwrapDataArray(res).map(
          normalizeStoreContextRow,
        )[0];
        setStoreType(contextRow?.storeType || "");
        setStoreName(contextRow?.storeName || "");
      } catch (error) {
        console.error("Failed to load branch store type:", error);
        setStoreType("");
        setStoreName("");
        if (!silent)
          showToast("Unable to load branch store type setup.", "error");
      }
    },
    [hasTaggedBranch, showToast, storeCode, userCode],
  );

  useEffect(() => {
    loadStoreContext({ silent: true });
  }, [loadStoreContext]);

  useEffect(() => {
    if (
      confirmationCategoryFilter &&
      !confirmationCategoryOptions.includes(confirmationCategoryFilter)
    ) {
      setConfirmationCategoryFilter("");
    }
  }, [confirmationCategoryFilter, confirmationCategoryOptions]);

  useEffect(() => {
    setCollapsedConfirmationCategories((prev) =>
      prev.filter((category) => confirmationCategoryOptions.includes(category)),
    );
  }, [confirmationCategoryOptions]);

  useEffect(() => {
    confirmationRequestIdRef.current += 1;
    setConfirmLoading(false);
    setConfirmationRows([]);
    setLoadedConfirmationRows([]);
  }, [storeCode, deliveryDate]);

  const loadConfirmation = useCallback(
    async ({ silent = false } = {}) => {
      if (!hasTaggedBranch) {
        confirmationRequestIdRef.current += 1;
        setConfirmLoading(false);
        if (!silent)
          showToast(
            "No branch is tagged to the logged-in user account.",
            "error",
          );
        return [];
      }

      const requestId = confirmationRequestIdRef.current + 1;
      confirmationRequestIdRef.current = requestId;
      setConfirmLoading(true);

      try {
        const res = await fetchData("store-portal/confirmation", {
          storeCode,
          deliveryDate,
        });

        if (confirmationRequestIdRef.current !== requestId) return [];

        const rows = unwrapDataArray(res)
          .map((row) => normalizeConfirmationRow(row, deliveryDate))
          .filter(
            (row) =>
              row.itemCode &&
              (toNumber(row.orderQty) > 0 ||
                toNumber(row.forecastQty) > 0 ||
                toBoolean(row.confirmed)),
          );

        setConfirmationRows(rows);
        setLoadedConfirmationRows(rows.map((row) => ({ ...row })));
        return rows;
      } catch (error) {
        if (confirmationRequestIdRef.current !== requestId) return [];

        console.error("Failed to load store portal confirmation:", error);
        setConfirmationRows([]);
        setLoadedConfirmationRows([]);
        if (!silent)
          showToast("Unable to load forecast confirmation.", "error");
        return [];
      } finally {
        if (confirmationRequestIdRef.current === requestId) {
          setConfirmLoading(false);
        }
      }
    },
    [deliveryDate, hasTaggedBranch, showToast, storeCode],
  );

  const resetConfirmationRows = () => {
    setConfirmationRows(loadedConfirmationRows.map((row) => ({ ...row })));
    showToast("Daily order confirmation reset to the last loaded values.");
  };

  const handleConfirmQtyChange = (index, value) => {
    setConfirmationRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || toBoolean(row.confirmed)) return row;

        return { ...row, orderQty: value };
      }),
    );
  };

  const handleConfirmDateChange = (index, value) => {
    setConfirmationRows((prev) =>
      prev.map((row, i) =>
        i === index && !toBoolean(row.confirmed)
          ? { ...row, deliveryDate: value }
          : row,
      ),
    );
  };

  const confirmOrder = async () => {
    if (!hasTaggedBranch) {
      showToast("No branch is tagged to the logged-in user account.", "error");
      return;
    }

    const details = filteredConfirmationRows
      .filter((row) => !toBoolean(row.confirmed) && toNumber(row.orderQty) > 0)
      .map((row) => ({
        forecastId: row.forecastId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        categCode: row.categCode || "",
        uomCode: row.uomCode,
        deliveryDate: row.deliveryDate || deliveryDate,
        orderQty: Number(row.orderQty || 0),
      }));

    if (details.length === 0) {
      showToast("No unconfirmed quantity to submit.", "error");
      return;
    }

    const payloadDeliveryDate = details[0]?.deliveryDate || deliveryDate;

    const payload = {
      userCode,
      storeCode,
      deliveryDate: payloadDeliveryDate,
      orderType: "ConfirmedOrder",
      details,
    };

    setConfirmSubmitting(true);
    try {
      const res = await postRequest("store-portal/confirm-order", payload);
      showToast(res?.message || "Order confirmed successfully.");
      await loadConfirmation({ silent: true });
    } catch (error) {
      console.error("Failed to confirm store portal order:", error);
      showToast(getApiErrorMessage(error, "Unable to confirm order."), "error");
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const totalConfirmationOrderQty = useMemo(
    () =>
      filteredConfirmationRows.reduce(
        (sum, row) => sum + Number(row.forecastQty || 0),
        0,
      ),
    [filteredConfirmationRows],
  );

  const totalConfirmedQty = useMemo(
    () =>
      filteredConfirmationRows.reduce(
        (sum, row) => sum + Number(row.orderQty || 0),
        0,
      ),
    [filteredConfirmationRows],
  );

  const getConfirmationCategoryTotals = useCallback((rows = []) => {
    return rows.reduce(
      (totals, row) => ({
        orderQty: totals.orderQty + toNumber(row.forecastQty),
        confirmedQty: totals.confirmedQty + toNumber(row.orderQty),
      }),
      { orderQty: 0, confirmedQty: 0 },
    );
  }, []);

  return (
    <div className="global-tran-main-div-ui !mt-0 min-w-0 overflow-x-hidden px-2 pb-20 pt-[70px] sm:px-3 sm:pt-[74px] lg:px-4">
      {isBusy && <LoadingSpinner />}
      <Toast toast={toast} />

      <div className="relative z-[1] mb-3 flex w-full min-w-0 items-center rounded-lg border border-blue-200 bg-blue-100 px-4 py-3 text-blue-900 shadow-md dark:border-blue-800 dark:bg-blue-900 dark:text-white sm:mb-4 sm:px-5">
        <h1 className="min-w-0 break-words text-base font-extrabold leading-tight tracking-wide sm:text-xl lg:text-2xl">
          Daily Order Confirmation
        </h1>
      </div>

      <div className="global-tran-header-div-ui !mt-0 !p-2 sm:!p-4 lg:!p-2">
        <div className="mb-1 px-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Basic Information
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FloatingField
            id="userAccount"
            label="User Account"
            value={userDisplay || "Loading user..."}
            readOnly
          />
          <FloatingField
            id="branchTagged"
            label="Store"
            value={branchDisplay || "No branch tagged"}
            readOnly
          />
          <FloatingField
            id="storeCode"
            label="Store Code"
            value={storeCode || ""}
            readOnly
          />
          <FloatingField
            id="storeType"
            label="Store Type"
            value={storeType || "Auto from Branch_ref"}
            readOnly
          />
        </div>

        {!hasTaggedBranch && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100">
            This account has no branch tagged in the Users table. Store Portal
            ordering is disabled until a branch is assigned.
          </div>
        )}
      </div>

      <div className="global-tran-tab-div-ui !p-3 sm:!p-4 lg:!p-6">
        <div className="global-tran-tab-nav-ui !items-stretch !gap-3 sm:!items-center">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <button className="global-tran-tab-padding-ui global-tran-tab-text_active-ui">
              Daily Order Confirmation
            </button>
            {confirmationRows.length > 0 && (
              <StatusPill variant="success">
                {confirmationRows.length} lines
              </StatusPill>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ActionButton
              icon={RefreshCw}
              onClick={() => loadConfirmation()}
              disabled={confirmLoading || !hasTaggedBranch}
            >
              {confirmLoading ? "Loading..." : "Load Forecast"}
            </ActionButton>
            <ActionButton
              icon={RotateCcw}
              onClick={resetConfirmationRows}
              disabled={confirmLoading || loadedConfirmationRows.length === 0}
            >
              Reset
            </ActionButton>
            <ActionButton
              icon={ChevronDown}
              onClick={handleToggleAllConfirmationCategories}
              disabled={confirmLoading || groupedConfirmationRows.length === 0}
            >
              {visibleCollapsedConfirmationCategoryCount ===
                groupedConfirmationRows.length &&
              groupedConfirmationRows.length > 0
                ? "Show Categories"
                : "Collapse Categories"}
            </ActionButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FloatingField
            id="deliveryDate"
            label="Delivery Date"
            type="date"
            value={deliveryDate}
            onChange={setDeliveryDate}
          />
          <FloatingField
            id="confirmationCategoryFilter"
            label="Category Filter"
            type="select"
            value={confirmationCategoryFilter}
            onChange={setConfirmationCategoryFilter}
            disabled={confirmationRows.length === 0}
          >
            <option value="">All Categories</option>
            {confirmationCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </FloatingField>
        </div>

        <div className="mt-3 space-y-3 md:hidden">
          {groupedConfirmationRows.map((group) => {
            const isCollapsed = isConfirmationCategoryCollapsed(group.category);
            const categoryTotals = getConfirmationCategoryTotals(group.rows);

            return (
              <div
                key={`${group.category}-confirmation-group`}
                className="space-y-3"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleConfirmationCategoryCollapse(group.category)
                  }
                  aria-expanded={!isCollapsed}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold uppercase shadow-sm transition-colors ${
                    isCollapsed
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-gray-800 dark:text-slate-200"
                      : "border-green-200 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    />
                    <span className="truncate">Category: {group.category}</span>
                  </span>
                  <span className="shrink-0 text-right font-semibold normal-case">
                    {group.rows.length} line{group.rows.length === 1 ? "" : "s"}{" "}
                    • Order {categoryTotals.orderQty.toLocaleString()} • Confirm{" "}
                    {categoryTotals.confirmedQty.toLocaleString()}
                  </span>
                </button>

                {!isCollapsed &&
                  group.rows.map((row) => {
                    const isConfirmed = toBoolean(row.confirmed);
                    const originalIndex = row.__originalIndex;

                    return (
                      <div
                        key={`${row.itemCode || "item"}-${originalIndex}-confirmation-card`}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-blue-50 px-3 py-2 dark:border-slate-700 dark:bg-blue-900/30">
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {row.itemCode}
                            </div>
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {row.itemName}
                            </div>
                            <div className="mt-1 truncate text-[10px] font-bold uppercase text-slate-500 dark:text-slate-300">
                              Category: {getCategoryLabel(row)}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-gray-900 dark:text-slate-200">
                            {row.uomCode || "-"}
                          </span>
                        </div>

                        <div className="space-y-3 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                                Order Qty
                              </div>
                              <div className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                                Order Forecast
                              </div>
                            </div>
                            <div className="w-28 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-gray-900 dark:text-slate-200">
                              {toNumber(row.forecastQty).toLocaleString()}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                                Confirm Qty
                              </div>
                              {isConfirmed && (
                                <div className="text-[10px] font-bold uppercase text-green-600 dark:text-green-300">
                                  Confirmed
                                </div>
                              )}
                            </div>
                            <div className="w-28 shrink-0 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-900">
                              <QuantityInput
                                value={row.orderQty ?? 0}
                                onChange={(value) =>
                                  handleConfirmQtyChange(originalIndex, value)
                                }
                                tone="green"
                                navGroup="confirmation-mobile"
                                navRow={row.__displayIndex}
                                navCol={0}
                                disabled={isConfirmed}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                                Confirmation Date
                              </div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {shortDate(row.deliveryDate || deliveryDate)}
                              </div>
                            </div>
                            <div className="w-36 shrink-0 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-900">
                              <DateInput
                                value={row.deliveryDate || deliveryDate}
                                onChange={(value) =>
                                  handleConfirmDateChange(originalIndex, value)
                                }
                                disabled={isConfirmed}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {filteredConfirmationRows.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-gray-800 dark:text-slate-300">
              <div className="flex flex-col items-center justify-center gap-2">
                <PackageOpen className="h-8 w-8 text-slate-400" />
                <span>
                  {hasTaggedBranch
                    ? "No forecast rows loaded for confirmation."
                    : "Assign a branch to this user before ordering."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* COMPACT TABLE SECTION */}
        <div className="global-tran-table-main-div-ui mt-3 hidden max-w-full overflow-x-auto sm:mt-4 md:block">
          <div className="global-tran-table-main-sub-div-ui relative isolate !max-h-[56vh] sm:!max-h-[360px]">
            <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-[11px] [&_td]:!px-1.5 [&_td]:!py-1 [&_td]:border-b [&_td]:border-r [&_td]:border-slate-200 [&_th]:!px-1.5 [&_th]:!py-1 [&_th]:border-b [&_th]:border-r [&_th]:border-slate-200 [&_tr>td:first-child]:border-l">
              <thead className="global-tran-thead-div-ui sticky top-0 z-[220]">
                <tr>
                  <th className="global-tran-th-ui sticky left-0 top-0 z-[240] w-[82px] min-w-[82px] max-w-[82px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Code</div>
                    <TableHeaderFilter
                      compact
                      value={confirmationColumnFilters.itemCode}
                      onChange={(value) =>
                        setConfirmationColumnFilters((prev) => ({
                          ...prev,
                          itemCode: value,
                        }))
                      }
                      placeholder="Search code"
                      ariaLabel="Filter confirmation by item code"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky left-[82px] top-0 z-[240] w-[190px] min-w-[190px] max-w-[190px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Item Name</div>
                    <TableHeaderFilter
                      compact
                      value={confirmationColumnFilters.itemName}
                      onChange={(value) =>
                        setConfirmationColumnFilters((prev) => ({
                          ...prev,
                          itemName: value,
                        }))
                      }
                      placeholder="Search item"
                      ariaLabel="Filter confirmation by item name"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky left-[272px] top-0 z-[240] w-[80px] min-w-[80px] max-w-[80px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Category</div>
                    <TableHeaderFilter
                      compact
                      value={confirmationColumnFilters.category}
                      onChange={(value) =>
                        setConfirmationColumnFilters((prev) => ({
                          ...prev,
                          category: value,
                        }))
                      }
                      placeholder="Filter"
                      ariaLabel="Filter confirmation by category"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky left-[352px] top-0 z-[240] w-[58px] min-w-[58px] max-w-[58px] bg-blue-100 text-center shadow-[2px_0_0_0_rgba(226,232,240,1)] dark:bg-blue-900">
                    <div>UOM</div>
                    <TableHeaderFilter
                      compact
                      value={confirmationColumnFilters.uom}
                      onChange={(value) =>
                        setConfirmationColumnFilters((prev) => ({
                          ...prev,
                          uom: value,
                        }))
                      }
                      placeholder="Filter"
                      ariaLabel="Filter confirmation by UOM"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[76px] min-w-[76px] max-w-[76px] bg-blue-100 text-right dark:bg-blue-900">
                    Order Qty
                  </th>
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[84px] min-w-[84px] max-w-[84px] bg-blue-100 text-right dark:bg-blue-900">
                    Confirm Qty
                  </th>
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[120px] min-w-[120px] max-w-[120px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Confirmation Date</div>
                    <TableHeaderFilter
                      compact
                      value={confirmationColumnFilters.deliveryDate}
                      onChange={(value) =>
                        setConfirmationColumnFilters((prev) => ({
                          ...prev,
                          deliveryDate: value,
                        }))
                      }
                      placeholder="YYYY-MM-DD"
                      ariaLabel="Filter confirmation by date"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedConfirmationRows.map((group) => {
                  const isCollapsed = isConfirmationCategoryCollapsed(
                    group.category,
                  );
                  const categoryTotals = getConfirmationCategoryTotals(
                    group.rows,
                  );

                  return (
                    <Fragment
                      key={`${group.category}-confirmation-table-group`}
                    >
                      <tr className="bg-green-50/80 dark:bg-green-900/30">
                        <td colSpan={7} className="global-tran-td-ui !p-0">
                          <button
                            type="button"
                            onClick={() =>
                              toggleConfirmationCategoryCollapse(group.category)
                            }
                            aria-expanded={!isCollapsed}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold uppercase text-green-800 hover:bg-green-100 dark:text-green-100 dark:hover:bg-green-900/50"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                                  isCollapsed ? "-rotate-90" : "rotate-0"
                                }`}
                              />
                              <span className="truncate">
                                Category: {group.category}
                              </span>
                            </span>
                            <span className="shrink-0 text-right font-semibold normal-case text-slate-600 dark:text-slate-200">
                              {group.rows.length} line
                              {group.rows.length === 1 ? "" : "s"} • Order{" "}
                              {categoryTotals.orderQty.toLocaleString()} •
                              Confirm{" "}
                              {categoryTotals.confirmedQty.toLocaleString()}
                            </span>
                          </button>
                        </td>
                      </tr>

                      {!isCollapsed &&
                        group.rows.map((row) => {
                          const originalIndex = row.__originalIndex;

                          return (
                            <tr
                              key={`${row.itemCode || "item"}-${originalIndex}`}
                              className="global-tran-tr-ui"
                            >
                              <td className="global-tran-td-ui sticky left-0 z-[40] w-[82px] min-w-[82px] max-w-[82px] overflow-hidden text-ellipsis whitespace-nowrap bg-white font-mono font-semibold dark:bg-black">
                                {row.itemCode}
                              </td>
                              <td className="global-tran-td-ui sticky left-[82px] z-[40] w-[190px] min-w-[190px] max-w-[190px] bg-white font-medium dark:bg-black">
                                <span className="block truncate">
                                  {row.itemName}
                                </span>
                              </td>
                              <td className="global-tran-td-ui sticky left-[272px] z-[40] w-[80px] min-w-[80px] max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap bg-white text-[11px] font-semibold text-slate-700 dark:bg-black dark:text-slate-200">
                                {getCategoryLabel(row)}
                              </td>
                              <td className="global-tran-td-ui sticky left-[352px] z-[40] w-[58px] min-w-[58px] max-w-[58px] bg-white text-center shadow-[2px_0_0_0_rgba(226,232,240,1)] dark:bg-black">
                                <span className="block w-full text-center text-[11px] font-medium text-slate-700 dark:text-slate-200">
                                  {row.uomCode || "-"}
                                </span>
                              </td>
                              <td className="global-tran-td-ui w-[76px] min-w-[76px] max-w-[76px] bg-slate-50 text-right text-[11px] font-semibold text-slate-700 dark:bg-gray-900 dark:text-slate-200">
                                {toNumber(row.forecastQty).toLocaleString()}
                              </td>
                              <td className="global-tran-td-ui w-[84px] min-w-[84px] max-w-[84px] text-right">
                                <QuantityInput
                                  compact
                                  value={row.orderQty ?? 0}
                                  onChange={(value) =>
                                    handleConfirmQtyChange(originalIndex, value)
                                  }
                                  tone="green"
                                  navGroup="confirmation"
                                  navRow={row.__displayIndex}
                                  navCol={0}
                                  disabled={toBoolean(row.confirmed)}
                                />
                              </td>
                              <td className="global-tran-td-ui w-[120px] min-w-[120px] max-w-[120px] text-left">
                                <DateInput
                                  compact
                                  value={row.deliveryDate || deliveryDate}
                                  onChange={(value) =>
                                    handleConfirmDateChange(
                                      originalIndex,
                                      value,
                                    )
                                  }
                                  disabled={toBoolean(row.confirmed)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}

                {filteredConfirmationRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="global-tran-td-ui py-10 text-center text-sm text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <PackageOpen className="h-8 w-8 text-slate-400" />
                        <span>
                          {hasTaggedBranch
                            ? "No forecast rows loaded for confirmation."
                            : "Assign a branch to this user before ordering."}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="global-tran-tab-footer-main-div-ui !mt-4 !gap-3">
          <div className="global-tran-tab-footer-button-div-ui w-full sm:w-auto">
            <ActionButton
              icon={CheckCircle2}
              onClick={confirmOrder}
              disabled={
                !hasTaggedBranch ||
                filteredConfirmationRows.length === 0 ||
                confirmSubmitting ||
                !filteredConfirmationRows.some(
                  (row) =>
                    !toBoolean(row.confirmed) && toNumber(row.orderQty) > 0,
                )
              }
              variant="success"
            >
              {confirmSubmitting ? "Confirming..." : "Confirm Order"}
            </ActionButton>
          </div>

          <div className="ml-auto flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="global-tran-tab-footer-total-main-div-ui w-full rounded-lg bg-blue-50/60 px-3 py-2 sm:w-auto dark:bg-gray-900/40">
              <div className="global-tran-tab-footer-total-div-ui">
                <label className="global-tran-tab-footer-total-label-ui">
                  Total Order Qty:
                </label>
                <label className="global-tran-tab-footer-total-value-ui">
                  {totalConfirmationOrderQty.toLocaleString()}
                </label>
              </div>
            </div>

            <div className="global-tran-tab-footer-total-main-div-ui w-full rounded-lg bg-green-50/60 px-3 py-2 sm:w-auto dark:bg-gray-900/40">
              <div className="global-tran-tab-footer-total-div-ui">
                <label className="global-tran-tab-footer-total-label-ui">
                  Total Confirmed Qty:
                </label>
                <label className="global-tran-tab-footer-total-value-ui">
                  {totalConfirmedQty.toLocaleString()}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 hidden max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-lg dark:border-slate-700 dark:bg-gray-800 dark:text-slate-200 md:flex md:max-w-[420px]">
        <UserRound className="h-4 w-4 text-blue-600" />
        <span className="truncate">{userCode || "User"}</span>
        <span className="text-slate-300">|</span>
        <Building2 className="h-4 w-4 text-blue-600" />
        <span className="truncate">{branchDisplay || "No branch tagged"}</span>
      </div>
    </div>
  );
}