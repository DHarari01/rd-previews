// =========================================================================
// RD PROSPECT — 05_GerarSite.gs (v3.0 — MESCLADO: estrutura da Natália +
// fixes meus + instrumentação de tempo pra medir velocidade média)
// Item 3 do menu: monta o HTML final, a página de apresentação (comparador
// antes/depois) e publica — o motor principal de geração.
//
// ORIGEM DESTA VERSÃO:
// - Estrutura modular (registrarEtapaGeracao, fetchSeguro,
//   executarPipelineInteligente, aguardarDeployVercel,
//   aplicarMapaImagensNoHTML, normalizarOgImageAbsoluta): veio da Natália.
// - Tratamento de "site" que na verdade é link de Instagram/Facebook
//   (siteParaRaspar/ehSiteAtualLinkSocial + foto de perfil do IG como
//   melhor esforço) e prioridade do telefone já validado na Auditoria
//   (coluna AH) sobre re-raspar o site: são os meus fixes, reincorporados
//   aqui porque a versão da Natália raspava qualquer siteAtual direto,
//   inclusive links de Instagram — reintroduzindo o bug que corrigimos
//   (Instagram bloqueia acesso de servidor e devolve lixo).
// - Instrumentação de tempo (elapsed ms por etapa + tempo total por lead,
//   tudo no Logger): nova nesta versão, pra dar visibilidade real de quanto
//   tempo cada lead consome na esteira de 4 chamadas de IA + QA + deploy.
// =========================================================================

