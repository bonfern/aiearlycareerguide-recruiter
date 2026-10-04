export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const config = {
    apiKey: process.env.FIREBASE_WEB_API_KEY,
    authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_WEB_APP_ID,
    messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return res.status(503).json({ error: 'Firebase Web App configuration is incomplete' });
  }
  return res.status(200).json(config);
}
