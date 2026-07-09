import React, { useState, useMemo, useEffect } from "react";
import { Search, ListTree, PackageOpen, LayoutList, ChevronDown } from "lucide-react";
import { fetchData } from "./api";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const pad2 = (value) => String(value).padStart(2, "0");

const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const getDateRange = (start, end) => {
  if (!start || !end) return [];
  const dates = [];
  let current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (current <= last) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const shortDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
};

const getCategoryLabel = (row = {}) => {
  const category = String(row?.categCode ?? row?.categoryCode ?? row?.category ?? "").trim();
  return category || "Uncategorized";
};

const getStoreKey = (row = {}) => String(row?.storeCode ?? row?.store ?? "").trim();

const getStoreLabel = (row = {}) => {
  const storeName = String(row?.store ?? "").trim();
  const storeCode = String(row?.storeCode ?? "").trim();

  if (storeName && storeCode && storeName !== storeCode) return `${storeCode} - ${storeName}`;
  return storeName || storeCode || "Unspecified Store";
};

/* ─── shared UI (Aligned with Store Portal) ───────────────────────────────── */
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
        <label htmlFor={id} className="global-tran-floating-label">
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
      <label htmlFor={id} className="global-tran-floating-label">
        {label}
      </label>
    </div>
  );
};

const ActionButton = ({ children, icon: Icon, onClick, disabled = false, variant = "primary" }) => {
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
        disabled ? "cursor-not-allowed bg-gray-400 hover:bg-gray-400 dark:bg-gray-700" : colorClass
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
};

const unwrapData = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.result)) return response.result;
  return [];
};

const pivotRows = (rows = [], isDetailed = false) => {
  const map = new Map();

  rows.forEach((item) => {
    const itemCode = item.itemCode || "";
    const storeCode = item.storeCode || "";
    const deliveryDate = item.deliveryDate;
    const qty = Number(item.qty || item.totalQty || item.storeQty || 0);

    if (!itemCode || !deliveryDate) return;

    const key = isDetailed ? `${storeCode}|${itemCode}` : itemCode;

    if (!map.has(key)) {
      map.set(key, {
        store: item.storeName || storeCode,
        storeCode,
        itemCode,
        itemDesc: item.itemDesc || item.itemName || "",
        categCode: item.categCode || item.categoryCode || "",
        uomCode: item.uomCode || "",
        dates: {},
        total: 0,
      });
    }

    const row = map.get(key);
    row.dates[deliveryDate] = (Number(row.dates[deliveryDate]) || 0) + qty;
    row.total += qty;
  });

  return Array.from(map.values());
};

