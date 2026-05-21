import React, { useState } from "react";
import Modal from "./Modal";
import { Copy, Check } from "lucide-react";
import { EditorAPI } from "@/hooks/useEditor";
import { compositeDocument } from "@/lib/render";
import { canvasToBlob } from "@/lib/canvas";

interface Props {
  api: EditorAPI;
  onClose: () => void;
}

export default function ShareDialog({ api, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const upload = async () => {
    setBusy(true);
    try {
      const comp = compositeDocument(api.doc, undefined, { includeBackground: true });
      const blob = await canvasToBlob(comp, "image/png");
      const fd = new FormData();
      fd.append("image", blob);
      const res = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: { Authorization: "Client-ID 546c25a59c58ad7" },
        body: fd,
      });
      const data = await res.json();
      if (data.success) setUrl(data.data.link);
      else alert(data.data?.error ?? "Upload failed");
    } catch (e) {
      alert("Upload failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Share" onClose={onClose}>
      {!url ? (
        <>
          <p className="muted small">
            Uploads a flattened PNG to Imgur and returns a shareable link.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy} onClick={upload}>
              {busy ? "Uploading…" : "Upload"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>Link</label>
            <div className="filename-row">
              <input className="input mono" readOnly value={url} />
              <button
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div className="preview-frame">
            <img src={url} alt="" />
          </div>
          <div className="modal-actions">
            <button className="btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
