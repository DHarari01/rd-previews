// =========================================================================
// RD PROSPECT — 10_EnriquecerLeadManual.gs
// Pra quando você encontra um lead "na unha" (navegando, indicação etc.) e
// quer adicionar direto na aba de trabalho, sem passar pela mineração do
// Google Maps (01_Mineracao.gs) nem pela busca por nome exato da Carteira
// Própria (09_CarteiraPropria.gs).
//
// COMO USAR:
// 1. Na aba onde você trabalha (ex: "Página1 (Reorganizada)"), adicione uma
//    linha nova preenchendo à mão só 3 colunas: A (Nome), B (Nicho) e
//    C (Site Atual — a URL completa do site feio que você achou).
// 2. Rode "enriquecerLeadsManualNaAbaAtiva" (pelo editor do Apps Script,
//    OU — melhor — adicione um atalho de menu se preferir). Ela varre a
//    aba INTEIRA procurando linhas com Site preenchido e Email ainda vazio
//    (ou seja, novas, ainda não enriquecidas) e preenche Email, Logo,
//    Cor Principal e Telefone a partir do próprio site.
// 3. Rode "2. Executar Auditoria" (menu normal da planilha) — ela completa
//    o resto (idade de domínio, velocidade, pixels, redes, plataforma,
//    identidade visual).
// 4. Rode "classificarOportunidadeNaAbaAtiva" (deste mesmo arquivo) pra
//    preencher a Classificação de Oportunidade (coluna L) — assim como a
//    Carteira Própria, essa coluna não é calculada pela Auditoria.
// 5. Marque a coluna W como "Gerar" e rode "3. Gerar Site" normalmente.
// 6. Se depois de ler a mensagem de WhatsApp (ou o e-mail) você achar que
//    a copy não ficou boa, SELECIONE a(s) linha(s) na planilha e rode
//    "regenerarCopiesSelecionadas" (mais abaixo neste arquivo) — ela pede
//    uma nova tentativa pra IA só da copy, sem reauditar o site inteiro.
//
// ATENÇÃO — getActiveSheet(): como aprendemos rodando a Carteira Própria,
// rodar uma função direto pelo "Executar" do editor do Apps Script usa a
// aba que estiver REALMENTE ativa no backend do Google, que nem sempre
// bate com a aba visível na tela. Antes de rodar qualquer função daqui,
// clique numa célula da aba certa (não só na aba em si) e SÓ DEPOIS troque
// pra aba do Apps Script e clique Executar. Diferente da Carteira Própria,
// aqui não travei a aba por nome fixo (getSheetByName) de propósito — essa
// função precisa funcionar em QUALQUER aba onde você estiver prospectando,
// não numa fixa.
// =========================================================================

/**
 * Varre a aba ativa e enriquece (Email, Logo, Cor, Telefone) toda linha que
 * já tem Site (coluna C) preenchido mas ainda não tem Email (coluna D) —
 * ou seja, foi adicionada manualmente e ainda não passou por nenhum
 * enriquecimento automático.
 */
function enriquecerLeadsManualNaAbaAtiva() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dados = sheet.getDataRange().getValues();
  let processados = 0;

  for (let i = 1; i < dados.length; i++) {
    const nome = dados[i][0];
    const site = dados[i][2];
    const emailAtual = dados[i][3];
    if (!nome || !site || emailAtual) continue; // só processa lead novo com site mas sem e-mail ainda

    const rowNum = i + 1;

    try {
      sheet.getRange(rowNum, 4).setValue(extrairEmailDoSite(site)); // D Email
      sheet.getRange(rowNum, 16).setValue(extrairLogoDoSite(site)); // P Logo Personalizado
      sheet.getRange(rowNum, 17).setValue(extrairCorDoSite(site)); // Q Cor Principal

      const telefoneAtual = dados[i][33]; // AH Telefone_Real
      if (!telefoneAtual) {
        Utilities.sleep(300);
        const telefone = extrairTelefoneDoSite(site);
        if (telefone) sheet.getRange(rowNum, 34).setValue(telefone);
      }

      processados++;
      Utilities.sleep(300); // Evita sobrecarga de requisições consecutivas
    } catch (erro) {
      sheet.getRange(rowNum, 26).setValue("⚠️ Erro ao enriquecer lead manual: " + erro.message);
    }
  }

  SpreadsheetApp.flush();
  Logger.log("[Lead Manual] " + processados + " linha(s) enriquecida(s) (Email/Logo/Cor/Telefone).");
}

/**
 * Mesma fórmula de Classificação de Oportunidade usada em
 * 09_CarteiraPropria.gs (e originalmente em 01_Mineracao.gs), só que
 * generalizada pra rodar em QUALQUER aba ativa, não numa fixa por nome.
 * Rode DEPOIS de "2. Executar Auditoria", senão as colunas de origem
 * (Nota, Idade do Domínio, Velocidade, Pixels, Redes) ainda estão vazias
 * e tudo cai em "Prospecção Padrão".
 */
