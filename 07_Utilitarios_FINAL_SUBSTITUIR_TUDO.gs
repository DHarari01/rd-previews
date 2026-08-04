// =========================================================================
// RD PROSPECT — 07_Utilitarios.gs
// Itens 5, 6, 8 e 9 do menu, a migração one-time de colunas, e o menu
// principal (onOpen) — que registra todos os itens de todos os módulos acima.
// =========================================================================

function migrarParaNovasCategorias() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const origem = ss.getActiveSheet();
  const dados = origem.getDataRange().getValues();

  if (dados.length < 1) {
    SpreadsheetApp.getUi().alert("A aba ativa está vazia — selecione a aba com os dados originais antes de rodar essa migração.");
    return;
  }

  // Índice ANTIGO (0-based) que alimenta cada posição NOVA, na ordem A→AD.
  const NOVA_ORDEM_INDICE_ANTIGO = [0,1,2,3,4,5,6,7,8,19,26,10,9,24,25,15,16,20,21,22,23,29,11,12,27,28,17,18,13,14];

  const novosCabecalhos = [
    "Nome do Cliente", "Nicho", "Site Atual", "Email", "Diferencial / Nota",
    "Idade do Domínio", "Vel. de Carregamento", "Pixels de Anúncio", "Redes Sociais",
    "Plataforma (Wappalyzer)", "Idade_Site_Wayback",
    "Classificação de Oportunidade", "Diagnóstico/Gaps vs. Concorrência", "Diagnostico_Dores", "Score_Prioridade",
    "Logo Personalizado (URL)", "Cor Principal (Hex)", "DS_Tipografia", "DS_Paleta", "DS_Estrutura", "DS_Estilo_Global", "Oferta_Real_Detectada",
    "Status", "URL de Teste", "URL_Apresentacao", "Avisos_Validacao",
    "WA", "Msg Automática", "Assunto do E-mail", "Corpo do E-mail"
  ];

  if (novosCabecalhos.length !== NOVA_ORDEM_INDICE_ANTIGO.length) {
    throw new Error("Mapeamento inconsistente: " + novosCabecalhos.length + " cabeçalhos x " + NOVA_ORDEM_INDICE_ANTIGO.length + " posições.");
  }

  const linhasOriginais = dados.slice(1); // sem cabeçalho
  const linhasNovas = linhasOriginais.map(function(linha) {
    return NOVA_ORDEM_INDICE_ANTIGO.map(function(idxAntigo) {
      return linha[idxAntigo] !== undefined ? linha[idxAntigo] : "";
    });
  });

  const nomeAbaNova = origem.getName() + " (Reorganizada)";
  const existente = ss.getSheetByName(nomeAbaNova);
  if (existente) ss.deleteSheet(existente); // permite rodar de novo sem duplicar

  const destino = ss.insertSheet(nomeAbaNova);
  destino.getRange(1, 1, 1, novosCabecalhos.length).setValues([novosCabecalhos]);
  if (linhasNovas.length > 0) {
    destino.getRange(2, 1, linhasNovas.length, novosCabecalhos.length).setValues(linhasNovas);

    // Copia também a validação de dados (dropdowns, ex: Status = "Gerar")
    // coluna por coluna, seguindo o mesmo mapeamento — getValues/setValues
    // só move o conteúdo, não pega validação nem formatação. Só copia se a
    // coluna antiga realmente tiver alguma célula com validação, pra não
    // gastar chamada de API à toa nas colunas que nunca tiveram dropdown.
    NOVA_ORDEM_INDICE_ANTIGO.forEach(function(idxAntigoZeroBased, idxNovoZeroBased) {
      const colAntiga = idxAntigoZeroBased + 1;
      const colNova = idxNovoZeroBased + 1;
      const validacoes = origem.getRange(2, colAntiga, linhasNovas.length, 1).getDataValidations();
      const temValidacao = validacoes.some(function(linha) { return linha[0] !== null; });
      if (temValidacao) {
        destino.getRange(2, colNova, linhasNovas.length, 1).setDataValidations(validacoes);
      }
    });
  }

  destino.setFrozenRows(1);

  const mensagemFinal = "Migração concluída! Criei a aba \"" + nomeAbaNova + "\" com " + linhasNovas.length +
    " linha(s) reorganizadas. A aba original (\"" + origem.getName() + "\") não foi alterada. " +
    "Confira a aba nova, clique nela pra deixá-la ativa, e aí sim use o menu Automação RD normalmente.";
  try {
    SpreadsheetApp.getUi().alert(mensagemFinal);
  } catch (e) {
    Logger.log(mensagemFinal);
  }
}