function capturarScreenshotViaMshots(url, altura) {
  try {
    if (!url) return null;
    const alturaFinal = altura || 600;
    const mshotsUrl = "https://s.wordpress.com/mshots/v1/" + encodeURIComponent(url) + "?w=800&h=" + alturaFinal;
    const TAMANHO_MINIMO_PRINT_REAL = 8000; // bytes
    const totalTentativas = 4;
    let melhorBytesConseguido = null;
    for (let tentativa = 1; tentativa <= totalTentativas; tentativa++) {
      const resposta = UrlFetchApp.fetch(mshotsUrl, { muteHttpExceptions: true });
      if (resposta.getResponseCode() === 200) {
        const bytes = resposta.getBlob().getBytes();
        melhorBytesConseguido = bytes;
        if (bytes.length >= TAMANHO_MINIMO_PRINT_REAL) {
          return Utilities.base64Encode(bytes);
        }
      }
      if (tentativa < totalTentativas) Utilities.sleep(5000 + tentativa * 2000);
    }
    return melhorBytesConseguido ? Utilities.base64Encode(melhorBytesConseguido) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Gera a página de apresentação com o comparador AO VIVO "antes/depois":
 * dois iframes de verdade (não screenshots estáticos), lado a lado no
 * desktop e alternáveis por um toggle no mobile. Fica ENTRE o primeiro
 * contato e o site novo em si — é ESSE link, não o link cru do site
 * gerado, que deve ir no e-mail/WhatsApp de reforço.
 * Retorna a URL final da página de apresentação, ou null se o commit falhar.
 */
function gerarPaginaApresentacao(nomeCliente, nicho, siteAntigo, urlNovo, nomePasta) {
  try {
    const anoAtual = new Date().getFullYear();
    const temSiteAntigo = !!siteAntigo;
    const siteAntigoParaIframe = siteAntigo ? siteAntigo.replace(/^http:\/\//i, "https://") : null;

    const painelAntes = temSiteAntigo ? (
      '<div class="painel" data-painel="antes">\n' +
      '  <span class="painel-label">ANTES</span>\n' +
      '  <iframe src="' + siteAntigoParaIframe + '" loading="lazy" title="Site atual"></iframe>\n' +
      '  <div class="painel-fallback"><a href="' + siteAntigo + '" target="_blank" rel="noopener">Não carregou? Abrir site atual em nova aba</a></div>\n' +
      '</div>\n'
    ) : '';

    const painelDepois =
      '<div class="painel" data-painel="depois">\n' +
      '  <span class="painel-label">DEPOIS</span>\n' +
      '  <iframe src="' + urlNovo + '" loading="lazy" title="Site novo proposto"></iframe>\n' +
      '  <div class="painel-fallback"><a href="' + urlNovo + '" target="_blank" rel="noopener">Não carregou? Abrir site novo em nova aba</a></div>\n' +
      '</div>\n';

    const toggleHtml = temSiteAntigo ? (
      '  <div class="toggle">\n' +
      '    <button id="btnAntes" type="button">Como está hoje</button>\n' +
      '    <button id="btnDepois" type="button" class="ativo">Como pode ficar</button>\n' +
      '  </div>\n'
    ) : '';

    const introTexto = temSiteAntigo
      ? 'Compare abaixo: toque nos botões pra alternar entre o site de hoje e a nova versão (no computador, os dois aparecem lado a lado). Sem compromisso — é só um protótipo.'
      : 'Preparamos uma prévia funcional do que o novo site pode ser. Sem compromisso — é só um protótipo.';

    const toggleScript = temSiteAntigo ? (
      '  <script>\n' +
      '    var btnAntes = document.getElementById("btnAntes");\n' +
      '    var btnDepois = document.getElementById("btnDepois");\n' +
      '    btnAntes.addEventListener("click", function() {\n' +
      '      document.body.classList.add("mostrar-antes");\n' +
      '      btnAntes.classList.add("ativo");\n' +
      '      btnDepois.classList.remove("ativo");\n' +
      '    });\n' +
      '    btnDepois.addEventListener("click", function() {\n' +
      '      document.body.classList.remove("mostrar-antes");\n' +
      '      btnDepois.classList.add("ativo");\n' +
      '      btnAntes.classList.remove("ativo");\n' +
      '    });\n' +
      '  </script>\n'
    ) : '';

    const html = '<!DOCTYPE html>\n' +
      '<html lang="pt-BR">\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>Uma prévia preparada para ' + nomeCliente + '</title>\n' +
      '<style>\n' +
      '  * { box-sizing: border-box; margin: 0; padding: 0; }\n' +
      '  body { font-family: Inter, -apple-system, sans-serif; background: #FAF7F2; color: #1A1A1A; }\n' +
      '  .topo { padding: 24px 16px 4px; text-align: center; }\n' +
      '  .marca { margin-bottom: 12px; }\n' +
      '  .marca img { height: 64px; width: auto; }\n' +
      '  h1 { font-size: 20px; line-height: 1.3; margin-bottom: 8px; color: #1F3A34; }\n' +
      '  p.intro { font-size: 14px; line-height: 1.5; color: #555; max-width: 520px; margin: 0 auto; }\n' +
      '  .toggle { display: flex; justify-content: center; gap: 8px; padding: 16px; }\n' +
      '  .toggle button { border: 1px solid #1F3A34; background: #fff; color: #1F3A34; padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; }\n' +
      '  .toggle button.ativo { background: #1F3A34; color: #fff; }\n' +
      '  .comparador { display: flex; flex-direction: column; gap: 2px; background: #ddd; }\n' +
      '  .painel { position: relative; height: 72vh; background: #fff; }\n' +
      '  .painel iframe { width: 100%; height: 100%; border: 0; display: block; }\n' +
      '  .painel-label { position: absolute; top: 10px; left: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; background: rgba(26,26,26,0.65); color: #fff; padding: 4px 10px; border-radius: 20px; z-index: 2; }\n' +
      '  .painel-fallback { position: absolute; bottom: 10px; left: 10px; right: 10px; text-align: center; z-index: 2; }\n' +
      '  .painel-fallback a { display: inline-block; font-size: 11px; color: #1F3A34; background: rgba(255,255,255,0.92); padding: 6px 10px; border-radius: 8px; text-decoration: none; font-weight: 600; }\n' +
      '  .painel[data-painel="antes"] { display: none; }\n' +
      '  body.mostrar-antes .painel[data-painel="antes"] { display: block; }\n' +
      '  body.mostrar-antes .painel[data-painel="depois"] { display: none; }\n' +
      '  .rodape-cta { padding: 20px 16px 40px; text-align: center; }\n' +
      '  .cta { display: inline-block; background: #1F3A34; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px; }\n' +
      '  .rodape { text-align: center; font-size: 12px; color: #999; margin-top: 16px; padding-bottom: 8px; }\n' +
      '  @media (min-width: 900px) {\n' +
      '    .toggle { display: none; }\n' +
      '    .comparador { flex-direction: row; }\n' +
      '    .painel { height: 80vh; flex: 1; }\n' +
      '    .painel[data-painel="antes"] { display: block !important; }\n' +
      '    .painel[data-painel="depois"] { display: block !important; }\n' +
      '  }\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      '  <div class="topo">\n' +
      '    <div class="marca"><img src="' + URL_LOGO_RD_COLORIDA + '" alt="RD Exclusive"></div>\n' +
      '    <h1>Preparamos uma prévia especialmente para ' + nomeCliente + '</h1>\n' +
      '    <p class="intro">' + introTexto + '</p>\n' +
      '  </div>\n' +
      toggleHtml +
      '  <div class="comparador">\n' +
      painelAntes +
      painelDepois +
      '  </div>\n' +
      '  <div class="rodape-cta">\n' +
      '    <a class="cta" href="' + urlNovo + '" target="_blank" rel="noopener">Ver o site completo</a>\n' +
      '    <p class="rodape">RD Exclusive · ' + anoAtual + '</p>\n' +
      '  </div>\n' +
      toggleScript +
      '</body>\n' +
      '</html>';

    publicarNoGitHub(nomePasta + "/apresentacao/index.html", html);
    return "https://rd-previews-dharari01s-projects.vercel.app/" + nomePasta + "/apresentacao/index.html";
  } catch (e) {
    return null;
  }
}

/**
 * REDE DE SEGURANÇA CONTRA CONTATO FABRICADO PELA IA — roda DEPOIS que o
 * HTML já foi gerado e confere cada contato encontrado contra os dados
 * REAIS extraídos do site. Cada valor único só gera um aviso, mesmo
 * aparecendo várias vezes no HTML.
 */
function blindarContatosFabricados(html, contexto, emailFinal) {
  const avisos = [];
  let htmlCorrigido = html;
  const textoRealCompleto = (contexto.textoOriginal || "") + " " + (contexto.whatsappReal || "") + " " + (emailFinal || "");
  const textoRealSoDigitos = textoRealCompleto.replace(/\D/g, "");

  // 1) Links de WhatsApp (wa.me/NUMERO) — só sobrevive o número real.
  const numeroRealLimpo = contexto.whatsappReal ? contexto.whatsappReal.replace(/\D/g, "") : null;
  const numerosWhatsJaAvisados = {};
  htmlCorrigido = htmlCorrigido.replace(/wa\.me\/(\d+)/g, function(match, numero) {
    if (numeroRealLimpo && numero === numeroRealLimpo) return match;
    if (!numerosWhatsJaAvisados[numero]) {
      numerosWhatsJaAvisados[numero] = true;
      avisos.push("WhatsApp fabricado neutralizado (não é o número real do cliente): " + numero);
    }
    return "#";
  });

  // 2) E-mails no HTML — só sobrevive o e-mail já confirmado como real.
  const emailsEncontrados = htmlCorrigido.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const emailsJaTratados = {};
  emailsEncontrados.forEach(function(email) {
    if (emailFinal && email.toLowerCase() === emailFinal.toLowerCase()) return;
    const chave = email.toLowerCase();
    if (emailsJaTratados[chave]) return;
    emailsJaTratados[chave] = true;
    htmlCorrigido = htmlCorrigido.split(email).join(emailFinal || "");
    avisos.push("E-mail fabricado substituído pelo e-mail real (ou removido): " + email);
  });

  // 3) Telefones soltos no texto — não substitui automaticamente, só sinaliza.
  const telefonesEncontrados = htmlCorrigido.match(/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/g) || [];
  const telefonesUnicos = [];
  const digitosJaVistos = {};
  telefonesEncontrados.forEach(function(tel) {
    const digitos = tel.replace(/\D/g, "");
    if (digitosJaVistos[digitos]) return;
    digitosJaVistos[digitos] = true;
    telefonesUnicos.push(tel);
  });
  telefonesUnicos.forEach(function(tel) {
    const telSoDigitos = tel.replace(/\D/g, "");
    if (!textoRealSoDigitos.includes(telSoDigitos)) {
      avisos.push("Telefone possivelmente fabricado (revisar manualmente): " + tel);
      return;
    }
    const posicao = htmlCorrigido.indexOf(tel);
    const trechoAntes = posicao > 40 ? htmlCorrigido.substring(posicao - 40, posicao) : htmlCorrigido.substring(0, posicao);
    if (!trechoAntes.includes("tel:")) {
      avisos.push("Telefone real sem link clicável (tel:) — revisar manualmente: " + tel);
    }
  });

  return { html: htmlCorrigido, avisos: avisos };
}

/**
 * Injeta um selo discreto "Protótipo por RD Exclusive" com a logo real,
 * fixo no canto inferior direito do site gerado.
 */
function adicionarSeloRDExclusive(html) {
  try {
    const selo =
      // CORRIGIDO (caso Douglas Sales / M&B Fisioterapia): fixo embaixo
      // CENTRALIZADO colidia com botões de CTA do hero em telas baixas.
      // Movido pro canto inferior ESQUERDO (o botão flutuante do WhatsApp
      // já ocupa o canto inferior direito em todo template) e reduzido um
      // pouco pra ficar mais discreto num canto.
      '<div style="position:fixed;bottom:16px;left:16px;z-index:2147483647;' +
      'background:rgba(255,255,255,0.96);border-radius:999px;padding:8px 18px 8px 10px;' +
      'box-shadow:0 6px 20px rgba(0,0,0,0.22);display:flex;align-items:center;gap:7px;' +
      'font-family:Inter,-apple-system,sans-serif;">' +
      '<img src="' + URL_LOGO_RD_COLORIDA + '" alt="RD Exclusive" style="height:26px;width:auto;display:block;">' +
      '<span style="font-size:14px;font-weight:700;color:#1A1A1A;white-space:nowrap;">Protótipo por RD Exclusive</span>' +
      '</div>';
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, selo + "</body>");
    }
    return html + selo;
  } catch (e) {
    return html;
  }
}

/**
 * Injeta o "pacote de efeitos padrão RD" (CSS + JS puro, sem biblioteca
 * externa) em QUALQUER site-teste gerado — decidido com a Carla depois do
 * caso M&B Fisioterapia:
 * 1. Hero dividido (texto + foto do profissional/negócio), quando a IA optar
 *    por usar essa estrutura (classes rd-hero-split / rd-hero-media).
 * 2. Fade/slide suave ao rolar a página (classe rd-reveal em seções).
 * 3. Números que "contam" até o valor real ao aparecerem na tela
 *    (classe rd-counter + atributo data-target).
 * 4. Zoom leve + sombra em cards (benefícios, serviços, depoimentos etc.)
 *    ao passar o mouse — e também ao entrarem na tela, no celular, já que
 *    não existe hover no toque (classe rd-card-fx).
 * As classes em si são geradas pela IA em gerarHTMLViaAI (03_IA.gs); esta
 * função só entra com o "motor" (CSS/JS) que dá vida a elas. Isso mantém a
 * geração de conteúdo e o motor de efeitos desacoplados — se a IA não usar
 * alguma classe num lead específico (ex: sem foto boa pro hero dividido),
 * simplesmente não tem elemento pra animar, sem quebrar nada.
 */
function adicionarEfeitosPadraoRD(html) {
  try {
    const estilo =
      '<style>\n' +
      '.rd-reveal{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease;}\n' +
      '.rd-reveal.rd-in-view{opacity:1;transform:translateY(0);}\n' +
      '.rd-card-fx{transition:transform .35s ease,box-shadow .35s ease;}\n' +
      '.rd-card-fx.rd-in-view,.rd-card-fx:hover{transform:scale(1.035);box-shadow:0 18px 40px rgba(0,0,0,0.14);}\n' +
      '.rd-hero-split{display:grid;grid-template-columns:1fr;gap:2rem;align-items:center;}\n' +
      '@media (min-width:900px){.rd-hero-split{grid-template-columns:1.1fr .9fr;gap:3rem;}}\n' +
      '.rd-hero-media img{width:100%;height:auto;border-radius:20px;display:block;}\n' +
      '@media (prefers-reduced-motion: reduce){.rd-reveal,.rd-card-fx{transition:none;opacity:1;transform:none;}}\n' +
      '</style>';

    const script =
      '<script>\n' +
      'document.addEventListener("DOMContentLoaded", function() {\n' +
      '  var alvos = document.querySelectorAll(".rd-reveal, .rd-card-fx, .rd-counter");\n' +
      '  function animarContador(el) {\n' +
      '    var textoAlvo = el.getAttribute("data-target") || "0";\n' +
      '    var alvo = parseFloat(textoAlvo);\n' +
      '    var casas = textoAlvo.indexOf(".") !== -1 ? 1 : 0;\n' +
      '    var duracao = 1400, inicio = null;\n' +
      '    function passo(ts) {\n' +
      '      if (!inicio) inicio = ts;\n' +
      '      var progresso = Math.min((ts - inicio) / duracao, 1);\n' +
      '      var valorAtual = alvo * progresso;\n' +
      '      el.textContent = casas ? valorAtual.toFixed(casas) : Math.floor(valorAtual);\n' +
      '      if (progresso < 1) requestAnimationFrame(passo);\n' +
      '      else el.textContent = casas ? alvo.toFixed(casas) : alvo;\n' +
      '    }\n' +
      '    requestAnimationFrame(passo);\n' +
      '  }\n' +
      '  if ("IntersectionObserver" in window) {\n' +
      '    var obs = new IntersectionObserver(function(entradas) {\n' +
      '      entradas.forEach(function(entrada) {\n' +
      '        if (entrada.isIntersecting) {\n' +
      '          entrada.target.classList.add("rd-in-view");\n' +
      '          if (entrada.target.classList.contains("rd-counter")) animarContador(entrada.target);\n' +
      '          obs.unobserve(entrada.target);\n' +
      '        }\n' +
      '      });\n' +
      '    }, { threshold: 0.25 });\n' +
      '    alvos.forEach(function(el) { obs.observe(el); });\n' +
      '  } else {\n' +
      '    alvos.forEach(function(el) {\n' +
      '      el.classList.add("rd-in-view");\n' +
      '      if (el.classList.contains("rd-counter")) animarContador(el);\n' +
      '    });\n' +
      '  }\n' +
      '});\n' +
      '</script>';

    let resultado = html;
    resultado = /<\/head>/i.test(resultado) ? resultado.replace(/<\/head>/i, estilo + "</head>") : estilo + resultado;
    resultado = /<\/body>/i.test(resultado) ? resultado.replace(/<\/body>/i, script + "</body>") : resultado + script;
    return resultado;
  } catch (e) {
    return html; // nunca trava a geração do site por causa de um efeito visual
  }
}

function limparNomeParaURL(texto) {
  return texto.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Registra a etapa atual na coluna W e no Logger — com o tempo decorrido
 * desde o início do processamento DESSE lead, pra dar visibilidade real de
 * onde o tempo está sendo gasto (screenshot, cada chamada de IA, deploy...).
 * Pra medir velocidade média: rode "3. Gerar Site" com um lote pequeno de
 * teste (3-5 leads com status "Gerar"), depois abra Apps Script → Execuções
 * (ou View → Logs, se estiver rodando manualmente do editor) e leia as
 * linhas "[RD Prospect][Linha X]" — cada uma já mostra "+Yms desde início
 * do lead", e ao final de cada lead sai uma linha "TEMPO TOTAL DO LEAD".
 */
function registrarEtapaGeracao(sheet, rowNum, etapa, inicioLead) {
  const texto = "Gerando: " + etapa;
  sheet.getRange(rowNum, 23).setValue(texto);
  SpreadsheetApp.flush();
  const sufixoTempo = inicioLead ? (" (+" + (Date.now() - inicioLead) + "ms desde início do lead)") : "";
  Logger.log("[RD Prospect][Linha " + rowNum + "] " + texto + sufixoTempo);
}

/**
 * Faz fetch de uma URL sem interromper toda a geração em caso de falha.
 */
function fetchSeguro(url) {
  if (!url) return null;
  try {
    return UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true
    });
  } catch (e) {
    Logger.log("[RD Prospect] Falha ao acessar " + url + ": " + e.message);
    return null;
  }
}

