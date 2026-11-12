"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

interface Inquiry {
  id: number;
  customer_name: string;
  contact_method: string;
  contact_value: string;
  subject: string;
  description: string;
  status: "New" | "In Progress" | "Resolved";
  created_at: string;
  version: number;
}

interface Staff {
  name: string;
  email: string;
}

type StatusFeedback = {
  type: "success" | "error" | "conflict" | "info";
  message: string;
};

const statusStyles: Record<Inquiry["status"], string> = {
  New: "bg-blue-50 text-blue-700 ring-blue-600/15",
  "In Progress": "bg-orange-50 text-orange-700 ring-orange-600/15",
  Resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
};

const inputStyles =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getNextStatus(
  status: Inquiry["status"],
): Inquiry["status"] | null {
  if (status === "New") return "In Progress";
  if (status === "In Progress") return "Resolved";
  return null;
}

function subscribeToStaff(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStaffSnapshot() {
  return localStorage.getItem("staff");
}

function getServerStaffSnapshot() {
  return null;
}

function parseStaffProfile(storedStaff: string | null): Staff | null {
  if (!storedStaff) return null;

  try {
    const parsed: unknown = JSON.parse(storedStaff);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof parsed.name === "string" &&
      "email" in parsed &&
      typeof parsed.email === "string"
    ) {
      return { name: parsed.name, email: parsed.email };
    }
  } catch (error) {
    console.error("Unable to read the signed-in staff profile:", error);
  }

  return null;
}

