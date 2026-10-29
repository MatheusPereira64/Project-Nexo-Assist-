# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema em português; o agent consulta a central de ajuda e os chamados, pede confirmação antes de gravar qualquer coisa e chama um analista quando a regra manda. O analista assume a mesma conversa, com o agent pausado.

## Como rodar

Requisitos: Node.js 22.

```bash
npm install
copy .env.example .env
npm run dev
```

Abra http://localhost:3000. Na primeira subida, se `data/nexo.sqlite` ainda não tem usuários, a base de exemplo é criada sozinha. Não é preciso rodar o seed para começar.

No protótipo, qualquer senha não vazia serve (`nexo` funciona em todas). Funcionário entra em `/atendimento`. Analista entra em `/console`.

Sem `OPENAI_API_KEY`, o login, as conversas já gravadas e o console funcionam. O agent só responde mensagens novas com a chave preenchida no `.env` (ou no painel da Render, no deploy). O modelo padrão é `gpt-4.1-mini`, na variável `LLM_MODEL`. A chave não entra no Git.

Outros comandos:

- `npm test` — prazo útil, prioridade, duplicidade, privacidade e o serviço de chamados, sem chamar o modelo.
- `npm run db:seed` — apaga e regrava `data/nexo.sqlite`. Se o `npm run dev` estiver aberto no Windows, o arquivo fica travado; o seed esvazia as tabelas e grava os exemplos de novo, sem parar o servidor.
- `NEXO_DB` — caminho opcional do SQLite. Vazio usa `data/nexo.sqlite`.
- `NEXO_AUTO_SEED=0` — não recria os exemplos quando a base está vazia.

## Principais decisões

- **Mastra, não LangGraph.** Um `Agent` com ferramentas. O modelo propõe; o código confirma.
- **gpt-4.1-mini.** Latência e custo de uma conversa de suporte. Troca pelo `LLM_MODEL` sem mudar o agent.
- **Regra no código, não só no prompt.** `src/domain/policy.ts` exige rascunho antes de gravar, impede chamado duplicado, reabre resolvido em até 7 dias, transfere quando a pessoa pede, o caso é crítico, o prazo venceu ou a confiança fica abaixo de 55, e recusa assunto fora de TI. Se o modelo esquecer a ferramenta, a transferência obrigatória ainda acontece.
- **O agent não grava chamado.** As ferramentas devolvem rascunho, lista, artigo ou proposta. Criar, atualizar e reabrir passam pela confirmação na tela e por `src/services/tickets.ts`.
- **Serviço de chamados separado, com queda do legado.** Cerca de 8% das vezes ele fica fora por 1,5 s. Há uma retentativa. Se continuar fora, a conversa explica isso e não inventa status. Os testes fixam o modo para não oscilar.
- **A mesma thread para funcionário e analista.** Estados: com o agent, aguardando, com o analista, encerrada. Enquanto aguarda ou está com o analista, o agent não responde. Assumir pausa o agent; devolver abre sessão nova; encerrar fecha.
- **Transparência em cada resposta.** Chips do que foi feito e “Ver decisão” com o que entendeu, a ação, a confiança de 0 a 100 e o motivo (`record-decision`).
- **30 mensagens por dia em Brasília**, só enquanto a conversa está com o agent. O histórico permanece no dia seguinte e o contador zera. Devolver ao agent também zera.
- **SQLite no processo do Next, via Drizzle.** Sobe com um comando e sobrevive a um reinício local. Não serve para mais de uma instância: por isso o deploy é a Render Free (um processo), e não a Vercel, que separaria login e chat em funções com discos diferentes.
- **Testes sem o LLM.** `npm test` trava prazo, prioridade, duplicidade, privacidade e transferência. A conversa com a chave só mostra o agent chegando nessa decisão.

## Contas para testar

No deploy, a instância Free da Render recria estes mesmos usuários quando acorda. Dá para testar sem a chave da OpenAI: as conversas abaixo já estão gravadas. Com `OPENAI_API_KEY` no painel, as frases novas dos roteiros passam de fato pelo agent.