/**
 * Colore o CABEÇALHO (linha 1) por categoria, no layout novo de colunas
 * (Identificação > Diagnóstico > Qualificação > Design System >
 * Geração/Status > Contato/Saída). Só a linha 1 — as colunas de dados
 * ficam como estão, porque várias já usam cor via emoji (🟢🔴🟡) e pintar
 * a coluna inteira ia competir visualmente com isso. Pode rodar quantas
 * vezes quiser (idempotente); é só reaplicar as mesmas cores.
 */
function aplicarCoresPorCategoria() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const grupos = [
    { inicio: 1, fim: 4, cor: "#D9EAF7" },   // Identificação (A-D)
    { inicio: 5, fim: 11, cor: "#FCE5CD" },  // Diagnóstico (E-K)
    { inicio: 12, fim: 15, cor: "#F4CCCC" }, // Qualificação (L-O)
    { inicio: 16, fim: 22, cor: "#D9D2E9" }, // Design System (P-V)
    { inicio: 23, fim: 26, cor: "#EFEFEF" }, // Geração/Status (W-Z)
    { inicio: 27, fim: 30, cor: "#D9EAD3" }, // Contato/Saída (AA-AD)
    { inicio: 31, fim: 31, cor: "#FFF2CC" }, // Pipeline (AE) — Status_Comercial, kanban
    { inicio: 32, fim: 33, cor: "#CFE2F3" }, // Links Curtos (AF-AG) — link próprio RD Exclusive
    { inicio: 34, fim: 35, cor: "#D0E0E3" }, // Telefone/Msg Continuação (AH-AI)
    { inicio: 36, fim: 36, cor: "#F9CB9C" }, // Instagram_Popularidade (AJ)
    { inicio: 37, fim: 39, cor: "#B6D7A8" }  // Rastreio de Envio WA (AK-AM)
  ];

  grupos.forEach(function(g) {
    const largura = g.fim - g.inicio + 1;
    sheet.getRange(1, g.inicio, 1, largura)
      .setBackground(g.cor)
      .setFontWeight("bold");
  });

  SpreadsheetApp.getUi().alert("Cores aplicadas no cabeçalho! Se quiser ajustar algum tom, é só rodar de novo depois de editar os hex no código.");
}

/**
 * CONFIGURAÇÃO ÚNICA: cria a coluna AE "Status_Comercial" — o estágio do
 * relacionamento com o lead (Novo/Redesenhado/Publicado/Proposta
 * Enviada/Respondeu/Fechado/Descartado), separado do Status técnico da
 * coluna W (que é só Pendente/Gerar/Sucesso/Erro, sobre a geração em si).
 * Rode isso 1 vez. Já preenche cabeçalho, dropdown de seleção, e faz um
 * backfill nas linhas existentes: quem já tem Status técnico = "Sucesso"
 * vira "Publicado"; o resto vira "Novo" — sem sobrescrever se a célula já
 * tiver algum valor (ex: rodar de novo depois de já ter usado o kanban).
 * Dali em diante, a mineração já grava "Novo" sozinha, e o Gerar Site
 * avança pra "Publicado" sozinho — sem nunca regredir um lead que você já
 * tenha avançado manualmente pra Proposta Enviada/Respondeu/Fechado/
 * Descartado (ver processarLeadsInteligente).
 */
function configurarStatusComercial() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ultimaLinha = sheet.getLastRow();
  sheet.getRange(1, 31).setValue("Status_Comercial");

  const opcoes = ["Novo", "Redesenhado", "Publicado", "Proposta Enviada", "Respondeu", "Fechado", "Descartado"];
  const regra = SpreadsheetApp.newDataValidation().requireValueInList(opcoes, true).setAllowInvalid(false).build();

  if (ultimaLinha > 1) {
    const faixa = sheet.getRange(2, 31, ultimaLinha - 1, 1);
    faixa.setDataValidation(regra);

    const statusTecnico = sheet.getRange(2, 23, ultimaLinha - 1, 1).getValues();
    const statusComercialAtual = faixa.getValues();
    const novosValores = statusTecnico.map(function(linha, idx) {
      if (statusComercialAtual[idx][0]) return [statusComercialAtual[idx][0]];
      return [linha[0] === "Sucesso" ? "Publicado" : "Novo"];
    });
    faixa.setValues(novosValores);
  } else {
    sheet.getRange(2, 31, 1000, 1).setDataValidation(regra);
  }

  SpreadsheetApp.getUi().alert("Coluna Status_Comercial configurada! Rode \"5. Colorir Cabeçalho\" de novo pra ela ganhar cor também.");
}

