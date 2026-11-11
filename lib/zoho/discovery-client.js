import { ZOHO_DEFAULTS } from './config';
// The source worker receives a service binding, never a database credential.
export async function discoveryCommand(binding, command, body) {
  if (!binding?.fetch) throw new Error('Discovery authority unavailable');
  let timer;
  try {
    const response = await Promise.race([
      binding.fetch(new Request(`https://discovery-authority/${command}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Discovery authority timeout')), ZOHO_DEFAULTS.requestTimeoutMs); }),
    ]);
    if (!response.ok) throw new Error('Discovery authority rejected command');
    return await response.json();
  } finally { clearTimeout(timer); }
}
