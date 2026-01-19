// api/ping.ts

export const config = {
  runtime: "nodejs",
};

export default async function handler(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, ping: "pong" }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}