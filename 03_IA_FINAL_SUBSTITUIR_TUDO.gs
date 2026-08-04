// =========================================================================
// RD PROSPECT — 03_IA.gs (v3.0 — MESCLADO: esteira da Natália + fixes meus)
// Todas as chamadas ao Gemini: diagnóstico, copy, e-mail, geração do HTML
// do site novo e análise de identidade visual por imagem.
//
// ORIGEM DESTA VERSÃO (pra referência futura, caso precise desfazer algo):
// - Esteira de 4 estágios (briefing→estratégia→copy→HTML) + QA autocorreção
//   + identidade visual rica (paleta/tipografia/estrutura/estilo por IA):
//   veio da versão da Natália.
// - maxFotos em escolherLayoutVariante, prioridade de cor (visão > raspagem
//   crua) com instrução anti-genérica, e a extensão de EQUIPE/CORPO CLÍNICO
//   com bio completa: são os meus fixes, reincorporados aqui porque a versão
//   da Natália não tinha (ela partiu de uma base minha mais antiga).
// =========================================================================

function chamarGeminiComRetry(prompt, maxTentativas) {
  const tentativas = maxTentativas || 3;
  const payload = { "contents": [{ "parts": [{ "text": prompt }] }] };
  const opcoes = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  let ultimoErro = "";
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const response = UrlFetchApp.fetch(GEMINI_API_URL, opcoes);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    ultimoErro = response.getContentText();
    if (response.getResponseCode() !== 503 || tentativa === tentativas) break;
    Utilities.sleep(tentativa * 4000); // 4s, 8s, 12s...
  }
  throw new Error("Falha na comunicação com o Motor de IA: " + ultimoErro);
}

function obterTextoRespostaGemini(json) {
  try {
    return json.candidates[0].content.parts.map(function(p) { return p.text || ""; }).join("\n").trim();
  } catch (e) {
    return "";
  }
}