| Quem testa | E-mail | O que já encontra ao entrar |
|---|---|---|
| Funcionário | `matheus.pereira@nexo.com.br` | Conversa transferida ao N2, aguardando analista. Chamados INC-20311 (vencido), INC-20298 e REQ-10442. |
| Funcionário | `elisa.prado@nexo.com.br` | Ainda com o agent. Serve para dúvida da central de ajuda e para pedir um analista. |
| Funcionário | `diego.ramos@nexo.com.br` | Ainda com o agent. Serve para abrir um chamado novo e confirmar o rascunho. |
| Funcionário | `bruno.tavares@nexo.com.br` | Já na fila N2, confiança 41%. O INC-20150 (senha do SAP) foi resolvido há 4 dias e ainda pode ser reaberto. |
| Funcionário | `carla.mendes@nexo.com.br` | Já na fila N2, acesso ao SAP para hoje. |
| Funcionário | `helena.dias@nexo.com.br` | Já na fila N1, impressora do andar. |
| Analista N2 | `rafael.lima@nexo.com.br` | Filtro **Para você**: Matheus, Carla e Bruno. |
| Analista N2 | `paulo.henrique@nexo.com.br` | A mesma fila N2 do Rafael. |
| Analista N1 | `marina.costa@nexo.com.br` | Filtro **Para você**: Helena. |

No console, **Para você** é a fila do nível do analista. **Com o agent** mostra Elisa e Diego, com o agent ainda respondendo. **Minhas** fica vazia até o analista clicar em **Assumir atendimento**. **Todas** inclui também as conversas já encerradas (Fábio e Gabriela).

## Arquitetura

A interface é Next.js (App Router). O estado mora num SQLite local via Drizzle e sobrevive a um reinício: usuários, sessões, conversas, mensagens, rastro de cada resposta, chamados e artigos.

O agent é um `Agent` do Mastra. Ele não grava chamado direto. As ferramentas devolvem rascunho, lista, artigo ou uma proposta de transferência. Quem cria, atualiza ou reabre é a confirmação na tela, passando por `src/domain/policy.ts` e por `src/services/tickets.ts`. Esse serviço é separado do agent e, de vez em quando, fica indisponível por cerca de um segundo e meio — o legado do Anexo A. A ferramenta tenta de novo uma vez e, se continuar fora, o agent diz isso em vez de inventar um status.

Estados da conversa: com o agent, aguardando atendente, com o analista, encerrada. Em aguardando ou com o analista, a mensagem do funcionário entra na thread e o agent não responde. A resposta do analista aparece na mesma conversa.

## Como o agent decide

Cada resposta passa por ferramentas com um pedido explícito de registrar o que entendeu, a ação, a confiança de 0 a 100 e o motivo (`record-decision`). A interface mostra isso em chips (“consultou seus chamados”, “classificou a prioridade”) e em “Ver decisão”.

A política, e não só o prompt, garante o Anexo A:

- prioridade pelo impacto e pela urgência, com prazo em horas úteis (segunda a sexta, 8h–18h) ou uma hora corrida se for crítica
- rascunho obrigatório antes de criar ou atualizar
- chamado aberto parecido é atualizado; resolvido há até 7 dias pode ser reaberto
- transferência quando a pessoa pede, o caso é crítico, o chamado está vencido ou a confiança fica abaixo de 55 — mesmo se o modelo esquecer a ferramenta
- assunto fora de TI (férias, RH, salário, facilities) é recusado na hora de montar o rascunho
- funcionário só lê os próprios chamados; analista lê os da pessoa da conversa

A sessão do chat aceita 30 mensagens entre a pessoa e o agent, contadas no dia corrente em Brasília. O contador fica no compositor. No dia seguinte a mesma conversa continua e o contador volta a zero. Devolver o atendimento ao agent também abre uma sessão nova.

## Como a qualidade foi garantida

As decisões do Anexo A não dependem do modelo acertar o texto. Cada roteiro abaixo tem um teste que trava o resultado. `npm test` roda esses casos sem chamar o LLM. A conversa em linguagem natural, com a chave preenchida, só confirma que o agent conduz até essa decisão.

