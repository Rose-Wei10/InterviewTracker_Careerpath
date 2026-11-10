import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus } from "lucide-react";
import { ErrorState, Loading, Modal } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";

type Starter = {
  starterKey: string;
  category: string;
  group: string;
  prompt: string;
  review: boolean;
};
type Entry = {
  id: string;
  starterKey: string | null;
  category: string;
  prompt: string;
  answer: string;
  revision: number;
};
type Kit = { categories: string[]; starters: Starter[]; entries: Entry[] };
type Draft = {
  entry?: Entry;
  starter?: Starter;
  category: string;
  prompt: string;
  answer: string;
};

export default function ApplyKit() {
  const api = useApi(),
    qc = useQueryClient();
  const queryKey = ["apply-kit", api.userId];
  const kit = useQuery({ queryKey, queryFn: () => api.get<Kit>("/apply-kit") });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [draft, setDraft] = useState<Draft>();
  const [remove, setRemove] = useState<Entry>();
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: async (input: { draft: Draft } | { remove: Entry }) => {
      if ("remove" in input) {
        await api.remove(
          `/apply-kit/${input.remove.id}?revision=${input.remove.revision}`,
        );
        return;
      }
      const { entry, starter, category, prompt, answer } = input.draft;
      if (entry)
        await api.patch(
          `/apply-kit/${entry.id}`,
          entry.starterKey
            ? { revision: entry.revision, answer }
            : { revision: entry.revision, category, prompt, answer },
        );
      else
        await api.post(
          "/apply-kit",
          starter
            ? { starterKey: starter.starterKey, answer }
            : { category, prompt, answer },
        );
    },
    onSuccess: async (_data, input) => {
      await qc.invalidateQueries({ queryKey });
      setNotice("remove" in input ? "Answer removed." : "Answer saved.");
      setDraft(undefined);
      setRemove(undefined);
    },
  });

  const matches = (item: {
    category: string;
    prompt: string;
    answer?: string;
  }) =>
    (filter === "All" || filter === item.category) &&
    `${item.prompt} ${item.answer ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  const entries = kit.data?.entries ?? [];
  const starters = kit.data?.starters ?? [];
  const saved = entries.filter(matches);
  const available = starters.filter(
    (starter) =>
      matches(starter) &&
      !entries.some((entry) => entry.starterKey === starter.starterKey),
  );
  const starterFor = (entry: Entry) =>
    starters.find(({ starterKey }) => starterKey === entry.starterKey);

  function edit(value?: Entry | Starter) {
    mutation.reset();
    setDraft(
      value && "id" in value
        ? {
            entry: value,
            category: value.category,
            prompt: value.prompt,
            answer: value.answer,
          }
        : {
            starter: value,
            category:
              value?.category ?? (filter === "All" ? "General" : filter),
            prompt: value?.prompt ?? "",
            answer: "",
          },
    );
  }
  async function copy(entry: Entry) {
    try {
      await navigator.clipboard.writeText(entry.answer);
      setNotice("Copied to clipboard.");
      setCopied(entry.id);
      window.setTimeout(
        () => setCopied((current) => (current === entry.id ? "" : current)),
        1500,
      );
    } catch {
      setExpanded((current) =>
        current.includes(entry.id) ? current : [...current, entry.id],
      );
      setNotice(
        "Clipboard unavailable. Select the answer text and copy it manually.",
      );
    }
  }

  async function copyAutofillData() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({
          format: "careerpath-apply-kit",
          version: 1,
          careerpathOrigin: window.location.origin,
          entries: entries.map(({ starterKey, prompt, answer }) => ({
            starterKey,
            prompt,
            answer,
            review: starters.some(
              (starter) => starter.starterKey === starterKey && starter.review,
            ),
          })),
        }),
      );
      setNotice(
        "Autofill data copied. Paste it only into the Careerpath extension.",
      );
    } catch {
      setNotice(
        "Could not copy autofill data. You can still copy individual answers.",
      );
    }
  }

  return (
    <div className="apply-kit">
      <div className="page-heading">
        <div>
          <h1>Apply Kit</h1>
          <p>Save the details and answers you reuse on job applications.</p>
        </div>
        <div className="actions">
          <button
            disabled={!entries.length}
            onClick={() => void copyAutofillData()}
          >
            Copy autofill data
          </button>
          <button
            className="primary"
            disabled={!kit.data}
            onClick={() => edit()}
          >
            <Plus size={17} /> Add question
          </button>
        </div>
      </div>
      {kit.isPending && <Loading />}
      {kit.isError && (
        <ErrorState error={kit.error} retry={() => kit.refetch()} />
      )}
      {kit.data && (
        <>
          <section className="card">
            <div className="section-heading">
              <h2>Your saved answers</h2>
              <Link to="/resumes">Open Resume Library</Link>
            </div>
            <div className="filters">
              <label>
                Search Apply Kit
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, question or answer"
                />
              </label>
              <label>
                Category
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All</option>
                  {kit.data.categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
            </div>
            <p role="status" className="apply-kit-notice">
              {notice}
            </p>
            {!saved.length && (
              <p className="muted">
                {entries.length
                  ? "No saved answers match your filters."
                  : "Start with a question below or add one of your own."}
              </p>
            )}
            {kit.data.categories
              .filter((category) =>
                saved.some((entry) => entry.category === category),
              )
              .map((category) => (
                <section className="apply-kit-group" key={category}>
                  <h3>{category}</h3>
                  {saved
                    .filter((entry) => entry.category === category)
                    .map((entry) => {
                      const long =
                        entry.answer.length > 220 ||
                        entry.answer.split("\n").length > 3;
                      const open = expanded.includes(entry.id);
                      return (
                        <div className="apply-kit-row" key={entry.id}>
                          <div>
                            <strong>{entry.prompt}</strong>
                            {starterFor(entry)?.review && (
                              <span className="badge">
                                Review before pasting
                              </span>
                            )}
                            <p className="apply-kit-answer">
                              {long && !open
                                ? `${entry.answer.slice(0, 200)}…`
                                : entry.answer}
                            </p>
                            {long && (
                              <button
                                aria-expanded={open}
                                aria-label={`${open ? "Show less" : "Show full answer"}: ${entry.prompt}`}
                                onClick={() =>
                                  setExpanded((current) =>
                                    open
                                      ? current.filter((id) => id !== entry.id)
                                      : [...current, entry.id],
                                  )
                                }
                              >
                                {open ? "Show less" : "Show full answer"}
                              </button>
                            )}
                          </div>
                          <div className="actions">
                            <button
                              aria-label={`Copy: ${entry.prompt}`}
                              onClick={() => void copy(entry)}
                            >
                              {copied === entry.id ? (
                                <Check size={15} />
                              ) : (
                                <Copy size={15} />
                              )}
                              {copied === entry.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              aria-label={`Edit: ${entry.prompt}`}
                              onClick={() => edit(entry)}
                            >
                              Edit
                            </button>
                            <button
                              aria-label={`${entry.starterKey ? "Clear" : "Delete"}: ${entry.prompt}`}
                              onClick={() => {
                                mutation.reset();
                                setRemove(entry);
                              }}
                            >
                              {entry.starterKey ? "Clear" : "Delete"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </section>
              ))}
          </section>
          <details className="card">
            <summary>
              <strong>Starter questions</strong>{" "}
              <span className="count">{available.length}</span>
            </summary>
            {!available.length && (
              <p className="muted">
                No unanswered starter questions match your filters.
              </p>
            )}
            {[...new Set(available.map(({ group }) => group))].map((group) => (
              <section className="apply-kit-group" key={group}>
                <h3>{group}</h3>
                {available
                  .filter((starter) => starter.group === group)
                  .map((starter) => (
                    <div className="apply-kit-row" key={starter.starterKey}>
                      <div>
                        {starter.prompt}{" "}
                        {starter.review && (
                          <span className="badge">Review before pasting</span>
                        )}
                      </div>
                      <button
                        aria-label={`Answer: ${starter.prompt}`}
                        onClick={() => edit(starter)}
                      >
                        Answer
                      </button>
                    </div>
                  ))}
              </section>
            ))}
          </details>
        </>
      )}
      {draft && (
        <Modal
          title={
            draft.entry
              ? "Edit answer"
              : draft.starter
                ? "Save starter answer"
                : "Add question"
          }
          onClose={() => {
            if (!mutation.isPending) setDraft(undefined);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!mutation.isPending) mutation.mutate({ draft });
            }}
          >
            {draft.starter || draft.entry?.starterKey ? (
              <p>{draft.prompt}</p>
            ) : (
              <>
                <label>
                  Question
                  <input
                    required
                    maxLength={300}
                    value={draft.prompt}
                    onChange={(e) =>
                      setDraft({ ...draft, prompt: e.target.value })
                    }
                  />
                </label>
                <label>
                  Category
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                  >
                    {kit.data?.categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              Answer
              <textarea
                required
                rows={6}
                maxLength={10000}
                value={draft.answer}
                onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              />
            </label>
            <p className="muted">
              Keep passwords, government IDs and financial details out of saved
              answers.
            </p>
            {mutation.error && (
              <p role="alert">{errorMessage(mutation.error)}</p>
            )}
            <div className="actions">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => setDraft(undefined)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  mutation.isPending ||
                  !draft.answer.trim() ||
                  !draft.prompt.trim()
                }
              >
                {mutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          compact
          title={remove.starterKey ? "Clear answer?" : "Delete question?"}
          onClose={() => {
            if (!mutation.isPending) setRemove(undefined);
          }}
        >
          <p>{remove.prompt}</p>
          {mutation.error && <p role="alert">{errorMessage(mutation.error)}</p>}
          <div className="actions">
            <button
              disabled={mutation.isPending}
              onClick={() => setRemove(undefined)}
            >
              Cancel
            </button>
            <button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ remove })}
            >
              {remove.starterKey ? "Clear answer" : "Delete question"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
