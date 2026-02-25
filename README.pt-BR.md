# discordjs-plus

> Extensões, correções de bugs e funcionalidades da API do Discord que faltam no **discord.js v14**.

[![npm](https://img.shields.io/npm/v/discordjs-plus)](https://www.npmjs.com/package/discordjs-plus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## ⚠️ Aviso de Compatibilidade (importante — leia antes de usar)

Mantemos esta tabela atualizada conforme o discord.js evolui:

| Funcionalidade | discord.js nativo | Status nesta lib |
|---|---|---|
| `PollManager` | ✅ Adicionado no **v14.15.0** | Backport para `< 14.15.0` + utilitários extras (eleitores, resultados brutos) |
| `ApplicationEmojiManager` | ✅ Adicionado no **v14.16.0** | Backport para `< 14.16.0` + helper `toString()` |
| `SoundboardManager` | ✅ Adicionado no **v14.16+** | Backport para versões mais antigas |
| `ForumTagManager` (operações atômicas) | ❌ Nunca adicionado | Sempre útil — DJS ainda exige reenvio do array completo |
| Bug `awaitReactions idle` | 🐛 **Ainda quebrado** ([#11286](https://github.com/discordjs/discord.js/issues/11286), Nov 2025) | Corrigido via `applyPatches()` |
| `MaxListenersExceededWarning` em collectors | 🐛 **Contínuo** ([#4626](https://github.com/discordjs/discord.js/issues/4626)) | Corrigido via `SafeCollector` |
| `BurstReactionManager` (parâmetro type) | ❌ Não exposto | Sempre útil |
| `RateLimitQueue` | ❌ Não fornecido | Sempre útil |
| `Collection#findAll / groupBy / random` | ❌ Não fornecido | Sempre útil via `applyPatches()` |
| `GuildMember#guildBannerURL` | ❌ Não fornecido | Sempre útil via `applyPatches()` |
| `channel.sendTypingFor(ms)` | ❌ Não fornecido | Sempre útil via `applyPatches()` |

**Resumo:** Se você usa discord.js ≥ 14.16.0, as principais razões para usar esta lib são as correções de bugs, `ForumTagManager`, `SafeCollector`, `RateLimitQueue` e `BurstReactionManager`. Os managers de Polls/Emoji/Soundboard são um bônus para versões mais antigas ou pelos utilitários extras que expõem.

---

## Por que isso existe?

O discord.js é incrível, mas tem lacunas reais e confirmadas:

- **`awaitReactions idle`** — Ignorado desde a v11, ainda quebrado em novembro de 2025 ([issue #11286](https://github.com/discordjs/discord.js/issues/11286))
- **`MaxListenersExceededWarning`** — Um dos problemas mais comuns do discord.js, causado por collectors que não limpam listeners corretamente ([issue #4626](https://github.com/discordjs/discord.js/issues/4626), [#3943](https://github.com/discordjs/discord.js/issues/3943))
- **Forum tags substituem tudo** — `channel.edit({ availableTags: [...] })` apaga silenciosamente qualquer tag não incluída no array. Não existe operação atômica nativa de add/remove.
- **Duplicatas em forum tags** — A API do Discord aceita IDs de tags duplicados, um bug confirmado em [discord-api-docs #5408](https://github.com/discord/discord-api-docs/issues/5408). Nosso `ForumTagManager#setThreadTags` desuplica automaticamente.
- **Burst reactions** — O parâmetro `type` para super reactions não está exposto nos métodos de `MessageReaction` do discord.js.
- **Backport de Application Emojis** — Só foi adicionado ao discord.js na v14.16.0 após solicitação da comunidade em [issue #10396](https://github.com/discordjs/discord.js/issues/10396) (julho de 2024).

---

## Instalação

```bash
npm install discordjs-plus
# discord.js deve estar instalado como peer dependency
npm install discord.js
```

---

## Início Rápido

```js
const { Client, GatewayIntentBits } = require('discord.js');
const {
  applyPatches,
  PollManager,
  PollBuilder,
  SoundboardManager,
  ApplicationEmojiManager,
  ForumTagManager,
  SafeCollector,
  RateLimitQueue,
  BurstReactionManager,
} = require('discordjs-plus');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  // Aplica correções de bugs e extensões nas classes do discord.js
  applyPatches();
  console.log(`Logado como ${client.user.tag}`);
});

client.login('SEU_TOKEN');
```

---

## Referência da API

### `applyPatches()`

Aplica todas as correções e extensões nas classes do discord.js. Chame apenas uma vez quando o bot estiver pronto.

**O que é corrigido/adicionado:**

- `Collection#findAll(fn)` — encontra **todos** os itens que satisfazem a condição (não apenas o primeiro)
- `Collection#random(n)` — retorna N itens aleatórios
- `Collection#groupBy(fn)` — agrupa itens por uma chave
- `Message#awaitReactions` — corrige a opção `idle` que era ignorada pelo discord.js
- `Message#safeCrosspost()` — faz crosspost sem lançar erro se o canal não for de anúncios
- `GuildMember#guildBannerURL(options)` — retorna a URL do banner específico do servidor do membro
- `BaseInteraction#isFromGuild()` — retorna `true` se a interação veio de um servidor
- `BaseInteraction#resolvedLocale` — locale com fallback (`locale → guildLocale → 'en-US'`)
- `TextChannel#sendTypingFor(ms)` — envia indicador de digitação por uma duração definida

```js
applyPatches();

// Agora disponível:
const membrosOnline = guild.members.cache.findAll(m => m.presence?.status === 'online');
const cincoAleatorios = guild.members.cache.random(5);
const porCargo = guild.members.cache.groupBy(m => m.roles.highest.name);

const banner = member.guildBannerURL({ size: 1024 });

const digitando = channel.sendTypingFor(10_000);
await processamentoHeavy();
digitando.stop();
```

---

### `PollManager`

Suporte completo à API de Enquetes do Discord — criar, encerrar antes do prazo, obter resultados e buscar eleitores.

```js
const pollManager = new PollManager(client);

// Criar uma enquete
const mensagem = await pollManager.create('canalId', {
  question: 'Qual é sua linguagem favorita?',
  answers: [
    'JavaScript',
    { text: 'TypeScript', emoji: '🔷' },
    { text: 'Python', emoji: '🐍' },
  ],
  duration: 24,            // horas (1–168)
  allowMultiselect: false, // permite múltiplas escolhas?
});

// Buscar resultados
const resultados = await pollManager.getResults('canalId', mensagem.id);
console.log(resultados.answers);
// [{ id: 1, text: 'JavaScript', count: 42, meVoted: false }, ...]

// Buscar eleitores da resposta #1
const eleitores = await pollManager.getVoters('canalId', mensagem.id, 1, { limit: 100 });

// Encerrar enquete antes do prazo
await pollManager.end('canalId', mensagem.id);
```

---

### `PollBuilder`

Builder fluente para configurar enquetes. Use junto com `PollManager#create`.

```js
const enquete = new PollBuilder()
  .setQuestion('Melhor framework JS?')
  .addAnswer('React', '⚛️')
  .addAnswer('Vue', '💚')
  .addAnswer('Svelte', '🧡')
  .setDuration(48)        // 48 horas
  .allowMultiselect()     // permitir múltiplas escolhas
  .build();

await pollManager.create('canalId', enquete);
```

---

### `SoundboardManager`

Criação, edição, exclusão e envio de sons no Soundboard. Suporte a 100% da API de Soundboard do Discord.

```js
const soundboard = new SoundboardManager(client);

// Listar sons padrão do Discord
const padrao = await soundboard.getDefaultSounds();

// Listar sons do servidor
const sons = await soundboard.getGuildSounds('servidorId');

// Criar um som (formato OGG Opus, máx 512KB)
const fs = require('fs');
const novoSom = await soundboard.create('servidorId', {
  name: 'meu-som',
  sound: `data:audio/ogg;base64,${fs.readFileSync('./som.ogg').toString('base64')}`,
  volume: 0.8,
  emojiName: '🔊',
});

// Editar
await soundboard.edit('servidorId', novoSom.sound_id, { volume: 1.0 });

// Excluir
await soundboard.delete('servidorId', novoSom.sound_id);
```

---

### `ApplicationEmojiManager`

Gerencie emojis vinculados à sua aplicação — usáveis em qualquer servidor, sem precisar de Nitro.

```js
const emojiManager = new ApplicationEmojiManager(client);

// Listar todos os emojis da aplicação
const emojis = await emojiManager.fetchAll();

// Criar um emoji
const fs = require('fs');
const emoji = await emojiManager.create({
  name: 'meu_logo',
  image: `data:image/png;base64,${fs.readFileSync('./logo.png').toString('base64')}`,
});

// Usar em uma mensagem
await canal.send(`Confira: ${emojiManager.toString(emoji)}`);

// Editar ou excluir
await emojiManager.edit(emoji.id, 'novo_nome');
await emojiManager.delete(emoji.id);
```

---

### `ForumTagManager`

Operações atômicas em tags de canal de fórum — sem mais apagar tags por acidente.

> **Bug do discord.js:** Ao editar tags de um canal de fórum, você precisa reenviar o array inteiro de tags. Esquecer de incluir uma tag existente a apaga silenciosamente. Este manager resolve isso com operações seguras.

```js
const tagManager = new ForumTagManager(client);

// ✅ Seguro: adiciona a tag sem afetar as existentes
await tagManager.addTag('canalForumId', {
  name: 'Report de Bug',
  emojiName: '🐛',
  moderated: false,
});

// ✅ Seguro: remove apenas a tag especificada
await tagManager.removeTag('canalForumId', 'tagId');

// ✅ Seguro: edita apenas a tag especificada
await tagManager.editTag('canalForumId', 'tagId', {
  name: 'Bug Crítico',
  emojiName: '🔴',
});

// Reordenar tags
await tagManager.reorderTags('canalForumId', ['tagId3', 'tagId1', 'tagId2']);

// Aplicar tags a um tópico (máx 5)
await tagManager.setThreadTags('topicoId', ['tagId1', 'tagId2']);
```

---

### `SafeCollector`

Substituto seguro para os collectors do discord.js — sem vazamentos de memória.

**O que é corrigido:**
- Remove listeners de eventos corretamente ao chamar `.stop()`
- `setMaxListeners` é gerenciado automaticamente — sem mais `MaxListenersExceededWarning`
- Timers usam `.unref()` para o processo encerrar corretamente
- Suporte ao timeout `idle` que realmente funciona

```js
const collector = new SafeCollector(client, {
  time: 30_000,    // encerra após 30 segundos
  idle: 5_000,     // encerra após 5 segundos sem novos itens
  max: 10,         // encerra após coletar 10 itens
  filter: (interaction) => interaction.channelId === canalAlvo,
});

collector
  .start('interactionCreate', (i) => i.id)
  .on('collect', (item) => console.log('Coletado:', item.id))
  .on('end', (coletados, motivo) => console.log(`Encerrado (${motivo}): ${coletados.size} itens`));

// Ou aguardar todos os resultados
const resultados = await collector.awaitEnd();
```

---

### `RateLimitQueue`

Fila com prioridade e retry automático para rate limits da REST API do Discord.

```js
const fila = new RateLimitQueue({
  baseDelay: 50,     // 50ms entre cada requisição
  maxRetries: 3,     // tenta até 3 vezes em caso de 429
  concurrency: 1,    // 1 requisição por vez (mais seguro)
});

fila.on('rateLimited', ({ retryAfter }) => {
  console.log(`Rate limited! Tentando novamente em ${retryAfter}ms`);
});

// Todas essas requisições serão enfileiradas com segurança
const canais = await fila.addAll(
  canalIds.map(id => () => client.channels.fetch(id))
);

// Tarefa de alta prioridade executa primeiro
await fila.add(() => requisicaoImportante(), { priority: 'high' });

// Verificar estatísticas
console.log(fila.getStats());
// { total: 50, success: 49, rateLimited: 1, failed: 0, pending: 0, active: 0 }
```

---

### `BurstReactionManager`

Suporte a Super Reações (burst reactions) que não existe no discord.js.

```js
const burst = new BurstReactionManager(client);

// Adicionar uma super reação (requer Nitro na conta do bot)
await burst.addBurstReaction('canalId', 'mensagemId', '⭐');

// Adicionar reação normal explicitamente
await burst.addNormalReaction('canalId', 'mensagemId', '⭐');

// Remover uma super reação
await burst.removeBurstReaction('canalId', 'mensagemId', '⭐');

// Buscar usuários que usaram super reação (type=1) ou normal (type=0)
const superEleitores = await burst.getReactions('canalId', 'mensagemId', '⭐', 1);

// Resumo completo de todas as reações
const resumo = await burst.getSummary('canalId', 'mensagemId');
// { '⭐': { normal: 5, burst: 2, total: 7, burstColors: ['#FFD700'] }, ... }
```

---

### `VoiceMessageBuilder`

Construa e envie mensagens de voz (as mensagens com forma de onda azul).

```js
const { VoiceMessageBuilder } = require('discordjs-plus');
const fs = require('fs');

const builder = new VoiceMessageBuilder()
  .setAudio(fs.readFileSync('./gravacao.ogg'))    // Formato OGG Opus
  .setDuration(5.2)                               // duração em segundos
  .generateWaveform(new Array(256).fill(0).map(() => Math.random() * 255));

// Envia via REST diretamente (necessário para setar a flag corretamente)
await builder.sendTo(canal);
```

---

### `GuildOnboardingManager`

Gerenciamento completo do fluxo de boas-vindas de servidores — o discord.js só oferece leitura.

```js
const { GuildOnboardingManager } = require('discordjs-plus');
const onboarding = new GuildOnboardingManager(client);

// Buscar configuração atual
const config = await onboarding.fetch('servidorId');
console.log(`Onboarding ativo: ${config.enabled}`);

// Editar prompts
await onboarding.edit('servidorId', {
  enabled: true,
  mode: 0, // 0 = padrão, 1 = avançado
  defaultChannelIds: ['canalId1', 'canalId2'],
  prompts: [
    {
      type: 0,
      title: 'Escolha seus cargos',
      options: [
        {
          title: 'Desenvolvedor',
          description: 'Eu escrevo código',
          roleIds: ['cargoId'],
          channelIds: [],
          emojiName: '💻',
        },
      ],
      singleSelect: false,
      required: false,
      inOnboarding: true,
    },
  ],
});

// Adicionar/remover canais padrão
await onboarding.addDefaultChannel('servidorId', 'canalId');
await onboarding.removeDefaultChannel('servidorId', 'canalId');
```

---

## Contribuindo

Pull requests são bem-vindos! Abra uma issue primeiro para discutir o que você gostaria de mudar.

```bash
git clone https://github.com/seu-usuario/discordjs-plus
cd discordjs-plus
npm install
```

---

## Licença

[MIT](./LICENSE)

---

*Mantido pela comunidade. Não possui afiliação com o Discord ou a equipe do discord.js.*
