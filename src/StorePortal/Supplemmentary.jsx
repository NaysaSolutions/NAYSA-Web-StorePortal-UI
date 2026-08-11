import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  Loader2,
  PackageOpen,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postRequest } from "./api";

const getUserValue = (user, keys) => {
  const source = user?.user ?? user?.data ?? user;
  const currentUser = Array.isArray(source) ? source[0] || {} : source || {};

  for (const key of keys) {
    const value = currentUser?.[key] ?? user?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value).trim();
    }
  }

  return "";
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultDeliveryDate = () => {
  return formatDate(new Date());
};

const unwrapItems = (response) => {
  let current = response;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current)) return current;

    if (typeof current === "string") {
      try {
        current = JSON.parse(current);
        continue;
      } catch {
        return [];
      }
    }

    if (!current || typeof current !== "object") return [];

    const nested =
      current.data ?? current.Data ?? current.result ?? current.RESULT;
    if (nested === undefined || nested === current) return [];
    current = nested;
  }

  return [];
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

const normalizeStoreContextRow = (row = {}) => ({
  storeName: getRowValue(row, [
    "storeName",
    "STORE_NAME",
    "store_name",
    "branchName",
    "BRANCH_NAME",
    "branchDesc",
    "BRANCH_DESC",
  ]),
  storeType: getRowValue(row, [
    "storeType",
    "STORE_TYPE",
    "store_type",
    "branchStoreType",
    "BRANCH_STORE_TYPE",
  ]),
});

const getCategoryLabel = (item = {}) =>
  String(
    item.categCode ??
      item.categoryCode ??
      item.categoryName ??
      item.category ??
      item.CATEG_CODE ??
      item.CATEGORY_CODE ??
      item.CATEGORY_NAME ??
      "Uncategorized",
  ).trim() || "Uncategorized";

const normalizeSupplementaryItem = (row = {}) => ({
  ...row,
  itemCode: getRowValue(row, ["itemCode", "ITEM_CODE", "item_code"]),
  itemName: getRowValue(row, ["itemName", "ITEM_NAME", "item_name"]),
  categCode: getRowValue(
    row,
    [
      "categCode",
      "categoryCode",
      "categoryName",
      "CATEG_CODE",
      "CATEGORY_CODE",
      "CATEGORY_NAME",
    ],
    "Uncategorized",
  ),
  uomCode: getRowValue(row, ["uomCode", "UOM_CODE", "uom_code"]),
  orderQty: row.orderQty ?? row.ORDER_QTY ?? row.order_qty ?? 0,
  isSubmitted: [
    row.isSubmitted,
    row.IS_SUBMITTED,
    row.submitted,
    row.SUBMITTED,
    row.confirmed,
    row.CONFIRMED,
  ].some((value) =>
    ["1", "true", "y", "yes"].includes(String(value ?? "").toLowerCase()),
  ),
});

const toNumber = (value) => {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
};

const containsText = (value, filter) =>
  String(value ?? "")
    .toLowerCase()
    .includes(
      String(filter ?? "")
        .trim()
        .toLowerCase(),
    );

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
        className={`peer global-tran-textbox-ui ${
          readOnly || disabled
            ? "cursor-default bg-gray-50 dark:bg-gray-700"
            : ""
        }`}
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

const StatusPill = ({ children, variant = "default" }) => {
  const toneClass =
    variant === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200";

  return (
    <span
      className={`inline-flex min-h-[34px] max-w-full items-center justify-center rounded-md border px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide ${toneClass}`}
    >
      {children}
    </span>
  );
};

const TableHeaderFilter = ({ value, onChange, placeholder, ariaLabel }) => (
  <input
    type="search"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    onClick={(event) => event.stopPropagation()}
    placeholder={placeholder}
    aria-label={ariaLabel}
    className="mt-0.5 h-6 w-full rounded border border-blue-200 bg-white px-1.5 text-[10px] font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-900 dark:text-slate-100"
  />
);

