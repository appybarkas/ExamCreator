import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    const subPath = params.path ? params.path.join('/') : '';
    if (!subPath) {
      return new NextResponse('Not found', { status: 404 });
    }

    const possibleDirs = [
      path.join(process.cwd(), 'public', 'figures'),
      path.join(process.cwd(), 'figures'),
      path.join(process.cwd(), 'frontend', 'public', 'figures'),
      path.join(process.cwd(), 'frontend', 'figures'),
      path.join(os.tmpdir(), 'figures'),
    ];

    for (const dir of possibleDirs) {
      const fullPath = path.join(dir, subPath);
      if (fs.existsSync(fullPath)) {
        const fileBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        let mime = 'image/jpeg';
        if (ext === '.png') mime = 'image/png';
        else if (ext === '.gif') mime = 'image/gif';
        else if (ext === '.svg') mime = 'image/svg+xml';
        else if (ext === '.webp') mime = 'image/webp';

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }

    return new NextResponse('Image not found', { status: 404 });
  } catch (err) {
    console.error('Figure serve error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

