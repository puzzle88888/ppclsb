// api/submit.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const name = (body.name || '').toString().trim().slice(0, 128);
    const answer = (body.answer || '').toString().trim().slice(0, 128);

    if (!name || !answer) return res.status(400).json({ success: false });

    // Basic length / content checks
    if (name.length < 1 || answer.length < 1) return res.status(400).json({ success: false });

    // Secret stored in environment
    const secret = (process.env.SECRET_WORD || '').toString().trim();
    if (!secret) {
      console.error('SECRET_WORD not set');
      return res.status(500).json({ success: false });
    }

    // Case-insensitive comparison
    const ok = answer.toLowerCase() === secret.toLowerCase();

    if (!ok) {
      // Failed attempt: return generic failure (no hint)
      return res.status(200).json({ success: false });
    }

    // Correct answer: prepare payload to forward
    const timestamp = new Date().toISOString(); // UTC ISO8601
    const payload = {
      name,
      timestamp,
      source: 'puzzle-site',
      // optionally include limited metadata
    };

    const logEndpoint = process.env.LOG_ENDPOINT;
    if (!logEndpoint) {
      console.error('LOG_ENDPOINT not set; would have forwarded:', payload);
      // still return success so user sees overlay; you'll need to set LOG_ENDPOINT
      return res.status(200).json({ success: true });
    }

    // Forward to the configured endpoint. Include optional auth header.
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.LOG_AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.LOG_AUTH_TOKEN}`;
    }

    // Send the ping (don't fail to user on remote errors, but log)
    try {
      const r = await fetch(logEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        // small timeout is advisable but node-fetch needs extra code for timeout; skip here
      });
      if (!r.ok) {
        console.error('Forward failed', r.status, await r.text());
      }
    } catch (err) {
      console.error('Error forwarding to LOG_ENDPOINT', err);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
}
