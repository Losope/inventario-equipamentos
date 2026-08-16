# Como publicar no GitHub Pages

## 1. Criar conta
Acesse https://github.com/signup e crie uma conta gratuita (e-mail + senha).

## 2. Criar o repositório
1. Clique no **+** no canto superior direito → **New repository**
2. Nome sugerido: `inventario-equipamentos`
3. Marque como **Public**
4. Clique em **Create repository**

## 3. Enviar os arquivos (sem precisar instalar nada)
1. Na página do repositório recém-criado, clique em **uploading an existing file** (ou **Add file → Upload files**)
2. Arraste todos os arquivos desta pasta: `index.html`, `app.js`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`
3. Role para baixo e clique em **Commit changes**

## 4. Ativar o GitHub Pages
1. No repositório, vá em **Settings** (aba no topo)
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione a branch **main** e a pasta **/ (root)**
4. Clique em **Save**
5. Aguarde 1–2 minutos e atualize a página — vai aparecer o link, algo como:
   `https://SEU-USUARIO.github.io/inventario-equipamentos/`

## 5. Instalar no celular
- **Android (Chrome)**: abra o link → menu (⋮) → "Adicionar à tela inicial" / "Instalar app"
- **iOS (Safari)**: abra o link → botão de compartilhar (□↑) → "Adicionar à Tela de Início"

## Sobre os dados
Os dados (equipamentos, pessoas, histórico) podem ficar salvos de duas formas:
- **Sem planilha configurada** (padrão): salvos só no navegador de cada aparelho — use os botões 💾 Backup / 📂 Restaurar para levar de um aparelho pro outro.
- **Com planilha configurada** (veja abaixo): todos os aparelhos veem os mesmos dados, atualizados automaticamente.

## Deixando os dados compartilhados via Google Sheets

### 1. Criar a planilha
1. Acesse https://sheets.google.com e crie uma planilha em branco
2. Dê um nome, ex: "Inventário de Equipamentos — Dados"

### 2. Adicionar o backend (Apps Script)
1. No menu da planilha: **Extensões → Apps Script**
2. Apague todo o conteúdo padrão que aparece (`function myFunction() {}`)
3. Abra o arquivo `Code.gs` (que veio junto com este pacote), copie todo o conteúdo e cole no editor
4. Na linha `const TOKEN = "TROQUE-ESTE-TOKEN-123";`, troque por uma senha/token só sua (qualquer texto, sem espaços)
5. Clique no ícone de disquete 💾 para salvar (Ctrl+S / Cmd+S)

### 3. Publicar como App da Web
1. Clique em **Implantar → Nova implantação**
2. No ícone de engrenagem ⚙️ ao lado de "Selecionar tipo", escolha **App da Web**
3. Em "Executar como": **Eu (seu e-mail)**
4. Em "Quem pode acessar": **Qualquer pessoa**
5. Clique em **Implantar**
6. Na primeira vez, o Google vai pedir autorização — clique em **Autorizar acesso**, escolha sua conta, e se aparecer um aviso de "app não verificado", clique em **Avançado → Acessar (nome do projeto), não seguro** (é seguro, é o seu próprio script)
7. Copie o link que aparece, terminado em `/exec`

### 4. Conectar o app à planilha
1. Abra o arquivo `app.js` (deste pacote) em qualquer editor de texto
2. Localize a linha `const PLANILHA_URL = "COLE_AQUI_O_LINK_DO_APPS_SCRIPT";` (perto do topo) e cole o link do passo anterior no lugar do texto entre aspas
3. Localize `const PLANILHA_TOKEN = "TROQUE-ESTE-TOKEN-123";` e coloque o **mesmo token** que você definiu no `Code.gs`
4. Suba o `app.js` atualizado no GitHub (substituindo o antigo, mesmo nome)
5. Suba também um `sw.js` com a versão de cache atualizada, se eu tiver te enviado um

Pronto — a partir daí, qualquer pessoa que abrir o app (em qualquer aparelho) vai ler e gravar na mesma planilha. As abas **"Equipamentos"** e **"Pessoas"** dentro da planilha são atualizadas automaticamente a cada gravação, só para você acompanhar visualmente — não edite essas abas diretamente, pois elas são recriadas do zero a cada sincronização (o dado "de verdade" fica numa aba técnica oculta chamada "Dados").

### Limitações a saber
- Se duas pessoas confirmarem uma conferência no mesmo instante exato, a última a salvar prevalece (chance bem baixa de acontecer no uso normal).
- Sem internet, o app continua funcionando com os últimos dados baixados, e sincroniza de novo assim que a conexão voltar.


## Sobre a senha de cadastro
A senha padrão do botão "Cadastrar equipamento" é `1234`, definida no início do arquivo `app.js` (`CADASTRO_SENHA`). Para trocar, edite esse arquivo diretamente pelo GitHub (ícone de lápis na página do arquivo) e publique novamente.

## Atualizações futuras
Sempre que eu enviar uma nova versão dos arquivos, é só repetir o passo 3 (upload) substituindo os arquivos antigos — o GitHub Pages atualiza sozinho em 1–2 minutos.