/**
 * Conta ocorrências sem lançar erro quando o valor procurado estiver vazio.
 */
function contarOcorrenciasSeguro(texto, valor) {
  if (!texto || !valor) return 0;
  try {
    if (typeof contarOcorrencias === "function") {
      return contarOcorrencias(texto, valor);
    }
  } catch (e) {}
  return String(texto).split(String(valor)).length - 1;
}

/**
 * Monta o contexto factual que será usado por todas as etapas da IA.
 *
 * AJUSTE (merge, reincorporado da minha versão): recebe siteParaRaspar e
 * ehSiteAtualLinkSocial já calculados pelo caller (processarLeadsInteligente)
 * em vez de assumir que dadosLead.siteAtual é sempre um site raspável.
 * Quando o "site" é na verdade um link de Instagram/Facebook:
 * - não tenta raspar HTML de lá (viraria lixo/tela de login);
 * - tenta a foto de perfil pública do Instagram como melhor esforço
 *   (extrairFotoPerfilInstagram, do 02_ExtracaoSite — funciona só quando o
 *   Instagram não bloqueia leitura de servidor);
 * - ainda assim preenche redesSociais com o link real, pra aparecer no
 *   rodapé do site gerado.
 * Também prioriza o telefone JÁ VALIDADO na Auditoria (dadosLead.
 * telefoneRealAtual, coluna AH) sobre raspar o site de novo — evita jogar
 * fora um número já confirmado quando não há site pra raspar (lead só-IG
 * ou sem site nenhum).
 */
