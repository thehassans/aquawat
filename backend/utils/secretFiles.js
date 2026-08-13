import fs from 'fs';

/**
 * Docker / Kubernetes secret files: JWT_SECRET_FILE=/run/secrets/jwt_secret
 * copies the file contents into JWT_SECRET when the env var is empty.
 * Explicit env values always win.
 */
export function applySecretFiles(env = process.env) {
  const loaded = [];
  for (const key of Object.keys(env)) {
    if (!key.endsWith('_FILE')) continue;
    const target = key.slice(0, -5);
    if (!target) continue;
    if (String(env[target] || '').trim()) continue;
    const filePath = String(env[key] || '').trim();
    if (!filePath) continue;
    try {
      env[target] = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
      loaded.push(target);
    } catch (error) {
      throw new Error(`Failed to read secret file ${key}=${filePath}: ${error.message}`);
    }
  }
  return loaded;
}

export default { applySecretFiles };
