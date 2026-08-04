# Prompt para nova conversa — LP Espaço Viv Copacabana ("desafio 3 cliques")

## Objetivo
Apostei com a equipe web da RD Exclusive que consigo produzir a landing page abaixo em ~3 cliques, usando o app RD Prospect (Apps Script + Gemini, hoje usado pra gerar sites-teste de prospecção). Preciso da sua ajuda pra descobrir se isso é viável e, se for, construir.

## Diferença importante em relação ao uso normal do RD Prospect
O RD Prospect hoje só sabe fazer um tipo de coisa: raspar o site ATUAL de um lead frio, auditar (pixels, velocidade, idade de domínio), e pedir pra IA criar uma versão "melhorada" pra pitch de venda, publicando em `rd-previews-dharari01s-projects.vercel.app/<slug>`.

Este caso é diferente: é um cliente já ativo (Espaço Viv), o site já é bom, e o pedido não é "melhorar", é **duplicar uma página existente e simplificar pra virar landing page de conversão**, seguindo um briefing bem detalhado da equipe de tráfego. Não tenho certeza se dá pra reaproveitar o pipeline atual (raspagem + IA generativa livre) ou se precisa de uma lógica nova, mais parecida com "aplicar uma lista de transformações pontuais" do que "a IA recria o site do zero".

## Cliente e página de referência
- Site: https://espacoviv.com/ (WordPress + Elementor, já é cliente da RD Exclusive — rodapé do site confirma)
- A home atual já parece ser, na prática, a página da unidade Copacabana (endereço no rodapé: R. Barata Ribeiro, 391 - Copacabana, RJ). O briefing pede a URL da "página atual de Copacabana" mas deixa em branco — pode ser essa mesma home, vale confirmar com quem passou o desafio.
- Estrutura atual da home (extraída ao vivo): topo com WhatsApp/horário, menu (Home / Espaço / Terapeutas / Massagens + submenu / Blog / Contato), hero com 1 slide (headline "Presenteie com experiências inesquecíveis"), seção "Massoterapia em Copacabana" com 4 diferenciais, seção "Sobre nós", carrossel de terapeutas (10 cards, cada um com foto + nome genérico "Terapeuta" + botão "Agendar com Terapeuta"), seção "Experimente nossas massagens" com 9 cards de serviço (cada um com "Saiba mais" + "Agendar"), depoimentos (com Lorem Ipsum ainda no texto — atenção, é conteúdo de placeholder real no site live), mapa embutido, rodapé com endereço das 2 unidades (RJ e SP), redes sociais.

## ⚠️ Duas inconsistências que encontrei comparando o briefing com o site ao vivo — não decidi nada, só flagando pra confirmar antes de publicar:
1. **GTM duplicado com ID diferente**: o site JÁ tem um GTM instalado — `GTM-KGWX7FSV` (visto no HTML). O briefing pede pra instalar `GTM-KGUX7FSV` (repare: KG**U**X vs KG**W**X). Pode ser erro de digitação no briefing, ou são containers realmente diferentes. O próprio briefing avisa pra checar duplicidade antes — isso é exatamente esse caso.
2. **Número de WhatsApp inconsistente**: a maioria dos botões do site usa `5521984109090`, mas 1-2 botões (ex: "Agende sua sessão na Viv Massagens") usam `5521984109201`. O briefing pede pra usar `21984109201` como número oficial da unidade. Vale confirmar com o Gilmar (responsável pelo briefing) qual é o número certo antes de publicar — o próprio briefing já lista isso como item de checklist final.

## Escopo completo do briefing (resumo acionável)
**Manter da página original:** identidade visual, cores, tipografia, logo, imagens reais do ambiente, fotos das terapeutas, cards de serviço, estilo dos botões, responsividade mobile.

**Remover:** menu de navegação inteiro, links pra outras páginas, botões "Saiba mais", links de Instagram/Facebook/blog, informações/telefones de outras unidades (tirar tudo de São Paulo).

**Alterar só o slide 1 do hero** (manter os demais como estão):
- Headline: "Seu refúgio de relaxamento em Copacabana."
- Subheadline: "Local totalmente discreto, com atendimento 24 horas."
- Texto de apoio: "Ambiente acolhedor, terapeutas qualificadas e atendimento profissional para proporcionar bem-estar, relaxamento e conforto."
- Botão: "Agendar pelo WhatsApp"
- Imagem: manter a atual do slide ou outra real já aprovada do Espaço Viv.

**Botões de WhatsApp** — trocar todos os principais por link direto (1 clique só, sem passar por outra página):
- Mensagem geral: `Olá! Vim pelo Google e gostaria de consultar os horários disponíveis para uma massagem na unidade de Copacabana.`
- Nos cards de terapeuta, incluir o nome: `Olá! Vim pelo Google e gostaria de consultar a disponibilidade da terapeuta [NOME] na unidade de Copacabana.`
- Nos cards de massagem, incluir o nome do serviço: `Olá! Vim pelo Google e gostaria de consultar os horários disponíveis para [NOME DA MASSAGEM] na unidade de Copacabana.`
- Manter botão flutuante de WhatsApp + criar CTA fixo no rodapé mobile.
- Formato: `https://wa.me/<numero>?text=<mensagem codificada>`

**Google Tag Manager** — instalar (checar duplicidade, ver inconsistência de ID acima):
```html
<!-- head -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KGUX7FSV');
</script>
<!-- body, logo após abertura -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KGUX7FSV" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

**UTMs esperadas na URL** (só precisa garantir que a página carrega normal recebendo elas, não precisa tratar manualmente):
`utm_source=google&utm_medium=cpc&utm_campaign=pesquisa_massagem_copacabana&utm_id={campaignid}&utm_term={keyword}&utm_content={creative}`

**Não fazer:** não alterar a página original, não criar layout do zero, não misturar dados de outras unidades, não criar depoimentos falsos, não duplicar código de rastreamento, não mexer nos outros slides do carrossel.

**URL sugerida da LP nova:** `/massagem-copacabana` (independente da página original).

## Pergunta central pra resolver antes de codar
O briefing pede uma duplicação literal **dentro do WordPress** do cliente ("localizar a página atual, duplicar, publicar em URL própria dentro do site"). O RD Prospect hoje publica sites estáticos independentes num domínio próprio (Vercel), não dentro do WordPress do cliente. Pra bater a meta de "3 cliques" preciso decidir com a nova conversa:
- (a) Reconstruir a página como HTML estático (reaproveitando o motor atual, visualmente fiel ao original) e publicar num link separado — rápido, dá pra fazer nos "3 cliques", mas tecnicamente não é "a mesma página duplicada dentro do WP".
- (b) Duplicar de verdade dentro do WordPress — só é automatizável se eu tiver acesso à API REST do WP ou alguma automação lá (Elementor, etc.); se não tiver, isso vira trabalho manual da equipe web, fora do que consigo fazer via Apps Script.

Minha aposta foi "3 cliques com o app" — então provavelmente a opção (a) é o caminho, mas quero confirmar isso logo no início da nova conversa antes de construir.