/**
 * CONFIGURAÇÃO ÚNICA: cria DUAS colunas — AF "Link_Curto_Site" e AG
 * "Link_Curto_Apresentacao" — os links encurtados via redirecionamento
 * próprio da RD Exclusive (ver encurtarLink, 06_Infraestrutura.gs) que
 * passam a ser gerados automaticamente pra cada lead novo dentro de
 * processarLeadsInteligente.
 * As duas ficam separadas de propósito: o site-teste cru e a apresentação
 * (split antes/depois) atendem a momentos diferentes da conversa com o
 * lead, então a escolha de qual mandar fica com você, na hora.
 * Rode isso 1 vez pra criar os cabeçalhos e, de brinde, encurtar de uma vez
 * os links de todo lead que JÁ tenha site gerado antes dessas colunas
 * existirem (não sobrescreve nenhuma célula que já tenha um link curto).
 */
function configurarLinkCurto() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ultimaLinha = sheet.getLastRow();
  sheet.getRange(1, 32).setValue("Link_Curto_Site");
  sheet.getRange(1, 33).setValue("Link_Curto_Apresentacao");

  if (ultimaLinha > 1) {
    const linkSiteAtual = sheet.getRange(2, 32, ultimaLinha - 1, 1).getValues();
    const linkApresAtual = sheet.getRange(2, 33, ultimaLinha - 1, 1).getValues();
    const urlApresentacao = sheet.getRange(2, 25, ultimaLinha - 1, 1).getValues(); // Coluna Y
    const urlTeste = sheet.getRange(2, 24, ultimaLinha - 1, 1).getValues(); // Coluna X

    for (let i = 0; i < ultimaLinha - 1; i++) {
      if (!linkSiteAtual[i][0] && urlTeste[i][0]) {
        sheet.getRange(i + 2, 32).setValue(encurtarLink(urlTeste[i][0]));
      }
      if (!linkApresAtual[i][0] && urlApresentacao[i][0]) {
        sheet.getRange(i + 2, 33).setValue(encurtarLink(urlApresentacao[i][0]));
      }
    }
  }

  SpreadsheetApp.getUi().alert("Colunas Link_Curto_Site e Link_Curto_Apresentacao configuradas! Todo lead com site já publicado ganhou os links encurtados retroativamente, e os próximos leads gerados (item 3) já saem com os dois automaticamente. Rode \"5. Colorir Cabeçalho\" de novo pra elas ganharem cor também.");
}

/**
 * CONFIGURAÇÃO ÚNICA: cria DUAS colunas — AH "Telefone_Real" e AI
 * "Msg_Continuacao_WhatsApp". A AH guarda o telefone capturado na
 * Mineração (antes esse dado só existia cravado dentro do link fixo da
 * coluna AA, sem lugar próprio pra ficar — por isso a AA nunca conseguia
 * ser atualizada depois). A AI recebe a mensagem 2 do WhatsApp (com o
 * link), gerada automaticamente pelo Gerar Site depois que o site-teste
 * de cada lead existir.
 * Rode isso 1 vez: cria os cabeçalhos e faz backfill do telefone pra leads
 * antigos (raspando de novo do site — não sobrescreve célula que já tenha
 * valor). Não gera a Msg_Continuacao_WhatsApp em massa — essa só faz
 * sentido pra quem já tem site-teste pronto, então fica pro "3. Gerar
 * Site" preencher organicamente na próxima rodada de cada lead.
 */