function montarContextoGeracaoLead(dadosLead, textoOriginalFinal, textoExtraidoViaVisao, siteParaRaspar, ehSiteAtualLinkSocial) {
  const siteAtual = dadosLead.siteAtual;
  const contexto = {
    textoOriginal: textoOriginalFinal || "",
    imagensReais: [],
    diagnosticoDores: dadosLead.diagnosticoDores || "",
    melhoriasAwwwards: dadosLead.melhoriasAwwwards || "",
    logoUrl: dadosLead.logoUrl || "",
    logoFinal: dadosLead.logoFinalDecidido || "",
    corPrincipal: dadosLead.corPrincipal || "",
    anoAtual: new Date().getFullYear(),
    whatsappReal: dadosLead.telefoneRealAtual
      ? normalizarNumeroWhatsApp(dadosLead.telefoneRealAtual)
      : (siteParaRaspar ? extrairTelefoneDoSite(siteParaRaspar) : ""),
    redesSociais: siteParaRaspar
      ? extrairLinksRedesSociais(siteParaRaspar)
      : (ehSiteAtualLinkSocial
          ? (/instagram\.com/i.test(siteAtual) ? { instagram: siteAtual } : { facebook: siteAtual })
          : {}),
    ofertaReal: dadosLead.ofertaReal || "",
    notaGoogle: dadosLead.diferencial || "",
    conveniosReais: siteParaRaspar ? extrairConveniosDoSite(siteParaRaspar) : [],
    linkAgendamentoReal: siteParaRaspar ? extrairLinkAgendamentoReal(siteParaRaspar) : "",
    textoExtraidoViaVisao: !!textoExtraidoViaVisao
  };

  if (siteParaRaspar) {
    contexto.imagensReais = extrairImagensDoSite(siteParaRaspar);
  } else if (ehSiteAtualLinkSocial && /instagram\.com/i.test(siteAtual)) {
    const fotoPerfilIG = extrairFotoPerfilInstagram(siteAtual);
    if (fotoPerfilIG) contexto.imagensReais = [{ url: fotoPerfilIG, alt: dadosLead.nomeCliente }];
  }

  // Em alguns sites o botão de agendamento é a ação principal, enquanto um
  // número secundário aparece perdido no HTML. Nesse caso, priorizamos o link
  // de agendamento real e não apresentamos o número como WhatsApp.
  if (contexto.whatsappReal && contexto.linkAgendamentoReal && siteParaRaspar) {
    const resposta = fetchSeguro(siteParaRaspar);
    if (resposta && resposta.getResponseCode() >= 200 && resposta.getResponseCode() < 400) {
      const htmlOriginal = resposta.getContentText();
      const ocorrenciasWhats = contarOcorrenciasSeguro(htmlOriginal, contexto.whatsappReal);
      const ocorrenciasAgendamento = contarOcorrenciasSeguro(htmlOriginal, contexto.linkAgendamentoReal);
      if (ocorrenciasAgendamento > ocorrenciasWhats) {
        contexto.whatsappReal = "";
      }
    }
  }

  return contexto;
}

