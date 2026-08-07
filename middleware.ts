import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  const headers = new Headers(request.headers);
  const accept = (headers.get("accept") || "").toLowerCase();

  // mcp-handler currently enforces the Streamable HTTP Accept pair strictly.
  // ChatGPT's plugin scanner can probe with a narrower Accept header, so normalize
  // only the inbound /mcp transport header before the MCP handler sees it.
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    headers.set("accept", "application/json, text/event-stream");
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/mcp"],
};