/* ─── main component ──────────────────────────────────────────────────────── */
export default function CommissaryForecast() {
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(addDays(formatDate(new Date()), 6));
  const [category, setCategory] = useState("All");
  const [activeTab, setActiveTab] = useState("summary");
  const [storeFilter, setStoreFilter] = useState("All");
  const [collapsedSummaryCategories, setCollapsedSummaryCategories] = useState([]);
  const [collapsedDetailedCategories, setCollapsedDetailedCategories] = useState([]);

  const [summaryData, setSummaryData] = useState([]);
  const [detailedData, setDetailedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const dates = useMemo(() => getDateRange(startDate, endDate), [startDate, endDate]);

  const loadCategories = async () => {
    try {
      const response = await fetchData("/commissary/categories");
      setCategories(unwrapData(response));
    } catch (error) {
      console.error("Failed to load commissary categories", error);
      setCategories([]);
    }
  };

  const loadForecastData = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (!startDate || !endDate) {
        setSummaryData([]);
        setDetailedData([]);
        setErrorMessage("Start Date and End Date are required.");
        return;
      }

      const query = new URLSearchParams({
        startDate,
        endDate,
        category: category ?? "All",
      }).toString();

      const [summaryResponse, detailedResponse] = await Promise.all([
        fetchData(`/commissary/summary?${query}`),
        fetchData(`/commissary/detailed?${query}`),
      ]);

      const summaryRows = unwrapData(summaryResponse);
      const detailedRows = unwrapData(detailedResponse);

      setSummaryData(pivotRows(summaryRows, false));
      setDetailedData(pivotRows(detailedRows, true));
    } catch (error) {
      console.error("Failed to fetch commissary forecast data", error);
      setSummaryData([]);
      setDetailedData([]);
      setErrorMessage(error?.response?.data?.message || error?.message || "Failed to load commissary forecast data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadForecastData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storeOptions = useMemo(() => {
    const map = new Map();

    detailedData.forEach((row) => {
      const storeKey = getStoreKey(row);
      if (!storeKey) return;

      if (!map.has(storeKey)) {
        map.set(storeKey, getStoreLabel(row));
      }
    });

    return Array.from(map, ([storeCode, storeName]) => ({ storeCode, storeName })).sort((a, b) =>
      String(a.storeName || a.storeCode).localeCompare(String(b.storeName || b.storeCode)),
    );
  }, [detailedData]);

  const filteredDetailedData = useMemo(() => {
    if (storeFilter === "All") return detailedData;

    return detailedData.filter((row) => getStoreKey(row) === storeFilter);
  }, [detailedData, storeFilter]);

  const currentData = activeTab === "summary" ? summaryData : filteredDetailedData;
  const activeCollapsedCategories = activeTab === "summary" ? collapsedSummaryCategories : collapsedDetailedCategories;
  const activeCollapsedCategorySet = useMemo(() => new Set(activeCollapsedCategories), [activeCollapsedCategories]);

  const groupedCurrentData = useMemo(() => {
    const groups = new Map();

    currentData.forEach((row) => {
      const categoryLabel = getCategoryLabel(row);

      if (!groups.has(categoryLabel)) {
        groups.set(categoryLabel, []);
      }

      groups.get(categoryLabel).push(row);
    });

    return Array.from(groups, ([categoryName, rows]) => ({
      categoryName,
      rows: rows.sort((a, b) => {
        if (activeTab === "detailed") {
          const storeCompare = String(a.store || "").localeCompare(String(b.store || ""));
          if (storeCompare !== 0) return storeCompare;
        }

        return String(a.itemDesc || a.itemCode || "").localeCompare(String(b.itemDesc || b.itemCode || ""));
      }),
    })).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [activeTab, currentData]);

  const totalQueryQty = useMemo(() => {
    return currentData.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  }, [currentData]);

  const getCategoryTotal = (rows = []) => rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  const toggleCategoryCollapse = (categoryName) => {
    const setter = activeTab === "summary" ? setCollapsedSummaryCategories : setCollapsedDetailedCategories;

    setter((prev) =>
      prev.includes(categoryName)
        ? prev.filter((value) => value !== categoryName)
        : [...prev, categoryName],
    );
  };

  const visibleCollapsedCategoryCount = useMemo(() => {
    return groupedCurrentData.filter((group) => activeCollapsedCategorySet.has(group.categoryName)).length;
  }, [activeCollapsedCategorySet, groupedCurrentData]);

  const handleToggleAllCategories = () => {
    if (groupedCurrentData.length === 0) return;

    const setter = activeTab === "summary" ? setCollapsedSummaryCategories : setCollapsedDetailedCategories;
    const visibleCategories = groupedCurrentData.map((group) => group.categoryName);

    setter((prev) => {
      const allVisibleCollapsed = visibleCategories.every((categoryName) => prev.includes(categoryName));

      if (allVisibleCollapsed) {
        return prev.filter((categoryName) => !visibleCategories.includes(categoryName));
      }

      return Array.from(new Set([...prev, ...visibleCategories]));
    });
  };

  useEffect(() => {
    setCollapsedSummaryCategories((prev) =>
      prev.filter((categoryName) =>
        summaryData.some((row) => getCategoryLabel(row) === categoryName),
      ),
    );
  }, [summaryData]);

  useEffect(() => {
    setCollapsedDetailedCategories((prev) =>
      prev.filter((categoryName) =>
        detailedData.some((row) => getCategoryLabel(row) === categoryName),
      ),
    );
  }, [detailedData]);

  useEffect(() => {
    if (storeFilter === "All") return;

    const selectedStoreStillExists = detailedData.some((row) => getStoreKey(row) === storeFilter);

    if (!selectedStoreStillExists) {
      setStoreFilter("All");
    }
  }, [detailedData, storeFilter]);

  return (
    <div className="global-tran-main-div-ui !mt-0 min-w-0 overflow-x-hidden px-2 pb-20 pt-[136px] sm:pt-[112px] md:pt-[116px] lg:pt-[120px]">
      
      {/* Floating Header */}
      <div className="fixed left-[4.5rem] right-2 top-[54px] z-[20] flex max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-lg bg-gradient-to-r from-blue-200 to-blue-100 p-2 text-blue-900 shadow-xl dark:bg-blue-900 dark:text-white sm:left-20 sm:right-4 sm:top-[62px] sm:max-w-none sm:flex-row sm:items-center sm:justify-between md:left-[17rem] md:right-4">
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="break-words px-1 text-base font-semibold leading-tight sm:px-3 sm:text-xl lg:text-2xl">
            Commissary
          </h1>
        </div>
        <div className="hidden sm:block min-w-0 text-right">
          <p className="truncate text-[10px] font-semibold text-blue-700 dark:text-blue-200 sm:text-xs">
            
          </p>
          <h1 className="truncate text-xs font-extrabold text-blue-900 dark:text-white sm:text-sm lg:text-base">
            
          </h1>
        </div>
      </div>

      {/* Query Parameters */}
      <div className="global-tran-header-div-ui !mt-0 !p-3 sm:!p-4">
        <div className="global-tran-header-tab-div-ui">
          <button className="global-tran-tab-padding-ui global-tran-tab-text_active-ui">
            Query Parameters
          </button>
        </div>

        <div className={`grid grid-cols-1 gap-1 sm:gap-2 ${activeTab === "detailed" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <FloatingField id="startDate" label="Start Date" type="date" value={startDate} onChange={setStartDate} disabled={isLoading} />
          <FloatingField id="endDate" label="End Date" type="date" value={endDate} onChange={setEndDate} disabled={isLoading} />
          <FloatingField id="category" label="Filter by Category" type="select" value={category} onChange={setCategory} disabled={isLoading}>
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.categCode || "__BLANK__"} value={cat.categCode || ""}>
                {cat.categName || cat.categCode || "Uncategorized"}
              </option>
            ))}
          </FloatingField>

          {activeTab === "detailed" && (
            <FloatingField
              id="storeFilter"
              label="Filter by Store"
              type="select"
              value={storeFilter}
              onChange={setStoreFilter}
              disabled={isLoading || detailedData.length === 0}
            >
              <option value="All">All Stores</option>
              {storeOptions.map((store) => (
                <option key={store.storeCode} value={store.storeCode}>
                  {store.storeName}
                </option>
              ))}
            </FloatingField>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Main Tab Div */}
      <div className="global-tran-tab-div-ui !p-3 sm:!p-4 lg:!p-6 mt-4">
        <div className="global-tran-tab-nav-ui !items-stretch !gap-3 sm:!items-center">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`global-tran-tab-padding-ui flex items-center gap-2 ${activeTab === "summary" ? "global-tran-tab-text_active-ui" : "rounded-lg bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-300"}`}
            >
              <LayoutList className="h-4 w-4" />
              Forecast Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("detailed")}
              className={`global-tran-tab-padding-ui flex items-center gap-2 ${activeTab === "detailed" ? "global-tran-tab-text_active-ui" : "rounded-lg bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-300"}`}
            >
              <ListTree className="h-4 w-4" />
              Forecast Detaileds
            </button>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ActionButton icon={Search} onClick={loadForecastData} disabled={isLoading}>
              {isLoading ? "Querying..." : "Run Query"}
            </ActionButton>
            <ActionButton
              icon={ChevronDown}
              onClick={handleToggleAllCategories}
              disabled={isLoading || groupedCurrentData.length === 0}
            >
              {visibleCollapsedCategoryCount === groupedCurrentData.length && groupedCurrentData.length > 0
                ? "Show Categories"
                : "Collapse Categories"}
            </ActionButton>
          </div>
        </div>

        {/* Data Table */}
        <div className="global-tran-table-main-div-ui mt-3 block max-w-full overflow-x-auto sm:mt-4">
          <div className="global-tran-table-main-sub-div-ui relative isolate !max-h-[56vh] sm:!max-h-[500px]">
            <table className="w-max min-w-full table-fixed border-separate border-spacing-0 [&_td]:border-b [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-b [&_th]:border-r [&_th]:border-slate-200 [&_tr>td:first-child]:border-l">
              <thead className="global-tran-thead-div-ui sticky top-0 z-[220]">
                <tr>
                  {activeTab === "detailed" && (
                    <th className="global-tran-th-ui sticky top-0 z-[210] w-[180px] min-w-[180px] bg-blue-100 text-left dark:bg-blue-900">Store</th>
                  )}
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[120px] min-w-[120px] bg-blue-100 text-left dark:bg-blue-900">Item Code</th>
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[260px] min-w-[260px] bg-blue-100 text-left dark:bg-blue-900">Description</th>
                  
                  {dates.map((date) => (
                    <th key={date} className="global-tran-th-ui sticky top-0 z-[210] w-[96px] min-w-[96px] max-w-[96px] bg-blue-100 text-right dark:bg-blue-900">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{dayLabel(date)}</div>
                      <div>{shortDate(date)}</div>
                    </th>
                  ))}
                  
                  <th className="global-tran-th-ui sticky top-0 z-[210] w-[100px] min-w-[100px] max-w-[100px] bg-blue-100 text-right font-bold text-blue-900 dark:bg-blue-900 dark:text-white">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={dates.length + (activeTab === "detailed" ? 4 : 3)} className="global-tran-td-ui py-10 text-center text-sm text-slate-500">
                      Loading data from confirmed store orders...
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan={dates.length + (activeTab === "detailed" ? 4 : 3)} className="global-tran-td-ui py-10 text-center text-sm text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <PackageOpen className="h-8 w-8 text-slate-400" />
                        <span>No forecast data available for this date range.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedCurrentData.map((group) => {
                    const isCollapsed = activeCollapsedCategorySet.has(group.categoryName);
                    const categoryTotal = getCategoryTotal(group.rows);
                    const colSpan = dates.length + (activeTab === "detailed" ? 4 : 3);

                    return (
                      <React.Fragment key={`${activeTab}-${group.categoryName}`}>
                        <tr className="bg-blue-50 dark:bg-blue-950/40">
                          <td colSpan={colSpan} className="global-tran-td-ui !p-0">
                            <button
                              type="button"
                              onClick={() => toggleCategoryCollapse(group.categoryName)}
                              aria-expanded={!isCollapsed}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold uppercase text-blue-900 hover:bg-blue-100 dark:text-blue-100 dark:hover:bg-blue-900/60"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                                    isCollapsed ? "-rotate-90" : "rotate-0"
                                  }`}
                                />
                                <span className="truncate">Category: {group.categoryName}</span>
                              </span>
                              <span className="shrink-0 text-right text-[11px] font-semibold normal-case text-slate-600 dark:text-slate-300">
                                {group.rows.length} item{group.rows.length === 1 ? "" : "s"} • Total {categoryTotal.toLocaleString()}
                              </span>
                            </button>
                          </td>
                        </tr>

                        {!isCollapsed &&
                          group.rows.map((row, idx) => (
                            <tr key={`${group.categoryName}-${row.storeCode || "all"}-${row.itemCode}-${idx}`} className="global-tran-tr-ui bg-white hover:bg-slate-50 dark:bg-black dark:hover:bg-gray-900/50">
                              {activeTab === "detailed" && (
                                <td className="global-tran-td-ui w-[180px] min-w-[180px] text-left font-semibold text-slate-800 dark:text-slate-200">{row.store}</td>
                              )}
                              <td className="global-tran-td-ui w-[120px] min-w-[120px] text-left font-mono text-sm text-slate-600 dark:text-slate-400">{row.itemCode}</td>
                              <td className="global-tran-td-ui w-[260px] min-w-[260px] text-left">
                                <span className="block truncate font-medium">{row.itemDesc}</span>
                                <span className="mt-0.5 block truncate text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                                  {getCategoryLabel(row)}{row.uomCode ? ` • ${row.uomCode}` : ""}
                                </span>
                              </td>

                              {dates.map((date) => (
                                <td key={date} className="global-tran-td-ui w-[96px] min-w-[96px] max-w-[96px] text-right font-medium">
                                  {row.dates[date] ? row.dates[date].toLocaleString() : "-"}
                                </td>
                              ))}

                              <td className="global-tran-td-ui w-[100px] min-w-[100px] max-w-[100px] bg-slate-50 text-right text-xs font-bold text-blue-700 dark:bg-gray-900 dark:text-blue-300">
                                {row.total.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary */}
        {!isLoading && currentData.length > 0 && (
          <div className="global-tran-tab-footer-main-div-ui !mt-4 !justify-end !gap-3">
            <div className="global-tran-tab-footer-total-main-div-ui w-full rounded-lg bg-blue-50/60 px-3 py-2 sm:w-auto dark:bg-gray-900/40">
              <div className="global-tran-tab-footer-total-div-ui">
                <label className="global-tran-tab-footer-total-label-ui">Query Total Quantity:</label>
                <label className="global-tran-tab-footer-total-value-ui">{totalQueryQty.toLocaleString()}</label>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