function classificarOportunidadeNaAbaAtiva() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dados = sheet.getDataRange().getValues();
  let atualizados = 0;

  for (let i = 1; i < dados.length; i++) {
    const nome = dados[i][0];
    if (!nome) continue;

    const site = dados[i][2];
    const diferencialTexto = String(dados[i][4] || "");
    const idadeDominio = String(dados[i][5] || "");
    const velocidadeCarregamento = String(dados[i][6] || "");
    const pixelsDetectados = String(dados[i][7] || "");
    const redesDetectadas = String(dados[i][8] || "");

    const matchNota = diferencialTexto.match(/Nota\s+([\d.]+).*?com\s+(\d+)\s+avalia/i);
    const notaRating = matchNota ? parseFloat(matchNota[1]) : 0;
    const totalAvaliacoes = matchNota ? parseInt(matchNota[2]) : 0;

    let classificacao = "Prospecção Padrão";
    if (site && (notaRating >= 4.5 || totalAvaliacoes > 50)) {
      const temPontosFracosGraves = velocidadeCarregamento.includes("🔴") || pixelsDetectados.includes("🔴") || redesDetectadas.includes("⚠️");
      const temPontosFracosMedios = velocidadeCarregamento.includes("🟡") || (idadeDominio && parseInt(idadeDominio) >= 3);

      if (temPontosFracosGraves || (idadeDominio && parseInt(idadeDominio) >= 5)) {
        classificacao = "🔥 Oportunidade de Ouro";
      } else if (temPontosFracosMedios) {
        classificacao = "⚡ Boa Oportunidade";
      }
    }

    sheet.getRange(i + 1, 12).setValue(classificacao); // L Classificação de Oportunidade
    atualizados++;
  }

  SpreadsheetApp.flush();
  Logger.log("[Lead Manual] Classificação de Oportunidade recalculada em " + atualizados + " linha(s).");
}

/**
 * Regenera só as COPIES (mensagem de abertura do WhatsApp e, se já existir
 * site-teste, o e-mail de reforço) das linhas SELECIONADAS na aba ativa —
 * sem reauditar o site inteiro. Use quando achar que a copy atual (WA ou
 * e-mail) não ficou boa o suficiente e quiser uma nova tentativa da IA,
 * sem gastar tempo refazendo raspagem/velocidade/pixels/redes do zero.
 *
 * COMO USAR: selecione a(s) linha(s) desejada(s) na planilha (clique numa
 * célula da linha, ou arraste pra selecionar várias) e rode esta função
 * pelo editor do Apps Script.
 *
 * - Regenera sempre a mensagem 1 do WhatsApp (coluna AB) e atualiza o link
 *   pronto de WA (coluna AA), se a linha já tiver telefone real (AH).
 * - Regenera o e-mail de reforço (colunas AC/AD) só se a linha já tiver
 *   um site-teste gerado (coluna X preenchida) — sem isso não tem link
 *   pra colocar no e-mail. Se ainda não gerou o site, só a mensagem de
 *   WhatsApp é regenerada.
 */
