import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Truck,
  X,
} from "lucide-react";
import { fetchData, postRequest } from "./api";

const RECEIVING_ENDPOINT = "store-portal/received-items";

const formatDate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getValue = (row, keys, fallback = "") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const asText = (value) => String(value ?? "").trim();
const asNumber = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const asBoolean = (value) =>
  value === true ||
  value === 1 ||
  ["1", "true", "yes", "y", "closed", "force closed", "forceclosed"].includes(
    asText(value).toLowerCase(),
  );
const unwrapRows = (response) => {
  let source = response?.data ?? response?.Data ?? response?.result ?? response?.RESULT ?? [];

  if (Array.isArray(source) && source.length === 1) {
    const nested = source[0]?.result ?? source[0]?.RESULT;
    if (typeof nested === "string") source = nested;
  }

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source) && Array.isArray(source?.details)) return source.details;
  return Array.isArray(source) ? source : [];
};

const normalizeRow = (row, index, orderDate) => {
  const orderedQty = asNumber(
    getValue(row, ["orderedQty", "orderQty", "ORDER_QTY", "qty", "QTY"]),
  );
  const previouslyReceivedQty = asNumber(
    getValue(row, [
      "previouslyReceivedQty",
      "receivedToDate",
      "totalReceivedQty",
      "RECEIVED_QTY",
    ]),
  );
  const remainingQty = Math.max(0, orderedQty - previouslyReceivedQty);
  const isClosed = asBoolean(
    getValue(row, ["forceClose", "forceClosed", "isClosed", "closed", "status"]),
  );

  return {
    lineId: asText(getValue(row, ["lineId", "detailId", "id", "ID"], index)),
    orderNo: asText(getValue(row, ["orderNo", "ORDER_NO", "referenceNo", "docNo"])),
    sourceOrderNo: asText(
      getValue(row, ["sourceOrderNo", "storeOrderNo", "STORE_ORDER_NO"]),
    ),
    orderSource: asText(
      getValue(row, ["orderSource", "sourceType", "ORDER_SOURCE"], "Confirmed"),
    ),
    orderDate: formatDate(getValue(row, ["orderDate", "ORDER_DATE"], orderDate)),
    itemCode: asText(getValue(row, ["itemCode", "ITEM_CODE", "item_code"])),
    itemName: asText(
      getValue(row, ["itemName", "itemDesc", "ITEM_DESC", "description"], "Unnamed item"),
    ),
    category: asText(
      getValue(row, ["category", "categoryName", "categName", "CATEG_NAME"], "Uncategorized"),
    ),
    uomCode: asText(getValue(row, ["uomCode", "UOM_CODE", "uom"], "EA")),
    orderedQty,
    previouslyReceivedQty,
    receivedQty: "",
    forceClose: false,
    isForceClosed: isClosed && remainingQty > 0,
    // A saved partial receipt is history, not an editable value. Keep the
    // order line open for a new receipt until its full quantity is received.
    isComplete: remainingQty <= 0 || isClosed,
  };
};

const userRecord = (user) => {
  const source = user?.user ?? user?.data ?? user;
  return Array.isArray(source) ? source[0] || {} : source || {};
};

const getUserContext = (user) => {
  const row = userRecord(user);
  return {
    userCode: asText(
      getValue(row, [
        "userCode",
        "USER_CODE",
        "user_code",
        "usercode",
        "USERCODE",
        "UserCode",
        "userId",
        "USER_ID",
        "username",
      ]),
    ),
    storeCode: asText(
      getValue(row, [
        "branchCode",
        "BRANCH_CODE",
        "branch_code",
        "branchcode",
        "BRANCHCODE",
        "storeCode",
        "STORE_CODE",
      ]),
    ),
  };
};

const FloatingField = ({ id, label, className = "", children, ...props }) => (
  <div className={`relative ${className}`}>
    {children ? (
      <select id={id} className="peer global-tran-textbox-ui" {...props}>
        {children}
      </select>
    ) : (
      <input id={id} className="peer global-tran-textbox-ui" {...props} />
    )}
    <label htmlFor={id} className="global-tran-floating-label !left-3 px-1">
      {label}
    </label>
  </div>
);

const ActionButton = ({ icon: Icon, tone = "blue", children, ...props }) => {
  const tones = {
    blue: "border-blue-700 bg-blue-700 text-white hover:bg-blue-800",
    green: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800",
    neutral: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  };

  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-extrabold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
};

