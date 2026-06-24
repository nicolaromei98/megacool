const corsResponse = (request: Request, payload?: any) => {
  return new Response(payload ? JSON.stringify(payload) : null, {
    headers: {
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
      "Access-Control-Allow-Headers":
        "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
      "Content-Type": "application/json",
    },
  });
};

export async function OPTIONS(request: Request) {
  return corsResponse(request);
}

export function GET(request: Request) {
  return corsResponse(request, {
    message: "Hello from me 2",
  });
}
