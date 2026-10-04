// Single Vercel function router: retain independently tested endpoint handlers outside /api.
// Never dynamically construct a filesystem path from user input.
const handlers = {
  'assessment': () => import('../server/assessment.js'),
  'candidate': () => import('../server/candidate.js'),
  'focus': () => import('../server/focus.js'),
  'extract': () => import('../server/extract.js'),
  'generate-questions': () => import('../server/generate-questions.js'),
  'invitations': () => import('../server/invitations.js'),
  'invite': () => import('../server/invite.js'),
  'job': () => import('../server/job.js'),
  'jobs': () => import('../server/jobs.js'),
  'me': () => import('../server/me.js'),
  'parse-jd': () => import('../server/parse-jd.js'),
  'public-config': () => import('../server/public-config.js'),
  'report': () => import('../server/report.js'),
  'requirements': () => import('../server/requirements.js'),
};

export default async function router(req, res) {
  const route = req.query?.endpoint;
  if (typeof route !== "string" || !Object.hasOwn(handlers, route)) {
    return res.status(404).json({error: "Unknown API endpoint"});
  }
  try {
    const {default: handler} = await handlers[route]();
    return await handler(req, res);
  } catch (error) {
    console.error("Recruiter API router error:", error?.message || error);
    if (!res.headersSent) return res.status(500).json({error: "Service temporarily unavailable"});
  }
}
