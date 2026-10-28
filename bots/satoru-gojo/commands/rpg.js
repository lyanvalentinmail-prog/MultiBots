// Comandos RPG / Economía
const { getUser, db, save } = require('../lib/database');
const { rand, pick } = require('../lib/helpers');

const COOLDOWN_MS = {
  daily: 24 * 3600 * 1000,
  work: 15 * 60 * 1000,
  crimen: 20 * 60 * 1000,
  robar: 30 * 60 * 1000,
  minar: 10 * 60 * 1000,
  pescar: 8 * 60 * 1000,
  cazar: 12 * 60 * 1000,
  suerte: 60 * 60 * 1000,
  sorpresa: 3 * 3600 * 1000,
  dado: 60 * 1000
};

function cooldown(jid, name) {
  const key = name + '_' + jid;
  const last = db.lastDaily[key] || 0;
  const cd = COOLDOWN_MS[name];
  if (Date.now() - last < cd) {
    const left = cd - (Date.now() - last);
    const min = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  }
  return null;
}
function setCd(jid, name) { db.lastDaily[name + '_' + jid] = Date.now(); save(); }

function parseAmount(u, arg) {
  if (!arg) return 0;
  if (arg === 'all') return u.coins;
  const n = parseInt(arg.replace(/\D/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

module.exports = {
  title: '✺ •• ┈┈ ⋯ Juegos RPG ⋯ ┈┈ •• ✺',
  commands: [
    {
      pattern: 'balance',
      desc: 'Ver tu balance',
      handler: async (sock, jid, a, msg) => {
        const sender = msg.key.participant || jid;
        const u = getUser(sender);
        await sock.sendMessage(jid, { text: `💰 *Balance*\n💵 Billetera: ${u.coins} monedas\n🏦 Banco: ${u.banco} monedas` });
      }
    },
    { pattern: 'coins', desc: 'Ver tus monedas', handler: async (s,j,a,m) => {
      const u = getUser(m.key.participant||j);
      await s.sendMessage(j,{text:`💵 Tienes ${u.coins} monedas.`});
    }},
    {
      pattern: 'transf',
      desc: 'Transferir monedas',
      handler: async (sock, jid, args, msg) => {
        const sender = msg.key.participant || jid;
        const me = getUser(sender);
        const parts = args.trim().split(/\s+/);
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const amt = parseAmount(me, parts[1] || parts[0]);
        if (!target) return sock.sendMessage(jid,{text:'❌ Menciona a un usuario.'});
        if (!amt || amt > me.coins) return sock.sendMessage(jid,{text:'❌ Monedas insuficientes.'});
        me.coins -= amt; getUser(target).coins += amt; save();
        await sock.sendMessage(jid,{text:`✅ Transferidas ${amt} monedas a @${target.split('@')[0]}.`,mentions:[target]});
      }
    },
    {
      pattern: 'dado',
      desc: 'Lanzar un dado (apuesta)',
      handler: async (sock, jid, args, msg) => {
        const sender = msg.key.participant || jid;
        const cd = cooldown(sender,'dado'); if (cd) return sock.sendMessage(jid,{text:`⏳ Espera ${cd}.`});
        const n = rand(1,6); setCd(sender,'dado');
        await sock.sendMessage(jid,{text:`🎲 Dado: *${n}*\n${n>=4?'🎉 ¡Buena suerte!':'😬 Mala suerte.'}`});
      }
    },
    {
      pattern: 'daily',
      desc: 'Recompensa diaria',
      handler: async (sock, jid, a, msg) => {
        const sender = msg.key.participant || jid;
        const cd = cooldown(sender,'daily'); if (cd) return sock.sendMessage(jid,{text:`⏳ Ya reclamaste tu diario. Próxima en ${cd}.`});
        const amt = rand(100,500); getUser(sender).coins += amt; setCd(sender,'daily'); save();
        await sock.sendMessage(jid,{text:`🎁 *Recompensa diaria*\n+${amt} monedas!`});
      }
    },
    {
      pattern: 'adivinanza',
      desc: 'Juego de adivinanzas (simple)',
      handler: async (sock,jid) => {
        await sock.sendMessage(jid,{text:'🧠 Modo adivinanza: responde con el número del 1 al 5. (Temporalmente sin multijugador: escribe un número y ganas entre 10-50 monedas.)'});
      }
    },
    {
      pattern: 'pescar',
      desc: 'Ir a pescar',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'pescar'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const fishes=['🐟 Pez payaso','🐠 Pez tropical','🐡 Pez globo','🦈 Tiburón','🦑 Calamar','🎣 Bota vieja','💎 Cofre'];
        const f=pick(fishes); const gain=rand(10,80); getUser(s).coins+=gain; setCd(s,'pescar'); save();
        await sock.sendMessage(jid,{text:`🎣 Has pescado: *${f}*\n+${gain} monedas.`});
      }
    },
    {
      pattern: 'miner',
      desc: 'Minar',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'minar'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const ores=['🪨 Piedra','💿 Hierro','🥈 Plata','🥇 Oro','💎 Diamante'];
        const o=pick(ores); const g=rand(20,150); getUser(s).coins+=g; setCd(s,'minar'); save();
        await sock.sendMessage(jid,{text:`⛏️ Minaste *${o}*\n+${g} monedas.`});
      }
    },
    {
      pattern: 'work',
      desc: 'Trabajar',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'work'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const jobs=['Repartiste pizza 🍕','Programaste una app 💻','Pintaste un cuadro 🎨','Cuidaste niños 👶','Cosechaste frutas 🍎','Arreglaste coches 🚗'];
        const j=pick(jobs); const g=rand(50,200); getUser(s).coins+=g; setCd(s,'work'); save();
        await sock.sendMessage(jid,{text:`💼 ${j}\n+${g} monedas.`});
      }
    },
    {
      pattern: 'suerte',
      desc: 'Prueba tu suerte',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'suerte'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const u=getUser(s); const win=Math.random()<0.4; const g=win?rand(200,1000):-rand(50,200); u.coins=Math.max(0,u.coins+g); setCd(s,'suerte'); save();
        await sock.sendMessage(jid,{text:`🍀 ${win?'¡Mucha suerte!':'Mala suerte...'} ${g>=0?'+':''}${g} monedas.`});
      }
    },
    {
      pattern: 'crimen',
      desc: 'Cometer un crimen',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'crimen'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const u=getUser(s); const success=Math.random()<0.55; const g=success?rand(100,500):-rand(50,300); u.coins=Math.max(0,u.coins+g); setCd(s,'crimen'); save();
        await sock.sendMessage(jid,{text:`🔫 ${success?'Crimen exitoso':'Te atraparon, multa'}: ${g>=0?'+':''}${g} monedas.`});
      }
    },
    {
      pattern: 'cazar',
      desc: 'Cazar',
      handler: async (sock,jid,args,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'cazar'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const animals=['🐗 Jabalí','🦌 Ciervo','🐰 Conejo','🐻 Oso','🍃 Nada'];
        const animal=pick(animals); const g=animal.includes('Nada')?0:rand(30,120); getUser(s).coins+=g; setCd(s,'cazar'); save();
        await sock.sendMessage(jid,{text:`🏹 Cazaste: *${animal}*\n+${g} monedas.`});
      }
    },
    {
      pattern: 'cofre',
      desc: 'Abrir cofre',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const u=getUser(s);
        if(u.coins<50) return sock.sendMessage(jid,{text:'❌ Necesitas 50 monedas.'});
        u.coins-=50; const g=rand(0,200); u.coins+=g; save();
        await sock.sendMessage(jid,{text:`🎁 Abriste un cofre: +${g} monedas (costo: 50).`});
      }
    },
    {
      pattern: 'ppt',
      desc: 'Piedra, papel o tijera',
      handler: async (sock,jid,args,msg)=>{
        const opt=(args.split(/\s+/)[0]||'').toLowerCase();
        if(!['piedra','papel','tijera'].includes(opt)) return sock.sendMessage(jid,{text:'❌ Uso: .ppt piedra|papel|tijera'});
        const cpu=pick(['piedra','papel','tijera']);
        const win=(opt==='piedra'&&cpu==='tijera')||(opt==='papel'&&cpu==='piedra')||(opt==='tijera'&&cpu==='papel');
        const tie=opt===cpu;
        await sock.sendMessage(jid,{text:`✊✋✌️ Tú: ${opt} / Bot: ${cpu}\n${tie?'🤝 Empate':win?'🏆 ¡Ganaste!':'😭 Perdiste.'}`});
      }
    },
    { pattern: 'ahorcado', desc: 'Juego del ahorcado', handler: async (s,j)=>s.sendMessage(j,{text:'🎮 Ahorcado en progreso: escribe una letra para jugar (usa el chat).'}) },
    { pattern: 'banco', desc: 'Ver banco', handler: async (s,j,a,m)=>{
      const u=getUser(m.key.participant||j); await s.sendMessage(j,{text:`🏦 *Banco*\nSaldo: ${u.banco} monedas.`});
    }},
    {
      pattern: 'deposit',
      desc: 'Depositar monedas',
      handler: async (sock,jid,args,msg)=>{
        const s=msg.key.participant||jid; const u=getUser(s); const n=parseAmount(u,args.trim());
        if(!n||n>u.coins)return sock.sendMessage(jid,{text:'❌ Monto inválido.'});
        u.coins-=n; u.banco+=n; save(); await sock.sendMessage(jid,{text:`🏦 Depositaste ${n}. Saldo banco: ${u.banco}.`});
      }
    },
    {
      pattern: 'robar',
      desc: 'Robar',
      handler: async (sock,jid,args,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'robar'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const t=msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if(!t)return sock.sendMessage(jid,{text:'❌ Menciona a quién robar.'});
        const u=getUser(s), v=getUser(t); const ok=Math.random()<0.4;
        if(!ok||v.coins<10){u.coins=Math.max(0,u.coins-50); setCd(s,'robar'); save(); return sock.sendMessage(jid,{text:'🚔 Te atraparon: -50 monedas.'});}
        const g=rand(10,Math.min(200,v.coins)); v.coins-=g; u.coins+=g; setCd(s,'robar'); save();
        await sock.sendMessage(jid,{text:`🕵️ Robaste ${g} monedas a @${t.split('@')[0]}.`,mentions:[t]});
      }
    },
    {
      pattern: 'sorpresa',
      desc: 'Caja sorpresa',
      handler: async (sock,jid,a,msg)=>{
        const s=msg.key.participant||jid; const cd=cooldown(s,'sorpresa'); if(cd)return sock.sendMessage(jid,{text:`⏳ ${cd}`});
        const u=getUser(s); const g=rand(-50,150); u.coins=Math.max(0,u.coins+g); setCd(s,'sorpresa'); save();
        await sock.sendMessage(jid,{text:`🎁 Caja sorpresa: ${g>=0?'+':''}${g} monedas.`});
      }
    },
    { pattern: 'w', desc: 'Apuesta simple (w/rw)', handler: async (s,j)=>s.sendMessage(j,{text:'🎰 Apuesta: escribe .w <cantidad> y prueba tu suerte.'}) },
    { pattern: 'rw', desc: 'Apuesta rápida', handler: async (s,j)=>s.sendMessage(j,{text:'🎰 .rw <cantidad> para apuesta rápida.'}) },
    { pattern: 'claim', desc: 'Reclamar recompensa', handler: async (s,j,a,m)=>{const u=getUser(m.key.participant||j); u.coins+=50; save(); s.sendMessage(j,{text:'🎁 +50 monedas!'});} },
    { pattern: 'c', desc: 'Atajo claim', handler: async (s,j,a,m)=>{
      const { getUser, save } = require('../lib/database');
      const u=getUser(m.key.participant||j); u.coins+=50; save(); s.sendMessage(j,{text:'🎁 +50 monedas!'});
    }},
    { pattern: 'tiendag', desc: 'Ver tienda del grupo', handler: async (s,j)=>s.sendMessage(j,{text:'🛒 *Tienda del grupo*\n1. Espada (100)\n2. Escudo (80)\n3. Poción (30)\nUsa .comprarg <orden>'}) },
    { pattern: 'comprarg', desc: 'Comprar en tienda', handler: async (sock,jid,args,msg)=>{
      const u=getUser(msg.key.participant||jid); const n=parseInt(args); const prices={1:['Espada',100],2:['Escudo',80],3:['Poción',30]}; const it=prices[n];
      if(!it)return sock.sendMessage(jid,{text:'❌ Ítem inválido. Usa .tiendag.'});
      if(u.coins<it[1])return sock.sendMessage(jid,{text:'❌ Monedas insuficientes.'});
      u.coins-=it[1]; save(); await sock.sendMessage(jid,{text:`✅ Compraste ${it[0]} por ${it[1]} monedas.`});
    }},
    { pattern: 'change', desc: 'Cambiar de banco', handler: async (s,j,a)=>s.sendMessage(j,{text:`🏦 Banco cambiado a: ${a||'Principal'}.`}) },
    { pattern: 'unirsebank', desc: 'Unirse a un banco', handler: async (s,j,a)=>s.sendMessage(j,{text:`🏦 Te uniste al banco ${a||'Principal'}.`}) },
    { pattern: 'prestamo', desc: 'Pedir préstamo', handler: async (sock,jid,args,msg)=>{
      const u=getUser(msg.key.participant||jid); const n=parseInt(args); if(!n)return sock.sendMessage(jid,{text:'❌ Monto inválido.'}); u.coins+=n; save(); await sock.sendMessage(jid,{text:`🏦 Préstamo de ${n} aprobado. A pagar en los próximos días.`});
    }},
    { pattern: 'pagar', desc: 'Pagar préstamo', handler: async (sock,jid,args,msg)=>{const u=getUser(msg.key.participant||jid); const n=parseInt(args)||50; if(u.coins<n)return sock.sendMessage(jid,{text:'❌ Insuficiente.'}); u.coins-=n; save(); await sock.sendMessage(jid,{text:`💸 Pagaste ${n} del préstamo.`}); } },
  ]
};
