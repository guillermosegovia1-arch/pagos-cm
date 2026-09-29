export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'cicloEscolar' },
    });

    const cicloEscolar = setting?.value || '2026 - 2027';
    return NextResponse.json({ cicloEscolar });
  } catch (err) {
    return NextResponse.json({ cicloEscolar: '2026 - 2027' });
  }
}
