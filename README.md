# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema em português; o agent consulta a central de ajuda e os chamados, pede confirmação antes de gravar qualquer coisa e chama um analista quando a regra manda. O analista assume a mesma conversa, com o agent pausado.

## Como rodar

Requisitos: Node.js 22.

```bash
npm install
copy .env.example .env
npm run dev
```

Abra http://localhost:3000. No protótipo, qualquer senha serve. Contas úteis:

- `matheus.pereira@nexo.com.br` — funcionário, conversa já transferida
- `elisa.prado@nexo.com.br` — funcionária ainda com o agent
- `rafael.lima@nexo.com.br` — analista N2
- `marina.costa@nexo.com.br` — analista N1

Para o agent responder, preencha `OPENAI_API_KEY` no `.env`. O modelo padrão é `gpt-4.1-mini` (`LLM_MODEL`), escolhido pelo custo e pela latência de uma conversa de suporte. A chave fica só no ambiente.

`npm test` cobre prazo útil, prioridade, duplicidade, privacidade e o serviço de chamados, sem chamar o modelo. `npm run db:seed` recria o SQLite em `data/nexo.sqlite`. Se o `npm run dev` estiver aberto, o arquivo fica travado no Windows; o seed esvazia as tabelas e grava os dados de exemplo de novo, sem precisar parar o servidor.

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

A sessão do chat aceita 30 mensagens entre a pessoa e o agent. O contador fica no compositor.

## Trade-offs

- SQLite no processo do Next, em vez de um banco à parte, para subir com um comando. Não serve para mais de uma instância.
- O rastro depende do modelo chamar `record-decision`. Se ele não chamar, a interface ainda mostra as ferramentas e uma leitura inferida, com confiança mais baixa.
- A falha do legado é probabilística em desenvolvimento (cerca de 8%). Os testes fixam o modo para não oscilar.
- Deploy ficou de fora. Publicar conta ponto extra e a ausência não penaliza. Num passo seguinte, eu colocaria a app na Vercel ou no Railway, a chave só no painel da plataforma, e um limite diário de mensagens por usuário para segurar custo.

## O que eu faria com mais tempo

Avaliação automática dos roteiros do Anexo A com o modelo de verdade, fila com mais de um analista disponível ao mesmo tempo, e o deploy com teto de uso.