/**
 * Executa a esteira de 4 estágios do 03_IA.gs (briefing → estratégia → copy
 * → HTML) + QA estrutural com autocorreção — com log de tempo por etapa.
 */
function executarPipelineInteligente(nomeCliente, nicho, dsData, contexto, sheet, rowNum, inicioLead) {
  registrarEtapaGeracao(sheet, rowNum, "briefing factual", inicioLead);
  contexto.briefingEstruturado = estruturarConteudoDoClienteIA(
    nomeCliente,
    nicho,
    contexto
  );

  registrarEtapaGeracao(sheet, rowNum, "estratégia UX, CRO e SEO", inicioLead);
  contexto.estrategiaPrototipo = criarEstrategiaDoPrototipoIA(
    nomeCliente,
    nicho,
    dsData,
    contexto,
    contexto.briefingEstruturado
  );

  registrarEtapaGeracao(sheet, rowNum, "copy completa", inicioLead);
  contexto.copyPrototipo = gerarCopyCompletaDoPrototipoIA(
    nomeCliente,
    nicho,
    contexto,
    contexto.briefingEstruturado,
    contexto.estrategiaPrototipo
  );

  registrarEtapaGeracao(sheet, rowNum, "HTML mobile-first", inicioLead);
  let html = gerarHTMLViaAI(nomeCliente, nicho, dsData, contexto);
  if (!html || String(html).trim().length < 500) {
    throw new Error("A IA retornou um HTML vazio ou incompleto.");
  }

  registrarEtapaGeracao(sheet, rowNum, "QA estrutural", inicioLead);
  let validacao = validarEstruturaDoPrototipo(html, contexto);

  if (!validacao.valido) {
    registrarEtapaGeracao(sheet, rowNum, "correção automática", inicioLead);
    html = corrigirHTMLViaIA(
      html,
      nomeCliente,
      nicho,
      contexto,
      validacao
    );
    validacao = validarEstruturaDoPrototipo(html, contexto);
  }

  return {
    html: html,
    validacao: validacao
  };
}

