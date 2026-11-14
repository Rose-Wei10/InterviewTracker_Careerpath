import { useState } from "react";
export default function GmailLabelGuide({ account }: { account: string }) {
  const [sender, setSender] = useState("");
  const [phrases, setPhrases] = useState(false);
  const [notice, setNotice] = useState("");
  const valid =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(
      sender.trim(),
    );
  const query = valid
    ? `from:"${sender.trim()}"${phrases ? ' {"application received" "thank you for applying" interview assessment offer}' : ""}`
    : "";
  return (
    <details>
      <summary>Automatically label recruiting emails</summary>
      <p>
        Set up filters in Gmail for <strong>{account}</strong>. Careerpath keeps
        read-only access.
      </p>
      <label>
        Exact recruiting email address
        <input
          type="email"
          value={sender}
          onChange={(event) => setSender(event.target.value)}
          placeholder="recruiter@example.com"
        />
      </label>
      <label>
        Recipe
        <select
          value={phrases ? "phrases" : "sender"}
          onChange={(event) => setPhrases(event.target.value === "phrases")}
        >
          <option value="sender">Messages from this exact sender</option>
          <option value="phrases">Sender plus recruiting phrases</option>
        </select>
      </label>
      <p>
        Use an actual sender from a recruiting message, not an entire ATS
        domain.
      </p>
      {query && <p style={{ overflowWrap: "anywhere" }}>{query}</p>}
      <button
        disabled={!valid}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(query);
            setNotice("Search copied. Preview its matches in Gmail first.");
          } catch {
            setNotice(
              "Clipboard unavailable. Select and copy the search shown above.",
            );
          }
        }}
      >
        Copy search
      </button>
      <p role="status">{notice}</p>
      <ol>
        <li>
          Open Gmail in the account shown above and paste the search. Check for
          unrelated results.
        </li>
        <li>
          Open search options, choose Create filter, then Apply the label →
          Careerpath.
        </li>
        <li>
          Choose whether to apply it to existing matching conversations, then
          create the filter.
        </li>
        <li>Return here and click Sync now.</li>
      </ol>
      <p>
        Replies must match the filter themselves. Careerpath imports only
        labeled messages from the last 30 days, up to 100 new messages per sync.
        No mailbox setting is changed here.
      </p>
      <a
        href="https://support.google.com/mail/answer/6579?hl=en"
        target="_blank"
        rel="noreferrer"
      >
        Google’s filter instructions
      </a>
    </details>
  );
}
