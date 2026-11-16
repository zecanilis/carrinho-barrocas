# Carrinho Barrocas 🛒

Web app de listas de compras do mês, partilhada em tempo real com o grupo **Condomínio Barrocas**.
Funciona em qualquer telemóvel (Android e iPhone) e no computador. Começa com os 153 produtos das faturas do Pingo Doce.

## O que está nesta pasta

| Ficheiro | Para que serve |
|---|---|
| `index.html` | A app (aspeto e estrutura) |
| `app.js` | Os ecrãs e o que cada botão faz |
| `store.js` | Ligação aos dados (Firebase ou modo demonstração) |
| `seed.js` | Os 153 produtos iniciais (nome, secção, unidade, preço, vezes comprado) |
| `config.js` | **O único ficheiro que tens de editar**: a configuração do Firebase |
| `firestore.rules` | As regras de segurança da base de dados |
| `manifest.webmanifest`, `sw.js`, `icons/` | O que faz dela uma app instalável e que abre sem rede |

Enquanto `config.js` estiver a `null`, a app funciona em **modo demonstração**: tudo fica só no aparelho onde a abres.

---

## Passo 1 — Criar o Firebase (uma vez, ~10 minutos)

1. Entra em <https://console.firebase.google.com> com a tua conta Google e carrega em **Criar projeto**. Nome: `carrinho-barrocas`. Podes desligar o Google Analytics.
2. **Segurança → Authentication** → *Método de login* → **Adicionar novo provedor** → **Google** → ativar, escolher o email de suporte → Salvar.
   Cada pessoa entra com a sua conta Google: fica reconhecida em qualquer telemóvel. Para entrar num grupo precisa também do código.
3. **Firestore Database** → *Criar base de dados* → localização **eur3 (Europa)** → começa em *modo de produção*.
4. Ainda no Firestore, separador **Regras**: apaga o que lá está, cola o conteúdo de `firestore.rules` e carrega em **Publicar**.
5. Na roda dentada ⚙️ → **Definições do projeto** → em *As tuas apps* carrega no ícone **`</>`** (Web) → nome `Carrinho` → Registar.
   Aparece um bloco `const firebaseConfig = { ... }`. Copia só o que está entre as chavetas.
6. Abre `config.js` e troca `export const firebaseConfig = null;` por:

   ```js
   export const firebaseConfig = {
     apiKey: "…",
     authDomain: "…",
     projectId: "…",
     storageBucket: "…",
     messagingSenderId: "…",
     appId: "…"
   };
   ```

> A `apiKey` do Firebase não é secreta: identifica o projeto. Quem protege os dados são as regras do passo 4.

## Passo 2 — Pôr a app online (GitHub Pages, sem instalar nada)

1. No GitHub cria um repositório novo, por exemplo `carrinho-barrocas` (pode ser público).
2. *Add file* → *Upload files* → arrasta **todo o conteúdo desta pasta** (com a pasta `icons`) → *Commit*.
3. *Settings* → *Pages* → *Source*: **Deploy from a branch** → branch `main`, pasta `/ (root)` → Save.
4. Passado um minuto a app fica em `https://<o-teu-utilizador>.github.io/carrinho-barrocas/`.
5. Volta ao Firebase → **Authentication** → *Settings* → **Domínios autorizados** → *Adicionar domínio* → `<o-teu-utilizador>.github.io`.

(Alternativa: Firebase Hosting com `firebase deploy`, se preferires o endereço `carrinho-barrocas.web.app`. Precisa de Node.js no computador.)

## Passo 3 — Começar a usar

1. Abre o link no teu telemóvel → escreve o teu nome → **Criar um grupo novo** → `Condomínio Barrocas`.
   A app carrega os 153 produtos e fica tudo pronto.
2. Instala no ecrã principal:
   - **Android (Chrome)**: menu ⋮ → **Instalar app**.
   - **iPhone (Safari)**: botão **Partilhar** → **Adicionar ao ecrã principal**.
3. Separador **Grupo** → **Enviar convite** (WhatsApp, por exemplo). O convite leva o link e o código.
   Quem o recebe abre o link, instala, entra com a conta Google, escreve o nome e o código (ex.: `BAR-7KQ9-X2MP`).

## Como se usa

- **Nova lista** → dá-lhe um nome (ex.: *Dezembro*). Pode começar com os produtos da lista anterior, com as quantidades a zero.
- Na lista, o **+** abre os produtos por secção, os mais comprados primeiro. Tocas nos que queres e carregas em **Adicionar**. Os que já estão na lista aparecem com "Na lista".
- Em cada produto: **− / +** (ou escreve a quantidade) e o **✓** quando já está no carrinho. O ✓ mostra quem o marcou.
- No topo: **número de itens**, **valor previsto** e quanto já está no carrinho.
- **Desliza para a esquerda** para tirar um produto da lista, apagar uma lista ou editar/apagar um produto da base. Apagar **pede sempre confirmação**.
- Ícone do PDF (ou ⋮) → **Exportar PDF** (escolhe *Guardar como PDF*) ou **Enviar como texto** para o WhatsApp.
- Separador **Grupo**: código e QR para convidar, **Novo código**, tirar pessoas (só quem criou o grupo).

## Segurança

- Só quem entrou com uma conta Google **e** está no grupo lê ou escreve listas e produtos (regras do Firestore).
- Os códigos de convite têm 8 caracteres aleatórios e não podem ser listados.
- Fica no plano **Spark** (gratuito, sem cartão): nunca há custos.
- Recomendado: limitar a chave à tua página. Google Cloud Console → *APIs e serviços* → *Credenciais* → *Browser key* → **Restrições de aplicações: Referenciadores HTTP** → `https://zecanilis.github.io/*` e `https://carrinho-barrocas.firebaseapp.com/*` → Guardar.

## Notas

- Funciona sem rede (por exemplo dentro do supermercado) e sincroniza quando a rede volta.
- O plano gratuito do Firebase (Spark) chega bem para uma família.
- Se mudares algum ficheiro, basta voltar a fazer upload no GitHub; os telemóveis apanham a versão nova da próxima vez que abrirem a app com rede.
- Se alguém sair do grupo ou apagar os dados do browser, volta a entrar com o código.
