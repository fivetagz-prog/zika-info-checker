// Vercel serverless function — proxies requests to official Roblox APIs
// No external dependencies needed, uses native fetch (Node 18+)

const ROBLOX_BASES = {
  users: 'https://users.roblox.com',
  friends: 'https://friends.roblox.com',
  groups: 'https://groups.roblox.com',
  badges: 'https://badges.roblox.com',
  thumbnails: 'https://thumbnails.roblox.com'
};

export default async function handler(req, res) {
  // Enable CORS for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  
  if (!path || !Array.isArray(path) || path.length < 2) {
    return res.status(400).json({ error: 'Invalid path. Use /api/proxy/<service>/<endpoint>' });
  }

  const [service, ...endpointParts] = path;
  const endpoint = '/' + endpointParts.join('/');
  
  if (!ROBLOX_BASES[service]) {
    return res.status(400).json({ error: `Unknown service: ${service}` });
  }

  const targetUrl = `${ROBLOX_BASES[service]}${endpoint}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // Forward body for POST requests
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
