import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/graph";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body as {
      messages: { role: string; content: string }[];
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "Messages array is required." },
        { status: 400 }
      );
    }

    const result = await runAgent(messages);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        content:
          "I'm sorry, I encountered an error processing your request. Please try again.",
        evidence: [],
        actions: [],
      },
      { status: 500 }
    );
  }
}
