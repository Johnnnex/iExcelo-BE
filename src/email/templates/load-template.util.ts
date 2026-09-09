import * as fs from 'fs';
import * as path from 'path';

const HTML_DIR = path.join(__dirname, '../../../html');

export function loadTemplate(
  filename: string,
  vars: Record<string, string> = {},
): string {
  let html = fs.readFileSync(path.join(HTML_DIR, filename), 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    html = html.split(`{{${key}}}`).join(value);
  }
  return html;
}
