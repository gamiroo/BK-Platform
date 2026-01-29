// api/ping.ts

export const config = {
  runtime: "nodejs",
};

export default {
  async fetch(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({ ok: true, ping: "pong" }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};