function configurarTelefoneEMensagemContinuacao() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ultimaLinha = sheet.getLastRow();
  sheet.getRange(1, 34).setValue("Telefone_Real");
  sheet.getRange(1, 35).setValue("Msg_Continuacao_WhatsApp");

  let backfillados = 0;
  if (ultimaLinha > 1) {
    const sites = sheet.getRange(2, 3, ultimaLinha - 1, 1).getValues(); // Coluna C
    const telefonesAtuais = sheet.getRange(2, 34, ultimaLinha - 1, 1).getValues(); // Coluna AH

    for (let i = 0; i < ultimaLinha - 1; i++) {
      const site = sites[i][0];
      const telefoneAtual = telefonesAtuais[i][0];
      if (!site || telefoneAtual) continue;

      const telefone = extrairTelefoneDoSite(site);
      if (telefone) {
        sheet.getRange(i + 2, 34).setValue(telefone); // Coluna AH
        backfillados++;
      }
      Utilities.sleep(300);
    }
  }

  SpreadsheetApp.getUi().alert("Colunas Telefone_Real e Msg_Continuacao_WhatsApp configuradas! Telefone recuperado em " + backfillados + " lead(s) antigo(s). Rode \"5. Colorir Cabeçalho\" de novo pra elas ganharem cor também.");
}

/**
 * CONFIGURAÇÃO ÚNICA: cria a coluna AJ "Instagram_Popularidade" — guarda o
 * resultado de analisarPopularidadeInstagram (02_ExtracaoSite.gs), rodado
 * automaticamente pela Auditoria sempre que o "site" do lead é, na
 * verdade, um link de Instagram/Facebook. Rode isso 1 vez.
 */
function configurarColunaInstagramPopularidade() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange(1, 36).setValue("Instagram_Popularidade");
  SpreadsheetApp.getUi().alert("Coluna Instagram_Popularidade configurada na AJ! Rode \"5. Colorir Cabeçalho\" de novo pra ela ganhar cor também.");
}

/**
 * REINSTALAÇÃO DO MENU (Forçar carregamento)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  // Itens de configuração "rodar 1x" (antigos 4, 5, 6, 8, 9, 12, e agora
  // configurarRastreioEnvios) saíram do menu do dia a dia — já foram
  // executados e dificilmente precisam rodar de novo. As funções continuam
  // no código (publicarAssetsRDExclusive, aplicarCoresPorCategoria,
  // configurarStatusComercial, configurarLinkCurto,
  // configurarTelefoneEMensagemContinuacao, configurarColunaInstagramPopularidade,
  // configurarRastreioEnvios) — se um dia precisar rodar alguma de novo, é
  // só abrir o Apps Script, selecionar a função no dropdown e clicar Executar.
  ui.createMenu('🤖 Automação RD V2')
    .addItem('🔍 1. Minerar Leads no Maps', 'buscarLeadsNoMaps')
    .addItem('✨ 2. Executar Auditoria (Wappalyzer + DS)', 'executarAuditoriaWappalyzer')
    .addItem('🚀 3. Gerar Site (Migrador Técnico)', 'processarLeadsInteligente')
    .addItem('🔄 4. Recapturar Identidade Visual (linhas selecionadas)', 'recapturarIdentidadeVisualSelecionadas')
    .addItem('🧹 5. Reprocessar Lead (limpa p/ nova auditoria)', 'reprocessarLeadSelecionado')
    .addItem('🗂️ 6. Abrir Painel Kanban', 'abrirPainelKanban')
    .addItem('🧷 7. Enriquecer Lead Manual (Email/Logo/Cor/Tel)', 'enriquecerLeadsManualNaAbaAtiva')
    .addItem('🏆 8. Classificar Oportunidade (aba ativa)', 'classificarOportunidadeNaAbaAtiva')
    .addItem('✍️ 9. Regenerar Copy WA/E-mail (linhas selecionadas)', 'regenerarCopiesSelecionadas')
    .addItem('📲 10. Marcar Envio de WA Agora (linhas selecionadas)', 'marcarEnvioWAAgora')
    .addItem('📊 11. Ver Resumo de Rastreio de Envios', 'gerarResumoRastreioWA')
    .addToUi();
}

/**
 * CONFIGURAÇÃO ÚNICA: cria TRÊS colunas — AK "Data_Hora_Envio_WA1", AL
 * "Status_Leitura_WA1" e AM "Respondeu_WA1". Servem pra rastrear, por
 * lead, quando a mensagem 1 foi REALMENTE enviada (marcado por você via
 * "📲 10. Marcar Envio de WA Agora", depois de mandar de verdade pelo
 * WhatsApp — não quando ela foi só gerada) e o que aconteceu depois: ficou
 * só cinza (✓✓ entregue), ficou azul (✓✓ lido) ou nunca chegou a ser
 * visto, e se respondeu ou não.
 * Como o WhatsApp não expõe essa informação por nenhuma API, é você quem
 * atualiza a Status_Leitura e a Respondeu manualmente, olhando o WhatsApp
 * Web — os dropdowns dessas duas colunas deixam isso rápido (clique e
 * escolha, sem digitar). Rode isso 1 vez.
 */
