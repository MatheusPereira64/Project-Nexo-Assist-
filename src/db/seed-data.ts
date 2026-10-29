import { deadlineFor } from "@/domain/sla";
import type { Block, Trace } from "@/domain/blocks";
import { getDb } from "./client";
import { articles, conversations, messages, tickets, users } from "./schema";

const minute = 60 * 1000;
const day = 24 * 60 * minute;

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function trace(input: Trace): string {
  return JSON.stringify(input);
}

function blocks(input: Block[]): string {
  return JSON.stringify(input);
}

export function seedDatabase(): void {
  const db = getDb();
  const now = new Date();
  const matheusPassword = ago(42 * day);
  const staffPassword = ago(10 * day);

  db.insert(users)
    .values([
      person("user-ana", "Matheus Pereira", "matheus.pereira@nexo.com.br", "employee", "Financeiro", "MP", null, matheusPassword),
      person("user-carla", "Carla Mendes", "carla.mendes@nexo.com.br", "employee", "Comercial", "CM", null, staffPassword),
      person("user-bruno", "Bruno Tavares", "bruno.tavares@nexo.com.br", "employee", "Operações", "BT", null, staffPassword),
      person("user-diego", "Diego Ramos", "diego.ramos@nexo.com.br", "employee", "Produto", "DR", null, staffPassword),
      person("user-elisa", "Elisa Prado", "elisa.prado@nexo.com.br", "employee", "Gente", "EP", null, staffPassword),
      person("user-fabio", "Fábio Nunes", "fabio.nunes@nexo.com.br", "employee", "Jurídico", "FN", null, staffPassword),
      person("user-gabriela", "Gabriela Rocha", "gabriela.rocha@nexo.com.br", "employee", "Marketing", "GR", null, staffPassword),
      person("user-helena", "Helena Dias", "helena.dias@nexo.com.br", "employee", "Facilities", "HD", null, staffPassword),
      person("user-rafael", "Rafael Lima", "rafael.lima@nexo.com.br", "analyst", "Suporte N2", "RL", "N2", staffPassword),
      person("user-marina", "Marina Costa", "marina.costa@nexo.com.br", "analyst", "Suporte N1", "MC", "N1", staffPassword),
      person("user-paulo", "Paulo Henrique", "paulo.henrique@nexo.com.br", "analyst", "Suporte N2", "PH", "N2", staffPassword),
    ])
    .run();

  const inc20311Updated = ago(6 * day);
  const sharepointUpdated = ago(2 * day);
  const monitorUpdated = ago(7 * day);

  db.insert(tickets)
    .values([
      {
        id: "t-20311",
        code: "INC-20311",
        type: "INC",
        title: "Notebook lento após atualização do Windows",
        description: "Lentidão geral desde a atualização de 15/10. Reiniciar e rodar o diagnóstico da central não resolveu.",
        category: "Hardware",
        subcategory: "Notebook",
        priority: "medium",
        status: "waiting_analyst",
        requesterId: "user-ana",
        assigneeId: null,
        impact: "only_me",
        openedAt: ago(12 * day),
        updatedAt: inc20311Updated,
        dueAt: deadlineFor("medium", new Date(inc20311Updated)).toISOString(),
        resolvedAt: null,
        conversationId: "conv-ana",
      },
      {
        id: "t-20298",
        code: "INC-20298",
        type: "INC",
        title: "Acesso à pasta Financeiro no SharePoint",
        description: "Matheus não consegue abrir a pasta Financeiro no SharePoint desde a troca de grupo.",
        category: "Acesso",
        subcategory: "SharePoint",
        priority: "medium",
        status: "in_progress",
        requesterId: "user-ana",
        assigneeId: "user-marina",
        impact: "only_me",
        openedAt: ago(14 * day),
        updatedAt: sharepointUpdated,
        dueAt: deadlineFor("medium", new Date(sharepointUpdated)).toISOString(),
        resolvedAt: null,
        conversationId: null,
      },
      {
        id: "t-10442",
        code: "REQ-10442",
        type: "REQ",
        title: "Segundo monitor para home office",
        description: "Pedido de segundo monitor para trabalho remoto.",
        category: "Hardware",
        subcategory: "Monitor",
        priority: "low",
        status: "approved",
        requesterId: "user-ana",
        assigneeId: "user-marina",
        impact: "only_me",
        openedAt: ago(19 * day),
        updatedAt: monitorUpdated,
        dueAt: new Date(now.getTime() + 3 * day).toISOString(),
        resolvedAt: null,
        conversationId: null,
      },
      {
        id: "t-19877",
        code: "INC-19877",
        type: "INC",
        title: "Outlook não sincroniza no celular",
        description: "O Outlook do celular parou de receber mensagens novas.",
        category: "E-mail",
        subcategory: "Outlook",
        priority: "medium",
        status: "resolved",
        requesterId: "user-ana",
        assigneeId: "user-marina",
        impact: "only_me",
        openedAt: "2026-09-01T14:00:00.000Z",
        updatedAt: "2026-09-02T18:00:00.000Z",
        dueAt: "2026-09-04T18:00:00.000Z",
        resolvedAt: "2026-09-02T18:00:00.000Z",
        conversationId: null,
      },
      {
        id: "t-19410",
        code: "INC-19410",
        type: "INC",
        title: "Troca de senha da rede",
        description: "Senha da rede expirou e o desbloqueio pelo portal não concluiu.",
        category: "Acesso",
        subcategory: "Rede",
        priority: "high",
        status: "resolved",
        requesterId: "user-ana",
        assigneeId: "user-paulo",
        impact: "only_me",
        openedAt: "2026-07-11T11:00:00.000Z",
        updatedAt: "2026-07-11T16:00:00.000Z",
        dueAt: "2026-07-11T20:00:00.000Z",
        resolvedAt: "2026-07-11T16:00:00.000Z",
        conversationId: null,
      },
      {
        id: "t-20150",
        code: "INC-20150",
        type: "INC",
        title: "Senha do SAP bloqueada",
        description: "Usuário bloqueado após três tentativas no SAP.",
        category: "Acesso",
        subcategory: "SAP",
        priority: "medium",
        status: "resolved",
        requesterId: "user-bruno",
        assigneeId: "user-marina",
        impact: "only_me",
        openedAt: ago(6 * day),
        updatedAt: ago(4 * day),
        dueAt: ago(3 * day),
        resolvedAt: ago(4 * day),
        conversationId: null,
      },
      {
        id: "t-sap-carla",
        code: "REQ-10488",
        type: "REQ",
        title: "Acesso ao SAP ainda hoje",
        description: "Carla precisa de acesso ao SAP para fechar o pedido de um cliente hoje.",
        category: "Acesso",
        subcategory: "SAP",
        priority: "high",
        status: "waiting_analyst",
        requesterId: "user-carla",
        assigneeId: null,
        impact: "only_me",
        openedAt: ago(40 * minute),
        updatedAt: ago(30 * minute),
        dueAt: new Date(now.getTime() + 25 * minute).toISOString(),
        resolvedAt: null,
        conversationId: "conv-carla",
      },
      {
        id: "t-20519",
        code: "INC-20519",
        type: "INC",
        title: "Outlook trava ao abrir anexo",
        description: "O Outlook fecha sozinho quando Elisa abre um anexo PDF.",
        category: "E-mail",
        subcategory: "Outlook",
        priority: "medium",
        status: "open",
        requesterId: "user-elisa",
        assigneeId: null,
        impact: "only_me",
        openedAt: ago(20 * minute),
        updatedAt: ago(12 * minute),
        dueAt: deadlineFor("medium", new Date(now.getTime() - 20 * minute)).toISOString(),
        resolvedAt: null,
        conversationId: "conv-elisa",
      },
      {
        id: "t-wifi",
        code: "INC-20502",
        type: "INC",
        title: "Senha do Wi-Fi da recepção",
        description: "Visitante sem a senha atual da rede de convidados.",
        category: "Rede e VPN",
        subcategory: "Wi-Fi",
        priority: "low",
        status: "resolved",
        requesterId: "user-gabriela",
        assigneeId: null,
        impact: "only_me",
        openedAt: ago(1 * day + 2 * 60 * minute),
        updatedAt: ago(1 * day),
        dueAt: ago(20 * 60 * minute),
        resolvedAt: ago(1 * day),
        conversationId: "conv-gabriela",
      },
      {
        id: "t-printer",
        code: "INC-20521",
        type: "INC",
        title: "Impressora do 4º andar sem fila",
        description: "A impressora do 4º andar aparece offline para o andar inteiro.",
        category: "Hardware",
        subcategory: "Impressora",
        priority: "high",
        status: "waiting_analyst",
        requesterId: "user-helena",
        assigneeId: null,
        impact: "team",
        openedAt: ago(50 * minute),
        updatedAt: ago(35 * minute),
        dueAt: deadlineFor("high", new Date(now.getTime() - 50 * minute)).toISOString(),
        resolvedAt: null,
        conversationId: "conv-helena",
      },
    ])
    .run();

  const anaList = [
    ticketBlock("INC-20311", "Notebook lento após atualização", "waiting_analyst", "Hardware", "medium", false),
    ticketBlock("INC-20298", "Acesso à pasta Financeiro no SharePoint", "in_progress", "Acesso", "medium", false),
    ticketBlock("REQ-10442", "Segundo monitor para home office", "approved", "Hardware", "low", false),
  ];

  db.insert(conversations)
    .values([
      conv("conv-ana", "user-ana", "waiting", "N2", "Notebook lento sem atualização há 6 dias. Matheus pediu um analista.", null, "user_asked", 2, ago(40 * minute)),
      conv("conv-carla", "user-carla", "waiting", "N2", "Acesso ao SAP necessário ainda hoje.", null, "same_day", 1, ago(50 * minute)),
      conv("conv-bruno", "user-bruno", "waiting", "N2", "O agent não teve segurança para orientar a falha intermitente do SAP.", 41, "low_confidence", 1, ago(70 * minute)),
      conv("conv-diego", "user-diego", "with_agent", null, null, null, null, 0, ago(15 * minute)),
      conv("conv-elisa", "user-elisa", "with_agent", null, null, null, null, 0, ago(25 * minute)),
      conv("conv-fabio", "user-fabio", "closed", null, null, null, null, 0, ago(3 * 60 * minute)),
      conv("conv-gabriela", "user-gabriela", "closed", null, null, null, null, 0, ago(1 * day)),
      conv("conv-helena", "user-helena", "waiting", "N1", "Impressora do andar parada.", null, "team_stopped", 1, ago(40 * minute)),
    ])
    .run();

  const anaTicket = {
    type: "ticket" as const,
    ticket: {
      id: "t-20311",
      code: "INC-20311",
      type: "INC" as const,
      title: "Notebook lento após atualização do Windows",
      description: "Lentidão geral desde a atualização de 15/10. Reiniciar e rodar o diagnóstico da central não resolveu.",
      category: "Hardware",
      subcategory: "Notebook",
      priority: "medium" as const,
      status: "waiting_analyst" as const,
      impact: "only_me" as const,
      openedAt: ago(12 * day),
      updatedAt: inc20311Updated,
      dueAt: deadlineFor("medium", new Date(inc20311Updated)).toISOString(),
      resolvedAt: null,
      overdue: true,
      requesterId: "user-ana",
    },
  };

  db.insert(messages)
    .values([
      msg("conv-ana", "user", "Matheus Pereira", "Qual o status do meu chamado?", ago(24 * minute)),
      msg(
        "conv-ana",
        "assistant",
        "Nexo Assist",
        "Você tem 3 chamados abertos. Sobre qual deles quer saber?",
        ago(23 * minute),
        ["consultou seus chamados"],
        trace({
          understood: "Matheus quer o status de um chamado, sem informar o número.",
          action: "Listar os chamados abertos dela e pedir qual consultar.",
          confidence: 88,
          reason: "Há três chamados em andamento. Escolher pelo título evita atualizar o caso errado.",
          tools: ["list-tickets"],
        }),
        blocks([{ type: "tickets", tickets: anaList }]),
      ),
      msg("conv-ana", "user", "Matheus Pereira", "INC-20311 · Notebook lento após atualização", ago(20 * minute)),
      msg(
        "conv-ana",
        "assistant",
        "Nexo Assist",
        "Está sem atualização há 6 dias, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?",
        ago(19 * minute),
        ["consultou o INC-20311", "calculou o prazo"],
        trace({
          understood: "Matheus quer o status do INC-20311, notebook lento após o Windows.",
          action: "Mostrar o chamado e oferecer transferência porque o prazo de prioridade média venceu.",
          confidence: 91,
          reason: "A última atualização passou de 3 dias úteis. A regra manda oferecer um analista em chamado vencido.",
          tools: ["get-ticket"],
        }),
        blocks([
          anaTicket,
          {
            type: "actions",
            actions: [
              { id: "transfer", label: "Falar com um analista" },
              { id: "add-info", label: "Adicionar informação" },
              { id: "decline", label: "Não, obrigado" },
            ],
          },
        ]),
      ),
      msg("conv-ana", "user", "Matheus Pereira", "Está parado há 5 dias.", ago(10 * minute)),
      msg("conv-ana", "user", "Matheus Pereira", "Quero falar com um analista.", ago(8 * minute)),
      msg(
        "conv-ana",
        "assistant",
        "Nexo Assist",
        "Encaminhei para o Suporte N2. Um analista vai falar com você em até 2 h úteis.",
        ago(7 * minute),
        ["encaminhou para um analista"],
        trace({
          understood: "Matheus pediu explicitamente para falar com um analista sobre o chamado vencido.",
          action: "Transferir a conversa ao Suporte N2 com o resumo do INC-20311 e pausar o agent.",
          confidence: 96,
          reason: "Pedido direto da pessoa e chamado fora do prazo. O agent não responde enquanto a conversa estiver com o analista.",
          tools: ["transfer-conversation"],
        }),
      ),
      msg("conv-ana", "system", "Sistema", "Transferida para Suporte N2", ago(7 * minute)),
      msg("conv-carla", "user", "Carla Mendes", "Preciso de acesso ao SAP ainda hoje", ago(32 * minute)),
      msg(
        "conv-carla",
        "assistant",
        "Nexo Assist",
        "Abri o pedido com prioridade alta por causa do compromisso de hoje e chamei o Suporte N2.",
        ago(30 * minute),
        ["classificou a prioridade", "encaminhou para um analista"],
        trace({
          understood: "Carla precisa de um acesso ao SAP com compromisso no mesmo dia.",
          action: "Prioridade alta e transferência, porque o prazo é hoje.",
          confidence: 84,
          reason: "Compromisso no mesmo dia cai na prioridade alta e a transferência leva o resumo ao analista.",
          tools: ["classify-priority", "transfer-conversation"],
        }),
      ),
      msg("conv-carla", "system", "Sistema", "Transferida para Suporte N2", ago(30 * minute)),
      msg("conv-bruno", "user", "Bruno Tavares", "O SAP abre, mas some metade dos botões. Já reiniciei.", ago(18 * minute)),
      msg(
        "conv-bruno",
        "assistant",
        "Nexo Assist",
        "Vou chamar um analista para isso.",
        ago(16 * minute),
        ["buscou na central de ajuda"],
        trace({
          understood: "Falha visual intermitente no SAP, sem artigo correspondente na central.",
          action: "Transferir por baixa confiança em vez de inventar um procedimento.",
          confidence: 41,
          reason: "A central não cobre esse sintoma e o agent não tem segurança para orientar.",
          tools: ["search-help", "transfer-conversation"],
        }),
      ),
      msg("conv-bruno", "system", "Sistema", "Agent pediu ajuda", ago(16 * minute)),
      msg("conv-diego", "user", "Diego Ramos", "A página interna de pedidos não carrega desde cedo.", ago(1 * minute)),
      msg("conv-elisa", "user", "Elisa Prado", "Meu Outlook fecha quando abro um PDF.", ago(18 * minute)),
      msg(
        "conv-elisa",
        "assistant",
        "Nexo Assist",
        "Chamado INC-20519 criado.",
        ago(12 * minute),
        ["consultou seus chamados", "montou o rascunho"],
        trace({
          understood: "O Outlook da Elisa fecha ao abrir anexo PDF e não havia chamado aberto igual.",
          action: "Criar incidente de e-mail depois da confirmação dela.",
          confidence: 86,
          reason: "Não havia duplicidade e o rascunho foi confirmado na conversa.",
          tools: ["list-tickets", "prepare-draft"],
        }),
      ),
      msg("conv-fabio", "user", "Fábio Nunes", "Isso resolveu, obrigado!", ago(3 * 60 * minute)),
      msg("conv-gabriela", "assistant", "Nexo Assist", "A senha do Wi-Fi foi enviada no seu e-mail corporativo.", ago(1 * day)),
      msg("conv-helena", "user", "Helena Dias", "A impressora do 4º andar sumiu para todo mundo.", ago(36 * minute)),
      msg("conv-helena", "system", "Sistema", "Transferida para Suporte N1", ago(34 * minute)),
    ])
    .run();

  db.insert(articles)
    .values([
      article(
        "art-vpn-809",
        "VPN com erro 809",
        "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10. No Windows 11, abra um chamado.",
        "vpn erro 809 windows 10 windows 11 rede",
      ),
      article(
        "art-horario",
        "Horário do service desk",
        "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
        "horário expediente plantão crítico",
      ),
      article(
        "art-notebook",
        "Notebook lento após atualização",
        "Reinicie, rode o diagnóstico de disco no portal e desinstale a atualização se a lentidão começou no mesmo dia. Se continuar, abra um chamado de hardware.",
        "notebook lento windows atualização",
      ),
      article(
        "art-sap",
        "Senha do SAP bloqueada",
        "O desbloqueio é feito pelo analista de acesso. Não há autoatendimento. Informe se o bloqueio impede o trabalho de hoje.",
        "sap senha bloqueada acesso",
      ),
      article(
        "art-sharepoint",
        "Acesso a pasta no SharePoint",
        "Confira se está na rede da Nexo ou na VPN. Se o acesso foi pedido e já se passaram 2 dias úteis, complemente o chamado existente.",
        "sharepoint pasta acesso permissão",
      ),
      article(
        "art-outlook",
        "Outlook não sincroniza",
        "No celular, remova a conta e adicione de novo com o e-mail corporativo. No computador, abra o Outlook em modo de segurança. Se fechar ao abrir anexo, abra um chamado.",
        "outlook e-mail sincroniza anexo celular",
      ),
      article(
        "art-wifi",
        "Wi-Fi corporativo e de visitantes",
        "A senha da rede de visitantes muda toda sexta e é enviada aos ramais de recepção. A rede Nexo usa a senha da conta corporativa.",
        "wifi wi-fi senha visitante rede",
      ),
      article(
        "art-monitor",
        "Pedido de monitor ou periférico",
        "Pedidos de equipamento são requisições de prioridade baixa, com prazo de 5 dias úteis, salvo se a pessoa ficou sem como trabalhar.",
        "monitor equipamento periférico home office",
      ),
    ])
    .run();
}

