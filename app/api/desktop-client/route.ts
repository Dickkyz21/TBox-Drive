import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sourcePath = path.join(process.cwd(), 'sync-tool', 'desktop_client.py');
  const source = await readFile(sourcePath, 'utf-8');
  const origin = req.nextUrl.origin;
  const userAgent = req.headers.get('user-agent') ?? '';
  const filename = /windows/i.test(userAgent)
    ? 'teledrive-desktop-client.pyw'
    : 'teledrive-desktop-client.py';
  const patched = source.replace(
    'DEFAULT_SERVER_URL = os.environ.get("TELEDRIVE_SERVER_URL", "").strip()',
    `DEFAULT_SERVER_URL = os.environ.get("TELEDRIVE_SERVER_URL", "${origin}").strip()`
  );

  return new NextResponse(patched, {
    headers: {
      'Content-Type': 'text/x-python; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
