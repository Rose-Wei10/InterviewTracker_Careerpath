import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";
import { invalidateUserQueries } from "../services/queryCache";
import GmailLabelGuide from "../components/GmailLabelGuide";
import EventForm from "../components/events/EventForm";
import type { Application, Page, Status } from "../types";

type EmailItem = {
  id: string;
  account: string;
  threadId: string;
  sender: string;
  subject: string;
  receivedAt: string;
  category: string;
  applicationId: string | null;
};

type Inbox = {
  connection: { account: string; lastSyncedAt: string | null } | null;
  pending: number;
  items: EmailItem[];
};

const suggestedStatuses: Record<string, Status | undefined> = {
  OA: "OA",
  Interview: "Interview",
  Rejection: "Reject",
  Offer: "Offer",
};

export default function EmailUpdates() {
  const api = useApi();
  const qc = useQueryClient();
  const key = ["email-updates", api.userId];
  const inbox = useQuery({
    queryKey: key,
    queryFn: () => api.get<Inbox>("/email-updates"),
  });
  const [callback, setCallback] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      code: params.get("code"),
      state: params.get("state"),
      denied: params.has("error"),
    };
  });
  const [syncResult, setSyncResult] = useState("");
  const [item, setItem] = useState<EmailItem>();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [statusChange, setStatusChange] = useState(false);
  const [event, setEvent] = useState<{
    application: Application;
    category: "OA" | "Interview";
  }>();
  const applications = useQuery({
    queryKey: ["email-applications", api.userId, search],
    enabled: Boolean(item),
    queryFn: () =>
      api.get<Page<Application>>("/applications", { search, pageSize: 10 }),
  });
  const application = useQuery({
    queryKey: ["email-application", api.userId, selected],
    enabled: Boolean(selected),
    queryFn: () =>
      api.get<Application>(`/applications/${encodeURIComponent(selected)}`),
  });
  const action = useMutation({
    mutationFn: async (
      operation:
        | "connect"
        | "callback"
        | "disconnect"
        | "sync"
        | "dismiss"
        | "link"
        | "schedule",
    ) => {
      if (operation === "connect") {
        location.assign(
          (await api.post<{ url: string }>("/email-updates/connect", {})).url,
        );
      } else if (operation === "callback") {
        await api.post("/email-updates/callback", callback);
        history.replaceState(history.state, "", location.pathname);
        setCallback({ code: null, state: null, denied: false });
      } else if (operation === "disconnect") {
        await api.remove("/email-updates/connection");
        setSyncResult("");
      } else if (operation === "sync") {
        const { imported, hasMore } = await api.post<{
          imported: number;
          hasMore: boolean;
        }>("/email-updates/sync", {});
        setSyncResult(
          `Imported ${imported} new messages.${hasMore ? " Sync again for more." : ""}`,
        );
      } else if (item) {
        const chosen = application.data;
        const status = suggestedStatuses[item.category];
        await api.patch(
          `/email-updates/${item.id}`,
          operation === "dismiss"
            ? { action: "dismiss" }
            : {
                action: "link",
                applicationId: chosen?.id,
                statusChange:
                  statusChange && status
                    ? { from: chosen?.status, to: status }
                    : undefined,
              },
        );
        if (
          operation === "schedule" &&
          chosen &&
          (item.category === "OA" || item.category === "Interview")
        )
          setEvent({ application: chosen, category: item.category });
        setItem(undefined);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({
        queryKey: ["email-update-count", api.userId],
      });
      await invalidateUserQueries(qc, api.userId, [
        "dashboard",
        "applications",
        "application",
      ]);
    },
    onError: () => {
      setStatusChange(false);
      if (selected) void application.refetch();
    },
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Email updates</h1>
          <p>Review recruiting messages labeled Careerpath in Gmail.</p>
        </div>
        <Link to="/dashboard">Back to Overview</Link>
      </div>
      <section className="card">
        <p>
          Google grants read-only mailbox access. Careerpath syncs only the
          Careerpath label and stores sender, subject, date and review details.
        </p>
        {callback.denied && (
          <p role="alert">
            Gmail access was declined. Connect Gmail to try again.
          </p>
        )}
        {callback.code && callback.state ? (
          <button
            disabled={action.isPending}
            onClick={() => action.mutate("callback")}
          >
            Finish connecting Gmail
          </button>
        ) : inbox.data?.connection ? (
          <>
            <p>
              {inbox.data.connection.account} ·{" "}
              {inbox.data.connection.lastSyncedAt
                ? `Last synced ${new Date(inbox.data.connection.lastSyncedAt).toLocaleString()}`
                : "Ready to sync"}
            </p>
            <div className="actions">
              <button
                className="primary"
                disabled={action.isPending}
                onClick={() => action.mutate("sync")}
              >
                {action.isPending && action.variables === "sync"
                  ? "Syncing…"
                  : "Sync now"}
              </button>
              <button
                disabled={action.isPending}
                onClick={() => action.mutate("connect")}
              >
                Reconnect Gmail
              </button>
              <button
                disabled={action.isPending}
                onClick={() => action.mutate("disconnect")}
              >
                Disconnect Gmail
              </button>
            </div>
          </>
        ) : (
          <button
            disabled={inbox.isPending || action.isPending}
            onClick={() => action.mutate("connect")}
          >
            Connect Gmail
          </button>
        )}
        {inbox.data?.connection && (
          <GmailLabelGuide account={inbox.data.connection.account} />
        )}
        {syncResult && <p role="status">{syncResult}</p>}
        {action.error && <p role="alert">{errorMessage(action.error)}</p>}
        {inbox.error && <p role="alert">{errorMessage(inbox.error)}</p>}
      </section>
      <section className="card">
        <h2>Pending review {inbox.data ? `(${inbox.data.pending})` : ""}</h2>
        {!inbox.isPending && inbox.data?.pending === 0 && (
          <p>No emails waiting for review.</p>
        )}
        <ul className="timeline">
          {inbox.data?.items.map((email) => (
            <li key={email.id}>
              <div>
                <strong>{email.subject || "(No subject)"}</strong>
                <p>
                  {email.sender} · {new Date(email.receivedAt).toLocaleString()}{" "}
                  · {email.category}
                </p>
                <div className="actions">
                  <a
                    href={`https://mail.google.com/mail/u/${encodeURIComponent(email.account)}/#all/${encodeURIComponent(email.threadId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Gmail
                  </a>
                  <button
                    disabled={action.isPending}
                    onClick={() => {
                      action.reset();
                      setItem(email);
                      setSearch("");
                      setSelected(email.applicationId ?? "");
                      setStatusChange(false);
                    }}
                  >
                    Review
                  </button>
                </div>
                {item?.id === email.id && (
                  <>
                    <label>
                      Search applications
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label>
                      Application
                      <select
                        value={selected}
                        onChange={(e) => {
                          setSelected(e.target.value);
                          setStatusChange(false);
                        }}
                      >
                        <option value="">Choose an application</option>
                        {application.data &&
                          !applications.data?.items.some(
                            ({ id }) => id === application.data?.id,
                          ) && (
                            <option value={application.data.id}>
                              {application.data.company} ·{" "}
                              {application.data.role}
                            </option>
                          )}
                        {applications.data?.items.map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {choice.company} · {choice.role}
                          </option>
                        ))}
                      </select>
                    </label>
                    {application.data && suggestedStatuses[item.category] && (
                      <label className="inline-label">
                        <input
                          type="checkbox"
                          checked={statusChange}
                          onChange={(e) => setStatusChange(e.target.checked)}
                        />
                        Change status from {application.data.status} to{" "}
                        {suggestedStatuses[item.category]}
                      </label>
                    )}
                    <div className="actions">
                      <button
                        disabled={!application.data || action.isPending}
                        onClick={() => action.mutate("link")}
                      >
                        Link to application
                      </button>
                      {(item.category === "OA" ||
                        item.category === "Interview") && (
                        <button
                          disabled={!application.data || action.isPending}
                          onClick={() => action.mutate("schedule")}
                        >
                          Link and schedule
                        </button>
                      )}
                      <Link to="/applications?new=1">Add application</Link>
                      <button
                        disabled={action.isPending}
                        onClick={() => action.mutate("dismiss")}
                      >
                        Dismiss
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {event && (
        <EventForm
          application={event.application}
          category={event.category}
          onClose={() => setEvent(undefined)}
        />
      )}
    </>
  );
}
