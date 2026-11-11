import fs from 'fs';
import path from 'path';

export interface EnvConfig {
  TEACHER_NAME: string;
  TEACHER_PASSWORD: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export function getAppConfig(forceReload = false): EnvConfig {
  const loadedVars: Record<string, string> = {};

  // Check multiple potential locations for .env files
  const searchDirs = [
    process.cwd(),
    path.resolve(process.cwd(), 'frontend'),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../../../..'),
  ];

  const envFileNames = ['.env.local', '.env'];

  for (const dir of searchDirs) {
    for (const fileName of envFileNames) {
      const fullPath = path.join(dir, fileName);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
              const key = match[1].trim();
              let val = match[2].trim();
              // Remove surrounding quotes if present
              if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
              ) {
                val = val.slice(1, -1);
              }
              if (!loadedVars[key]) {
                loadedVars[key] = val;
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  const TEACHER_NAME =
    process.env.TEACHER_NAME ||
    process.env.teacher_name ||
    loadedVars['TEACHER_NAME'] ||
    loadedVars['teacher_name'] ||
    'Bhargav_Appasani';

  const TEACHER_PASSWORD =
    process.env.TEACHER_PASSWORD ||
    process.env.teacher_password ||
    loadedVars['TEACHER_PASSWORD'] ||
    loadedVars['teacher_password'] ||
    'GOODexample1!';

  const supabaseUrl =
    process.env.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    loadedVars['supabaseUrl'] ||
    loadedVars['SUPABASE_URL'] ||
    loadedVars['supabase_url'] ||
    '';

  const supabaseKey =
    process.env.supabaseKey ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    loadedVars['supabaseKey'] ||
    loadedVars['SUPABASE_KEY'] ||
    loadedVars['supabase_key'] ||
    loadedVars['SUPABASE_SERVICE_ROLE_KEY'] ||
    loadedVars['SUPABASE_ANON_KEY'] ||
    '';

  return {
    TEACHER_NAME,
    TEACHER_PASSWORD,
    supabaseUrl: supabaseUrl.trim(),
    supabaseKey: supabaseKey.trim(),
  };
}
