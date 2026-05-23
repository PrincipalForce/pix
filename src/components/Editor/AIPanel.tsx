import React, { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Wand2, Layers as LayersIcon, Scissors, Maximize2, Settings as SettingsIcon } from "lucide-react";
import { EditorAPI } from "@/hooks/useEditor";
import { runAgent, AgentMessage } from "@/lib/ai/agent";
import { hasKey } from "@/lib/ai/settings";
import { ctx2d, createCanvas } from "@/lib/canvas";
import { Gemini } from "@/lib/ai/providers/gemini";
import { OpenAI } from "@/lib/ai/providers/openai";
import { RemoveBg } from "@/lib/ai/providers/removebg";
import { Replicate } from "@/lib/ai/providers/replicate";
import { ImageOutput } from "@/lib/ai/types";

interface Props {
  api: EditorAPI;
  onOpenSettings: () => void;
}

interface ConvoTurn {
  role: "user" | "assistant";
  content: any[];
}

export default function AIPanel({ api, onOpenSettings }: Props) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [convo, setConvo] = useState<ConvoTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!hasKey("anthropic")) {
      alert("Add an Anthropic API key in AI Settings first.");
      onOpenSettings();
      return;
    }
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    const tools: string[] = [];
    let lastText = "";
    try {
      const result = await runAgent(api, convo, text, (u) => {
        if (u.type === "text" && u.text) lastText = u.text;
        if (u.type === "tool" && u.toolName) tools.push(u.toolName);
      });
      lastText = result.assistantText || lastText;
      setMessages((m) => [...m, { role: "assistant", text: lastText, toolNames: tools }]);
      // Persist the same conversation server-side: we trust the agent's loop already
      // mutated `convo` mentally — but `runAgent` builds its own turn list and we
      // don't propagate it back here. For continuity we keep just user/assistant text:
      setConvo((c) => [
        ...c,
        { role: "user", content: [{ type: "text", text }] },
        { role: "assistant", content: [{ type: "text", text: lastText }] },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  // --- Quick actions: direct provider calls, no agent loop ---

  const withSelectedLayerBase64 = async (): Promise<string | null> => {
    const layer = api.selectedLayer;
    if (!layer || layer.kind !== "raster") {
      alert("Select a raster layer first.");
      return null;
    }
    if (layer.locked) {
      alert("Layer is locked.");
      return null;
    }
    return layer.canvas.toDataURL("image/png").split(",")[1];
  };

  const generate = async () => {
    const prompt = window.prompt("Describe what to generate:");
    if (!prompt) return;
    if (!hasKey(provider)) {
      alert(`Add a ${provider} API key in AI Settings first.`);
      onOpenSettings();
      return;
    }
    setBusy(true);
    try {
      const p = provider === "gemini" ? Gemini : OpenAI;
      const results = await p.generate!({
        prompt,
        width: api.doc.width,
        height: api.doc.height,
      });
      const img = await base64ToImage(results[0].base64Png);
      api.addImageLayer(img, `AI: ${prompt.slice(0, 28)}`);
      setMessages((m) => [...m, { role: "assistant", text: `Generated via ${p.name}: "${prompt}"` }]);
    } catch (e) {
      alert("Generate failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const editSelected = async () => {
    const b64 = await withSelectedLayerBase64();
    if (!b64) return;
    const prompt = window.prompt("How should the selected layer be edited?");
    if (!prompt) return;
    if (!hasKey(provider)) {
      onOpenSettings();
      return;
    }
    setBusy(true);
    try {
      const p = provider === "gemini" ? Gemini : OpenAI;
      const results = await p.edit!({
        prompt,
        image: { base64Png: b64 },
      });
      await replaceSelectedLayerWith(api, results[0]);
      setMessages((m) => [...m, { role: "assistant", text: `Edited via ${p.name}: "${prompt}"` }]);
    } catch (e) {
      alert("Edit failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeBg = async () => {
    const b64 = await withSelectedLayerBase64();
    if (!b64) return;
    const useReplicate = !hasKey("removebg") && hasKey("replicate");
    const p = useReplicate ? Replicate : RemoveBg;
    if (!hasKey(useReplicate ? "replicate" : "removebg")) {
      alert("Add a remove.bg or Replicate API key in AI Settings.");
      onOpenSettings();
      return;
    }
    setBusy(true);
    try {
      const out = await p.removeBackground!({ image: { base64Png: b64 } });
      await replaceSelectedLayerWith(api, out);
      setMessages((m) => [...m, { role: "assistant", text: `Background removed via ${p.name}.` }]);
    } catch (e) {
      alert("Remove background failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upscale = async () => {
    const b64 = await withSelectedLayerBase64();
    if (!b64) return;
    if (!hasKey("replicate")) {
      alert("Upscale uses Replicate (Real-ESRGAN). Add a Replicate API key.");
      onOpenSettings();
      return;
    }
    setBusy(true);
    try {
      const out = await Replicate.upscale!({ image: { base64Png: b64 }, scale: 2 });
      await replaceSelectedLayerWith(api, out);
      setMessages((m) => [...m, { role: "assistant", text: `Upscaled to ${out.width}×${out.height}.` }]);
    } catch (e) {
      alert("Upscale failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-quick">
        <div className="ai-prov">
          {(["gemini", "openai"] as const).map((p) => (
            <button
              key={p}
              className={`pill ${provider === p ? "is-on" : ""}`}
              onClick={() => setProvider(p)}
            >
              {p === "gemini" ? "Nano Banana" : "gpt-image-1"}
            </button>
          ))}
        </div>
        <div className="ai-quick-btns">
          <button className="ai-quick-btn" onClick={generate} disabled={busy} title="Generate a new image and add as layer">
            <Sparkles size={14} /> <span>Generate</span>
          </button>
          <button className="ai-quick-btn" onClick={editSelected} disabled={busy} title="Edit the selected layer with a prompt">
            <Wand2 size={14} /> <span>Edit layer</span>
          </button>
          <button className="ai-quick-btn" onClick={removeBg} disabled={busy} title="Remove background of the selected layer">
            <Scissors size={14} /> <span>Remove BG</span>
          </button>
          <button className="ai-quick-btn" onClick={upscale} disabled={busy} title="Upscale the selected layer">
            <Maximize2 size={14} /> <span>Upscale</span>
          </button>
        </div>
      </div>

      <div className="ai-chat" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">
            <LayersIcon size={22} strokeWidth={1.4} />
            <div>
              Ask the assistant for an edit, or use the quick actions above.
              Examples: "blur the background", "make the sky look like sunset",
              "remove the watermark", "add a midnight forest background".
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}`}>
            <div className="ai-msg-text">{m.text}</div>
            {m.toolNames && m.toolNames.length > 0 && (
              <div className="ai-msg-tools">used: {m.toolNames.join(", ")}</div>
            )}
          </div>
        ))}
        {busy && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-msg-text ai-thinking">Thinking…</div>
          </div>
        )}
      </div>

      <div className="ai-input">
        <textarea
          className="input"
          placeholder="Ask the assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn primary" onClick={send} disabled={busy || !input.trim()}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

async function replaceSelectedLayerWith(api: EditorAPI, out: ImageOutput): Promise<void> {
  const layer = api.selectedLayer;
  if (!layer) return;
  const img = await base64ToImage(out.base64Png);
  const c = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx2d(c).drawImage(img, 0, 0);
  api.updateLayer(layer.id, { canvas: c, width: img.naturalWidth, height: img.naturalHeight });
  api.bump();
  api.pushHistory("AI: Replace Layer Pixels");
}

function base64ToImage(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
}