function person(
  id: string,
  name: string,
  email: string,
  role: string,
  department: string,
  initials: string,
  supportLevel: string | null,
  passwordChangedAt: string,
) {
  return { id, name, email, role, department, initials, supportLevel, available: 1, passwordChangedAt };
}

function conv(
  id: string,
  employeeId: string,
  state: string,
  queue: string | null,
  summary: string | null,
  confidence: number | null,
  transferReason: string | null,
  unreadForAnalyst: number,
  updatedAt: string,
) {
  return {
    id,
    employeeId,
    analystId: null,
    state,
    queue,
    summary,
    confidence,
    transferReason,
    unreadForAnalyst,
    sessionStartedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  };
}

let messageSeq = 0;

function msg(
  conversationId: string,
  role: string,
  authorName: string,
  content: string,
  createdAt: string,
  chips?: string[],
  traceJson?: string,
  blocksJson?: string,
) {
  messageSeq += 1;
  return {
    id: `seed-msg-${messageSeq}`,
    conversationId,
    role,
    authorName,
    content,
    chips: chips ? JSON.stringify(chips) : null,
    trace: traceJson ?? null,
    blocks: blocksJson ?? null,
    createdAt,
  };
}

function article(id: string, title: string, body: string, keywords: string) {
  return { id, title, body, keywords };
}

function ticketBlock(
  code: string,
  title: string,
  status: "waiting_analyst" | "in_progress" | "approved",
  category: string,
  priority: "medium" | "low",
  overdue: boolean,
) {
  return {
    id: code,
    code,
    type: code.startsWith("REQ") ? ("REQ" as const) : ("INC" as const),
    title,
    description: title,
    category,
    subcategory: null,
    priority,
    status,
    impact: "only_me" as const,
    openedAt: ago(10 * day),
    updatedAt: ago(6 * day),
    dueAt: ago(1 * day),
    resolvedAt: null,
    overdue,
    requesterId: "user-ana",
  };
}
