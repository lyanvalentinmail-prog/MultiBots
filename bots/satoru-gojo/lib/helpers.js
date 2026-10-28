// Helpers compartidos por comandos
const config = require('../config');

function isOwner(jid) {
  const num = String(jid || '').split('@')[0].replace(/\D/g, '');
  return num === String(config.ownerNumber).replace(/\D/g, '');
}

async function isAdmin(sock, jid, participant) {
  if (isOwner(participant)) return true;
  try {
    const meta = await sock.groupMetadata(jid);
    const p = meta.participants.find(x => x.id === participant);
    return !!p && (p.admin === 'admin' || p.admin === 'superadmin');
  } catch {
    return false;
  }
}

function isGroup(jid) {
  return jid && jid.endsWith('@g.us');
}

function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function getMentioned(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function getQuoted(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.participant || null;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} años`;
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} meses`;
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} días`;
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} horas`;
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutos`;
  return `${Math.floor(seconds)} segundos`;
}

module.exports = {
  isOwner, isAdmin, isGroup, getSender, getMentioned, getQuoted,
  rand, pick, formatTime, escapeRegex, timeSince
};
