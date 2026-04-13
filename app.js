import React, { useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";

function App() {
  const [url, setUrl] = useState("");
  const [timeout, setTimeoutValue] = useState("30");
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ text: "", kind: "" });

  const txtContent = useMemo(
    () => (links.length ? `${links.join("\n")}\n` : ""),
    [links],
  );

  function buildFileName() {
    try {
      const host = new URL(url).hostname
        .replace(/[^a-z0-9.-]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      return `${host || "sitemap"}-urls.txt`;
    } catch {
      return "sitemap-urls.txt";
    }
  }

  async function runConversion(event) {
    event.preventDefault();
    setStatus({ text: "", kind: "" });

    if (!url.trim()) {
      setStatus({ text: "Please enter a sitemap URL.", kind: "error" });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), timeout: timeout.trim() || "30" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not convert this sitemap URL.");
      }

      setLinks(data.links || []);
      setStatus({
        text: `Done. Extracted ${(data.links || []).length} URL(s). You can now download the TXT file.`,
        kind: "success",
      });
    } catch (error) {
      setLinks([]);
      setStatus({
        text: error instanceof Error ? error.message : "Unexpected error occurred.",
        kind: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!txtContent) return;
    try {
      await navigator.clipboard.writeText(txtContent);
      setStatus({ text: "Copied TXT content to clipboard.", kind: "success" });
    } catch {
      setStatus({ text: "Could not copy to clipboard in this browser.", kind: "error" });
    }
  }

  function downloadTxt() {
    if (!txtContent) return;
    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  return React.createElement(
    "main",
    { className: "app-shell" },
    React.createElement(
      "section",
      { className: "hero" },
      React.createElement("h1", null, "Sitemap to TXT Converter"),
      React.createElement(
        "p",
        null,
        "Convert WordPress visual sitemap pages into one-URL-per-line TXT output for AccessibilityChecker dashboard scans.",
      ),
    ),
    React.createElement(
      "section",
      { className: "panel" },
      React.createElement(
        "form",
        { onSubmit: runConversion },
        React.createElement(
          "label",
          { htmlFor: "sitemap-url" },
          "WordPress sitemap page URL",
        ),
        React.createElement("input", {
          id: "sitemap-url",
          type: "url",
          required: true,
          placeholder: "https://example.com/sitemap/",
          value: url,
          onChange: (event) => setUrl(event.target.value),
        }),
        React.createElement(
          "div",
          { className: "grid", style: { marginTop: "0.85rem" } },
          React.createElement(
            "div",
            null,
            React.createElement("label", { htmlFor: "timeout" }, "Timeout (1-120 seconds)"),
            React.createElement("input", {
              id: "timeout",
              type: "number",
              min: "1",
              max: "120",
              value: timeout,
              onChange: (event) => setTimeoutValue(event.target.value),
            }),
          ),
          React.createElement(
            "div",
            { style: { alignSelf: "end" } },
            React.createElement(
              "button",
              { type: "submit", disabled: isLoading },
              isLoading ? "Converting…" : "Convert Sitemap",
            ),
          ),
        ),
      ),
      React.createElement("div", {
        className: `status ${status.kind || ""}`,
        children: status.text,
      }),
      React.createElement(
        "div",
        { className: "meta" },
        links.length ? `${links.length} URL(s) ready for TXT export` : "No URLs extracted yet",
      ),
      React.createElement(
        "div",
        { style: { marginTop: "0.8rem" } },
        React.createElement("label", { htmlFor: "txt-preview" }, "TXT preview (one URL per line)"),
        React.createElement("textarea", {
          id: "txt-preview",
          readOnly: true,
          value: txtContent,
          placeholder: "Converted sitemap URLs will appear here...",
        }),
      ),
      React.createElement(
        "div",
        { className: "actions" },
        React.createElement(
          "button",
          { type: "button", onClick: downloadTxt, disabled: !links.length },
          "Download TXT",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className: "secondary",
            onClick: copyToClipboard,
            disabled: !links.length,
          },
          "Copy URLs",
        ),
      ),
    ),
  );
}

createRoot(document.getElementById("root")).render(React.createElement(App));
