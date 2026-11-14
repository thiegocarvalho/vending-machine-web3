// Perguntas no terminal. A senha/chave é lida sem aparecer na tela e nunca vai para o histórico do shell.
const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

function askHidden(question) {
  if (!process.stdin.isTTY) throw new Error('Este passo precisa de um terminal interativo (a senha não pode ser lida de um pipe).');
  return new Promise((res, rej) => {
    process.stdout.write(question);
    const stdin = process.stdin; let buf = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const done = (fn, v) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); fn(v); };
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') return done(res, buf);
        if (c === '\u0003') return done(rej, new Error('Cancelado.'));          // Ctrl+C
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1); else if (c >= ' ') buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

// Só segue se a pessoa digitar exatamente `expected` (ex.: o nome da rede).
async function confirmTyped(message, expected) {
  const a = await ask(`${message}\nDigite "${expected}" para continuar (qualquer outra coisa cancela): `);
  return a === expected;
}

module.exports = { ask, askHidden, confirmTyped };