function configurarRastreioEnvios() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ultimaLinha = sheet.getLastRow();

  sheet.getRange(1, 37).setValue("Data_Hora_Envio_WA1");
  sheet.getRange(1, 38).setValue("Status_Leitura_WA1");
  sheet.getRange(1, 39).setValue("Respondeu_WA1");

  const opcoesLeitura = ["Aguardando", "Entregue (✓✓ cinza)", "Lido (✓✓ azul)", "Sem info / bloqueado"];
  const regraLeitura = SpreadsheetApp.newDataValidation().requireValueInList(opcoesLeitura, true).setAllowInvalid(false).build();

  const opcoesRespondeu = ["Não", "Sim"];
  const regraRespondeu = SpreadsheetApp.newDataValidation().requireValueInList(opcoesRespondeu, true).setAllowInvalid(false).build();

  const numLinhas = Math.max(ultimaLinha - 1, 1000);
  sheet.getRange(2, 38, numLinhas, 1).setDataValidation(regraLeitura);
  sheet.getRange(2, 39, numLinhas, 1).setDataValidation(regraRespondeu);

  const mensagemFinal =
    "Colunas de Rastreio de Envio configuradas (AK, AL, AM)! Rode \"5. Colorir Cabeçalho\" de novo pra elas ganharem cor também.\n\n" +
    "Como usar: depois de mandar a mensagem 1 de verdade pelo WhatsApp, selecione a(s) linha(s) do(s) lead(s) e rode \"📲 10. Marcar Envio de WA Agora\". " +
    "Depois, quando checar o WhatsApp Web, atualize a Status_Leitura e a Respondeu clicando no dropdown de cada célula. " +
    "Quando quiser ver o resumo (por dia da semana e período do dia), rode \"📊 11. Ver Resumo de Rastreio de Envios\".";
  try {
    SpreadsheetApp.getUi().alert(mensagemFinal);
  } catch (e) {
    // getUi() falha quando a função é rodada direto pelo editor do Apps
    // Script (sem UI ativa, como agora) — nesse caso, log só pra confirmar
    // que rodou; as colunas já foram criadas normalmente de qualquer jeito.
    Logger.log(mensagemFinal);
  }
}

/**
 * Marca, na(s) linha(s) selecionada(s), o momento em que a mensagem 1 do
 * WhatsApp foi REALMENTE enviada (não quando foi gerada — quando você de
 * fato clicou em enviar no WhatsApp). Dá pra rodar pra várias linhas de
 * uma vez, se você mandar mensagem pra vários leads seguidos e só marcar
 * no fim. Reseta Status_Leitura pra "Aguardando" e Respondeu pra "Não"
 * (mesmo se já tivessem outro valor de um envio anterior a esse lead).
 */
function marcarEnvioWAAgora() {
  function avisar(msg) {
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      // getUi() falha se rodado direto pelo editor do Apps Script (sem UI
      // ativa) — nesse caso, log só pra confirmar.
      Logger.log(msg);
    }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) {
    avisar("Selecione antes a(s) linha(s) do(s) lead(s) que você acabou de mandar mensagem agora.");
    return;
  }

  const linhaInicio = Math.max(range.getRow(), 2);
  const linhaFim = range.getRow() + range.getNumRows() - 1;
  if (linhaFim < 2) {
    avisar("A seleção está no cabeçalho. Clique na linha do lead e rode de novo.");
    return;
  }

  const agora = new Date();
  const nomes = [];
  for (let r = linhaInicio; r <= linhaFim; r++) {
    const nome = sheet.getRange(r, 1).getValue();
    if (!nome) continue;
    sheet.getRange(r, 37).setValue(agora);        // AK Data_Hora_Envio_WA1
    sheet.getRange(r, 38).setValue("Aguardando"); // AL Status_Leitura_WA1
    sheet.getRange(r, 39).setValue("Não");        // AM Respondeu_WA1
    nomes.push(nome);
  }
  SpreadsheetApp.flush();

  if (nomes.length === 0) {
    avisar("Nenhum lead encontrado na(s) linha(s) selecionada(s) — a coluna A está vazia.");
    return;
  }
  avisar(
    "Envio marcado agora (" + Utilities.formatDate(agora, Session.getScriptTimeZone(), "dd/MM HH:mm") + ") em " +
    nomes.length + " lead(s):\n\n• " + nomes.join("\n• ")
  );
}

