import { readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { runAgent } from "@/lib/ai/agent";
import { geminiConfigured } from "@/lib/ai/gemini";
import { appendStep, createRun } from "@/lib/store/repo";
import type { AgentStep } from "@/lib/types";
import { agentRequestSchema } from "@/lib/validation";

/**
 * Runs the booking agent and streams each step as Server-Sent Events:
 *   event: run   data: { runId, mode }
 *   event: step  data: AgentStep   (also appended to agentRuns.steps)
 *   event: done  data: {}
 * Validation errors return a normal `{ error }` JSON response before the stream starts.
 */
export const POST = route<IdParams>(async (req, { params }) => {
  const trip = await requireTrip((await params).id);
  const { kind, request, autoBook, exclude } = await readBody(req, agentRequestSchema);
  const run = await createRun({ tripId: trip.id, kind, userRequest: request, autoBook, mode: geminiConfigured() ? "gemini" : "offline" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false; // client went away; keep running so the booking and log still complete
        }
      };
      const emit = async (step: AgentStep) => {
        await appendStep(run.id, step);
        send("step", step);
      };
      send("run", { runId: run.id, mode: run.mode });
      try {
        await runAgent({ trip, kind, autoBook, exclude }, request, emit);
      } catch (err) {
        console.error("[agent] run failed", err);
        await emit({ type: "final", content: { status: "failed", message: "Something went wrong while booking. Nothing was charged; please try again." }, at: new Date().toISOString() });
      } finally {
        send("done", {});
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
});
