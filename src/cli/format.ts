import { relative } from 'node:path';

export function relPath(p: string): string {
  const r = relative(process.cwd(), p);
  if (r === '') return '.';
  if (r.startsWith('..')) return r;
  return `./${r}`;
}
