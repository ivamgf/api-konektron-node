// Túnel SSH até o Postgres do EasyPanel, para acessar o banco sem expor a porta 5432:
//   npm run db:tunnel
// Configuração no .env: SSH_HOST (obrigatório), SSH_USER, SSH_PORT, DB_CONTAINER, TUNNEL_PORT.
// Com o túnel aberto, use DATABASE_URL=postgres://…@127.0.0.1:<TUNNEL_PORT>/…
import { spawn } from 'node:child_process';
import net from 'node:net';

try {
  process.loadEnvFile();
} catch {
  // sem .env: usa as variáveis do ambiente
}

const host = process.env.SSH_HOST;
const user = process.env.SSH_USER ?? 'root';
const sshPort = process.env.SSH_PORT ?? '22';
const container = process.env.DB_CONTAINER ?? 'konektron_konektron_database';
const localPort = Number(process.env.TUNNEL_PORT ?? 5433);

if (!host) {
  console.error('✖ Defina SSH_HOST no .env (IP ou domínio da VPS).');
  process.exit(1);
}

const target = `${user}@${host}`;
// accept-new: aceita a chave do servidor na primeira conexão e recusa se ela mudar depois
const sshBase = ['-p', sshPort, '-o', 'ConnectTimeout=15', '-o', 'StrictHostKeyChecking=accept-new'];

// Roda no servidor. No Docker Swarm (EasyPanel) o IP da rede overlay não é alcançável pelo
// próprio host; o da docker_gwbridge é. Fora do Swarm, vale o IP da rede bridge do contêiner.
const remoteScript = `
CID=$(docker ps -q --no-trunc -f name=${container} | head -n1)
if [ -z "$CID" ]; then echo "ERR:container"; exit 3; fi
IP=$(docker network inspect docker_gwbridge -f '{{range $k, $v := .Containers}}{{$k}} {{$v.IPv4Address}}{{"\\n"}}{{end}}' 2>/dev/null | awk -v id="$CID" '$1 == id { split($2, a, "/"); print a[1] }')
if [ -z "$IP" ]; then IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$CID" | awk '{ print $1 }'); fi
if [ -z "$IP" ]; then echo "ERR:ip"; exit 4; fi
echo "IP:$IP"
`;

function findContainerIp() {
  return new Promise((resolve, reject) => {
    // a senha (se pedida) é lida do terminal; o script vai pelo stdin
    const ssh = spawn('ssh', [...sshBase, target, 'sh', '-s'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let out = '';
    ssh.stdout.on('data', (d) => (out += d));
    ssh.on('error', (err) =>
      reject(
        new Error(
          err.code === 'ENOENT'
            ? 'comando ssh não encontrado (instale o OpenSSH Client)'
            : err.message,
        ),
      ),
    );
    ssh.on('close', (code) => {
      const ip = out.match(/IP:(\S+)/)?.[1];
      if (ip) return resolve(ip);
      if (out.includes('ERR:container'))
        return reject(new Error(`contêiner "${container}" não está rodando no servidor`));
      if (out.includes('ERR:ip'))
        return reject(new Error('não foi possível descobrir o IP do contêiner'));
      reject(new Error(`ssh terminou com código ${code} (usuário, senha ou chave recusados?)`));
    });
    ssh.stdin.end(remoteScript);
  });
}

// Avisa quando a porta local passar a aceitar conexões
function announceWhenReady(tunnel) {
  const timer = setInterval(() => {
    const socket = net.connect(localPort, '127.0.0.1', () => {
      socket.destroy();
      clearInterval(timer);
      console.log(`\n✔ Túnel aberto: 127.0.0.1:${localPort} → banco no servidor.`);
      console.log(
        `  No .env: DATABASE_URL=postgres://<usuario>:<senha>@127.0.0.1:${localPort}/<banco>?sslmode=disable`,
      );
      console.log('  Em outro terminal: npm run db:check · Ctrl+C aqui fecha o túnel.');
    });
    socket.on('error', () => socket.destroy());
  }, 500);
  tunnel.on('close', () => clearInterval(timer));
}

try {
  console.log(`Conectando em ${target} para localizar o contêiner ${container}...`);
  const ip = await findContainerIp();
  console.log(`Banco em ${ip}:5432 no servidor. Abrindo o túnel...`);

  const tunnel = spawn(
    'ssh',
    [
      ...sshBase,
      '-N',
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=30',
      '-L',
      `127.0.0.1:${localPort}:${ip}:5432`,
      target,
    ],
    { stdio: 'inherit' },
  );
  announceWhenReady(tunnel);
  tunnel.on('close', (code) => {
    console.log(
      code
        ? `✖ Túnel encerrado (código ${code}). A porta ${localPort} já está em uso?`
        : 'Túnel fechado.',
    );
    process.exit(code ?? 0);
  });
  process.on('SIGINT', () => tunnel.kill('SIGINT'));
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}
