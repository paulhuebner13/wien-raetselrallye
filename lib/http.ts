import { NextResponse } from 'next/server';

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function bad(error: string, status = 400) { return NextResponse.json({ error }, { status }); }
export function normalize(value: string) { return value.trim().toLocaleLowerCase('de-AT').replace(/\s+/g, ' '); }
export function normalizeBeer(value: string) {
  return normalize(value)
    .replace(/\b(?:0[,.](?:33|35|5)|330|350|500)\s*(?:l|ml)?\b/g, '')
    .replace(/\b(?:33|35|50)\s*cl\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
