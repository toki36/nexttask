import type { NextRequest } from "next/server";

const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";
const backendTimeoutMs = 3000;

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: ProxyContext) {
  const { path } = await context.params;
  const target = new URL(`/api/${path.join("/")}`, backendURL);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");

  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), backendTimeoutMs);
  init.signal = controller.signal;

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch {
    return Response.json(
      {
        error: {
          code: "backend_unreachable",
          message: "Backend is unreachable. Start the backend on localhost:8080.",
        },
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
  const responseHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");

  if (responseContentType) responseHeaders.set("content-type", responseContentType);
  if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