function limparBlocoMarkdown(texto) {
  return String(texto || "")
    .replace(/^```(?:json|html|javascript|js)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extrairJSONSeguro(texto, fallback) {
  try {
    const limpo = limparBlocoMarkdown(texto);
    const inicioObjeto = limpo.indexOf("{");
    const fimObjeto = limpo.lastIndexOf("}");
    if (inicioObjeto === -1 || fimObjeto === -1 || fimObjeto <= inicioObjeto) return fallback;
    return JSON.parse(limpo.substring(inicioObjeto, fimObjeto + 1));
  } catch (e) {
    return fallback;
  }
}

function limitarTextoParaPrompt(texto, limite) {
  const valor = String(texto || "").trim();
  const maximo = limite || 18000;
  return valor.length > maximo ? valor.substring(0, maximo) + "\n[CONTEÚDO TRUNCADO PELO SISTEMA]" : valor;
}

function serializarParaPrompt(valor, fallback) {
  try {
    return JSON.stringify(valor || fallback || {}, null, 2);
  } catch (e) {
    return JSON.stringify(fallback || {}, null, 2);
  }
}

/**
 * ESTÁGIO 1/4 — Briefing factual estruturado.
 *
 * AJUSTE (merge): o schema de "profissionais" ganhou o campo
 * "biografiaCompleta" (a versão da Natália só tinha nome + cargo, que
 * perdia justamente o problema que resolvemos pra Fisio Obstare: bios
 * rasas do Corpo Clínico). A instrução abaixo pede explicitamente pra
 * IA preferir a versão MAIS COMPLETA quando o mesmo profissional aparece
 * duas vezes no conteúdo real (resumo curto na home + versão longa numa
 * subpágina, já trazida pelo crawl de subpáginas do 02_ExtracaoSite).
 */
function estruturarConteudoDoClienteIA(nome, nicho, contexto) {
  contexto = contexto || {};
  const fallback = {
    resumoMarca: "",
    publicoProvavel: "",
    objetivoProvavel: "gerar contatos qualificados",
    localidade: "",
    servicos: [],
    beneficios: [],
    diferenciais: [],
    credenciais: [],
    numerosReais: [],
    profissionais: [],
    depoimentos: [],
    perguntasFrequentesReais: [],
    contatos: [],
    enderecos: [],
    horarios: [],
    ofertas: [],
    informacoesObrigatorias: [],
    temasDeConteudo: [],
    proibicoesFactuais: ["Não inventar contatos, credenciais, números, preços, depoimentos ou serviços."]
  };
  try {
    const prompt = `
Você é um estrategista sênior de conteúdo, UX, CRO e SEO da RD Exclusive.
Analise os dados reais abaixo e transforme-os em um BRIEFING ESTRUTURADO para o redesign de uma one-page mobile-first.

CLIENTE: ${nome}
NICHO: ${nicho}

CONTEÚDO REAL EXTRAÍDO:
----------------------------------------------------
${limitarTextoParaPrompt(contexto.textoOriginal, 18000) || "Nenhum conteúdo textual disponível."}
----------------------------------------------------

REDES REAIS: ${serializarParaPrompt(contexto.redesSociais, {})}
CONVÊNIOS REAIS: ${serializarParaPrompt(contexto.conveniosReais, [])}
NOTA GOOGLE AUDITADA: ${contexto.notaGoogle || "não disponível"}
OFERTA VISUAL DETECTADA: ${contexto.ofertaReal || "não disponível"}

REGRAS:
- Extraia e organize apenas fatos existentes.
- Não complete lacunas com informações plausíveis.
- Diferencie serviços de benefícios e de diferenciais.
- Um diferencial só deve ser listado quando houver explicação concreta no conteúdo.
- Números, credenciais, profissionais, preços e depoimentos só entram se estiverem explicitamente presentes.
- Identifique temas de conteúdo que podem ser desenvolvidos sem inventar fatos, usando conhecimento geral do segmento apenas para explicar benefícios de forma não factual e não quantificada.
- Quando não houver informação, use string vazia ou array vazio.
- PROFISSIONAIS/EQUIPE — VERSÃO MAIS COMPLETA PREVALECE: o conteúdo real pode trazer o MESMO profissional descrito duas vezes — um resumo curto (geralmente da home) e uma versão mais longa e detalhada vinda de uma página interna (marcada como "CONTEÚDO DA PÁGINA ..."), com formação completa, linha do tempo de carreira ano a ano, ou até história pessoal. Quando isso acontecer, preencha "biografiaCompleta" SEMPRE com a versão MAIS COMPLETA e rica em detalhes reais encontrada — nunca a curta só porque apareceu primeiro. Não resuma nem encurte fatos reais disponíveis (datas, marcos de carreira, formação) só pra deixar o texto mais enxuto — mais detalhe real gera mais confiança.

Retorne APENAS JSON válido, sem markdown, neste formato:
{
  "resumoMarca": "",
  "publicoProvavel": "",
  "objetivoProvavel": "",
  "localidade": "",
  "servicos": [{"nome":"","descricaoReal":"","beneficioPermitido":""}],
  "beneficios": [{"titulo":"","explicacao":""}],
  "diferenciais": [{"titulo":"","evidenciaReal":""}],
  "credenciais": [],
  "numerosReais": [{"numero":"","contexto":""}],
  "profissionais": [{"nome":"","cargoOuEspecialidade":"","biografiaCompleta":""}],
  "depoimentos": [{"texto":"","autor":""}],
  "perguntasFrequentesReais": [{"pergunta":"","resposta":""}],
  "contatos": [],
  "enderecos": [],
  "horarios": [],
  "ofertas": [],
  "informacoesObrigatorias": [],
  "temasDeConteudo": [],
  "proibicoesFactuais": []
}`;
    const json = chamarGeminiComRetry(prompt, 3);
    return extrairJSONSeguro(obterTextoRespostaGemini(json), fallback);
  } catch (e) {
    return fallback;
  }
}

/**
 * ESTÁGIO 2/4 — Estratégia de UX, CRO e SEO.
 * AJUSTE (merge): regra nova pedindo seção de equipe/corpo clínico na ordem
 * de seções quando o briefing já trouxe profissionais reais.
 */
function criarEstrategiaDoPrototipoIA(nome, nicho, dsData, contexto, briefing) {
  const fallback = {
    objetivoConversaoPrimario: contexto.whatsappReal ? "contato pelo WhatsApp" : (contexto.linkAgendamentoReal ? "agendamento" : "envio do formulário"),
    objetivoConversaoSecundario: "exploração dos serviços",
    propostaDeValor: "",
    keywordPrincipal: "",
    keywordsSecundarias: [],
    seoTitle: nome + " | " + nicho,
    metaDescription: "Conheça " + nome + " e suas principais soluções em " + nicho + ".",
    intencaoDeBusca: "comercial local",
    direcaoVisual: dsData.estiloGlobal || "moderna, profissional e coerente com a marca",
    ordemSecoes: (briefing && briefing.profissionais && briefing.profissionais.length)
      ? ["topbar", "header", "hero", "faixa de confiança", "benefícios", "serviços", "sobre", "equipe/corpo clínico", "diferenciais", "destaque editorial", "galeria", "como funciona", "FAQ", "CTA com formulário", "rodapé"]
      : ["topbar", "header", "hero", "faixa de confiança", "benefícios", "serviços", "sobre", "diferenciais", "destaque editorial", "galeria", "como funciona", "FAQ", "CTA com formulário", "rodapé"],
    estrategiaCROPorSecao: {},
    tomDeVoz: "profissional, humano e específico",
    ctaPrimario: contexto.whatsappReal ? "Falar com a equipe" : (contexto.linkAgendamentoReal ? "Agendar atendimento" : "Solicitar contato"),
    ctaSecundario: "Conhecer os serviços",
    schemaRecomendado: "LocalBusiness",
    elementosDeDestaque: []
  };
  try {
    const prompt = `
Você é Diretor de Estratégia Digital da RD Exclusive. Crie a estratégia de uma one-page de prospecção que precisa impressionar o cliente, preservar a identidade atual e demonstrar avanço real em UX, UI, CRO, conteúdo e SEO.

CLIENTE: ${nome}
NICHO: ${nicho}
BRIEFING FACTUAL:
${serializarParaPrompt(briefing, {})}

DESIGN SYSTEM EXTRAÍDO:
${serializarParaPrompt(dsData, {})}

DIAGNÓSTICO:
- Dores: ${contexto.diagnosticoDores || "não informado"}
- Gaps: ${contexto.melhoriasAwwwards || "não informado"}

CANAIS REAIS:
- WhatsApp confirmado: ${contexto.whatsappReal ? "sim" : "não"}
- Link de agendamento confirmado: ${contexto.linkAgendamentoReal ? "sim" : "não"}

REGRAS ESTRATÉGICAS:
- A página nasce no mobile e depois expande para desktop.
- A conversão primária deve usar apenas um canal real disponível.
- A topbar, header, hero, benefícios, serviços, sobre, diferenciais, destaque editorial, big numbers quando reais, galeria/carrossel, como funciona, FAQ, CTA final com formulário e rodapé completo devem ser planejados.
- Se o briefing trouxer profissionais reais (array "profissionais" não vazio), a ordem de seções DEVE incluir uma seção dedicada de equipe/corpo clínico (nomeie conforme o nicho: "Equipe", "Corpo Clínico", "Nosso Time" etc.) — não misture isso com "sobre" nem com "diferenciais".
- Não repita o mesmo argumento em várias seções.
- Benefícios explicam o ganho do cliente; serviços explicam o que é oferecido; diferenciais explicam por que escolher a marca.
- O CTA primário deve permanecer semanticamente consistente em toda a página.
- Crie SEO local apenas quando houver localidade real.
- Evite clichês vazios como excelência, qualidade, inovação e atendimento personalizado sem uma evidência ou explicação concreta.
- Defina uma direção visual coerente com a identidade capturada; não imponha luxo, dourado, off-white ou estética clínica quando o segmento não pedir isso.

Retorne APENAS JSON válido, sem markdown:
{
  "objetivoConversaoPrimario":"",
  "objetivoConversaoSecundario":"",
  "propostaDeValor":"",
  "keywordPrincipal":"",
  "keywordsSecundarias":[],
  "seoTitle":"",
  "metaDescription":"",
  "intencaoDeBusca":"",
  "direcaoVisual":"",
  "ordemSecoes":[],
  "estrategiaCROPorSecao":{"hero":"","beneficios":"","servicos":"","sobre":"","equipe":"","diferenciais":"","galeria":"","comoFunciona":"","faq":"","ctaFinal":""},
  "tomDeVoz":"",
  "ctaPrimario":"",
  "ctaSecundario":"",
  "schemaRecomendado":"",
  "elementosDeDestaque":[]
}`;
    const json = chamarGeminiComRetry(prompt, 3);
    return extrairJSONSeguro(obterTextoRespostaGemini(json), fallback);
  } catch (e) {
    return fallback;
  }
}

/**
 * ESTÁGIO 3/4 — Copy completa.
 * AJUSTE (merge): novo campo "equipe" no JSON de copy, alimentado a partir de
 * briefing.profissionais (com a biografiaCompleta), pra existir um lugar
 * concreto onde a bio rica do Corpo Clínico realmente chega até o HTML.
 */
function gerarCopyCompletaDoPrototipoIA(nome, nicho, contexto, briefing, estrategia) {
  const equipeFallback = (briefing.profissionais || []).map(function(p) {
    return {
      nome: p.nome || "",
      cargoOuEspecialidade: p.cargoOuEspecialidade || "",
      bio: p.biografiaCompleta || ""
    };
  });
  const fallback = {
    topbar: { texto: "" },
    hero: { eyebrow: nicho, h1: estrategia.propostaDeValor || nome, texto: briefing.resumoMarca || "", ctaPrimario: estrategia.ctaPrimario, ctaSecundario: estrategia.ctaSecundario },
    beneficios: briefing.beneficios || [],
    servicos: briefing.servicos || [],
    sobre: { titulo: "Sobre " + nome, texto: briefing.resumoMarca || "" },
    equipe: equipeFallback,
    diferenciais: briefing.diferenciais || [],
    destaqueEditorial: { titulo: "Uma experiência pensada para você", texto: "" },
    comoFunciona: [],
    faq: briefing.perguntasFrequentesReais || [],
    ctaFinal: { titulo: "Vamos conversar?", texto: "Conte o que você procura e receba um retorno da equipe.", botao: estrategia.ctaPrimario },
    miniBioRodape: briefing.resumoMarca || nome + " — " + nicho + "."
  };
  try {
    const prompt = `
Você é um copywriter sênior especialista em CRO e SEO. Escreva a COPY COMPLETA de uma one-page mobile-first, pronta para ser aplicada no layout, para ${nome} (${nicho}).

BRIEFING FACTUAL:
${serializarParaPrompt(briefing, {})}

ESTRATÉGIA:
${serializarParaPrompt(estrategia, {})}

REGRAS:
- Preserve nomes, serviços, contatos, credenciais e informações relevantes reais.
- Não invente fatos, números, preços, endereço, equipe, depoimentos, políticas ou resultados.
- Pode desenvolver conteúdo persuasivo e educativo sobre benefícios gerais do serviço, sem transformar conhecimento geral em alegação factual sobre a empresa.
- Escreva em voz ativa, com frases claras, específicas e naturais.
- O hero deve impressionar: H1 claro, benefício central e contexto de serviço/localidade quando real.
- Não use frases genéricas como "transformando sonhos em realidade", "excelência que faz a diferença" ou "soluções sob medida" sem detalhamento.
- Benefícios, serviços e diferenciais não podem repetir os mesmos títulos.
- EQUIPE: se briefing.profissionais NÃO estiver vazio, preencha "equipe" com um item por profissional real listado — "nome" e "cargoOuEspecialidade" exatamente como no briefing, e "bio" escrita a partir de "biografiaCompleta" do briefing (pode reescrever com qualidade editorial, mas é PROIBIDO cortar ou resumir a ponto de perder fatos reais presentes em biografiaCompleta — formação, datas, marcos de carreira e especializações precisam sobreviver na bio final). Se briefing.profissionais estiver vazio, "equipe" deve ser array vazio — não invente profissionais.
- Crie 4 a 6 FAQs úteis. Use respostas reais quando existirem; quando não existirem, formule perguntas neutras e respostas que orientem o contato, sem inventar políticas.
- Crie uma seção "como funciona" adequada ao segmento, sem afirmar processos internos desconhecidos; use passos seguros como contato, entendimento da necessidade, orientação/proposta e próximo passo.
- A última seção deve conter CTA e formulário. Não prometa funcionamento de envio; o HTML indicará que é demonstrativo quando não houver endpoint.
- Mini bio do rodapé: 35 a 60 palavras.

Retorne APENAS JSON válido, sem markdown:
{
  "topbar":{"texto":""},
  "hero":{"eyebrow":"","h1":"","texto":"","ctaPrimario":"","ctaSecundario":"","microProva":""},
  "faixaConfianca":[{"destaque":"","legenda":""}],
  "beneficios":[{"titulo":"","texto":""}],
  "servicos":[{"nome":"","texto":"","cta":""}],
  "sobre":{"titulo":"","texto":"","subtitulo":""},
  "equipe":[{"nome":"","cargoOuEspecialidade":"","bio":""}],
  "diferenciais":[{"titulo":"","texto":""}],
  "destaqueEditorial":{"titulo":"","texto":"","cta":""},
  "comoFunciona":[{"passo":"01","titulo":"","texto":""}],
  "faq":[{"pergunta":"","resposta":""}],
  "ctaFinal":{"titulo":"","texto":"","botao":""},
  "miniBioRodape":""
}`;
    const json = chamarGeminiComRetry(prompt, 3);
    return extrairJSONSeguro(obterTextoRespostaGemini(json), fallback);
  } catch (e) {
    return fallback;
  }
}

/**
 * Inteligência de Análise de Concorrência e Engenharia Reversa (Gera o Diagnóstico da Coluna J)
 */
function analisarERomperPadraoIA(nome, nicho, htmlOriginal) {
  try {
    const prompt =
      "Você é o Diretor Comercial de Growth da RD Exclusive.\n" +
      "Sua missão é ler o código/texto extraído do site atual do lead '" + nome + "' (" + nicho + ") e comparar mentalmente com as melhores práticas mundiais de design e conversão especificamente do nicho \"" + nicho + "\", no padrão de agências premiadas (referência de qualidade tipo Awwwards) — adapte os exemplos e o vocabulário ao segmento real informado, sem assumir que é sempre saúde/bem-estar.\n\n" +
      "TEXTO EXTRAÍDO DO SITE ATUAL DELE:\n" +
      "----------------------------------------------------\n" +
      htmlOriginal + "\n" +
      "----------------------------------------------------\n\n" +
      "ROTEIRO DE INTRUSÃO E GAP ANALYSIS:\n" +
      "1. Identifique 2 pontos fracos cruciais que sites internacionais de grife resolvem de forma impecável, mas o lead está errando rude (Ex: e-books sem captura de leads; falta de seções imersivas; tipografia sem contraste de valor; ausência de carrossel dinâmico de prova social real).\n" +
      "2. Resuma isso em uma linha curta e agressiva comercialmente para colocar na planilha, como no exemplo:\n" +
      "'❌ E-books soltos sem captura (vazamento de leads); ❌ Design institucional sem respiro e contraste de luxo.'\n" +
      "Não use explicações longas. Escreva APENAS a frase resumida com emojis representando as melhorias que faltam no site dele.";
    const json = chamarGeminiComRetry(prompt, 3);
    return json.candidates[0].content.parts[0].text.trim();
  } catch (e) {
    return "❌ Falta seção de conversão moderna; ❌ Design plano e institucional.";
  }
}

/**
 * Usa o Gemini para criar a copy perfeita baseada na Dor Real do Lead!
 */
function gerarFraseDeImpactoIA(nome, nicho, idade, velocidade, pixels, redes, lacunasAwwwards) {
  try {
    let denunciaSLA = "";
    if (velocidade.includes("🔴") || velocidade.includes("Lento")) {
      denunciaSLA = "O site atual deles está muito lento (" + velocidade + "). Isso faz com que eles percam até 50% dos potenciais clientes antes mesmo do site carregar.";
    } else if (velocidade.includes("🟡") || velocidade.includes("Instável")) {
      denunciaSLA = "O carregamento do site está instável (" + velocidade + "), o que derruba a retenção de pacientes e a autoridade no Google.";
    } else {
      denunciaSLA = "O site atual responde rápido (" + velocidade + "), foque em outros pontos como design e conversão.";
    }

    const ehNichoSaude = NICHOS_PUBLICIDADE_MODERADA.some(function(p) { return (nicho || "").toLowerCase().includes(p); });
    const dorAtendimentoWhatsApp = ehNichoSaude
      ? "Estatística de Mercado: Mais de 70% das clínicas médicas e odontológicas perdem até 80% das vendas porque a recepção/secretária demora mais de 5 a 15 minutos para dar o primeiro retorno no WhatsApp."
      : "É comum negócios de atendimento local perderem uma parte relevante dos leads de anúncios porque a recepção demora pra dar o primeiro retorno no WhatsApp.";

    const prompt =
      "Você é o Diretor Comercial e Copywriter de Elite da RD Exclusive no Rio de Janeiro.\n" +
      "Sua especialidade é a prospecção de negócios locais high-ticket de qualquer segmento (clínicas, salões, escritórios, restaurantes, academias, studios etc.), sempre adaptando o tom e o vocabulário ao nicho real do lead, informado abaixo.\n\n" +
      "Seu objetivo é gerar uma mensagem comercial para o WhatsApp que seja curta, extremamente elegante e matadora.\n\n" +
      "DADOS DO LEAD:\n" +
      "- Nome do Lead: " + nome + " (" + nicho + ")\n" +
      "- Tempo de existência do site atual: " + idade + "\n" +
      "- Tempo de resposta do servidor (SLA): " + velocidade + "\n" +
      "- Alerta Crítico de SLA do Site: " + denunciaSLA + "\n" +
      "- Gargalo de SLA de Atendimento no WhatsApp: " + dorAtendimentoWhatsApp + "\n" +
      "- Anúncios Ativos: " + pixels + "\n" +
      "- Redes Sociais no Site: " + redes + "\n" +
      "- Lacunas técnicas identificadas na concorrência: " + lacunasAwwwards + "\n\n" +
      "TAREFA DE ABORDAGEM:\n" +
      "1. Crie uma abordagem ultra focada na perda de faturamento por conta de gargalos técnicos (SLA de site lento: " + denunciaSLA + ") OU no gargalo de conversão da recepção/secretária ao demorar para responder leads de anúncios (" + dorAtendimentoWhatsApp + ").\n" +
      "2. Escreva a abordagem em tom de consultoria amigável, sem jargões forçados de vendas. Termine sempre instigando a curiosidade de forma sutil e pedindo permissão para enviar um PDF de auditoria de conversão focado em corrigir essas falhas ocultas que fazem o negócio perder dinheiro.\n" +
      "3. NÃO INVENTE DADOS. Escreva apenas a mensagem comercial em no máximo duas linhas e meia, pronta para envio no WhatsApp.";
    const json = chamarGeminiComRetry(prompt, 3);
    return json.candidates[0].content.parts[0].text.trim();
  } catch (e) {
    return "Olá, tudo bem? Me chamo David da RD Exclusive. Identificamos ótimas oportunidades para otimizar os agendamentos/atendimentos do seu negócio. Posso te enviar um PDF com a auditoria técnica de evolução do seu layout por aqui?";
  }
}

/**
 * Gera Assunto + Corpo de um e-mail LEVE de reforço (colunas AC e AD) — não é
 * o primeiro contato (esse é sempre por WhatsApp), é material de apoio pra
 * quem já demonstrou interesse: elogio real + observações construtivas +
 * link do site de teste já pronto. Sem pressão, sem promessa de resultado.
 */
function gerarEmailPropostaIA(nome, nicho, diferencial, diagnosticoDores, melhoriasAwwwards, urlTeste) {
  const fallback = {
    assunto: "Uma prévia que preparamos para " + nome,
    corpo: "Olá! Preparamos uma prévia de como o site de vocês poderia ficar: " + urlTeste + ". Dá uma olhada quando puder e me conta o que achou!"
  };
  try {
    const prompt =
      "Você é o Diretor Comercial da RD Exclusive, escrevendo um e-mail de REFORÇO pra um lead que já demonstrou interesse — o primeiro contato já foi feito por WhatsApp, esse e-mail é só material de apoio pra quem já topou dar uma olhada.\n" +
      "Tom: leve, pessoal, sem jargão de vendas, sem urgência artificial, sem emojis em excesso.\n\n" +
      "DADOS DO LEAD:\n" +
      "- Nome: " + nome + " (" + nicho + ")\n" +
      "- Ponto positivo real pra elogiar: " + (diferencial || "não informado") + "\n" +
      "- Observações técnicas (dores do site atual): " + (diagnosticoDores || "não informado") + "\n" +
      "- Sugestões de melhoria (gaps vs. concorrência premiada): " + (melhoriasAwwwards || "não informado") + "\n" +
      "- Link do site de teste já pronto: " + urlTeste + "\n\n" +
      "TAREFA:\n" +
      "1. ASSUNTO curto e pessoal (sem caixa alta, sem 'urgente', sem 'não perca').\n" +
      "2. CORPO curto (4 a 6 frases): abra com um elogio real e específico (não genérico), mencione 1 ou 2 observações/sugestões de forma construtiva (não agressiva), inclua o link do site de teste como algo que 'preparamos pra você dar uma olhada com calma', e feche de forma leve, sem pressão.\n" +
      "3. NÃO prometa resultado. NÃO use superlativos. NÃO invente dado que não esteja listado acima.\n" +
      "4. Responda EXATAMENTE neste formato, sem mais nada:\n" +
      "ASSUNTO: [assunto aqui]\n" +
      "CORPO: [corpo aqui]";
    const json = chamarGeminiComRetry(prompt, 3);
    const texto = json.candidates[0].content.parts[0].text.trim();
    const matchAssunto = texto.match(/ASSUNTO:\s*(.+)/i);
    const matchCorpo = texto.match(/CORPO:\s*([\s\S]+)/i);
    return {
      assunto: matchAssunto ? matchAssunto[1].trim() : fallback.assunto,
      corpo: matchCorpo ? matchCorpo[1].trim() : fallback.corpo
    };
  } catch (e) {
    return fallback;
  }
}

// Domínios de rede social — quando o "site" do lead é na verdade um perfil
// (Instagram, Facebook, etc.), não faz sentido usar o favicon desse domínio
// como logo do cliente (seria o ícone da própria rede social).
function gerarLogoTemporario(nome, corPrincipalHex) {
  const corValida = (corPrincipalHex && !ehCorGenericaDemais(corPrincipalHex)) ? corPrincipalHex : ("#" + DESIGN_SYSTEM_PADRAO.corPrimariaHex);
  const hex = corValida.replace("#", "");
  const nomeCodificado = encodeURIComponent(nome || "Empresa");
  return "https://ui-avatars.com/api/?name=" + nomeCodificado + "&background=" + hex + "&color=fff&bold=true&size=128&font-size=0.4";
}

function nivelRestricaoPublicidade(nicho) {
  const nichoLower = (nicho || "").toLowerCase();
  if (NICHOS_PUBLICIDADE_TOTALMENTE_RESTRITA.some(function(p) { return nichoLower.includes(p); })) return "total";
  if (NICHOS_PUBLICIDADE_MODERADA.some(function(p) { return nichoLower.includes(p); })) return "moderada";
  return "nenhuma";
}

/**
 * AJUSTE (merge, reincorporado da minha versão): a versão da Natália não
 * tinha o teto maxFotos — sem ele, a variante "Minimalista Tipográfico"
 * (a única pensada pra funcionar SEM nenhuma foto) podia ser sorteada mesmo
 * quando havia fotos reais disponíveis, desperdiçando uma foto de pessoa
 * que daria mais confiança ao site.
 */
function escolherLayoutVariante(nomeCliente, nicho, qtdFotosReais) {
  const elegiveis = LAYOUT_VARIANTES.filter(function(v) {
    return qtdFotosReais >= v.minFotos && (v.maxFotos === undefined || qtdFotosReais <= v.maxFotos);
  });
  const pool = elegiveis.length ? elegiveis : LAYOUT_VARIANTES;
  const chave = (nomeCliente || "") + "|" + (nicho || "");
  let hash = 0;
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

/**
 * ESTÁGIO 4/4 — HTML final mobile-first, a partir do briefing/estratégia/copy
 * já prontos (ou gerados aqui mesmo, se chamado isoladamente, mantendo
 * compatibilidade com chamadas antigas que não passam pela esteira).
 *
 * AJUSTE (merge): prioridade de cor (visão > raspagem crua) com instrução
 * anti-genérica explícita, reincorporada da minha versão — a versão da
 * Natália já usava dsData.paleta primeiro (o que já evita boa parte do bug
 * do Fisio Obstare), mas sem o "NÃO troque por paleta genérica" explícito
 * nem o fallback por hex extraído via regex quando dsData.paleta vier vazio.
 * Também ganhou o item de arquitetura EQUIPE/CORPO CLÍNICO usando copy.equipe.
 */
function gerarHTMLViaAI(nome, nicho, dsData, contexto) {
  contexto = contexto || {};
  dsData = dsData || {};
  const anoAtual = contexto.anoAtual || new Date().getFullYear();
  const briefing = contexto.briefingEstruturado || estruturarConteudoDoClienteIA(nome, nicho, contexto);
  const estrategia = contexto.estrategiaPrototipo || criarEstrategiaDoPrototipoIA(nome, nicho, dsData, contexto, briefing);
  const copy = contexto.copyPrototipo || gerarCopyCompletaDoPrototipoIA(nome, nicho, contexto, briefing, estrategia);

  // Prioridade de cor: visão (dsData.paleta, de analisarIdentidadeVisualComIA)
  // > raspagem crua do HTML (contexto.corPrincipal) > padrão. A visão é mais
  // confiável porque vem de olhar o print renderizado de verdade, não de
  // vasculhar HTML cheio de hex "de sistema" de page builder (caso Fisio
  // Obstare: #007CBA era cor default do próprio Elementor).
  const matchCorVisao = (dsData.paleta || "").match(/Prim[aá]ria\s+(#[0-9A-Fa-f]{6})/i);
  const corDaVisao = (matchCorVisao && !ehCorGenericaDemais(matchCorVisao[1])) ? matchCorVisao[1].toUpperCase() : "";
  const corDaMineracao = (contexto.corPrincipal && !ehCorGenericaDemais(contexto.corPrincipal)) ? contexto.corPrincipal : "";
  const corConfiavel = corDaVisao || corDaMineracao;
  const paletaInstrucao = corConfiavel
    ? ("Baseie a paleta na cor REAL da marca do cliente: " + corConfiavel + ", combinada com neutros/contraste coerentes com o segmento. NÃO troque por uma paleta genérica diferente da marca real, e não imponha dourado/off-white/estética clínica se o segmento não pedir isso.")
    : (dsData.paleta || DESIGN_SYSTEM_PADRAO.paleta);

  const logoFinal = contexto.logoFinal || contexto.logoUrl || gerarLogoTemporario(nome, corConfiavel || contexto.corPrincipal);
  const whatsappUrlFinal = contexto.whatsappReal
    ? "https://wa.me/" + contexto.whatsappReal + "?text=" + encodeURIComponent("Olá! Vim pelo site e gostaria de mais informações.")
    : (contexto.linkAgendamentoReal || "#");
  const redesSociais = contexto.redesSociais || {};
  const redesTexto = Object.keys(redesSociais).length
    ? Object.keys(redesSociais).map(function(k) { return k + ": " + redesSociais[k]; }).join("\n")
    : "Nenhuma rede social real encontrada.";
  const conveniosLista = contexto.conveniosReais || [];
  const imagensTexto = (contexto.imagensReais || []).length
    ? contexto.imagensReais.map(function(img, index) { return (index + 1) + ". [" + (img.alt || "sem descrição") + "] " + img.url; }).join("\n")
    : "Nenhuma imagem real encontrada. Use composição tipográfica e cores; não invente fotos.";
  const urlsImagensTodas = (contexto.imagensReais || []).map(function(img) { return img.url; });
  if (logoFinal) urlsImagensTodas.push(logoFinal);
  const dominiosParaPreconnect = extrairDominiosUnicos(urlsImagensTodas);
  const preconnectTags = dominiosParaPreconnect.length ? dominiosParaPreconnect.map(function(d) { return '<link rel="preconnect" href="' + d + '">'; }).join("\n") : "";
  const imagemHeroParaOg = (contexto.imagensReais && contexto.imagensReais.length) ? contexto.imagensReais[0].url : logoFinal;
  const variante = escolherLayoutVariante(nome, nicho, (contexto.imagensReais || []).length);
  const nivelRestricao = nivelRestricaoPublicidade(nicho);

  let blocoPublicidade = "Depoimentos só podem existir se forem reais e estiverem no briefing. Nunca invente prova social.";
  if (nivelRestricao === "total") blocoPublicidade += " Nicho jurídico: não use depoimentos de clientes nem promessa de resultado; use somente credenciais reais permitidas.";
  if (nivelRestricao === "moderada") blocoPublicidade += " Nicho de saúde: não prometa cura ou resultado; respeite publicidade profissional e use somente depoimentos reais.";

  const qtdProfissionaisReais = (briefing.profissionais || []).length;
  const blocoEquipeInstrucao = qtdProfissionaisReais
    ? ("O briefing traz " + qtdProfissionaisReais + " profissional(is) real(is) em copy.equipe. Use TODOS, sem omitir nenhum. Cada card usa a bio de copy.equipe (já é a versão mais completa disponível — não corte nem resuma).")
    : "Não há profissionais nomeados no briefing — NÃO crie seção de equipe/corpo clínico.";

  const prompt = `
Você é uma equipe integrada da RD Exclusive composta por Diretor de Criação, UX/UI Designer, Especialista em CRO, Estrategista de Conteúdo, Especialista em SEO e Desenvolvedor Front-end sênior.
Sua tarefa é converter a estratégia e a copy abaixo em uma ONE-PAGE COMPLETA, visualmente marcante e comercialmente convincente, em UM ÚNICO arquivo HTML.

CLIENTE: ${nome}
NICHO: ${nicho}
ANO: ${anoAtual}

BRIEFING FACTUAL — FONTE DE VERDADE:
${serializarParaPrompt(briefing, {})}

ESTRATÉGIA DE UX, CRO E SEO:
${serializarParaPrompt(estrategia, {})}

COPY PRONTA:
${serializarParaPrompt(copy, {})}

IDENTIDADE VISUAL:
- Tipografia: ${dsData.tipografia || DESIGN_SYSTEM_PADRAO.tipografia}
- Paleta: ${paletaInstrucao}
- Estrutura/direção: ${dsData.estrutura || variante.ordemSecoesDescricao}
- Estilo global: ${dsData.estiloGlobal || variante.formaLinguagem}
- Variante: ${variante.nome}
- Hero: ${variante.heroDescricao}
- Serviços/diferenciais: ${variante.secaoServicosDescricao}

IMAGENS REAIS — cada URL pode ser usada UMA ÚNICA VEZ, colada EXATAMENTE como está listada (completa, com http/https e domínio — nunca vire um caminho relativo tipo "img/foto.jpg", mesmo que pareça um nome de arquivo local):
${imagensTexto}

LOGO REAL OU TEMPORÁRIA:
${logoFinal}
ATENÇÃO: copie esta URL EXATAMENTE como está acima (completa, com http/https e domínio) em todo <img src>, og:image e JSON-LD que referenciar a logo. NUNCA encurte/reescreva para um caminho relativo tipo "img/algumacoisa.png" — mesmo que a URL original já contenha "/img/" no caminho, isso NÃO significa que existe um arquivo local com esse nome no site novo. O sistema de hospedagem de imagens só reconhece e substitui a URL completa; qualquer alteração no texto quebra a imagem (ela vira um link morto).

REDES SOCIAIS REAIS:
${redesTexto}

CONVÊNIOS REAIS (${conveniosLista.length}):
${conveniosLista.length ? conveniosLista.join("\n") : "Nenhum. Não crie seção nem alegação de convênio."}

CONTEXTO COMPLEMENTAR:
- Nota Google auditada: ${contexto.notaGoogle || "não disponível"}
- Oferta visual detectada: ${contexto.ofertaReal || "não disponível"}
- Dores do site atual: ${contexto.diagnosticoDores || "não informado"}
- Gaps de design/CRO: ${contexto.melhoriasAwwwards || "não informado"}
- Regra de publicidade: ${blocoPublicidade}
- Equipe/Corpo Clínico: ${blocoEquipeInstrucao}

ARQUITETURA OBRIGATÓRIA:
1. TOPBAR acima do header com telefone, e-mail, localização resumida e rede social, usando SOMENTE dados reais. Se houver poucos dados, mostre apenas os existentes; não invente. No mobile, mantenha legibilidade e evite excesso.
2. HEADER otimizado com logo, menu por âncoras e CTA principal. O menu mobile deve funcionar de verdade.
3. HERO: se houver uma foto real E boa da pessoa/negócio (não logo, não ícone) ainda não usada em outra seção, monte o hero como <div class="rd-hero-split"><div class="rd-hero-text">...eyebrow, H1, texto, CTAs, microprova...</div><div class="rd-hero-media"><img ...></div></div> — texto de um lado, foto grande do outro (o CSS já cuida do layout responsivo dessas classes, não redefina grid/flex nelas). Sem foto real boa disponível, use o hero full tradicional, preferencialmente ocupando 90–100svh no mobile, com overlay legível, eyebrow, H1 único, texto, CTA primário, CTA secundário e microprova real quando disponível. Nunca use uma imagem genérica/decorativa como se fosse foto de uma pessoa real.
4. FAIXA DE CONFIANÇA/BIG NUMBERS somente com números reais. Cada número vira <span class="rd-counter" data-target="20">0</span> (data-target = só o valor numérico, sem símbolo/texto — prefixo "+" e sufixo "Anos"/"avaliações"/etc. ficam FORA do span, ao lado). Sem números, use atributos concretos sem algarismos inventados (e sem rd-counter).
5. BENEFÍCIOS: explique ganhos e redução de objeções; não repita serviços. Cada card individual leva class="rd-card-fx". A seção/wrapper como um todo leva class="rd-reveal".
6. SERVIÇOS: use todos os serviços reais relevantes, com descrições persuasivas e links/CTAs por âncora. Cada card individual leva class="rd-card-fx"; o wrapper da seção leva class="rd-reveal".
6A. EQUIPE/CORPO CLÍNICO (só se copy.equipe não estiver vazio): um card por profissional — foto real se disponível e ainda não usada em outra seção, nome, cargo/especialidade, e a bio de copy.equipe na ÍNTEGRA (não corte, não resuma). Se copy.equipe estiver vazio, essa seção simplesmente não existe — nada de placeholder ou nome genérico. Cada card leva class="rd-card-fx".
7. SOBRE A MARCA OU PROFISSIONAL: história, posicionamento, método e credenciais exclusivamente reais.
8. DIFERENCIAIS: específicos e explicados; proíba cards vazios de "qualidade, excelência, confiança" sem evidência. Cada card leva class="rd-card-fx"; o wrapper da seção leva class="rd-reveal".
9. DESTAQUE EDITORIAL visualmente diferente para quebrar o padrão de grids e aumentar desejo/percepção de valor.
10. GALERIA/CARROSSEL com imagens reais, CSS scroll-snap, proporções consistentes e sem repetir URLs. Se houver menos de 3 imagens adequadas, substitua por composição editorial sem inventar fotos. Se a seção tiver depoimentos reais, cada card de depoimento leva class="rd-card-fx".
11. COMO FUNCIONA com passos seguros e adequados ao segmento.
12. FAQ com 4 a 6 perguntas úteis; não invente políticas, prazos, preços ou garantias.
13. CTA FINAL imediatamente antes do rodapé, com título, texto e FORMULÁRIO contendo nome, telefone, e-mail, serviço de interesse, mensagem, consentimento de privacidade e botão. Se não houver endpoint real, use action="#", method="post" e inclua uma nota discreta "Formulário demonstrativo".
14. RODAPÉ com no mínimo 4 colunas no desktop:
   - Coluna 1: logo + mini bio + redes reais;
   - Coluna 2: serviços reais;
   - Coluna 3: menu institucional + links úteis (Política de Privacidade, Perguntas Frequentes, Termos de Uso). Links inexistentes podem usar href="#" e não devem fingir páginas publicadas;
   - Coluna 4: contato real com telefone, e-mail, endereço e horário, somente quando existentes.
15. BOTÃO FLUTUANTE com href EXATO "${whatsappUrlFinal}". ${contexto.whatsappReal ? "Pode identificá-lo como WhatsApp." : (contexto.linkAgendamentoReal ? "Identifique como agendamento, nunca como WhatsApp." : "Mantenha href='#' e texto neutro de contato; não prometa canal inexistente.")}

FUNÇÃO DE CRO POR SEÇÃO:
- Hero: comunicar valor e gerar o primeiro clique.
- Benefícios: demonstrar transformação e relevância.
- Serviços: ajudar o visitante a se reconhecer na oferta.
- Equipe: construir confiança através de credenciais e trajetória reais dos profissionais.
- Sobre: construir autoridade e proximidade.
- Diferenciais: reduzir comparação apenas por preço.
- Galeria: aumentar desejo e percepção de qualidade.
- Como funciona: reduzir incerteza.
- FAQ: remover objeções.
- CTA final: capturar o lead.
Use o mesmo objetivo de conversão primário em toda a página e CTAs específicos; evite "Saiba mais" quando houver verbo mais claro.

REGRAS DE VERACIDADE:
- Não invente telefone, WhatsApp, e-mail, endereço, horário, credencial, CNPJ, registro profissional, equipe, serviço, preço, número, depoimento, avaliação ou política.
- EQUIPE/CORPO CLÍNICO: não invente profissional, formação ou marco de carreira além do que está em copy.equipe. Depoimento de cliente NUNCA vira credencial de profissional (ex: um paciente escrever "me cuido lá há 7 anos" não pode virar "7 anos de atuação" no card do profissional).
- Todo telefone exibido deve ser link tel:+55 apenas quando o número for real.
- Todo e-mail exibido deve ser mailto: e real.
- Redes sociais só podem ser links reais fornecidos.
- Preços só podem aparecer se estiverem literalmente no briefing.
- Informações de depoimentos nunca podem virar credenciais institucionais.
- ${blocoPublicidade}

SEO OBRIGATÓRIO:
- <html lang="pt-BR">, charset, viewport, title e meta description derivados da estratégia.
- Exatamente um H1; H2 e H3 em hierarquia lógica.
- Open Graph com og:title, og:description e og:image="${imagemHeroParaOg}".
- JSON-LD usando ${estrategia.schemaRecomendado || "LocalBusiness"}, somente com dados reais; inclua FAQPage apenas se o FAQ estiver no HTML.
- Alt text descritivo e natural em todas as imagens.
- Links internos por âncoras com IDs semânticos.

UX/UI MOBILE-FIRST:
- Comece o CSS para 320–767px e expanda com media queries.
- Área clicável mínima confortável, textos legíveis, contraste WCAG, espaçamento consistente e sem overflow horizontal.
- Header e CTA não podem encobrir conteúdo.
- Menu mobile funcional via checkbox-hack CSS puro, sem JavaScript.
- Use grid/flex responsivos e clamp() na tipografia.
- Evite aparência de template repetitivo: varie ritmos, alinhamentos, áreas de respiro, blocos full-bleed, composição editorial e hierarquia.
- Não use emojis como ícones de interface. Use SVG inline desenhado no HTML.

PERFORMANCE E CÓDIGO:
- Retorne UM arquivo HTML completo, começando em <!DOCTYPE html> e terminando em </html>.
- Todo CSS dentro de <style>; sem bibliotecas externas de CSS/JS/ícones.
- Google Fonts é permitido SOMENTE se a tipografia indicada citar claramente uma família do Google Fonts; nesse caso, importe no <head> e adicione preconnect. Caso contrário use uma pilha de fontes de sistema coerente.
- Inclua estas tags de preconnect para imagens antes dos demais recursos:
${preconnectTags || "Nenhuma tag obrigatória."}
- Primeira imagem do hero sem lazy loading e com fetchpriority="high"; demais imagens externas com loading="lazy".
- Favicon SVG embutido em data URI, com monograma da marca.
- Use HTML semântico, aria-label em navegação, botões de ícone e links sociais.
- Não use lorem ipsum, imagens quebradas, comentários explicativos fora do HTML ou blocos markdown.

Retorne APENAS o HTML final.`;

  const jsonResposta = chamarGeminiComRetry(prompt, 3);
  let txt = limparBlocoMarkdown(obterTextoRespostaGemini(jsonResposta));
  const inicio = txt.search(/<!DOCTYPE html>|<html/i);
  const fim = txt.toLowerCase().lastIndexOf("</html>");
  if (inicio !== -1 && fim !== -1) txt = txt.substring(inicio, fim + 7);
  return txt;
}

/**
 * Identidade visual rica por IA (versão da Natália, adotada sem alteração):
 * retorna paleta completa, tipografia, ESTRUTURA e ESTILO GLOBAL específicos
 * do cliente — na minha versão anterior, estrutura/estilo eram sempre
 * constantes fixas (DESIGN_SYSTEM_PADRAO), o que fazia todo site puxar pro
 * mesmo "jeito RD Exclusive" independente do negócio real do lead.
 */
function analisarIdentidadeVisualComIA(screenshotBase64, nomeCliente) {
  const resultado = {
    corPrincipalHex: "",
    paletaDescricao: "",
    tipografiaDescricao: "",
    estruturaDescricao: "",
    estiloGlobalDescricao: "",
    ofertaTextoVisivel: ""
  };
  if (!screenshotBase64) return resultado;
  try {
    const prompt =
      "Você está vendo um print do site atual do negócio \"" + nomeCliente + "\". Analise a identidade visual existente para orientar um REDESIGN que preserve reconhecimento de marca, mas melhore hierarquia, consistência e percepção de valor.\n\n" +
      "Não imponha dourado, off-white, luxo, estética clínica ou minimalismo se esses códigos não estiverem presentes. Diferencie cor de marca de cores genéricas do navegador, CMS, cookies ou elementos neutros.\n\n" +
      "Retorne APENAS JSON válido, sem markdown, com esta estrutura:\n" +
      "{\n" +
      "  \"corPrimaria\":\"#RRGGBB ou NENHUMA\",\n" +
      "  \"corSecundaria\":\"#RRGGBB ou NENHUMA\",\n" +
      "  \"corDestaque\":\"#RRGGBB ou NENHUMA\",\n" +
      "  \"corFundoClaro\":\"#RRGGBB\",\n" +
      "  \"corFundoEscuro\":\"#RRGGBB ou NENHUMA\",\n" +
      "  \"corTextoPrincipal\":\"#RRGGBB\",\n" +
      "  \"fonteTitulosRealOuProvavel\":\"nome ou categoria tipográfica\",\n" +
      "  \"fonteCorpoRealOuProvavel\":\"nome ou categoria tipográfica\",\n" +
      "  \"alternativasGoogleFonts\":\"Títulos: Fonte; Corpo: Fonte\",\n" +
      "  \"pesoTitulos\":\"\",\n" +
      "  \"estiloBotoes\":\"\",\n" +
      "  \"raioBordas\":\"\",\n" +
      "  \"estiloImagens\":\"\",\n" +
      "  \"densidadeVisual\":\"\",\n" +
      "  \"personalidadeMarca\":\"\",\n" +
      "  \"direcaoDeLayout\":\"\",\n" +
      "  \"preservar\":[\"\"],\n" +
      "  \"modernizar\":[\"\"],\n" +
      "  \"ofertaVisivel\":\"texto exato ou NENHUMA\"\n" +
      "}";
    const payload = {
      "contents": [{
        "parts": [
          { "text": prompt },
          { "inline_data": { "mime_type": "image/jpeg", "data": screenshotBase64 } }
        ]
      }]
    };
    const opcoes = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    const response = UrlFetchApp.fetch(GEMINI_API_URL, opcoes);
    if (response.getResponseCode() !== 200) return resultado;
    const texto = obterTextoRespostaGemini(JSON.parse(response.getContentText()));
    const dados = extrairJSONSeguro(texto, {});
    const corPrimaria = /^#[0-9A-Fa-f]{6}$/.test(dados.corPrimaria || "") && !ehCorGenericaDemais(dados.corPrimaria) ? dados.corPrimaria.toUpperCase() : "";
    resultado.corPrincipalHex = corPrimaria;
    resultado.paletaDescricao = [
      corPrimaria ? "Primária " + corPrimaria : "",
      /^#[0-9A-Fa-f]{6}$/.test(dados.corSecundaria || "") ? "Secundária " + dados.corSecundaria.toUpperCase() : "",
      /^#[0-9A-Fa-f]{6}$/.test(dados.corDestaque || "") ? "Destaque " + dados.corDestaque.toUpperCase() : "",
      /^#[0-9A-Fa-f]{6}$/.test(dados.corFundoClaro || "") ? "Fundo claro " + dados.corFundoClaro.toUpperCase() : "",
      /^#[0-9A-Fa-f]{6}$/.test(dados.corFundoEscuro || "") ? "Fundo escuro " + dados.corFundoEscuro.toUpperCase() : "",
      /^#[0-9A-Fa-f]{6}$/.test(dados.corTextoPrincipal || "") ? "Texto " + dados.corTextoPrincipal.toUpperCase() : ""
    ].filter(Boolean).join("; ");
    resultado.tipografiaDescricao =
      "Fonte observada/provável nos títulos: " + (dados.fonteTitulosRealOuProvavel || "não identificada") +
      "; fonte observada/provável no corpo: " + (dados.fonteCorpoRealOuProvavel || "não identificada") +
      "; alternativas web: " + (dados.alternativasGoogleFonts || "usar pilha de sistema coerente") +
      "; peso dos títulos: " + (dados.pesoTitulos || "forte e hierárquico");
    resultado.estruturaDescricao =
      "Direção de layout: " + (dados.direcaoDeLayout || "mobile-first, clara e orientada à conversão") +
      "; densidade: " + (dados.densidadeVisual || "equilibrada") +
      "; preservar: " + ((dados.preservar || []).filter(Boolean).join(", ") || "elementos reconhecíveis da marca") +
      "; modernizar: " + ((dados.modernizar || []).filter(Boolean).join(", ") || "hierarquia, espaçamento e consistência");
    resultado.estiloGlobalDescricao =
      "Personalidade: " + (dados.personalidadeMarca || "profissional") +
      "; botões: " + (dados.estiloBotoes || "claros e contrastantes") +
      "; bordas: " + (dados.raioBordas || "coerentes com a marca") +
      "; imagens: " + (dados.estiloImagens || "reais e contextualizadas");
    if (dados.ofertaVisivel && String(dados.ofertaVisivel).toUpperCase() !== "NENHUMA") {
      resultado.ofertaTextoVisivel = "⚠️ Extraído por IA a partir de imagem (conferir manualmente antes de usar): " + String(dados.ofertaVisivel).trim();
    }
    return resultado;
  } catch (e) {
    return resultado;
  }
}

function extrairConteudoViaVisaoIA(screenshotBase64, nomeCliente) {
  if (!screenshotBase64) return "";
  const prompt =
    "Você está vendo um print de tela do site atual do negócio \"" + nomeCliente + "\". " +
    "Esse site provavelmente foi feito numa ferramenta que carrega o conteúdo via JavaScript, " +
    "por isso não foi possível ler o texto direto do código-fonte.\n\n" +
    "Transcreva, o mais fielmente possível, TODO texto real e visível nesta imagem: título/chamada " +
    "principal, diferenciais, texto sobre o profissional/negócio, depoimentos, preços ou ofertas, " +
    "informações de contato — tudo que estiver legível.\n" +
    "NÃO invente, complete ou arredonde nada que não esteja realmente visível. Se alguma parte estiver " +
    "cortada ou ilegível, simplesmente ignore essa parte.\n" +
    "Responda só com o texto transcrito corrido, sem comentários seus nem formatação markdown.";
  const payload = {
    "contents": [{
      "parts": [
        { "text": prompt },
        { "inline_data": { "mime_type": "image/jpeg", "data": screenshotBase64 } }
      ]
    }]
  };
  const opcoes = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  const tentativas = 2;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const response = UrlFetchApp.fetch(GEMINI_API_URL, opcoes);
      if (response.getResponseCode() === 200) {
        const texto = JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
        return (texto || "").trim().substring(0, 6000);
      }
      if (response.getResponseCode() !== 503 || tentativa === tentativas) return "";
    } catch (e) {
      if (tentativa === tentativas) return "";
    }
    Utilities.sleep(tentativa * 3000);
  }
  return "";
}

function capturarEAplicarIdentidadeVisual(sheet, rowNum, nome, site) {
  const screenshotParaIdentidade = capturarScreenshotViaMshots(site, 2600);
  const identidadeVisual = analisarIdentidadeVisualComIA(screenshotParaIdentidade, nome);
  sheet.getRange(rowNum, 18).setValue(identidadeVisual.tipografiaDescricao || DESIGN_SYSTEM_PADRAO.tipografia); // R
  sheet.getRange(rowNum, 19).setValue(identidadeVisual.paletaDescricao || DESIGN_SYSTEM_PADRAO.paleta); // S
  sheet.getRange(rowNum, 20).setValue(identidadeVisual.estruturaDescricao || DESIGN_SYSTEM_PADRAO.estrutura); // T
  sheet.getRange(rowNum, 21).setValue(identidadeVisual.estiloGlobalDescricao || DESIGN_SYSTEM_PADRAO.estiloGlobal); // U
  if (identidadeVisual.ofertaTextoVisivel) {
    sheet.getRange(rowNum, 22).setValue(identidadeVisual.ofertaTextoVisivel); // V
  }
}

/**
 * Validação estrutural pós-geração, usada pelo 05_GerarSite.gs no loop de
 * QA/autocorreção.
 * AJUSTE (merge): adicionado o check de EQUIPE — se o briefing trouxe
 * profissionais reais, confere se o nome de cada um sobreviveu até o HTML
 * final (sinal de que a seção de equipe realmente foi montada e não foi
 * substituída por outra coisa no meio da esteira).
 */
function validarEstruturaDoPrototipo(html, contexto) {
  contexto = contexto || {};
  const erros = [];
  const avisos = [];
  const codigo = String(html || "");
  if (!/<!DOCTYPE html>/i.test(codigo)) erros.push("DOCTYPE ausente");
  if (!/<header[\s>]/i.test(codigo)) erros.push("Header ausente");
  if (!/<footer[\s>]/i.test(codigo)) erros.push("Rodapé ausente");
  if (!/<form[\s>]/i.test(codigo)) erros.push("Formulário final ausente");
  if (!/meta\s+name=["']description["']/i.test(codigo)) erros.push("Meta description ausente");
  if (!/application\/ld\+json/i.test(codigo)) avisos.push("Schema JSON-LD ausente");
  if (!/@media/i.test(codigo)) erros.push("Media queries ausentes");
  if (!/scroll-snap/i.test(codigo) && (contexto.imagensReais || []).length >= 3) avisos.push("Galeria sem scroll-snap");
  if (!/type=["']checkbox["']/i.test(codigo) || !/menu-toggle/i.test(codigo)) erros.push("Menu mobile funcional não identificado");
  const quantidadeH1 = (codigo.match(/<h1[\s>]/gi) || []).length;
  if (quantidadeH1 !== 1) erros.push("Quantidade de H1 inválida: " + quantidadeH1);
  const camposFormulario = ["name", "tel", "email", "textarea"];
  camposFormulario.forEach(function(tipo) {
    const regex = tipo === "textarea" ? /<textarea[\s>]/i : new RegExp('<input[^>]+type=["\\\']' + tipo + '["\\\']', 'i');
    if (!regex.test(codigo)) avisos.push("Campo de formulário ausente: " + tipo);
  });
  if (!/Política de Privacidade/i.test(codigo)) avisos.push("Link de Política de Privacidade ausente");
  if (!/Termos de Uso/i.test(codigo)) avisos.push("Link de Termos de Uso ausente");
  if (!/Perguntas Frequentes|FAQ/i.test(codigo)) avisos.push("FAQ não identificado");

  // CORRIGIDO (caso M&B Fisioterapia): a IA às vezes "encurta" a URL real de
  // uma imagem/logo pra um caminho relativo tipo "img/logo-mb.png", achando
  // que existe um arquivo local com esse nome no site novo. Não existe — o
  // sistema de hospedagem só reconhece e substitui a URL completa original,
  // então qualquer caminho relativo vira imagem quebrada em produção. Nesta
  // etapa (antes da hospedagem de imagens) NENHUM <img src="...">, og:image
  // ou JSON-LD deveria referenciar um caminho relativo — todos devem ainda
  // estar como URL completa (http/https), aguardando a troca automática.
  const referenciasRelativasSuspeitas = codigo.match(/(?:src|content)=["']img\/[^"']+["']/gi) || [];
  if (referenciasRelativasSuspeitas.length) {
    erros.push(
      "Imagem/logo referenciada como caminho relativo (vira imagem quebrada): " +
      referenciasRelativasSuspeitas.slice(0, 3).join(", ")
    );
  }

  // CORRIGIDO (caso Juliana Mohaupt/nutricionista): o bug do M&B acima só
  // pega URL virada em CAMINHO RELATIVO. Mas existe uma segunda variante do
  // mesmo problema — a IA às vezes copia uma URL absoluta de verdade, mas
  // CORTADA NO MEIO (ex: Wix manda ".../v1/fill/w_431,h_431,al_c,.../Nome
  // Real.jpg" e sobra só ".../v1/fill/w_431") — continua parecendo uma URL
  // válida (começa com https://), então o regex de caminho relativo não
  // pega. A única forma confiável de pegar ISSO é testar se a URL realmente
  // carrega uma imagem de verdade, então aqui a gente busca todo <img src=
  // ...> e content="..." (og:image) que seja http(s) e faz um HEAD real em
  // cada uma (dedup pra não testar a mesma imagem repetida vezes à toa).
  // Roda ANTES da hospedagem de imagens (aplicarMapaImagensNoHTML), então
  // testa exatamente as URLs originais que, na prática, continuam sendo as
  // URLs finais pra a maioria das fotos do site (só logo/foto manualmente
  // trocada é que vira hospedada depois).
  const candidatosImagem = codigo.match(/(?:src|content)=["'](https?:\/\/[^"']+)["']/gi) || [];
  const urlsImagemUnicas = Array.from(new Set(candidatosImagem.map(function(m) {
    return m.replace(/^(?:src|content)=["']/i, "").replace(/["']$/, "");
  })));
  const urlsQuebradas = [];
  urlsImagemUnicas.forEach(function(url) {
    try {
      const resp = UrlFetchApp.fetch(url, { method: "head", muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: false });
      const codigoResp = resp.getResponseCode();
      if (codigoResp < 200 || codigoResp >= 400) urlsQuebradas.push(url + " (HTTP " + codigoResp + ")");
    } catch (e) {
      urlsQuebradas.push(url + " (falha de conexão: " + e.message + ")");
    }
  });
  if (urlsQuebradas.length) {
    erros.push("Imagem/logo com URL quebrada ou inacessível (testado ao vivo): " + urlsQuebradas.slice(0, 3).join(" | "));
  }

  // CASO SARA SINGER: lead cuja única presença é o Instagram (sem site
  // próprio) e cuja foto de perfil não pôde ser capturada pelo servidor
  // (Instagram bloqueou — o comum). Sem foto real confirmada, o hero do
  // site pode ter saído com um ícone genérico no lugar da pessoa, e isso
  // só aparece olhando o site pronto. Aqui a gente já avisa antes: não dá
  // pra "corrigir" isso sozinho (a IA não tem acesso a fotos do Instagram),
  // então vira aviso, não erro — o passo seguinte é humano: pedir pra
  // buscar fotos alternativas manualmente (mesmo fluxo usado com o M&B).
  if (contexto.origemInstagramSemFoto) {
    avisos.push(
      "Origem é só Instagram e a foto de perfil não pôde ser capturada automaticamente — " +
      "o hero pode estar com um ícone genérico no lugar da foto real. Buscar fotos alternativas manualmente."
    );
  }

  const profissionaisReais = (contexto.briefingEstruturado && contexto.briefingEstruturado.profissionais) || [];
  profissionaisReais.forEach(function(p) {
    if (p.nome && !codigo.includes(p.nome)) {
      avisos.push("Profissional real não encontrado no HTML final (revisar seção de equipe): " + p.nome);
    }
  });

  return { valido: erros.length === 0, erros: erros, avisos: avisos };
}

function corrigirHTMLViaIA(html, nome, nicho, contexto, validacao) {
  if (!validacao || (validacao.erros || []).length === 0) return html;
  try {
    const prompt = `
Você é um revisor front-end sênior. Corrija o HTML abaixo sem apagar conteúdo real, sem trocar a identidade visual e sem inventar dados.

CLIENTE: ${nome}
NICHO: ${nicho}
ERROS OBRIGATÓRIOS: ${(validacao.erros || []).join(" | ")}
AVISOS: ${(validacao.avisos || []).join(" | ")}

REGRAS:
- Preserve todos os contatos reais e links existentes.
- Não invente contato, serviço, credencial, preço, depoimento ou número.
- Garanta exatamente um H1, menu mobile funcional, formulário final, SEO e rodapé completo.
- Retorne somente o HTML completo corrigido, sem markdown.

HTML:
${limitarTextoParaPrompt(html, 45000)}`;
    const resposta = chamarGeminiComRetry(prompt, 2);
    let corrigido = limparBlocoMarkdown(obterTextoRespostaGemini(resposta));
    const inicio = corrigido.search(/<!DOCTYPE html>|<html/i);
    const fim = corrigido.toLowerCase().lastIndexOf("</html>");
    if (inicio !== -1 && fim !== -1) corrigido = corrigido.substring(inicio, fim + 7);
    return corrigido || html;
  } catch (e) {
    return html;
  }
}

// NÃO USADA MAIS — substituída por gerarMensagemAberturaWhatsAppIA (abaixo).
// Mantida só de referência, não atrapalha se ficar aqui.
function gerarCopyColunaS(nome, dados, nicho) {
  const ehNichoSaude = NICHOS_PUBLICIDADE_MODERADA.some(function(p) { return (nicho || "").toLowerCase().includes(p); });
  let intro = "Olá, " + nome + "! Aqui é o David, diretor da RD Exclusive no RJ. ";
  let cta = " Desenhei um protótipo com design Mobile First e aceleração de cliques para o seu negócio. Posso enviar o link do diagnóstico técnico?";

  if (dados.velocidadeSymbol !== '🟢 Rápido') {
    let techContext = dados.plataforma !== 'Código Limpo / Outra' ? "sua estrutura em " + dados.plataforma : "seu site";
    return intro + "Notei que " + techContext + " está com carregamento lento no celular, fazendo você perder até 50% dos cliques de anúncios antes da página abrir." + cta;
  }
  if (!dados.pixels.length) {
    return intro + "Identifiquei via código que seu site carrega rápido, mas opera sem os rastreadores do Meta e Google. Vocês estão perdendo o rastro de 100% das pessoas que chegam ali." + cta;
  }
  if (dados.plataforma === 'Wix' || dados.plataforma === 'WordPress' || dados.plataforma === 'WordPress (Elementor)') {
    return intro + "Seu site em " + dados.plataforma + " está ativo, mas a experiência mobile e o posicionamento do botão do WhatsApp ocultam até 40% das intenções de agendamento diárias." + cta;
  }
  const estatisticaFinal = ehNichoSaude
    ? "estatisticamente, mais de 70% das clínicas de alto padrão perdem até 80% das vendas por demora na recepção do WhatsApp"
    : "negócios de atendimento local costumam perder uma parte relevante das vendas por demora na recepção do WhatsApp";
  return intro + "Analisamos sua engenharia digital e ela é excelente. Porém, " + estatisticaFinal + ". Criamos um protótipo Mobile First com fluxo otimizado para vocês. Posso enviar?";
}

/**
 * Gera a mensagem 1 do WhatsApp (primeiro contato) — curta, pessoal, baseada
 * só em elogio real + um ponto de melhoria específico, SEM nenhum link.
 * Fecha pedindo permissão leve para mandar o link do site-teste numa próxima
 * mensagem (abordagem "namoro", não "venda") — decisão explícita da Carla:
 * nunca despachar o link já na primeira mensagem, pra abrir comunicação
 * autorizada com o lead antes de mandar qualquer coisa.
 *
 * v2 (caso real Douglas Sales): não usa diminutivos que minimizam o achado,
 * indica a consequência real do problema, insinua (sem inventar números)
 * que outros visitantes também notam, assina só "David" (cargo/agência
 * ficam pra mensagem 2) e separa em parágrafos curtos com \n\n.
 */
function gerarMensagemAberturaWhatsAppIA(nome, nicho, diferencial, diagnosticoDores, melhoriasAwwwards) {
  const fallback = "Olá, " + nome + "! Aqui é o David.\n\nVi seu trabalho em " + (nicho || "seu segmento") + " e reparei em um ponto específico no seu site que provavelmente quem visita também está notando.\n\nPosso te mandar o que encontrei?";
  try {
    const prompt =
      "Você é o David, diretor comercial da RD Exclusive no Rio de Janeiro, escrevendo a PRIMEIRA mensagem de WhatsApp para um lead — o objetivo aqui NÃO é vender, é só abrir uma conversa autorizada.\n\n" +
      "REGRAS DE OURO (não negociáveis):\n" +
      "1. NÃO inclua nenhum link, nenhuma URL, em lugar nenhum da mensagem.\n" +
      "2. NÃO fale de preço, valores ou planos.\n" +
      "3. NÃO prometa resultado, cura ou garantia. Evite superlativos ('o melhor', 'número 1').\n" +
      "4. NÃO invente nenhum dado que não esteja listado abaixo.\n" +
      "5. Termine SEMPRE pedindo permissão, de forma leve e sutil, para enviar mais informações numa PRÓXIMA mensagem (nunca diga o que é — só que você quer mandar algo que preparou).\n" +
      "6. NÃO use diminutivos que minimizam o problema encontrado (nunca diga 'pequeno', 'simples', 'detalhezinho' etc.) — descreva o problema com o peso real que ele tem, sem soar alarmista.\n" +
      "7. Deixe implícito que outras pessoas que visitam o site provavelmente também estão vendo esse mesmo problema (sem inventar número exato de visitantes) — isso cria curiosidade genuína, não é só um aviso educado.\n" +
      "8. Assine só com o primeiro nome (David) — NÃO mencione cargo nem o nome 'RD Exclusive' nessa mensagem. Isso fica pra próxima mensagem, se o lead topar.\n" +
      "9. NÃO escreva tudo em um bloco só. Separe elogio, ponto de melhoria e pedido final em parágrafos curtos, com uma linha em branco entre cada um — do jeito que uma pessoa de verdade digita no WhatsApp, com pausa entre as ideias, não como um texto corrido.\n\n" +
      "DADOS REAIS DO LEAD (use só o que fizer sentido, não precisa usar tudo):\n" +
      "- Nome: " + nome + " (" + (nicho || "não informado") + ")\n" +
      "- Ponto positivo real pra elogiar (nota/avaliações no Google, diferencial): " + (diferencial || "não informado") + "\n" +
      "- Falha técnica específica encontrada: " + (diagnosticoDores || "não informado") + "\n" +
      "- Gap específico de design/experiência vs. concorrência de ponta: " + (melhoriasAwwwards || "não informado") + "\n\n" +
      "ESTRUTURA A SEGUIR:\n" +
      "1. Elogio inicial curto e ESPECÍFICO (cite a nota/avaliação real ou o diferencial real — nunca um elogio genérico tipo 'seu trabalho é incrível').\n" +
      "2. Um único ponto de melhoria ESPECÍFICO, com a consequência real dele (ex: passa impressão de site abandonado/desatualizado), apontado com gentileza, não como crítica — mostre que você olhou de verdade, não é mensagem em massa.\n" +
      "3. Pedido leve de permissão para mandar mais informações numa próxima mensagem, sem dizer que é um link ou site.\n\n" +
      "TOM: pessoal, como se você tivesse escrito à mão — curto (no máximo 4 frases), sem emoji em excesso, sem gatilho de urgência, sem cara de mensagem em massa. Lembre-se de separar em parágrafos curtos com linha em branco entre eles (regra 9).\n\n" +
      "Responda APENAS com o texto da mensagem, pronto pra copiar e colar no WhatsApp, JÁ COM as quebras de linha (\\n\\n) entre os parágrafos. Sem aspas, sem explicação, sem assinatura formal de e-mail.";
    const json = chamarGeminiComRetry(prompt, 3);
    const texto = json.candidates[0].content.parts[0].text.trim();
    return texto || fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Gera a mensagem 2 do WhatsApp — só é usada DEPOIS que o lead responder
 * "sim" à mensagem 1. Fica pronta na coluna AI pra copiar/colar na hora certa.
 */
function gerarMensagemContinuacaoWhatsAppIA(nome, nicho, urlApresentacao) {
  const fallback = "Que bom! Aqui quem fala é o David, diretor da RD Exclusive.\n\nTomei a liberdade de preparar uma nova versão do site de vocês, já no ar: " + urlApresentacao + ".\n\nDá uma olhada com calma, de preferência pelo celular, e me conta o que achou!";
  if (!urlApresentacao) return fallback;
  try {
    const prompt =
      "Você é o David, diretor comercial da RD Exclusive no Rio de Janeiro. O lead '" + nome + "' (" + (nicho || "não informado") + ") acabou de responder SIM a uma mensagem anterior perguntando se podia mandar mais informações. Agora é a hora de entregar.\n\n" +
      "REGRAS:\n" +
      "1. NÃO prometa resultado, cura ou garantia. Evite superlativos.\n" +
      "2. NÃO fale de preço, valores ou planos.\n" +
      "3. Use OBRIGATORIAMENTE este link, exatamente como está, sem alterar: " + urlApresentacao + " (é uma página que mostra o site atual dele e a proposta nova lado a lado, pra ele comparar).\n" +
      "4. Essa é a hora certa de se apresentar melhor: mencione que você é o David, diretor da RD Exclusive — agora que ele já demonstrou interesse respondendo 'sim', isso reforça credibilidade em vez de soar como venda fria (na mensagem 1 isso foi propositalmente omitido).\n" +
      "5. NÃO escreva tudo em um bloco só. Separe em parágrafos curtos, com uma linha em branco entre cada parte da estrutura abaixo — do jeito que uma pessoa de verdade digita no WhatsApp, não como um texto corrido.\n\n" +
      "ESTRUTURA (cada item abaixo vira um parágrafo separado por linha em branco):\n" +
      "1. Diga que preparou/já tomou a liberdade de montar uma versão nova, com a identidade dele, já se apresentando (nome + RD Exclusive).\n" +
      "2. Mande o link.\n" +
      "3. Convide a comparar com o site atual dele (o próprio link já mostra a comparação lado a lado — não precisa de um segundo link do site antigo).\n" +
      "4. Feche leve, sugerindo abrir de preferência pelo celular, perguntando a opinião dele — sem pressão, sem pedir reunião ainda.\n\n" +
      "TOM: escrito à mão, curto (no máximo 5 frases), sem emoji em excesso.\n\n" +
      "Responda APENAS com o texto da mensagem, pronto pra copiar e colar no WhatsApp, JÁ COM as quebras de linha (\\n\\n) entre os parágrafos. Sem aspas, sem explicação.";
    const json = chamarGeminiComRetry(prompt, 3);
    const texto = json.candidates[0].content.parts[0].text.trim();
    return texto || fallback;
  } catch (e) {
    return fallback;
  }
}