function regenerarCopiesSelecionadas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const intervalo = sheet.getActiveRange();
  if (!intervalo) {
    Logger.log("[Copies] Nenhuma linha selecionada.");
    return;
  }

  const linhaInicial = intervalo.getRow();
  const numLinhas = intervalo.getNumRows();
  let atualizadosWA = 0;
  let atualizadosEmail = 0;

  let atualizadosLinkAA = 0;
  const linhasSemLinkAA = []; // nomes das linhas cuja AB foi regerada mas AA NÃO pôde ser (sem telefone válido)

  for (let r = linhaInicial; r < linhaInicial + numLinhas; r++) {
    if (r === 1) continue; // pula cabeçalho, se selecionado por engano
    const linha = sheet.getRange(r, 1, 1, 34).getValues()[0];
    const nome = linha[0];               // A Nome
    if (!nome) continue;
    const nicho = linha[1];              // B Nicho
    const diferencial = linha[4];        // E Diferencial/Nota
    const diagnosticoGaps = linha[12];   // M Diagnóstico/Gaps
    const diagnosticoDores = linha[13];  // N Diagnostico_Dores
    const urlTeste = linha[23];          // X URL_Teste
    const telefoneReal = linha[33];      // AH Telefone_Real

    try {
      const novaMsgWA = gerarMensagemAberturaWhatsAppIA(nome, nicho, diferencial, diagnosticoDores, diagnosticoGaps);
      sheet.getRange(r, 28).setValue(novaMsgWA); // AB Msg_Automática

      // Recalcula a AA (link pronto de WA) sempre junto — nunca deixa ela
      // desatualizada em relação à AB que acabou de mudar. Se não der pra
      // atualizar (sem telefone, ou telefone inválido), registra pra avisar
      // no resumo final em vez de falhar em silêncio (Logger.log sozinho
      // não é visto na hora — foi isso que causou o "AA não atualizou e eu
      // nem soube por quê").
      let linkAtualizado = false;
      if (telefoneReal) {
        const numeroLimpo = normalizarNumeroWhatsApp(telefoneReal);
        if (numeroLimpo) {
          sheet.getRange(r, 27).setValue("https://wa.me/" + numeroLimpo + "?text=" + encodeURIComponent(novaMsgWA)); // AA WA
          linkAtualizado = true;
          atualizadosLinkAA++;
        }
      }
      if (!linkAtualizado) linhasSemLinkAA.push(nome + " (linha " + r + ")");

      atualizadosWA++;
      Utilities.sleep(300);
    } catch (erroWA) {
      Logger.log("[Copies] Linha " + r + " — erro ao regenerar msg de WhatsApp: " + erroWA.message);
    }

    if (urlTeste) {
      try {
        const novoEmail = gerarEmailPropostaIA(nome, nicho, diferencial, diagnosticoDores, diagnosticoGaps, urlTeste);
        sheet.getRange(r, 29).setValue(novoEmail.assunto); // AC Assunto e-mail
        sheet.getRange(r, 30).setValue(novoEmail.corpo);   // AD Corpo e-mail
        atualizadosEmail++;
        Utilities.sleep(300);
      } catch (erroEmail) {
        Logger.log("[Copies] Linha " + r + " — erro ao regenerar e-mail: " + erroEmail.message);
      }
    }
  }

  SpreadsheetApp.flush();

  let resumo = "Mensagem de WhatsApp (AB) regenerada em " + atualizadosWA + " linha(s).\n" +
    "Link pronto de WA (AA) atualizado em " + atualizadosLinkAA + " linha(s).\n" +
    "E-mail regenerado em " + atualizadosEmail + " linha(s) (só onde já havia site-teste gerado).";
  if (linhasSemLinkAA.length) {
    resumo += "\n\n⚠️ AA NÃO foi atualizada nestas linhas (falta telefone na coluna AH, ou o número não é válido):\n" +
      linhasSemLinkAA.join("\n");
  }
  Logger.log("[Copies] " + resumo.replace(/\n/g, " | "));

  try {
    SpreadsheetApp.getUi().alert(resumo);
  } catch (e) {
    // getUi() falha se a função for rodada direto pelo editor do Apps Script
    // (sem UI ativa) — nesse caso o resumo já foi pro Logger acima.
  }
}

/**
 * TRIGGER SIMPLES — o Google roda ela sozinha, automaticamente, toda vez que
 * você edita qualquer célula da planilha (não precisa rodar pelo menu nem
 * autorizar nada à parte).
 *
 * Resolve o problema de editar a coluna AB (Msg_Automática) na mão — pra
 * ajustar o texto ou pular linha — e a coluna AA (link pronto de WhatsApp,
 * o que a automação de envio realmente usa) ficar com o texto ANTIGO, já
 * que antes ela só era recalculada quando alguma função de código inteira
 * rodava (Gerar Site, ou o menu 9 Regenerar Copy).
 *
 * Agora: toda vez que você edita a coluna AB (a mensagem) OU a coluna AH
 * (o telefone), a AA é recalculada na hora com o texto/telefone mais
 * atuais daquela linha.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const colIni = e.range.getColumn();
    const colFim = colIni + e.range.getNumColumns() - 1;
    const linhaIni = e.range.getRow();
    const numLinhas = e.range.getNumRows();

    const tocouAB = colIni <= 28 && colFim >= 28; // AB Msg_Automática
    const tocouAH = colIni <= 34 && colFim >= 34; // AH Telefone_Real
    if (!tocouAB && !tocouAH) return;

    for (let i = 0; i < numLinhas; i++) {
      const linha = linhaIni + i;
      if (linha === 1) continue; // cabeçalho

      const msgAtual = sheet.getRange(linha, 28).getValue();      // AB
      const telefoneAtual = sheet.getRange(linha, 34).getValue(); // AH
      if (!msgAtual || !telefoneAtual) continue;

      const numeroLimpo = normalizarNumeroWhatsApp(telefoneAtual);
      if (numeroLimpo) {
        sheet.getRange(linha, 27).setValue(
          "https://wa.me/" + numeroLimpo + "?text=" + encodeURIComponent(msgAtual)
        ); // AA
      }
    }
  } catch (erro) {
    Logger.log("[onEdit] Erro ao atualizar link de WhatsApp: " + erro.message);
  }
}
