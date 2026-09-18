import { NextRequest, NextResponse } from "next/server";
import { buildGroundedReply } from "@/lib/assistant/chat";
import { getRepositoryContext } from "@/lib/repository-context";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { repository?: string; branch?: string; message?: string; refresh?: boolean };
    if (!body.repository?.trim()) return NextResponse.json({ error: "Repository is required." }, { status: 400 });
    if (!body.message?.trim()) return NextResponse.json({ error: "A question is required." }, { status: 400 });
    const context = await getRepositoryContext(body.repository, body.branch, body.refresh);
    const reply = buildGroundedReply(body.message, context);
    return NextResponse.json({ ...reply, context: { owner: context.owner, repository: context.repository, branch: context.branch, commitSha: context.commitSha, visibility: context.visibility, cached: context.cached, fetchedAt: context.fetchedAt, files: context.files.map(file => ({ path: file.path, importance: file.importance })) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect this repository.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