A chave `OPENAI_API_KEY` deste ambiente está vazia, então as frases novas abaixo não foram executadas com o modelo daqui. No deploy, com a chave no painel, use o par funcionário + analista de cada caso. Sem a chave, o que já está semeado (casos 2, 5 e 6) aparece do mesmo jeito.

1. **Dúvida resolvida na central de ajuda.** Não abre chamado e não entra na fila.
   - Funcionário: entre como `elisa.prado@nexo.com.br` e envie: "Meu notebook não conecta na VPN. Erro 809 no Windows 10." O agent cita o artigo: reinstalar o cliente e reiniciar, só no Windows 10. No Windows 11, a orientação é abrir chamado. Não aparece rascunho.
   - Analista: entre como `rafael.lima@nexo.com.br`, abra **Com o agent** e a conversa da Elisa. Ela continua com o agent. **Para você** não ganha esse atendimento.
   - O teste `a central de ajuda responde o erro 809 sem abrir chamado` confere o artigo.

2. **Consulta sem número.** O agent lista só os chamados de quem está na conversa.
   - Funcionário: entre como `matheus.pereira@nexo.com.br`. A thread já tem a pergunta "qual o status do meu chamado?", a lista INC-20311, INC-20298 e REQ-10442, e o aviso de prazo vencido no INC-20311. O compositor pede para escrever ao atendente, porque a conversa já foi transferida.
   - Analista: entre como `rafael.lima@nexo.com.br`. Matheus está em **Para você**. Abra a conversa: o mesmo histórico e os chamados dele no painel lateral. Marina (`marina.costa@nexo.com.br`) não vê o Matheus em **Para você**, porque a fila dele é N2.
   - Para repetir com o agent, Rafael clica em **Assumir atendimento** e depois em **Devolver ao agent**. O Matheus envia de novo "qual o status do meu chamado?". O teste de chamado vencido e de privacidade impede que outra pessoa veja essa lista.

3. **Abertura com rascunho.** Nada é gravado antes do Confirmar.
   - Funcionário: entre como `diego.ramos@nexo.com.br` e envie: "Preciso de um teclado novo, sem urgência, só para mim." O agent mostra título, descrição, tipo REQ, categoria, prioridade baixa e quem é afetado. O chamado só existe depois de **Confirmar**. **Editar** e **Cancelar** não gravam.
   - Analista: entre como `marina.costa@nexo.com.br` e abra Diego em **Com o agent**. Antes da confirmação não há chamado novo no histórico dele. Depois de **Confirmar**, o REQ aparece nesse histórico. A conversa segue com o agent e não vai para **Para você**.
   - O teste `confirmação cria, atualiza e reabre sem duplicar fora da janela` espera a decisão `create`.

4. **Duplicidade.** Chamado aberto parecido é atualizado, não duplicado.
   - Funcionário: com a conversa do Matheus devolvida ao agent (caso 2), entre como `matheus.pereira@nexo.com.br` e envie: "O notebook continua lento depois da atualização do Windows." A confirmação atualiza o INC-20311.
   - Analista: entre como `rafael.lima@nexo.com.br`, abra o Matheus e confira o painel de chamados. Continua um INC-20311, com a descrição complementada. Não surge um segundo chamado de notebook.
   - O mesmo teste espera a decisão `update`.

5. **Reabertura em até 7 dias.** Resolvido recente volta a abrir; o antigo vira chamado novo.
   - Funcionário: entre como `bruno.tavares@nexo.com.br`. A conversa já está na fila (o SAP abre e some metade dos botões) e o agent não responde. Para pedir a reabertura ao agent, Rafael devolve a conversa e o Bruno envia: "A senha do SAP bloqueou de novo." A confirmação reabre o INC-20150, resolvido há 4 dias. Um pedido da troca de senha da rede, fora da janela de 7 dias, vira chamado novo.
   - Analista: entre como `rafael.lima@nexo.com.br`. Bruno já está em **Para você**, com o rótulo de confiança 41%. Em **Chamados**, o INC-20150 (senha do SAP) aparece entre os encerrados até alguém reabrir. `paulo.henrique@nexo.com.br` vê a mesma fila N2.
   - Os testes de duplicidade cobrem a reabertura e a janela vencida.

