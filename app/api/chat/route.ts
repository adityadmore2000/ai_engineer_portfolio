import { NextRequest } from "next/server";
import { orchestrator } from "@/lib/agent/orchestrator";
import { createObservabilityService } from "@/lib/observability";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body as {
      messages: { role: string; content: string }[];
    };

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ error: "Messages array is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const service = createObservabilityService();
    const requestId = crypto.randomUUID();
    service.startRequest(requestId, { messageCount: messages.length });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const event of orchestrator(messages, {
            requestId,
            service,
          })) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch {
          const data = `data: ${JSON.stringify({
            type: "error",
            message: "I'm sorry, I encountered an error processing your request. Please try again.",
          })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } finally {
          controller.close();
          service.endRequest();
          await service.flush();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        type: "error",
        message:
          "I'm sorry, I encountered an error processing your request. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