const formatQuantity = (value) => {
  if (value === "") return "";
  const normalized = String(value ?? 0).replace(/,/g, "");
  if (!/^\d*(\.\d*)?$/.test(normalized)) return normalized;

  const [whole = "", decimal] = normalized.split(".");
  const formattedWhole = (whole.replace(/^0+(?=\d)/, "") || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
  return decimal === undefined
    ? formattedWhole
    : `${formattedWhole}.${decimal}`;
};

const QuantityInput = ({
  value,
  onChange,
  navRow,
  compact = false,
  disabled = false,
}) => {
  const handleChange = (event) => {
    let nextValue = event.target.value.replace(/[^0-9.]/g, "");
    const parts = nextValue.split(".");
    if (parts.length > 2) nextValue = `${parts[0]}.${parts.slice(1).join("")}`;
    if (/^\d*(\.\d{0,4})?$/.test(nextValue)) onChange(nextValue);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inputs = Array.from(
      document.querySelectorAll('[data-supplementary-qty="true"]'),
    ).filter(
      (input) =>
        !input.disabled &&
        (input.offsetWidth > 0 ||
          input.offsetHeight > 0 ||
          input.getClientRects().length > 0),
    );
    const currentIndex = inputs.indexOf(event.currentTarget);
    const nextInput = inputs[currentIndex + 1];
    nextInput?.focus();
    nextInput?.select?.();
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      data-supplementary-qty="true"
      data-qty-row={navRow}
      value={formatQuantity(value ?? 0)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      title={disabled ? "This quantity has already been submitted." : ""}
      className={`${
        compact ? "h-6 px-0.5 text-[11px]" : "h-7 px-1 text-xs"
      } w-full border-0 bg-transparent text-right outline-none focus:ring-0 ${
        disabled
          ? "cursor-not-allowed text-slate-500 dark:text-slate-400"
          : "text-slate-900 dark:text-white"
      }`}
    />
  );
};

const LoadingSpinner = () => (
  <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xl dark:border-slate-700 dark:bg-gray-900 dark:text-slate-100">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      Loading...
    </div>
  </div>
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

export default function Supplementary({ user }) {
  const queryClient = useQueryClient();
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate);
  const [quantities, setQuantities] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState({
    itemCode: "",
    category: "",
    uom: "",
  });
  const [collapsedCategories, setCollapsedCategories] = useState([]);
  const [toast, setToast] = useState(null);
  const [storeType, setStoreType] = useState("");
  const [configuredStoreName, setConfiguredStoreName] = useState("");

  const userCode = useMemo(
    () =>
      getUserValue(user, [
        "userCode",
        "USER_CODE",
        "user_code",
        "userId",
        "USER_ID",
      ]),
    [user],
  );
  const userName = useMemo(
    () => getUserValue(user, ["userName", "USER_NAME", "name", "fullName"]),
    [user],
  );
  const storeCode = useMemo(
    () =>
      getUserValue(user, [
        "storeCode",
        "STORE_CODE",
        "branchCode",
        "BRANCH_CODE",
        "branch_code",
        "branch",
        "BRANCH",
      ]),
    [user],
  );
  const userStoreName = useMemo(
    () =>
      getUserValue(user, [
        "storeName",
        "STORE_NAME",
        "branchName",
        "BRANCH_NAME",
        "branchDesc",
        "BRANCH_DESC",
      ]),
    [user],
  );

  const userDisplay =
    userName && userName !== userCode ? `${userCode} - ${userName}` : userCode;
  const branchDisplay = configuredStoreName || userStoreName || storeCode;
  const hasTaggedBranch = Boolean(storeCode);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadStoreContext = useCallback(async () => {
    if (!hasTaggedBranch) {
      setStoreType("");
      setConfiguredStoreName("");
      return;
    }

    try {
      const response = await fetchData("store-portal/store-context", {
        userCode,
        storeCode,
      });
      const contextRow = unwrapItems(response).map(normalizeStoreContextRow)[0];

      setStoreType(contextRow?.storeType || "");
      setConfiguredStoreName(contextRow?.storeName || "");
    } catch (contextError) {
      console.error("Failed to load branch store type:", contextError);
      setStoreType("");
      setConfiguredStoreName("");
      showToast("Unable to load branch store type setup.", "error");
    }
  }, [hasTaggedBranch, showToast, storeCode, userCode]);

  useEffect(() => {
    loadStoreContext();
  }, [loadStoreContext]);

  const fetchSupplementary = async (date) => {
    return fetchData("store-portal/supplementary", {
      userCode,
      storeCode,
      storeType,
      deliveryDate: date,
    });
  };

  const saveSupplementary = async (payload) =>
    postRequest("store-portal/supplementary-order", payload);

  const {
    data: response = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["supplementaryItems", storeCode, storeType, deliveryDate],
    queryFn: () => fetchSupplementary(deliveryDate),
    enabled: Boolean(deliveryDate && storeCode && storeType),
  });

  const items = useMemo(
    () =>
      unwrapItems(response)
        .map(normalizeSupplementaryItem)
        .filter((item) => item.itemCode),
    [response],
  );

  useEffect(() => {
    const initialQuantities = {};
    items.forEach((item) => {
      if (toNumber(item.orderQty) > 0) {
        initialQuantities[item.itemCode] = item.orderQty;
      }
    });
    setQuantities(initialQuantities);
  }, [items]);

  const mutation = useMutation({
    mutationFn: saveSupplementary,
    onSuccess: (result) => {
      const savedOrder =
        unwrapItems(result)[0] ?? result?.data?.data ?? result?.data ?? {};
      const orderNo = getRowValue(savedOrder, ["orderNo", "ORDER_NO"]);

      showToast(
        orderNo
          ? `Supplementary Order ${orderNo} submitted successfully.`
          : "Supplementary Order submitted successfully.",
      );
      queryClient.invalidateQueries({
        queryKey: ["supplementaryItems", storeCode, storeType, deliveryDate],
      });
      queryClient.invalidateQueries({
        queryKey: ["weeklyForecastHistory"],
      });
    },
    onError: (mutationError) => {
      showToast(
        mutationError?.message || "Unable to submit Supplementary Order.",
        "error",
      );
    },
  });

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => getCategoryLabel(item)))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            !categoryFilter || getCategoryLabel(item) === categoryFilter,
        )
        .filter(
          (item) =>
            containsText(item.itemCode, columnFilters.itemCode) &&
            containsText(getCategoryLabel(item), columnFilters.category) &&
            containsText(item.uomCode, columnFilters.uom),
        )
        .map((item, index) => ({ ...item, __displayIndex: index })),
    [categoryFilter, columnFilters, items],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map();
    filteredItems.forEach((item) => {
      const category = getCategoryLabel(item);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    });
    return Array.from(groups, ([category, groupItems]) => ({
      category,
      items: groupItems,
    }));
  }, [filteredItems]);

  const totalOrderQty = useMemo(
    () =>
      filteredItems.reduce(
        (total, item) => total + toNumber(quantities[item.itemCode]),
        0,
      ),
    [filteredItems, quantities],
  );

  const pendingOrderQty = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total + (item.isSubmitted ? 0 : toNumber(quantities[item.itemCode])),
        0,
      ),
    [items, quantities],
  );

  const handleQtyChange = (itemCode, value) => {
    if (items.some((item) => item.itemCode === itemCode && item.isSubmitted)) {
      return;
    }
    setQuantities((current) => ({ ...current, [itemCode]: value }));
  };

  const resetOrder = () => {
    const initialQuantities = {};
    items.forEach((item) => {
      if (toNumber(item.orderQty) > 0) {
        initialQuantities[item.itemCode] = item.orderQty;
      }
    });
    setQuantities(initialQuantities);
    showToast("Supplementary Order reset to the loaded values.");
  };

  const toggleCategory = (category) => {
    setCollapsedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  };

  const toggleAllCategories = () => {
    const visibleCategories = groupedItems.map((group) => group.category);
    const allCollapsed = visibleCategories.every((category) =>
      collapsedCategories.includes(category),
    );
    setCollapsedCategories(allCollapsed ? [] : visibleCategories);
  };

  const handleSubmit = () => {
    if (pendingOrderQty <= 0) {
      showToast("Enter a quantity for at least one unsent item.", "error");
      return;
    }

    const details = items
      .map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        categCode: getCategoryLabel(item),
        uomCode: item.uomCode,
        deliveryDate,
        orderQty: toNumber(quantities[item.itemCode]),
      }))
      .filter((item) => item.orderQty > 0);

    mutation.mutate({ userCode, storeCode, storeType, deliveryDate, details });
  };

  const allVisibleCategoriesCollapsed =
    groupedItems.length > 0 &&
    groupedItems.every((group) => collapsedCategories.includes(group.category));
  const isBusy = isLoading || isFetching || mutation.isPending;

  return (
    <div className="global-tran-main-div-ui !mt-0 min-w-0 overflow-x-hidden px-2 pb-20 pt-[70px] sm:px-3 sm:pt-[74px] lg:px-4">
      {isBusy && <LoadingSpinner />}
      <Toast toast={toast} />

      <div className="relative z-[1] mb-3 flex w-full min-w-0 items-center rounded-lg border border-blue-200 bg-blue-100 px-4 py-3 text-blue-900 shadow-md dark:border-blue-800 dark:bg-blue-900 dark:text-white sm:mb-4 sm:px-5">
        <h1 className="min-w-0 break-words text-base font-extrabold leading-tight tracking-wide sm:text-xl lg:text-2xl">
          Supplementary Order
        </h1>
      </div>

      <div className="global-tran-header-div-ui !mt-0 !p-2 sm:!p-4 lg:!p-2">
        <div className="mb-1 px-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Basic Information
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FloatingField
            id="supplementaryUserAccount"
            label="User Account"
            value={userDisplay || "Loading user..."}
            readOnly
          />
          <FloatingField
            id="supplementaryBranch"
            label="Store"
            value={branchDisplay || "No branch tagged"}
            readOnly
          />
          <FloatingField
            id="supplementaryStoreCode"
            label="Store Code"
            value={storeCode}
            readOnly
          />
          <FloatingField
            id="supplementaryStoreType"
            label="Store Type"
            value={storeType || "Auto from Branch_ref"}
            readOnly
          />
        </div>

        {!hasTaggedBranch && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100">
            This account has no branch tagged. Supplementary ordering is
            disabled until a branch is assigned.
          </div>
        )}
      </div>

      <div className="global-tran-tab-div-ui !p-3 sm:!p-4 lg:!p-6">
        <div className="global-tran-tab-nav-ui !items-stretch !gap-3 sm:!items-center">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="global-tran-tab-padding-ui global-tran-tab-text_active-ui">
              <PackagePlus className="h-4 w-4" />
              Supplementary Order
            </span>
            {items.length > 0 && (
              <StatusPill>
                {filteredItems.length} of {items.length} items
              </StatusPill>
            )}
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ActionButton
              icon={RefreshCw}
              onClick={() => refetch()}
              disabled={!hasTaggedBranch || !deliveryDate || isFetching}
            >
              {isFetching ? "Loading..." : "Load Items"}
            </ActionButton>
            <ActionButton
              icon={RotateCcw}
              onClick={resetOrder}
              disabled={items.length === 0 || isFetching}
            >
              Reset
            </ActionButton>
            <ActionButton
              icon={ChevronDown}
              onClick={toggleAllCategories}
              disabled={groupedItems.length === 0}
            >
              {allVisibleCategoriesCollapsed
                ? "Show Categories"
                : "Collapse Categories"}
            </ActionButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FloatingField
            id="supplementaryDeliveryDate"
            label="Delivery Date"
            type="date"
            value={deliveryDate}
            onChange={setDeliveryDate}
          />
          <FloatingField
            id="supplementaryCategory"
            label="Category"
            type="select"
            value={categoryFilter}
            onChange={setCategoryFilter}
            disabled={items.length === 0}
          >
            <option value="">All Categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </FloatingField>
          <FloatingField
            id="supplementaryItemCount"
            label="Available Items"
            value={String(items.length)}
            readOnly
          />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100">
            {error.message || "Unable to load supplementary items."}
          </div>
        )}

        <div className="mt-3 space-y-3 md:hidden">
          {groupedItems.map((group) => {
            const isCollapsed = collapsedCategories.includes(group.category);
            const categoryTotal = group.items.reduce(
              (total, item) => total + toNumber(quantities[item.itemCode]),
              0,
            );

            return (
              <div key={group.category} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleCategory(group.category)}
                  aria-expanded={!isCollapsed}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold uppercase shadow-sm transition-colors ${
                    isCollapsed
                      ? "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-gray-800 dark:text-slate-200"
                      : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    />
                    <span className="truncate">{group.category}</span>
                  </span>
                  <span className="shrink-0 normal-case">
                    {group.items.length} item
                    {group.items.length === 1 ? "" : "s"} ·{" "}
                    {categoryTotal.toLocaleString()}
                  </span>
                </button>

                {!isCollapsed &&
                  group.items.map((item) => (
                    <div
                      key={item.itemCode}
                      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between gap-3 bg-slate-50 px-3 py-2 dark:bg-gray-900">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.itemName}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {item.itemCode} · {getCategoryLabel(item)}
                          </div>
                        </div>
                        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-gray-800 dark:text-slate-200">
                          {item.uomCode || "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                            Order Qty
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">
                            Delivery: {deliveryDate}
                          </div>
                        </div>
                        <div
                          className={`w-28 rounded-md border ${
                            item.isSubmitted
                              ? "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-gray-700"
                              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-900"
                          }`}
                        >
                          <QuantityInput
                            value={quantities[item.itemCode] ?? 0}
                            onChange={(value) =>
                              handleQtyChange(item.itemCode, value)
                            }
                            navRow={item.__displayIndex}
                            disabled={item.isSubmitted}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-gray-800 dark:text-slate-300">
              <PackageOpen className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              {hasTaggedBranch
                ? items.length > 0
                  ? "No items match the selected filters."
                  : "No supplementary items loaded."
                : "Assign a branch to this user before ordering."}
            </div>
          )}
        </div>

        <div className="global-tran-table-main-div-ui mt-4 hidden max-w-full overflow-x-auto md:block">
          <div className="global-tran-table-main-sub-div-ui relative isolate !max-h-[56vh] sm:!max-h-[360px]">
            <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-[11px] [&_td]:!px-1.5 [&_td]:!py-1 [&_td]:border-b [&_td]:border-r [&_td]:border-slate-200 [&_th]:!px-1.5 [&_th]:!py-1 [&_th]:border-b [&_th]:border-r [&_th]:border-slate-200 [&_tr>td:first-child]:border-l">
              <thead className="global-tran-thead-div-ui sticky top-0 z-[220]">
                <tr>
                  <th className="global-tran-th-ui sticky left-0 top-0 z-[240] w-[100px] min-w-[100px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Code</div>
                    <TableHeaderFilter
                      value={columnFilters.itemCode}
                      onChange={(value) =>
                        setColumnFilters((current) => ({
                          ...current,
                          itemCode: value,
                        }))
                      }
                      placeholder="Search code"
                      ariaLabel="Filter by item code"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky left-[100px] top-0 z-[240] w-[240px] min-w-[240px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Item Name</div>
                  </th>
                  <th className="global-tran-th-ui sticky left-[340px] top-0 z-[240] w-[110px] min-w-[110px] bg-blue-100 text-left dark:bg-blue-900">
                    <div>Category</div>
                    <TableHeaderFilter
                      value={columnFilters.category}
                      onChange={(value) =>
                        setColumnFilters((current) => ({
                          ...current,
                          category: value,
                        }))
                      }
                      placeholder="Filter"
                      ariaLabel="Filter by category"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky left-[450px] top-0 z-[240] w-[70px] min-w-[70px] bg-blue-100 text-center dark:bg-blue-900">
                    <div>UOM</div>
                    <TableHeaderFilter
                      value={columnFilters.uom}
                      onChange={(value) =>
                        setColumnFilters((current) => ({
                          ...current,
                          uom: value,
                        }))
                      }
                      placeholder="Filter"
                      ariaLabel="Filter by UOM"
                    />
                  </th>
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[110px] min-w-[110px] bg-blue-100 text-right dark:bg-blue-900">
                    Order Qty
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.map((group) => {
                  const isCollapsed = collapsedCategories.includes(
                    group.category,
                  );
                  const categoryTotal = group.items.reduce(
                    (total, item) =>
                      total + toNumber(quantities[item.itemCode]),
                    0,
                  );

                  return (
                    <Fragment key={`${group.category}-table-group`}>
                      <tr className="bg-blue-50/80 dark:bg-blue-900/30">
                        <td colSpan={5} className="global-tran-td-ui !p-0">
                          <button
                            type="button"
                            onClick={() => toggleCategory(group.category)}
                            aria-expanded={!isCollapsed}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold uppercase text-blue-800 hover:bg-blue-100 dark:text-blue-100 dark:hover:bg-blue-900/50"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isCollapsed ? "-rotate-90" : "rotate-0"
                                }`}
                              />
                              <span className="truncate">
                                Category: {group.category}
                              </span>
                              <span className="font-semibold normal-case text-slate-500 dark:text-slate-300">
                                ({group.items.length} item
                                {group.items.length === 1 ? "" : "s"})
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold normal-case text-slate-600 dark:text-slate-300">
                              Total: {categoryTotal.toLocaleString()}
                            </span>
                          </button>
                        </td>
                      </tr>

                      {!isCollapsed &&
                        group.items.map((item) => (
                          <tr key={item.itemCode} className="global-tran-tr-ui">
                            <td className="global-tran-td-ui sticky left-0 z-[40] w-[100px] min-w-[100px] bg-white font-mono font-semibold dark:bg-black">
                              {item.itemCode}
                            </td>
                            <td className="global-tran-td-ui sticky left-[100px] z-[40] w-[240px] min-w-[240px] bg-white font-medium dark:bg-black">
                              <span className="block truncate">
                                {item.itemName}
                              </span>
                            </td>
                            <td className="global-tran-td-ui sticky left-[340px] z-[40] w-[110px] min-w-[110px] bg-white font-semibold text-slate-700 dark:bg-black dark:text-slate-200">
                              {getCategoryLabel(item)}
                            </td>
                            <td className="global-tran-td-ui sticky left-[450px] z-[40] w-[70px] min-w-[70px] bg-white text-center dark:bg-black">
                              {item.uomCode || "-"}
                            </td>
                            <td className="global-tran-td-ui w-[110px] min-w-[110px] text-right">
                              <QuantityInput
                                compact
                                value={quantities[item.itemCode] ?? 0}
                                onChange={(value) =>
                                  handleQtyChange(item.itemCode, value)
                                }
                                navRow={item.__displayIndex}
                                disabled={item.isSubmitted}
                              />
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="global-tran-td-ui py-10 text-center text-sm text-slate-500"
                    >
                      <PackageOpen className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                      {hasTaggedBranch
                        ? items.length > 0
                          ? "No items match the selected filters."
                          : "No supplementary items loaded."
                        : "Assign a branch to this user before ordering."}
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
              icon={Send}
              onClick={handleSubmit}
              disabled={
                !hasTaggedBranch ||
                items.length === 0 ||
                pendingOrderQty <= 0 ||
                mutation.isPending
              }
              variant="success"
            >
              {mutation.isPending
                ? "Submitting..."
                : "Submit Supplementary Order"}
            </ActionButton>
          </div>

          <div className="global-tran-tab-footer-total-main-div-ui w-full rounded-lg bg-blue-50/60 px-3 py-2 sm:w-auto dark:bg-gray-900/40">
            <div className="global-tran-tab-footer-total-div-ui">
              <label className="global-tran-tab-footer-total-label-ui">
                Total Supplementary Qty:
              </label>
              <label className="global-tran-tab-footer-total-value-ui">
                {totalOrderQty.toLocaleString()}
              </label>
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
