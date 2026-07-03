// Vercel serverless entry. vercel.json routes every /api/* request here and it
// delegates to the same request handler the local `node server.mjs` dev server
// uses, so routing lives in exactly one place. req.url is the original request
// path (e.g. /api/firms), which server.mjs's router switches on.
export { handler as default } from '../server.mjs';