function StatusBadge({ status }: { status: Inquiry["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(
    null,
  );

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [refreshingInquiry, setRefreshingInquiry] = useState(false);

  const [statusFeedback, setStatusFeedback] =
    useState<StatusFeedback | null>(null);

  const storedStaff = useSyncExternalStore(
    subscribeToStaff,
    getStaffSnapshot,
    getServerStaffSnapshot,
  );

  const staff = useMemo(
    () => parseStaffProfile(storedStaff),
    [storedStaff],
  );

  const selectedInquiry = useMemo(
    () =>
      inquiries.find(
        (inquiry) => inquiry.id === selectedInquiryId,
      ) ?? null,
    [inquiries, selectedInquiryId],
  );

  const [customerName, setCustomerName] = useState("");
  const [contactMethod, setContactMethod] = useState("Email");
  const [contactValue, setContactValue] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchInquiries = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5001/api/inquiries",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("staff");
        router.replace("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load inquiries",
        );
      }

      setLoadError("");
      setInquiries(data.inquiries);
    } catch (error) {
      console.error("Unable to load inquiries:", error);

      setLoadError(
        error instanceof TypeError
          ? "Unable to load inquiries. Please check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchInquiries();
    });
  }, [fetchInquiries]);

  useEffect(() => {
    if (selectedInquiryId === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !updatingStatus) {
        setSelectedInquiryId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedInquiryId, updatingStatus]);

  const filteredInquiries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inquiries.filter((inquiry) => {
      const matchesSearch =
        !query ||
        inquiry.customer_name.toLowerCase().includes(query) ||
        inquiry.subject.toLowerCase().includes(query);

      const matchesStatus =
        !status || inquiry.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [inquiries, search, status]);

  const counts = useMemo(
    () => ({
      total: inquiries.length,
      new: inquiries.filter(
        (inquiry) => inquiry.status === "New",
      ).length,
      inProgress: inquiries.filter(
        (inquiry) => inquiry.status === "In Progress",
      ).length,
      resolved: inquiries.filter(
        (inquiry) => inquiry.status === "Resolved",
      ).length,
    }),
    [inquiries],
  );

  const handleCreateInquiry = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setSaving(true);
    setFormError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        "http://localhost:5001/api/inquiries",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customer_name: customerName.trim(),
            contact_method: contactMethod,
            contact_value: contactValue.trim(),
            subject: subject.trim(),
            description: description.trim(),
          }),
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("staff");
        router.replace("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create inquiry",
        );
      }

      setSuccess("Inquiry created successfully.");

      setCustomerName("");
      setContactMethod("Email");
      setContactValue("");
      setSubject("");
      setDescription("");

      setLoading(true);
      await fetchInquiries();
    } catch (error) {
      console.error("Unable to create inquiry:", error);

      setFormError(
        error instanceof TypeError
          ? "Unable to save inquiry. Please check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Unable to save inquiry. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedInquiry || updatingStatus) return;

    const nextStatus = getNextStatus(selectedInquiry.status);

    if (!nextStatus) return;

    setUpdatingStatus(true);
    setStatusFeedback(null);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        `http://localhost:5001/api/inquiries/${selectedInquiry.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: nextStatus,
            version: selectedInquiry.version,
          }),
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("staff");
        router.replace("/");
        return;
      }

      if (response.status === 409) {
        setStatusFeedback({
          type: "conflict",
          message:
            data.message ||
            "This inquiry was updated elsewhere. Refresh its latest details before trying again.",
        });

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update inquiry status",
        );
      }

      const updatedInquiry = data.inquiry as Inquiry;

      setInquiries((current) =>
        current.map((inquiry) =>
          inquiry.id === updatedInquiry.id
            ? updatedInquiry
            : inquiry,
        ),
      );

      setStatusFeedback({
        type: "success",
        message: `Status updated to ${updatedInquiry.status}.`,
      });
    } catch (error) {
      console.error("Unable to update inquiry status:", error);

      setStatusFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "Unable to update the status. Please check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Failed to update inquiry status. Please try again.",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRefreshSelectedInquiry = async () => {
    if (selectedInquiryId === null || refreshingInquiry) return;

    setRefreshingInquiry(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        "http://localhost:5001/api/inquiries/",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("staff");
        router.replace("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to refresh inquiry",
        );
      }

      const latestInquiry = (
        data.inquiries as Inquiry[]
      ).find(
        (inquiry) => inquiry.id === selectedInquiryId,
      );

      if (!latestInquiry) {
        throw new Error(
          "This inquiry could not be found in the latest results.",
        );
      }

      setInquiries(data.inquiries);

      setStatusFeedback({
        type: "info",
        message:
          "Latest inquiry details loaded. Review the current status before continuing.",
      });
    } catch (error) {
      console.error("Unable to refresh inquiry:", error);

      setStatusFeedback({
        type: "error",
        message:
          error instanceof TypeError
            ? "Unable to refresh inquiry. Please check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Failed to refresh inquiry. Please try again.",
      });
    } finally {
      setRefreshingInquiry(false);
    }
  };

  const openInquiryDetails = (inquiryId: number) => {
    setStatusFeedback(null);
    setSelectedInquiryId(inquiryId);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("staff");
    router.replace("/");
  };

  const firstName =
    staff?.name.trim().split(/\s+/)[0] || "there";

  return (
        <main className="min-h-screen bg-[#f4f6fa] text-slate-900">
      <div className="min-h-screen md:flex">
        <aside className="flex w-full flex-col bg-[#101c36] text-white md:sticky md:top-0 md:h-screen md:w-[264px] md:shrink-0">
          <a
            href="#overview"
            className="flex items-center gap-3 px-5 py-5 md:px-7 md:py-7"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-950/30">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v8.5A1.75 1.75 0 0 1 18.25 16H11l-5 4v-4.1a1.75 1.75 0 0 1-2-1.65v-8.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 9h8M8 12.5h5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide">
                INQUIRY DESK
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                Customer support
              </span>
            </span>
          </a>

          <div className="hidden px-7 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 md:block">
            Workspace
          </div>

          <nav
            aria-label="Main navigation"
            className="flex gap-2 overflow-x-auto px-4 pb-4 md:block md:space-y-1 md:px-4 md:pb-0"
          >
            <a
              href="#overview"
              className="flex shrink-0 items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/10"
            >
              Overview
            </a>
            <a
              href="#inquiries"
              className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Inquiry queue
            </a>
            <a
              href="#create-inquiry"
              className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              + Create inquiry
            </a>
          </nav>

          <div className="mt-auto hidden border-t border-white/10 p-5 md:block md:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
                {staff ? getInitials(staff.name) : "SD"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {staff?.name || "Support desk"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {staff?.email || "Customer support"}
                </span>
              </span>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div
            id="overview"
            className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pt-9"
          >
            <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-blue-700">
                  Welcome back, {firstName}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-[#17243b] sm:text-[2rem]">
                  Inquiry dashboard
                </h1>
                <p className="mt-2 text-base text-slate-500">
                  A clear view of your customer conversations and team workload.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </header>

            <section
              aria-label="Inquiry summary"
              className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {[
                { label: "Total inquiries", value: counts.total },
                { label: "New", value: counts.new },
                { label: "In progress", value: counts.inProgress },
                { label: "Resolved", value: counts.resolved },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
                >
                  <p className="text-sm font-semibold text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-[#17243b]">
                    {loading ? "—" : item.value}
                  </p>
                </article>
              ))}
            </section>

            <section
              id="create-inquiry"
              className="mb-8 scroll-mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                <h2 className="text-lg font-bold text-[#17243b]">
                  Create an inquiry
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Capture a customer request and add it to your queue.
                </p>
              </div>

              <form
                onSubmit={handleCreateInquiry}
                className="grid gap-x-6 gap-y-5 px-5 py-6 sm:grid-cols-2 sm:px-7"
              >
                <div>
                  <label htmlFor="customer-name" className="mb-2 block text-sm font-semibold text-slate-700">
                    Customer name *
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Enter customer name"
                    required
                    maxLength={100}
                    className={inputStyles}
                  />
                </div>

                <div>
                  <label htmlFor="contact-method" className="mb-2 block text-sm font-semibold text-slate-700">
                    Preferred contact *
                  </label>
                  <select
                    id="contact-method"
                    value={contactMethod}
                    onChange={(event) => setContactMethod(event.target.value)}
                    className={inputStyles}
                  >
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-value" className="mb-2 block text-sm font-semibold text-slate-700">
                    {contactMethod === "Email" ? "Email address" : "Phone number"} *
                  </label>
                  <input
                    id="contact-value"
                    type={contactMethod === "Email" ? "email" : "tel"}
                    autoComplete={contactMethod === "Email" ? "email" : "tel"}
                    value={contactValue}
                    onChange={(event) => setContactValue(event.target.value)}
                    placeholder={
                      contactMethod === "Email"
                        ? "customer@example.com"
                        : "Enter phone number"
                    }
                    required
                    maxLength={150}
                    className={inputStyles}
                  />
                </div>

                <div>
                  <label htmlFor="inquiry-subject" className="mb-2 block text-sm font-semibold text-slate-700">
                    Subject *
                  </label>
                  <input
                    id="inquiry-subject"
                    type="text"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="What can we help with?"
                    required
                    maxLength={200}
                    className={inputStyles}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="inquiry-description" className="mb-2 block text-sm font-semibold text-slate-700">
                    Description *
                  </label>
                  <textarea
                    id="inquiry-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add the details the support team needs to know..."
                    required
                    rows={4}
                    className={`${inputStyles} min-h-32 resize-y`}
                  />
                </div>

                {(formError || success) && (
                  <div
                    role={formError ? "alert" : "status"}
                    className={`rounded-xl px-4 py-3 text-sm font-medium sm:col-span-2 ${
                      formError
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {formError || success}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 sm:col-span-2">
                  <p className="text-xs text-slate-500">
                    Fields marked with * are required.
                  </p>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Creating inquiry..." : "Create inquiry"}
                  </button>
                </div>
              </form>
            </section>

            <section id="inquiries" className="scroll-mt-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#17243b]">
                    Inquiry queue
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Search and review every customer conversation.
                  </p>
                </div>

                {!loading && !loadError && (
                  <p className="text-sm font-medium text-slate-500">
                    Showing{" "}
                    <strong className="text-slate-800">
                      {filteredInquiries.length}
                    </strong>{" "}
                    of {inquiries.length}
                  </p>
                )}
              </div>

              <div className="mb-5 grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
                <label className="relative block">
                  <span className="sr-only">Search inquiries</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer or subject"
                    className={inputStyles}
                  />
                </label>

                <label className="relative block">
                  <span className="sr-only">Filter by status</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={inputStyles}
                  >
                    <option value="">All statuses</option>
                    <option value="New">New</option>
                    <option value="In Progress">In progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </label>
              </div>

              {loading && (
                <div
                  role="status"
                  className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm font-medium text-slate-500 shadow-sm"
                >
                  Loading inquiries...
                </div>
              )}

              {!loading && loadError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800"
                >
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      void fetchInquiries();
                    }}
                    className="rounded-lg bg-white px-4 py-2 font-semibold text-red-700 shadow-sm ring-1 ring-red-200"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!loading && !loadError && filteredInquiries.length === 0 && (
                <div className="rounded-2xl border border-slate-100 bg-white px-6 py-14 text-center shadow-sm">
                  <h3 className="text-base font-bold text-slate-800">
                    No inquiries found
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {inquiries.length === 0
                      ? "New customer requests will appear here."
                      : "Try adjusting your search or status filter."}
                  </p>
                </div>
              )}

              {!loading && !loadError && filteredInquiries.length > 0 && (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left">
                        <thead className="bg-slate-50/80">
                          <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Inquiry</th>
                            <th className="px-6 py-4">Contact</th>
                            <th className="px-6 py-4">Created</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredInquiries.map((inquiry) => (
                            <tr key={inquiry.id} className="transition hover:bg-slate-50/70">
                              <td className="whitespace-nowrap px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                                    {getInitials(inquiry.customer_name)}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-800">
                                    {inquiry.customer_name}
                                  </span>
                                </div>
                              </td>

                              <td className="max-w-[360px] px-6 py-5">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {inquiry.subject}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                  {inquiry.description}
                                </p>
                              </td>

                              <td className="whitespace-nowrap px-6 py-5">
                                <p className="text-sm text-slate-700">
                                  {inquiry.contact_value}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {inquiry.contact_method}
                                </p>
                              </td>

                              <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-600">
                                {new Date(inquiry.created_at).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </td>

                              <td className="whitespace-nowrap px-6 py-5">
                                <StatusBadge status={inquiry.status} />
                              </td>

                              <td className="whitespace-nowrap px-6 py-5 text-right">
                                <button
                                  type="button"
                                  onClick={() => openInquiryDetails(inquiry.id)}
                                  className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                                >
                                  View details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {filteredInquiries.map((inquiry) => (
                      <article
                        key={inquiry.id}
                        className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                              {getInitials(inquiry.customer_name)}
                            </span>
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {inquiry.customer_name}
                            </p>
                          </div>
                          <StatusBadge status={inquiry.status} />
                        </div>

                        <h3 className="mt-4 text-base font-bold text-[#17243b]">
                          {inquiry.subject}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {inquiry.description}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                          <span>
                            {inquiry.contact_method}: {inquiry.contact_value}
                          </span>
                          <time dateTime={inquiry.created_at}>
                            {new Date(inquiry.created_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </time>
                        </div>

                        <button
                          type="button"
                          onClick={() => openInquiryDetails(inquiry.id)}
                          className="mt-4 w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          View details
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {selectedInquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !updatingStatus) {
              setSelectedInquiryId(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="inquiry-details-title"
            className="max-h-[min(90vh,850px)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl shadow-slate-950/25"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                  Inquiry #{selectedInquiry.id}
                </p>
                <h2
                  id="inquiry-details-title"
                  className="mt-2 text-xl font-bold tracking-tight text-[#17243b] sm:text-2xl"
                >
                  Inquiry details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review the customer request and update its status.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close inquiry details"
                onClick={() => setSelectedInquiryId(null)}
                disabled={updatingStatus}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                ✕
              </button>
            </header>

            <div className="space-y-6 px-5 py-6 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                    {getInitials(selectedInquiry.customer_name)}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Customer
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-800">
                      {selectedInquiry.customer_name}
                    </p>
                  </div>
                </div>
                <StatusBadge status={selectedInquiry.status} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Subject
                </p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-[#17243b]">
                  {selectedInquiry.subject}
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact method
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {selectedInquiry.contact_method}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact value
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-slate-800">
                    {selectedInquiry.contact_value}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedInquiry.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-slate-600">
                  Created
                </p>
                <time
                  dateTime={selectedInquiry.created_at}
                  className="text-sm text-slate-700"
                >
                  {new Date(selectedInquiry.created_at).toLocaleString(
                    undefined,
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                    },
                  )}
                </time>
              </div>

              {statusFeedback && (
                <div
                  role={
                    statusFeedback.type === "error" ||
                    statusFeedback.type === "conflict"
                      ? "alert"
                      : "status"
                  }
                  className={`rounded-xl px-4 py-3 text-sm leading-6 ${
                    statusFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800"
                      : statusFeedback.type === "conflict" ||
                          statusFeedback.type === "error"
                        ? "bg-red-50 text-red-800"
                        : "bg-blue-50 text-blue-800"
                  }`}
                >
                  <p>{statusFeedback.message}</p>

                  {statusFeedback.type === "conflict" && (
                    <button
                      type="button"
                      onClick={() => void handleRefreshSelectedInquiry()}
                      disabled={refreshingInquiry}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-800 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-60"
                    >
                      {refreshingInquiry
                        ? "Refreshing..."
                        : "Refresh latest inquiry"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-7">
              {getNextStatus(selectedInquiry.status) ? (
                <>
                  <p className="text-xs text-slate-500">
                    Next status:{" "}
                    <span className="font-semibold text-slate-700">
                      {getNextStatus(selectedInquiry.status)}
                    </span>
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleStatusUpdate()}
                    disabled={updatingStatus || refreshingInquiry}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingStatus
                      ? "Updating status..."
                      : `Move to ${getNextStatus(selectedInquiry.status)}`}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">
                    This inquiry is resolved. No further status changes are available.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSelectedInquiryId(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Close
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}