const QuantityInput = ({ value, max, onChange, disabled, label }) => (
  <input
    type="number"
    min="0"
    max={Math.max(0, max)}
    step="1"
    inputMode="numeric"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    disabled={disabled}
    aria-label={label}
    placeholder="0"
    title={max > 0 ? `${max.toLocaleString()} remaining on the order` : "Order already fully received"}
    className="h-9 w-full min-w-[86px] rounded-md border border-blue-300 bg-white px-2 text-right text-sm font-bold text-blue-900 outline-none transition placeholder:text-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
  />
);

const StatusBadge = ({ remaining, receivedBefore = 0, receivedNow = 0 }) => {
  if (remaining < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">
        <AlertTriangle className="h-3 w-3" /> Over
      </span>
    );
  }
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> Complete
      </span>
    );
  }
  if (receivedBefore > 0 || receivedNow > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-800">
        <Truck className="h-3 w-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">
      <PackageOpen className="h-3 w-3" /> Open
    </span>
  );
};

const StatusSelect = ({ row, remaining, onChange, disabled }) => {
  if (row.isForceClosed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-800">
        <CheckCircle2 className="h-3 w-3" /> Closed 
      </span>
    );
  }

  if (row.isComplete) {
    return <StatusBadge remaining={0} />;
  }

  const currentLabel =
    row.previouslyReceivedQty > 0 || asNumber(row.receivedQty) > 0 ? "Partial / Open" : "Open";

  return (
    <select
      value={row.forceClose ? "force-close" : "open"}
      onChange={(event) => onChange(row.lineId, event.target.value)}
      disabled={disabled}
      aria-label={`Status for ${row.itemName}`}
      className={`h-9 w-full min-w-[120px] rounded-md border px-2 text-xs font-extrabold outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        row.forceClose
          ? "border-violet-300 bg-violet-50 text-violet-800 focus:border-violet-500 focus:ring-violet-100"
          : "border-slate-300 bg-white text-slate-700 focus:border-blue-500 focus:ring-blue-100"
      }`}
    >
      <option value="open">{currentLabel}</option>
      {remaining > 0 && <option value="force-close"> Close </option>}
    </select>
  );
};

