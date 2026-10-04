import { requireRecruiter, reject } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const user = await requireRecruiter(req);
  if (user.error) return reject(res, user);
  const {filename, base64} = req.body || {};
  if (typeof filename !== 'string' || typeof base64 !== 'string' || base64.length > 2900000 || !/\.(pdf|docx|txt)$/i.test(filename)) {
    return res.status(400).json({error: 'Upload a PDF, DOCX or TXT file smaller than 2 MB'});
  }
  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > 2 * 1024 * 1024) return res.status(400).json({error: 'File must be smaller than 2 MB'});
    const ext = filename.split('.').pop().toLowerCase();
    let text = '';
    if (ext === 'txt') text = buffer.toString('utf8');
    else if (ext === 'docx') {
      if (buffer.subarray(0,2).toString() !== 'PK') return res.status(400).json({error: 'Invalid Word document'});
      const mammoth = await import('mammoth');
      text = (await mammoth.extractRawText({buffer})).value;
    } else {
      if (buffer.subarray(0,5).toString() !== '%PDF-') return res.status(400).json({error: 'Invalid PDF file'});
      const pdfParse = (await import('pdf-parse')).default;
      text = (await pdfParse(buffer)).text;
    }
    text = String(text || '').replace(/\u0000/g, '').trim();
    if (text.length < 50) return res.status(422).json({error: 'Very little readable text found. For scanned PDFs, please paste the JD instead.'});
    if (text.length > 30000) text = text.slice(0,30000);
    return res.status(200).json({text});
  } catch (error) {
    console.error('JD file parsing error:', error.message);
    return res.status(422).json({error: 'Unable to read that document. Try DOCX or paste the JD text.'});
  }
}