/**
 * Aguarda a publicação da Vercel com tentativas progressivas.
 */
function aguardarDeployVercel(url, totalTentativas) {
  const tentativas = totalTentativas || 6;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    Utilities.sleep(5000 + tentativa * 2500);
    const resposta = fetchSeguro(url);
    if (resposta && resposta.getResponseCode() === 200) {
      return true;
    }
  }
  return false;
}

/**
 * Substitui URLs externas pelas cópias hospedadas no projeto.
 */
function aplicarMapaImagensNoHTML(html, mapaImagens) {
  let resultado = html;
  Object.keys(mapaImagens || {}).forEach(function(urlOriginal) {
    resultado = resultado.split(urlOriginal).join(mapaImagens[urlOriginal]);
  });
  return resultado;
}

/**
 * Converte og:image relativo em URL absoluta.
 */
function normalizarOgImageAbsoluta(html, baseUrlPreview) {
  return html.replace(
    /(<meta\s+property=["']og:image["']\s+content=["'])(?!https?:\/\/)([^"']+)(["'])/i,
    function(match, prefixo, caminhoRelativo, sufixo) {
      return prefixo + baseUrlPreview + caminhoRelativo.replace(/^\/+/, "") + sufixo;
    }
  );
}

/**
 * MOTOR PRINCIPAL DE GERAÇÃO — RD Exclusive v5.0 (mesclado)
 *
 * Colunas preservadas:
 * W  (23) Status de geração
 * X  (24) URL do site
 * Y  (25) URL da apresentação
 * Z  (26) Avisos/QA
 * AC (29) Assunto do e-mail
 * AD (30) Corpo do e-mail
 * AE (31) Status comercial
 * AF (32) Link curto do site
 * AG (33) Link curto da apresentação
 * AH (34) Telefone_Real (já validado na Auditoria — lido aqui, não escrito)
 * AI (35) Continuação do WhatsApp
 */
/**
 * Um lead conta como "elegível pra gerar" tanto se o status for literalmente
 * "Gerar" quanto se estiver travado em "Gerando: <alguma etapa>" — esse
 * segundo caso acontece quando o limite RÍGIDO de execução do Apps Script
 * (6 min, imposto pelo Google, diferente do nosso limite interno de
 * segurança) interrompe o script no MEIO do processamento de um lead. Sem
 * isso, esse lead ficaria travado em "Gerando: ..." pra sempre — nenhuma
 * nova execução o pegaria de novo, porque o status nunca mais bate com
 * "Gerar" sozinho, exigindo reset manual toda vez que isso acontece.
 */
function statusElegivelParaGeracao(status) {
  return status === "Gerar" || (typeof status === "string" && status.indexOf("Gerando:") === 0);
}

function processarLeadsInteligente() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const inicioExecucao = Date.now();
  const LIMITE_MS = 4 * 60 * 1000; // 4 de 6 min — 2min de folga (a esteira nova de 4 estágios de IA faz um único lead chegar perto do limite rígido sozinho, então a folga precisa ser maior que na versão anterior)
  const TEXTO_MINIMO_UTIL = 200;
  const LIMITE_CONTEUDO_EXTENSO = 5000;

  const totalParaGerar = data.slice(1).filter(function(linha) {
    return statusElegivelParaGeracao(linha[22]);
  }).length;

  let processados = 0;
  let interrompidoPorTempo = false;

  for (let i = 1; i < data.length; i++) {
    if (Date.now() - inicioExecucao > LIMITE_MS) {
      interrompidoPorTempo = true;
      break;
    }

    if (!statusElegivelParaGeracao(data[i][22])) continue;

    const rowNum = i + 1;
    const statusNaHora = sheet.getRange(rowNum, 23).getValue();
    if (!statusElegivelParaGeracao(statusNaHora)) continue;

    const inicioLead = Date.now();
    processados++;

    const dadosLead = {
      nomeCliente: data[i][0],
      nicho: data[i][1],
      siteAtual: data[i][2],
      emailAtual: data[i][3],
      diferencial: data[i][4],
      melhoriasAwwwards: data[i][12],
      diagnosticoDores: data[i][13],
      logoUrl: data[i][15],
      corPrincipal: data[i][16],
      ofertaReal: data[i][21],
      telefoneRealAtual: data[i][33] // Coluna AH — já validado na Auditoria
    };

    const dsData = {
      tipografia: data[i][17],
      paleta: data[i][18],
      estrutura: data[i][19],
      estiloGlobal: data[i][20]
    };

    try {
      if (!dadosLead.nomeCliente) {
        throw new Error("Nome do cliente não informado.");
      }

      registrarEtapaGeracao(sheet, rowNum, "preparação", inicioLead);

      dadosLead.logoFinalDecidido =
        dadosLead.logoUrl ||
        gerarLogoTemporario(dadosLead.nomeCliente, dadosLead.corPrincipal);

      // "Site" que na verdade é link de Instagram/Facebook: não dá pra
      // raspar HTML de lá (o Instagram bloqueia acesso de robô e devolve
      // lixo/tela de login) — trata como "sem site" pra raspagem, mas
      // mantém o link real disponível pra redes sociais / foto de perfil.
      const ehSiteAtualLinkSocial = !!dadosLead.siteAtual && /instagram\.com|facebook\.com/i.test(dadosLead.siteAtual);
      const siteParaRaspar = ehSiteAtualLinkSocial ? "" : dadosLead.siteAtual;

      registrarEtapaGeracao(sheet, rowNum, "extração do site", inicioLead);

      let textoOriginalFinal = siteParaRaspar
        ? extrairTextoLimpoDoSite(siteParaRaspar)
        : "";

      let textoExtraidoViaVisao = false;

      if (
        siteParaRaspar &&
        String(textoOriginalFinal || "").length < TEXTO_MINIMO_UTIL
      ) {
        registrarEtapaGeracao(sheet, rowNum, "leitura visual do site", inicioLead);

        const screenshotSiteOriginal = capturarScreenshotViaMshots(
          siteParaRaspar,
          9000
        );

        const textoDaImagem = extrairConteudoViaVisaoIA(
          screenshotSiteOriginal,
          dadosLead.nomeCliente
        );

        if (
          textoDaImagem &&
          textoDaImagem.length > String(textoOriginalFinal || "").length
        ) {
          textoOriginalFinal = textoDaImagem;
          textoExtraidoViaVisao = true;
        }
      }

      const contexto = montarContextoGeracaoLead(
        dadosLead,
        textoOriginalFinal,
        textoExtraidoViaVisao,
        siteParaRaspar,
        ehSiteAtualLinkSocial
      );

      const resultadoPipeline = executarPipelineInteligente(
        dadosLead.nomeCliente,
        dadosLead.nicho,
        dsData,
        contexto,
        sheet,
        rowNum,
        inicioLead
      );

      let htmlCodigo = resultadoPipeline.html;
      const validacaoFinal = resultadoPipeline.validacao;
      const avisosFinais = [];

      if (validacaoFinal.erros && validacaoFinal.erros.length) {
        avisosFinais.push(
          "❌ QA estrutural ainda encontrou: " +
          validacaoFinal.erros.join(", ")
        );
      }

      if (validacaoFinal.avisos && validacaoFinal.avisos.length) {
        avisosFinais.push(
          "⚠️ QA: " +
          validacaoFinal.avisos.join(", ")
        );
      }

      registrarEtapaGeracao(sheet, rowNum, "blindagem de contatos", inicioLead);

      const blindagem = blindarContatosFabricados(
        htmlCodigo,
        contexto,
        dadosLead.emailAtual
      );

      htmlCodigo = blindagem.html;
      Array.prototype.push.apply(avisosFinais, blindagem.avisos || []);

      if (textoExtraidoViaVisao) {
        avisosFinais.push(
          "⚠️ Site original renderizado por JavaScript: o conteúdo foi " +
          "extraído por IA a partir do print. Revise os textos antes do envio."
        );
      }

      if (String(textoOriginalFinal || "").length >= LIMITE_CONTEUDO_EXTENSO) {
        avisosFinais.push(
          textoExtraidoViaVisao
            ? "📏 O site original é longo e foi lido visualmente. Parte do " +
              "conteúdo pode exigir enriquecimento manual."
            : "📏 O site original possui bastante conteúdo. Confira se todos " +
              "os pontos essenciais foram priorizados no protótipo."
        );
      }

      htmlCodigo = adicionarSeloRDExclusive(htmlCodigo);
      htmlCodigo = adicionarEfeitosPadraoRD(htmlCodigo);

      registrarEtapaGeracao(sheet, rowNum, "hospedagem das imagens", inicioLead);

      const nomePasta = limparNomeParaURL(dadosLead.nomeCliente);
      const urlsParaHospedar = (contexto.imagensReais || []).map(function(img) {
        return img.url;
      });

      if (dadosLead.logoFinalDecidido) {
        urlsParaHospedar.push(dadosLead.logoFinalDecidido);
      }

      const mapaImagens = baixarEHospedarImagens(
        urlsParaHospedar,
        nomePasta
      );

      htmlCodigo = aplicarMapaImagensNoHTML(htmlCodigo, mapaImagens);

      const baseUrlPreview =
        "https://rd-previews-dharari01s-projects.vercel.app/" +
        nomePasta +
        "/";

      htmlCodigo = normalizarOgImageAbsoluta(
        htmlCodigo,
        baseUrlPreview
      );

      registrarEtapaGeracao(sheet, rowNum, "publicação", inicioLead);

      publicarNoGitHub(
        nomePasta + "/index.html",
        htmlCodigo
      );

      const urlVercel =
        baseUrlPreview + "index.html";

      registrarEtapaGeracao(sheet, rowNum, "confirmação do deploy", inicioLead);

      const deployOk = aguardarDeployVercel(urlVercel, 6);

      if (!deployOk) {
        throw new Error(
          "Deploy ainda não confirmado. Verifique novamente em 1–2 minutos."
        );
      }

      sheet.getRange(rowNum, 24).setValue(urlVercel);
      sheet.getRange(rowNum, 23).setValue("Sucesso");

      const statusComercialAtual = sheet.getRange(rowNum, 31).getValue();
      if (!statusComercialAtual || statusComercialAtual === "Novo") {
        sheet.getRange(rowNum, 31).setValue("Publicado");
      }

      registrarEtapaGeracao(sheet, rowNum, "página comparativa", inicioLead);

      let urlParaProposta = urlVercel;
      const urlApresentacao = gerarPaginaApresentacao(
        dadosLead.nomeCliente,
        dadosLead.nicho,
        dadosLead.siteAtual,
        urlVercel,
        nomePasta
      );

      if (urlApresentacao) {
        sheet.getRange(rowNum, 25).setValue(urlApresentacao);
        urlParaProposta = urlApresentacao;
      }

      registrarEtapaGeracao(sheet, rowNum, "links curtos", inicioLead);

      const linkCurtoSite = encurtarLink(urlVercel);
      sheet.getRange(rowNum, 32).setValue(linkCurtoSite);

      let linkCurtoApresentacao = "";
      if (urlApresentacao) {
        linkCurtoApresentacao = encurtarLink(urlApresentacao);
        sheet.getRange(rowNum, 33).setValue(linkCurtoApresentacao);
      }

      const linkParaContato =
        linkCurtoApresentacao ||
        linkCurtoSite ||
        urlParaProposta;

      if (!sheet.getRange(rowNum, 35).getValue()) {
        registrarEtapaGeracao(sheet, rowNum, "mensagem de continuação", inicioLead);

        const mensagemContinuacao =
          gerarMensagemContinuacaoWhatsAppIA(
            dadosLead.nomeCliente,
            dadosLead.nicho,
            linkParaContato
          );

        sheet.getRange(rowNum, 35).setValue(mensagemContinuacao);
      }

      if (!sheet.getRange(rowNum, 29).getValue()) {
        registrarEtapaGeracao(sheet, rowNum, "e-mail de proposta", inicioLead);

        const email = gerarEmailPropostaIA(
          dadosLead.nomeCliente,
          dadosLead.nicho,
          dadosLead.diferencial,
          dadosLead.diagnosticoDores,
          dadosLead.melhoriasAwwwards,
          linkParaContato
        );

        sheet.getRange(rowNum, 29).setValue(email.assunto);
        sheet.getRange(rowNum, 30).setValue(email.corpo);
      }

      if (avisosFinais.length > 0) {
        sheet.getRange(rowNum, 26).setValue(
          avisosFinais.join(" | ")
        );
      } else {
        sheet.getRange(rowNum, 26).setValue(
          "✅ QA concluído sem avisos relevantes."
        );
      }

      sheet.getRange(rowNum, 23).setValue("Sucesso");
      SpreadsheetApp.flush();

      Logger.log(
        "[RD Prospect][Linha " + rowNum + "] TEMPO TOTAL DO LEAD: " +
        (Date.now() - inicioLead) + "ms"
      );

    } catch (erro) {
      const mensagemErro =
        erro && erro.message
          ? erro.message
          : String(erro);

      Logger.log(
        "[RD Prospect][Linha " + rowNum + "] ERRO após " +
        (Date.now() - inicioLead) + "ms: " +
        mensagemErro +
        (erro && erro.stack ? "\n" + erro.stack : "")
      );

      sheet.getRange(rowNum, 23).setValue(
        "Erro: " + mensagemErro
      );

      SpreadsheetApp.flush();
    }
  }

  if (interrompidoPorTempo) {
    const restantes = Math.max(totalParaGerar - processados, 0);
    const mensagem =
      "Parei por segurança perto do limite de execução do Apps Script. " +
      "Foram processados " + processados + " lead(s) nesta rodada. " +
      "Ainda restam aproximadamente " + restantes +
      " lead(s) com status \"Gerar\". Execute \"3. Gerar Site\" novamente " +
      "para continuar sem repetir os concluídos.";

    try {
      SpreadsheetApp.getUi().alert(mensagem);
    } catch (e) {
      Logger.log(mensagem);
    }
  }
}
