import { NextResponse } from "next/server";
import { deleteKv, getKv, setKv } from "@/lib/db/repos/kv";

type Params = { params: Promise<{ namespace: string; key: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { namespace, key } = await params;
    if (!namespace || !key) {
      return NextResponse.json(
        { error: "namespace and key are required" },
        { status: 400 }
      );
    }
    const value = getKv(namespace, key);
    return NextResponse.json({ namespace, key, value });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read kv" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { namespace, key } = await params;
    if (!namespace || !key) {
      return NextResponse.json(
        { error: "namespace and key are required" },
        { status: 400 }
      );
    }
    const body = await request.json();
    setKv(namespace, key, body?.value ?? null);
    return NextResponse.json({ namespace, key, value: body?.value ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to write kv" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { namespace, key } = await params;
    deleteKv(namespace, key);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete kv" },
      { status: 500 }
    );
  }
}
