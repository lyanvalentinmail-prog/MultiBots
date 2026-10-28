// Base de datos JSON simple (sin dependencias nativas, funciona en Termux)
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.json');

const DEFAULTS = {
  users: {},         // jid -> { coins, banco, age, desc, fav, genre, birth, married, warnings }
  groups: {},        // jid -> { antilink, antiimg, antiaudio, antivideo, antisticker, antispam, antibot, antidelete, antidocs, antipalabras: [], welcome, soloadmin, mutes: {}, mods: [] }
  global: {
    botOn: true,
    lang: 'es',
    menuStyle: 'lista',
    mods: [],
    botName: 'Satoru Gojo',
    totalCmds: 0
  },
  notes: {},         // jid -> [ {n, text} ]
  lastDaily: {},
  lastWork: {},
  fishInv: {},
  pokemon: {},       // jid -> { owned: [], team: [] }
  married: {},       // jid -> partnerJid
  birthdays: {}      // YYYY-MM-DD -> [jid]
};

function load() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULTS, null, 2));
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Merge con defaults por si faltan claves
    return { ...DEFAULTS, ...parsed, global: { ...DEFAULTS.global, ...(parsed.global || {}) } };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

let db = load();

function save() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Error guardando DB:', e);
  }
}

function getUser(jid) {
  const key = jid.split('@')[0] + '@s.whatsapp.net';
  if (!db.users[key]) {
    db.users[key] = {
      coins: 100,
      banco: 0,
      age: null,
      desc: 'Sin descripción',
      fav: null,
      genre: null,
      birth: null,
      married: null,
      warnings: 0
    };
  }
  return db.users[key];
}

function getGroup(jid) {
  if (!db.groups[jid]) {
    db.groups[jid] = {
      antilink: false, antiimg: false, antiaudio: false, antivideo: false,
      antisticker: false, antispam: false, antibot: false, antidelete: false,
      antidocs: false, antipalabras: [], welcome: true, soloadmin: false,
      mutes: {}, mods: []
    };
  }
  return db.groups[jid];
}

module.exports = { db, save, getUser, getGroup, DB_PATH };

// Auto-guardar cada 15 segundos
setInterval(save, 15000);
