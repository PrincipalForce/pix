// In-app Claude agent. Speaks the editor's tool API.
// Requires the user's Anthropic API key (stored locally; we send the
// "anthropic-dangerous-direct-browser-access" header that the SDK uses to allow
// direct browser calls).
//
// The agent receives:
//   - the user's natural-language request
//   - a downscaled snapshot of the current canvas (vision)
//   - the document state summary (size, layers, selected layer)
//
// It responds with text and zero or more tool calls. We execute each tool, send
// the result back as a tool_result, and loop until the model returns no more
// tool calls or we hit a max-iterations cap.

import { EditorAPI } from "@/hooks/useEditor";
import { compositeDocument } from "@/lib/render";
import { ctx2d, createCanvas } from "@/lib/canvas";
import { getKey, getModels } from "./settings";
import { Tool, executeTool, TOOLS } from "./tools";

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_ITERS = 8;
const SNAPSHOT_MAX = 1024;

export interface AgentMessage {
  role: "user" | "assistant";
  text: string;
  // For UI: a list of tool names that were invoked while producing this turn.
  toolNames?: string[];
}

export interface AgentRunUpdate {
  type: "text" | "tool" | "error" | "done";
  text?: string;
  toolName?: string;
  error?: string;
}

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image";
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  content?: any;
  tool_use_id?: string;
  source?: { type: "base64"; media_type: string; data: string };
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicContentBlock[] | string;
}

interface ConvoTurn {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
}

const SYSTEM = `You are an in-app image-editing assistant embedded inside a Photoshop-like web editor named "Pix.". You can call tools to inspect and modify the document.

When the user asks for changes, prefer making the edit directly via tools rather than describing how. Be concise in your text replies (1-3 sentences). After completing tool calls, summarize what you did.

You can:
- inspect the canvas (you'll already see a snapshot in the user message)
- add layers (image, fill, blank)
- apply filters from the registry (any filter id under Filter > Filter Gallery)
- fill or recolor selections
- resize the canvas or resample the image
- adjust the active layer's transform
- run AI image generation / edit / background removal / upscaling via 3rd-party providers when the user requests it

If the user asks for something not supported by any tool, say so plainly.`;

export async function runAgent(
  api: EditorAPI,
  conversation: ConvoTurn[],
  userText: string,
  onUpdate: (u: AgentRunUpdate) => void
): Promise<{ assistantText: string; toolNames: string[] }> {
  const key = getKey("anthropic");
  if (!key) throw new Error("No Anthropic API key. Add one in AI Settings.");
  const model = getModels().anthropic;

  // Build the user turn with vision: snapshot + state + the prompt.
  const snapshot = makeSnapshot(api);
  const stateText = describeState(api);

  const userTurn: ConvoTurn = {
    role: "user",
    content: [
      ...(snapshot
        ? [
            {
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/png", data: snapshot },
            },
          ]
        : []),
      { type: "text" as const, text: `Current document:\n${stateText}\n\nUser request: ${userText}` },
    ],
  };

  const turns: ConvoTurn[] = [...conversation, userTurn];
  const toolNames: string[] = [];
  let lastAssistantText = "";

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const messages = turns.map(serializeTurn);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM,
        tools: TOOLS.map(({ name, description, input_schema }) => ({
          name,
          description,
          input_schema,
        })),
        messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic ${res.status}: ${text}`);
    }
    const json = await res.json();
    const blocks: AnthropicContentBlock[] = json.content || [];
    turns.push({ role: "assistant", content: blocks });

    // Surface any text immediately
    for (const b of blocks) {
      if (b.type === "text" && b.text) {
        lastAssistantText = b.text;
        onUpdate({ type: "text", text: b.text });
      }
    }

    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      // Conversation ended naturally
      onUpdate({ type: "done" });
      return { assistantText: lastAssistantText, toolNames };
    }

    // Execute tools, collect tool_result blocks for the next user turn
    const toolResults: AnthropicContentBlock[] = [];
    for (const tu of toolUses) {
      if (!tu.name || !tu.id) continue;
      const tool = TOOLS.find((t) => t.name === tu.name);
      toolNames.push(tu.name);
      onUpdate({ type: "tool", toolName: tu.name });
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unknown tool: ${tu.name}`,
        });
        continue;
      }
      try {
        const result = await executeTool(api, tu.name as Tool["name"], tu.input ?? {});
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      } catch (e) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${(e as Error).message}`,
        });
      }
    }

    turns.push({ role: "user", content: toolResults });
  }

  onUpdate({ type: "done" });
  return { assistantText: lastAssistantText, toolNames };
}

function serializeTurn(t: ConvoTurn): AnthropicMessage {
  return { role: t.role, content: t.content as any };
}

function makeSnapshot(api: EditorAPI): string | null {
  const composite = compositeDocument(api.doc, undefined, { includeBackground: true });
  if (composite.width === 0 || composite.height === 0) return null;
  const ratio = composite.width / composite.height;
  let w = composite.width;
  let h = composite.height;
  if (Math.max(w, h) > SNAPSHOT_MAX) {
    if (ratio >= 1) {
      w = SNAPSHOT_MAX;
      h = Math.round(SNAPSHOT_MAX / ratio);
    } else {
      h = SNAPSHOT_MAX;
      w = Math.round(SNAPSHOT_MAX * ratio);
    }
  }
  const c = createCanvas(w, h);
  ctx2d(c).drawImage(composite, 0, 0, w, h);
  // toDataURL → strip prefix
  return c.toDataURL("image/png").split(",")[1];
}

function describeState(api: EditorAPI): string {
  const sel = api.selectedLayer;
  const lines = [
    `Size: ${api.doc.width} × ${api.doc.height}px`,
    `Layers (bottom→top): ${api.doc.layers.map((l) => `${l.name} (${l.kind})${l.locked ? " [locked]" : ""}`).join(", ") || "none"}`,
    sel
      ? `Selected layer: ${sel.name} — ${sel.kind}, ${sel.width}×${sel.height} at (${sel.x},${sel.y})${sel.mask ? " (has mask)" : ""}${sel.locked ? " (locked)" : ""}`
      : "Selected layer: none",
    api.selection.mask ? "There is an active pixel selection." : "No active pixel selection.",
  ];
  return lines.join("\n");
}