/**
 * Lê as colunas AK/AL/AM (Data_Hora_Envio_WA1, Status_Leitura_WA1,
 * Respondeu_WA1) da aba ativa e monta/atualiza uma aba "Rastreio WA" com
 * um resumo: total enviado, % lido, % respondido — geral, por dia da
 * semana do envio e por período do dia do envio. Rode de novo sempre que
 * quiser atualizar (idempotente — apaga e reconstrói a aba de resumo).
 */
function gerarResumoRastreioWA() {
  function avisar(msg) {
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      // getUi() falha se rodado direto pelo editor do Apps Script (sem UI
      // ativa) — nesse caso, log só pra confirmar.
      Logger.log(msg);
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) {
    avisar("Não há dados na aba ativa.");
    return;
  }

  const dados = sheet.getRange(2, 37, ultimaLinha - 1, 3).getValues(); // AK, AL, AM
  const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const PERIODOS = ["Madrugada (0h-6h)", "Manhã (6h-12h)", "Tarde (12h-18h)", "Noite (18h-24h)"];

  function periodoDaHora(h) {
    if (h < 6) return 0;
    if (h < 12) return 1;
    if (h < 18) return 2;
    return 3;
  }

  let totalEnviado = 0, totalLido = 0, totalRespondido = 0;
  const porDia = DIAS.map(function() { return { enviado: 0, lido: 0, respondido: 0 }; });
  const porPeriodo = PERIODOS.map(function() { return { enviado: 0, lido: 0, respondido: 0 }; });

  dados.forEach(function(linha) {
    const dataEnvio = linha[0];
    const statusLeitura = linha[1];
    const respondeu = linha[2];
    if (!dataEnvio || !(dataEnvio instanceof Date)) return;

    totalEnviado++;
    const lido = statusLeitura === "Lido (✓✓ azul)";
    const sim = respondeu === "Sim";
    if (lido) totalLido++;
    if (sim) totalRespondido++;

    const diaSemana = dataEnvio.getDay();
    porDia[diaSemana].enviado++;
    if (lido) porDia[diaSemana].lido++;
    if (sim) porDia[diaSemana].respondido++;

    const periodo = periodoDaHora(dataEnvio.getHours());
    porPeriodo[periodo].enviado++;
    if (lido) porPeriodo[periodo].lido++;
    if (sim) porPeriodo[periodo].respondido++;
  });

  function pct(n, total) { return total ? Math.round((n / total) * 100) + "%" : "—"; }

  const nomeAba = "Rastreio WA";
  let aba = ss.getSheetByName(nomeAba);
  if (aba) ss.deleteSheet(aba);
  aba = ss.insertSheet(nomeAba);

  let linhaAtual = 1;
  aba.getRange(linhaAtual, 1).setValue("Resumo de Rastreio de Envios de WhatsApp — atualizado em " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"));
  aba.getRange(linhaAtual, 1, 1, 5).setFontWeight("bold");
  linhaAtual += 2;

  aba.getRange(linhaAtual, 1, 1, 4).setValues([["Total Enviado", "Lidos (azul)", "% Lido", "% Respondido"]]).setFontWeight("bold");
  linhaAtual++;
  aba.getRange(linhaAtual, 1, 1, 4).setValues([[totalEnviado, totalLido, pct(totalLido, totalEnviado), pct(totalRespondido, totalEnviado)]]);
  linhaAtual += 2;

  aba.getRange(linhaAtual, 1).setValue("Por dia da semana do envio").setFontWeight("bold");
  linhaAtual++;
  aba.getRange(linhaAtual, 1, 1, 5).setValues([["Dia", "Enviados", "Lidos", "% Lido", "% Respondido"]]).setFontWeight("bold");
  linhaAtual++;
  DIAS.forEach(function(dia, i) {
    if (porDia[i].enviado === 0) return;
    aba.getRange(linhaAtual, 1, 1, 5).setValues([[dia, porDia[i].enviado, porDia[i].lido, pct(porDia[i].lido, porDia[i].enviado), pct(porDia[i].respondido, porDia[i].enviado)]]);
    linhaAtual++;
  });
  linhaAtual++;

  aba.getRange(linhaAtual, 1).setValue("Por período do dia do envio").setFontWeight("bold");
  linhaAtual++;
  aba.getRange(linhaAtual, 1, 1, 5).setValues([["Período", "Enviados", "Lidos", "% Lido", "% Respondido"]]).setFontWeight("bold");
  linhaAtual++;
  PERIODOS.forEach(function(periodo, i) {
    if (porPeriodo[i].enviado === 0) return;
    aba.getRange(linhaAtual, 1, 1, 5).setValues([[periodo, porPeriodo[i].enviado, porPeriodo[i].lido, pct(porPeriodo[i].lido, porPeriodo[i].enviado), pct(porPeriodo[i].respondido, porPeriodo[i].enviado)]]);
    linhaAtual++;
  });

  aba.autoResizeColumns(1, 5);
  ss.setActiveSheet(aba);

  avisar("Resumo atualizado na aba \"" + nomeAba + "\"! Com poucos envios os números ainda não dizem muita coisa — mas o padrão vai ficar mais claro conforme mais leads forem marcados e checados.");
}


/**
 * Limpa as colunas de resultado do(s) lead(s) da(s) linha(s) selecionada(s)
 * pra rodar uma auditoria + geração 100% do zero, preservando o que não
 * pode ser perdido:
 *   - APAGA: D (e-mail extraído), F até O (idade domínio, velocidade,
 *     pixels, redes, plataforma, idade wayback, tag de oportunidade,
 *     diagnóstico/gaps, diagnóstico de dores, score — inclui a coluna N,
 *     que é a marca de "já auditado" lida pelo skip da Auditoria; sem
 *     limpar ela o reprocessamento não tinha efeito nenhum), R até AD
 *     (design system, oferta, status, URLs, avisos, mensagens), AF, AG
 *     (links curtos) e AI (msg de continuação).
 *   - PRESERVA: E (dado da mineração), AE (Status_Comercial — kanban
 *     manual) e AH (Telefone_Real — telefone minerado do Google Maps).
 * Fluxo depois de rodar: menu 2 (Auditoria) → marcar "Gerar" na W → menu 3.
 */
function reprocessarLeadSelecionado() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) {
    ui.alert("Selecione antes a(s) linha(s) do(s) lead(s) que quer reprocessar (clique em qualquer célula da linha).");
    return;
  }

  const linhaInicio = Math.max(range.getRow(), 2); // nunca mexe no cabeçalho
  const linhaFim = range.getRow() + range.getNumRows() - 1;
  if (linhaFim < 2) {
    ui.alert("A seleção está no cabeçalho. Clique numa linha de lead e rode de novo.");
    return;
  }

  const nomes = [];
  for (let r = linhaInicio; r <= linhaFim; r++) {
    const nome = sheet.getRange(r, 1).getValue();
    if (nome) nomes.push(nome);
  }
  if (nomes.length === 0) {
    ui.alert("Nenhum lead encontrado na(s) linha(s) selecionada(s) — a coluna A está vazia.");
    return;
  }

  const resposta = ui.alert(
    "Reprocessar Lead",
    "Vou limpar as colunas D, F–O, R–AD, AF, AG, AI e AJ (preservando E, Status_Comercial e Telefone_Real) de:\n\n• " +
      nomes.join("\n• ") +
      "\n\nDepois é só rodar o menu 2 (Auditoria). Confirma?",
    ui.ButtonSet.YES_NO
  );
  if (resposta !== ui.Button.YES) return;

  for (let r = linhaInicio; r <= linhaFim; r++) {
    if (!sheet.getRange(r, 1).getValue()) continue;
    sheet.getRange(r, 4, 1, 1).clearContent();   // D (Email)
    sheet.getRange(r, 6, 1, 10).clearContent();  // F até O (6–15) — inclui N, a marca de "já auditado"
    sheet.getRange(r, 18, 1, 13).clearContent(); // R até AD (18–30)
    sheet.getRange(r, 32, 1, 2).clearContent();  // AF e AG (32–33)
    sheet.getRange(r, 35, 1, 2).clearContent();  // AI e AJ (35–36) — msg continuação + popularidade IG
  }
  SpreadsheetApp.flush();

  ui.alert("Pronto! " + nomes.length + " lead(s) limpo(s).\n\nAgora: rode o menu 2 (Auditoria). Quando terminar, marque \"Gerar\" na coluna W e rode o menu 3.");
}
