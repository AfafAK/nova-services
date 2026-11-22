'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const DATA_DIR = path.join(__dirname, 'data');

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

/* Headers de sécurité de base */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

/* CORS (uniquement pour /api, utile si le front tourne sur Live Server) */
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', Vary: 'Origin' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* Limiteur simple en mémoire : 5 envois / 15 min / IP */
const hits = new Map();
const rateLimit = (req, res, next) => {
  const now = Date.now(), win = 15 * 60 * 1000;
  const list = (hits.get(req.ip) || []).filter(t => now - t < win);
  if (list.length >= 5) return res.status(429).json({ ok: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  list.push(now); hits.set(req.ip, list);
  next();
};

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function validate({ name, email, subject, message }) {
  const errors = {};
  if (typeof name !== 'string' || name.trim().length < 3 || name.length > 100) errors.name = 'Nom invalide.';
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) errors.email = 'Email invalide.';
  if (typeof subject !== 'string' || subject.trim().length < 3 || subject.length > 150) errors.subject = 'Sujet invalide.';
  if (typeof message !== 'string' || message.trim().length < 10 || message.length > 3000) errors.message = 'Message invalide (10 à 3000 caractères).';
  return errors;
}

const smtpReady = Boolean(process.env.SMTP_HOST && process.env.CONTACT_TO);
const transporter = smtpReady ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

app.post('/api/contact', rateLimit, async (req, res) => {
  const body = req.body || {};
  if (body.website) return res.json({ ok: true, message: 'Message envoyé.' }); // honeypot anti-spam

  const errors = validate(body);
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, message: 'Données invalides.', errors });

  const entry = {
    date: new Date().toISOString(),
    name: body.name.trim(), email: body.email.trim(),
    subject: body.subject.trim(), message: body.message.trim()
  };

  try {
    /* Sauvegarde locale (sauvegarde de secours) */
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(path.join(DATA_DIR, 'messages.jsonl'), JSON.stringify(entry) + '\n');

    /* Envoi email si SMTP configuré */
    if (transporter) {
      await transporter.sendMail({
        from: `"Nova Services (site)" <${process.env.SMTP_USER}>`,
        to: process.env.CONTACT_TO,
        replyTo: `"${entry.name.replace(/"/g, '')}" <${entry.email}>`,
        subject: `[Site] ${entry.subject}`.replace(/[\r\n]/g, ' '),
        text: `De: ${entry.name} <${entry.email}>\n\n${entry.message}`,
        html: `<p><strong>De :</strong> ${escapeHtml(entry.name)} (${escapeHtml(entry.email)})</p><p>${escapeHtml(entry.message).replace(/\n/g, '<br>')}</p>`
      });
    }
    res.json({ ok: true, message: 'Merci ! Votre message a bien été envoyé.' });
  } catch (err) {
    console.error('Erreur contact :', err.message);
    res.status(500).json({ ok: false, message: "Une erreur est survenue. Veuillez réessayer plus tard." });
  }
});

/* Fichiers statiques : uniquement le site public (jamais .env ni server.js) */
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`Nova Services : http://localhost:${PORT}`);
  console.log(smtpReady ? 'Email SMTP : activé' : 'Email SMTP : non configuré (messages sauvegardés dans data/messages.jsonl)');
});
