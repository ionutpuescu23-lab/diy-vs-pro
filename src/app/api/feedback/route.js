// src/app/api/feedback/route.js
// Stores user feedback (ease-of-use rating, improvement ideas, comments) in
// Postgres via a generic client (works with Supabase, Neon, or any standard
// Postgres provider). Auto-creates the table on first use so no separate
// migration step is needed for a table this small.
import postgres from "postgres";

export async function POST(request) {
  try {
    const { easeOfUse, improvements, comments } = await request.json();

    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connStr) {
      return Response.json({ error: "Feedback storage isn't configured yet" }, { status: 500 });
    }

    const sql = postgres(connStr, { ssl: "require", prepare: false });
    await sql`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        ease_of_use INTEGER,
        improvements TEXT,
        comments TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`
      INSERT INTO feedback (ease_of_use, improvements, comments)
      VALUES (${easeOfUse ?? null}, ${improvements || ""}, ${comments || ""})
    `;

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Feedback route failed:", err);
    return Response.json(
      { error: "Couldn't save feedback", detail: String(err.message || err) },
      { status: 500 }
    );
  }
}
