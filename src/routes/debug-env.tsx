import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const getDatabaseConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const rawUrl = process.env.SUPABASE_URL || "not set";
    const rawKey = process.env.SUPABASE_PUBLISHABLE_KEY || "not set";
    const projectRef = process.env.SUPABASE_PROJECT_ID || "not set";
    
    let dbStatus = "Checking...";
    let dbError: any = null;
    let tablesList: string[] = [];

    try {
      const sanitizedUrl = rawUrl.replace(/\/rest\/v1\/?$/, "");
      const supabase = createClient(sanitizedUrl, rawKey);
      
      const { data, error } = await supabase.from("product_types").select("id, name").limit(1);
      if (error) {
        dbStatus = "Failed to query product_types";
        dbError = error;
      } else {
        dbStatus = "Success! Found product_types table.";
      }

      const { error: productsErr } = await supabase.from("products").select("id").limit(1);
      tablesList.push("product_types: " + (error ? "Error: " + error.message : "Exists"));
      tablesList.push("products: " + (productsErr ? "Error: " + productsErr.message : "Exists"));
    } catch (e: any) {
      dbStatus = "Exception occurred";
      dbError = { message: e.message, stack: e.stack };
    }

    return {
      SUPABASE_URL: rawUrl,
      SUPABASE_PROJECT_ID: projectRef,
      SUPABASE_PUBLISHABLE_KEY_PREVIEW: rawKey !== "not set" ? rawKey.substring(0, 12) + "..." + rawKey.slice(-8) : "not set",
      dbStatus,
      dbError,
      tablesList,
    };
  });

export const Route = createFileRoute("/debug-env")({
  loader: async () => {
    return await getDatabaseConfig();
  },
  component: DebugEnvPage,
});

function DebugEnvPage() {
  const data = Route.useLoaderData();

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", backgroundColor: "#0f172a", color: "#e2e8f0", minHeight: "100vh" }}>
      <h1 style={{ color: "#38bdf8", borderBottom: "1px solid #334155", paddingBottom: "0.5rem" }}>Environment Debug Audit</h1>
      
      <div style={{ marginTop: "1.5rem" }}>
        <h2>Environment Variables (Vercel Server):</h2>
        <ul>
          <li><strong>SUPABASE_URL:</strong> <span style={{ color: "#a7f3d0" }}>{data.SUPABASE_URL}</span></li>
          <li><strong>SUPABASE_PROJECT_ID:</strong> <span style={{ color: "#a7f3d0" }}>{data.SUPABASE_PROJECT_ID}</span></li>
          <li><strong>SUPABASE_PUBLISHABLE_KEY:</strong> <span style={{ color: "#a7f3d0" }}>{data.SUPABASE_PUBLISHABLE_KEY_PREVIEW}</span></li>
        </ul>
      </div>

      <div style={{ marginTop: "2rem", borderTop: "1px solid #334155", paddingTop: "1rem" }}>
        <h2>Database Connection Audit:</h2>
        <p><strong>Status:</strong> <span style={{ color: data.dbStatus.includes("Success") ? "#4ade80" : "#f87171" }}>{data.dbStatus}</span></p>
        
        {data.dbError && (
          <pre style={{ backgroundColor: "#1e293b", padding: "1rem", borderRadius: "0.375rem", overflowX: "auto", color: "#f87171" }}>
            {JSON.stringify(data.dbError, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ marginTop: "2rem", borderTop: "1px solid #334155", paddingTop: "1rem" }}>
        <h2>Tables Inspected:</h2>
        <ul>
          {data.tablesList.map((t, idx) => (
            <li key={idx}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
