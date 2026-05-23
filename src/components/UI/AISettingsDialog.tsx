import React, { useState } from "react";
import Modal from "./Modal";
import { Eye, EyeOff } from "lucide-react";
import {
  clearUserKey,
  getKey,
  getKeySource,
  getModels,
  ProviderId,
  setKey,
  setModel,
} from "@/lib/ai/settings";

interface Props {
  onClose: () => void;
}

const FIELDS: Array<{
  id: ProviderId;
  label: string;
  help: string;
  signupUrl: string;
}> = [
  {
    id: "anthropic",
    label: "Anthropic (in-app agent)",
    help: "Powers the assistant chat. Get a key at console.anthropic.com.",
    signupUrl: "https://console.anthropic.com/",
  },
  {
    id: "gemini",
    label: "Google Gemini (Nano Banana)",
    help: "Image generate + edit. Get a key at aistudio.google.com.",
    signupUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai",
    label: "OpenAI (gpt-image-1)",
    help: "Image generate + edit. Get a key at platform.openai.com.",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "replicate",
    label: "Replicate (Flux, ESRGAN)",
    help: "Image gen + upscaling. Get a key at replicate.com/account.",
    signupUrl: "https://replicate.com/account/api-tokens",
  },
  {
    id: "removebg",
    label: "remove.bg",
    help: "Background removal. Free tier at remove.bg/api.",
    signupUrl: "https://www.remove.bg/api",
  },
];

export default function AISettingsDialog({ onClose }: Props) {
  const [values, setValues] = useState<Record<ProviderId, string>>(() => ({
    anthropic: getKey("anthropic"),
    gemini: getKey("gemini"),
    openai: getKey("openai"),
    replicate: getKey("replicate"),
    removebg: getKey("removebg"),
  }));
  const [models, setModels] = useState(() => getModels());
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const save = () => {
    (Object.keys(values) as ProviderId[]).forEach((k) => {
      const v = values[k];
      if (v.trim()) setKey(k, v);
      else clearUserKey(k);
    });
    setModel("anthropic", models.anthropic);
    setModel("gemini", models.gemini);
    setModel("openai", models.openai);
    onClose();
  };

  return (
    <Modal title="AI Settings" onClose={onClose} width={580}>
      <p className="muted small">
        Keys are stored locally in your browser and sent only to the matching provider. They are never logged or
        forwarded.
      </p>
      <div className="ai-settings">
        {FIELDS.map((f) => {
          const source = getKeySource(f.id);
          const hasUser = !!values[f.id];
          // When the input is empty and an env var supplies a key, the field is effectively
          // showing "(from env)" rather than the user-entered value.
          const envActive = source === "env" && !hasUser;
          return (
            <div key={f.id} className="ai-row">
              <div className="ai-label">
                <div className="ai-name">
                  {f.label}
                  {envActive && <span className="env-tag">from env</span>}
                </div>
                <div className="ai-help">
                  {f.help}{" "}
                  <a href={f.signupUrl} target="_blank" rel="noreferrer">
                    Get a key →
                  </a>
                </div>
              </div>
              <div className="ai-input">
                <input
                  className="input mono"
                  type={reveal[f.id] ? "text" : "password"}
                  placeholder={envActive ? "(using env var — leave blank)" : `${f.id} key`}
                  value={values[f.id]}
                  onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                />
                <button
                  className="icon-btn"
                  onClick={() => setReveal({ ...reveal, [f.id]: !reveal[f.id] })}
                  type="button"
                  title={reveal[f.id] ? "Hide" : "Show"}
                >
                  {reveal[f.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          );
        })}

        <h4 className="ai-section">Models</h4>
        <div className="ai-row">
          <div className="ai-label">
            <div className="ai-name">Anthropic model</div>
            <div className="ai-help">Used for the in-app agent.</div>
          </div>
          <select
            className="input"
            value={models.anthropic}
            onChange={(e) => setModels({ ...models, anthropic: e.target.value })}
          >
            <option value="claude-opus-4-7">claude-opus-4-7</option>
            <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
            <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
          </select>
        </div>
        <div className="ai-row">
          <div className="ai-label">
            <div className="ai-name">Gemini model</div>
          </div>
          <select
            className="input"
            value={models.gemini}
            onChange={(e) => setModels({ ...models, gemini: e.target.value })}
          >
            <option value="gemini-2.5-flash-image">gemini-2.5-flash-image (Nano Banana)</option>
            <option value="gemini-2.5-flash-image-preview">gemini-2.5-flash-image-preview</option>
          </select>
        </div>
        <div className="ai-row">
          <div className="ai-label">
            <div className="ai-name">OpenAI image model</div>
          </div>
          <select
            className="input"
            value={models.openai}
            onChange={(e) => setModels({ ...models, openai: e.target.value })}
          >
            <option value="gpt-image-1">gpt-image-1</option>
            <option value="dall-e-3">dall-e-3</option>
          </select>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  );
}