const Toast = ({ toast, onClose }) =>
  toast ? (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={`mb-3 flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-sm sm:mb-4 ${
        toast.type === "error"
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-900"
      }`}
    >
      {toast.type === "error" ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wide">
          {toast.type === "error" ? "Validation Error" : "Success"}
        </p>
        <p className="mt-0.5 break-words text-sm font-semibold leading-5">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-current opacity-70 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : null;

export default function ReceivedItem({ user }) {
  const { userCode, storeCode } = useMemo(() => getUserContext(user), [user]);
  const [orderDate, setOrderDate] = useState(formatDate());
  const [receivedDate, setReceivedDate] = useState(formatDate());
  const [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loadedRows, setLoadedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [toast, setToast] = useState(null);
  const requestIdRef = useRef(0);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadOrder = useCallback(async () => {
    if (!storeCode) {
      showToast("No store or branch is tagged to the logged-in user.", "error");
      return;
    }
    if (!orderDate) {
      showToast("Select an order date first.", "error");
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    try {
      const response = await fetchData(RECEIVING_ENDPOINT, { storeCode, orderDate });
      if (requestIdRef.current !== requestId) return;
      const nextRows = unwrapRows(response)
        .map((row, index) => normalizeRow(row, index, orderDate))
        .filter((row) => row.itemCode && row.orderedQty > 0);
      setRows(nextRows);
      setLoadedRows(nextRows.map((row) => ({ ...row })));
      if (nextRows.length === 0) showToast("No ordered items found for this order date.", "error");
    } catch (error) {
      console.error("Failed to load ordered items for receiving:", error);
      setRows([]);
      setLoadedRows([]);
      showToast(
        error?.response?.data?.message || error?.message || "Unable to load ordered items.",
        "error",
      );
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [orderDate, showToast, storeCode]);

  useEffect(() => {
    requestIdRef.current += 1;
    setRows([]);
    setLoadedRows([]);
    setShowSaveConfirmation(false);
  }, [orderDate, storeCode]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.orderNo} ${row.sourceOrderNo} ${row.orderSource} ${row.itemCode} ${row.itemName} ${row.category} ${row.uomCode}`
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, search]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => {
          const receivedNow = asNumber(row.receivedQty);
          result.ordered += row.orderedQty;
          result.previous += row.previouslyReceivedQty;
          result.now += receivedNow;
          result.remaining += row.orderedQty - row.previouslyReceivedQty - receivedNow;
          return result;
        },
        { ordered: 0, previous: 0, now: 0, remaining: 0 },
      ),
    [rows],
  );

  const detailsToSave = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            !row.isComplete && (asNumber(row.receivedQty) > 0 || row.forceClose),
        )
        .map((row) => ({
          lineId: row.lineId,
          orderNo: row.orderNo,
          itemCode: row.itemCode,
          uomCode: row.uomCode,
          orderedQty: row.orderedQty,
          previouslyReceivedQty: row.previouslyReceivedQty,
          receivedQty: asNumber(row.receivedQty),
          forceClose: Boolean(row.forceClose),
          status: row.forceClose ? "CLOSED" : "OPEN",
        })),
    [rows],
  );

  const hasEditableRows = useMemo(
    () => rows.some((row) => !row.isComplete && row.orderedQty > row.previouslyReceivedQty),
    [rows],
  );

  const handleQuantityChange = (lineId, value) => {
    if (value !== "" && asNumber(value) < 0) return;
    setRows((current) =>
      current.map((row) =>
        row.lineId === lineId && !row.isComplete ? { ...row, receivedQty: value } : row,
      ),
    );
  };

  const handleStatusChange = (lineId, value) => {
    const shouldForceClose = value === "force-close";
    setRows((current) =>
      current.map((row) =>
        row.lineId === lineId && !row.isComplete
          ? {
              ...row,
              forceClose: shouldForceClose,
              // Force Close records an undeliverable balance, not a receipt.
              receivedQty: shouldForceClose ? "0" : "",
            }
          : row,
      ),
    );
  };

  const receiveAllRemaining = () => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        receivedQty: row.isComplete
          ? ""
          : String(Math.max(0, row.orderedQty - row.previouslyReceivedQty)),
        forceClose: false,
      })),
    );
  };

  const resetEntry = () => {
    setRows(loadedRows.map((row) => ({ ...row })));
    setRemarks("");
  };

  const validateReceipt = () => {
    if (!storeCode) return "No HO/branch is tagged to the logged-in user account.";
    if (!userCode) return "The logged-in User Code is required before saving.";
    if (!orderDate) return "Select an order date first.";
    if (!receivedDate) return "Select a received date first.";
    if (rows.length === 0) return "Load the ordered items before saving.";
    if (!detailsToSave.length) {
      return "Enter a received quantity or select Force Close for at least one item.";
    }

    const missingLine = detailsToSave.find(
      (detail) => !detail.lineId || !Number.isInteger(Number(detail.lineId)) || Number(detail.lineId) <= 0,
    );
    if (missingLine) return "One or more item lines have an invalid Store Order Detail ID.";

    const invalidForceClose = detailsToSave.find(
      (detail) => detail.forceClose && detail.receivedQty !== 0,
    );
    if (invalidForceClose) {
      return `Force Close quantity must be 0 for ${invalidForceClose.itemCode}.`;
    }

    const overReceived = rows.find(
      (row) =>
        !row.isComplete &&
        asNumber(row.receivedQty) > row.orderedQty - row.previouslyReceivedQty,
    );
    if (overReceived) {
      return `Received quantity cannot exceed the remaining balance for ${overReceived.itemCode}.`;
    }

    return "";
  };

  const requestSave = () => {
    const validationMessage = validateReceipt();
    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }
    setShowSaveConfirmation(true);
  };

  const submitReceipt = async () => {
    if (submitting) return;

    const validationMessage = validateReceipt();
    if (validationMessage) {
      setShowSaveConfirmation(false);
      showToast(validationMessage, "error");
      return;
    }

    setSubmitting(true);
    try {
      const response = await postRequest(RECEIVING_ENDPOINT, {
        userCode,
        storeCode,
        orderDate,
        receivedDate,
        remarks: remarks.trim(),
        details: detailsToSave,
      });
      showToast(response?.message || "Received items saved successfully.");
      await loadOrder();
      setRemarks("");
      setShowSaveConfirmation(false);
    } catch (error) {
      console.error("Failed to save received items:", error);
      showToast(
        error?.response?.data?.message || error?.message || "Unable to save received items.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || submitting;
  const forceCloseCount = detailsToSave.filter((detail) => detail.forceClose).length;

  return (
    <div className="global-tran-main-div-ui !mt-0 min-w-0 overflow-x-hidden px-2 pb-20 pt-[70px] sm:px-3 sm:pt-[74px] lg:px-4">
      {showSaveConfirmation &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="received-item-save-title"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4"
          >
            <div className="w-full max-w-md overflow-hidden rounded-lg border border-blue-200 bg-white shadow-2xl">
              <div className="flex items-center gap-3 bg-blue-700 px-5 py-3 text-white">
                <PackageCheck className="h-5 w-5 shrink-0" />
                <h2 id="received-item-save-title" className="text-base font-extrabold">
                  Save Received Items
                </h2>
              </div>

              <div className="px-5 py-5">
                <p className="text-sm leading-6 text-slate-700">
                  Are you sure you want to save the received quantity of{" "}
                  <b className="text-slate-900">{totals.now.toLocaleString()}</b> for the order
                  dated <b className="text-slate-900">{orderDate}</b>?
                </p>

                {forceCloseCount > 0 && (
                  <p className="mt-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">
                    {forceCloseCount} item{forceCloseCount === 1 ? "" : "s"} will be closed as not deliverable with a received quantity of 0.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setShowSaveConfirmation(false)}
                  disabled={submitting}
                  className="inline-flex min-h-9 min-w-20 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={submitReceipt}
                  disabled={submitting}
                  className="inline-flex min-h-9 min-w-20 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {submitting ? "Saving..." : "Yes"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="relative z-[1] mb-3 flex w-full items-center rounded-lg border border-blue-200 bg-blue-100 px-4 py-3 text-blue-900 shadow-md sm:mb-4 sm:px-5">
        <div>
          <h1 className="text-base font-extrabold leading-tight tracking-wide sm:text-xl lg:text-2xl">
            Received Item
          </h1>

        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="global-tran-header-div-ui !mt-0 !p-3 sm:!p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
          <ClipboardCheck className="h-4 w-4 text-blue-700" /> Receiving Information
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FloatingField id="receivingStore" label="Store" value={storeCode || "No HO/branch tagged"} readOnly />
          <FloatingField id="receivingStoreCode" label="Store Code" value={storeCode} readOnly />
          <FloatingField id="receivingOrderDate" label="Order Date" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} disabled={busy} />
          <FloatingField id="receivingDate" label="Received Date" type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} disabled={busy} />
          <ActionButton icon={loading ? RefreshCw : Search} onClick={loadOrder} disabled={busy || !storeCode}>
            {loading ? "Loading Order..." : "Load Ordered Items"}
          </ActionButton>
        </div>
      </div>

      <div className="global-tran-tab-div-ui !p-3 sm:!p-4 lg:!p-5">
        <div className="global-tran-tab-nav-ui !items-stretch">
          <div className="flex items-center gap-2">
            <span className="global-tran-tab-padding-ui global-tran-tab-text_active-ui">
              <PackageOpen className="h-4 w-4" /> Order Items
            </span>
            <span className="text-xs font-bold text-slate-500">{rows.length} line{rows.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-1000" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or order no." className="h-10 w-full rounded-lg border border-slate-400 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 sm:w-100" />
            </div>
            <ActionButton icon={CheckCircle2} tone="neutral" onClick={receiveAllRemaining} disabled={busy || !hasEditableRows}>
              Receive All Balance
            </ActionButton>
            <ActionButton icon={Save} tone="neutral" onClick={requestSave} disabled={busy}>
              Save
            </ActionButton>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {filteredRows.map((row) => {
            const balance = row.orderedQty - row.previouslyReceivedQty;
            const receivedNow = asNumber(row.receivedQty);
            const remaining = balance - receivedNow;
            return (
              <article key={row.lineId} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold text-blue-700">{row.itemCode}</p>
                    <h2 className="truncate text-sm font-extrabold text-slate-800">{row.itemName}</h2>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">{row.category} · {row.uomCode}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">DR {row.orderNo || "—"} · {row.orderSource}</p>
                  </div>
                  <StatusBadge
                    remaining={remaining}
                    receivedBefore={row.previouslyReceivedQty}
                    receivedNow={receivedNow}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-slate-50 p-2"><span className="block text-[9px] font-bold uppercase text-slate-400">Ordered</span><b>{row.orderedQty.toLocaleString()}</b></div>
                  <div className="rounded bg-slate-50 p-2"><span className="block text-[9px] font-bold uppercase text-slate-400">Previous</span><b>{row.previouslyReceivedQty.toLocaleString()}</b></div>
                  <div className={`rounded p-2 ${remaining < 0 ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}><span className="block text-[9px] font-bold uppercase">Balance</span><b>{remaining.toLocaleString()}</b></div>
                </div>
                <label className="mt-3 block text-[10px] font-black uppercase text-slate-500">Received Now</label>
                <QuantityInput value={row.receivedQty} max={balance} disabled={busy || row.isComplete || row.forceClose || balance <= 0} label={`New delivery quantity for ${row.itemName}`} onChange={(value) => handleQuantityChange(row.lineId, value)} />
                <label className="mt-3 block text-[10px] font-black uppercase text-slate-500">Status</label>
                <StatusSelect row={row} remaining={remaining} onChange={handleStatusChange} disabled={busy} />
              </article>
            );
          })}
        </div>

        <div className="global-tran-table-main-div-ui mt-4 hidden max-w-full overflow-x-auto md:block">
          <div className="global-tran-table-main-sub-div-ui relative isolate !max-h-[52vh]">
            <table className="w-max min-w-full table-fixed border-separate border-spacing-0 [&_td]:border-b [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-b [&_th]:border-r [&_th]:border-slate-200">
              <thead className="global-tran-thead-div-ui sticky top-0 z-[220]">
                <tr>
                  <th className="global-tran-th-ui w-[110px] text-left">DR No.</th>
                  <th className="global-tran-th-ui w-[115px] text-left">Order Source</th>
                  <th className="global-tran-th-ui w-[110px] text-left">Item Code</th>
                  <th className="global-tran-th-ui w-[260px] text-left">Description</th>
                  <th className="global-tran-th-ui w-[110px] text-left">Category</th>
                  <th className="global-tran-th-ui w-[65px] text-center">UOM</th>
                  <th className="global-tran-th-ui w-[90px] text-right">Ordered</th>
                  <th className="global-tran-th-ui w-[100px] text-right">Previously Received</th>
                  <th className="global-tran-th-ui w-[110px] text-right">Received Now</th>
                  <th className="global-tran-th-ui w-[90px] text-right">Balance</th>
                  <th className="global-tran-th-ui w-[140px] text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const balance = row.orderedQty - row.previouslyReceivedQty;
                  const receivedNow = asNumber(row.receivedQty);
                  const remaining = balance - receivedNow;
                  return (
                    <tr key={row.lineId} className="global-tran-tr-ui">
                      <td className="global-tran-td-ui font-mono font-semibold">{row.orderNo || "—"}</td>
                      <td className="global-tran-td-ui font-semibold">{row.orderSource}</td>
                      <td className="global-tran-td-ui font-mono font-semibold text-blue-700">{row.itemCode}</td>
                      <td className="global-tran-td-ui font-semibold">{row.itemName}</td>
                      <td className="global-tran-td-ui">{row.category}</td>
                      <td className="global-tran-td-ui text-center font-bold">{row.uomCode}</td>
                      <td className="global-tran-td-ui text-right font-bold">{row.orderedQty.toLocaleString()}</td>
                      <td className="global-tran-td-ui text-right">{row.previouslyReceivedQty.toLocaleString()}</td>
                      <td className="global-tran-td-ui text-right"><QuantityInput value={row.receivedQty} max={balance} disabled={busy || row.isComplete || row.forceClose || balance <= 0} label={`New delivery quantity for ${row.itemName}`} onChange={(value) => handleQuantityChange(row.lineId, value)} /></td>
                      <td className={`global-tran-td-ui text-right font-black ${remaining < 0 ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{remaining.toLocaleString()}</td>
                      <td className="global-tran-td-ui text-center"><StatusSelect row={row} remaining={remaining} onChange={handleStatusChange} disabled={busy} /></td>
                    </tr>
                  );
                })}
                {!loading && filteredRows.length === 0 && (
                  <tr><td colSpan="11" className="global-tran-td-ui py-12 text-center text-sm text-slate-500"><PackageOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />{rows.length ? "No items match your search." : "Select an order date, then load the ordered items."}</td></tr>
                )}
                {loading && <tr><td colSpan="11" className="global-tran-td-ui py-12 text-center text-sm font-semibold text-blue-700">Loading confirmed and supplementary items...</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end">
          <FloatingField id="receivingRemarks" label="Remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional delivery note or variance reason" disabled={busy} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionButton icon={RotateCcw} tone="neutral" onClick={resetEntry} disabled={busy || rows.length === 0}>Reset</ActionButton>
            <ActionButton icon={Save} tone="neutral" onClick={requestSave} disabled={busy}>Save Received Items</ActionButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Ordered", totals.ordered, "text-slate-800"],
            ["Received Before", totals.previous, "text-slate-800"],
            ["Received Now", totals.now, "text-emerald-700"],
            ["Balance After", totals.remaining, totals.remaining < 0 ? "text-amber-700" : "text-blue-700"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
              <p className={`text-lg font-black ${color}`}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