6. **Transferência com resumo.** O agent para de responder e a fila recebe o resumo.
   - Funcionário, pedido explícito: entre como `elisa.prado@nexo.com.br` e envie: "Quero falar com um analista." A resposta avisa a fila e o compositor passa a ser "escreva para o atendente". Também transferem caso crítico, chamado vencido ou confiança abaixo de 55.
   - Funcionário, já transferido sem digitar nada: `matheus.pereira@nexo.com.br` (pedido dele, N2), `carla.mendes@nexo.com.br` (SAP para hoje, N2), `bruno.tavares@nexo.com.br` (confiança 41%, N2) e `helena.dias@nexo.com.br` (impressora do andar, N1).
   - Analista N2: `rafael.lima@nexo.com.br` ou `paulo.henrique@nexo.com.br`. Em **Para você**, abra o Matheus, leia o resumo, clique em **Assumir atendimento** e responda no compositor. A mensagem aparece na mesma thread do Matheus. **Devolver ao agent** devolve a conversa; **Encerrar atendimento** fecha.
   - Analista N1: `marina.costa@nexo.com.br`. Em **Para você** está a Helena, não o Matheus. O caminho é o mesmo: assumir, responder, devolver ou encerrar.
   - O teste de transferência cobre pedido explícito, crítico, vencido e confiança 41.

7. **Continuidade no dia seguinte.** O histórico fica; o contador de 30 mensagens zera.
   - Funcionário: entre como `diego.ramos@nexo.com.br` ou `elisa.prado@nexo.com.br`, ainda com o agent. O compositor mostra o uso da sessão, no máximo 30 mensagens da pessoa e do agent no dia de Brasília. No mesmo dia, a 31ª é recusada e o texto avisa que o contador zera no dia seguinte ou quando um analista devolve o chat. Na virada do dia, as mensagens continuam na tela e a contagem recomeça.
   - Analista: entre como `rafael.lima@nexo.com.br`, assuma uma conversa transferida e clique em **Devolver ao agent**. Do lado do funcionário o histórico permanece e a sessão de 30 mensagens abre de novo.
   - O teste `no dia seguinte a conversa continua e o contador da sessão zera` usa uma mensagem de ontem e espera contagem zero.

## Trade-offs

- SQLite no processo do Next, em vez de um banco à parte, para subir com um comando. Não serve para mais de uma instância.
- O rastro depende do modelo chamar `record-decision`. Se ele não chamar, a interface ainda mostra as ferramentas e uma leitura inferida, com confiança mais baixa.
- A falha do legado é probabilística em desenvolvimento (cerca de 8%). Os testes fixam o modo para não oscilar.
- A hospedagem escolhida é a Render, no plano Free (US$ 0 por mês). A Vercel também é grátis, mas publica o Next como funções separadas, e o SQLite deste projeto não seria o mesmo arquivo no login e no chat. Railway só cobre cerca de US$ 1 por mês depois do trial, e a Fly.io cobra em conta nova. Na instância Free da Render há um processo só, então o SQLite vale enquanto ela está acordada. Sem acesso por cerca de 15 minutos ela dorme; ao voltar, o disco efêmero está vazio e os dados de exemplo são recriados. A chave da OpenAI fica no painel e é o único custo variável.

## O que eu faria com mais tempo

Rodar os sete roteiros com o modelo de verdade, numa avaliação automática, fila com mais de um analista disponível ao mesmo tempo, e um teto diário de mensagens para segurar o custo da OpenAI.

## Deploy

O blueprint está em `render.yaml`, no plano Free.

1. Entre em [render.com](https://render.com) com a conta gratuita.
2. Crie um Blueprint apontando para este repositório.
3. Quando a Render pedir `OPENAI_API_KEY`, cole a chave só no painel. Ela não vai no Git.
4. Abra a URL do serviço. A primeira resposta depois que a instância dormiu pode levar cerca de um minuto, e a base volta para os dados de exemplo. Use a tabela de contas no início deste arquivo: cada roteiro diz qual funcionário e qual analista entrar para ver o mesmo caso dos dois lados.
