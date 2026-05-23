export async function onRequestPost({ request }) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: "No API key provided" } }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.text();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body
    });
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}
