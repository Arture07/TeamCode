# CodeSync

CodeSync é uma plataforma avançada de colaboração de código em tempo real, projetada com uma arquitetura de microsserviços. A aplicação permite que desenvolvedores criem sessões de codificação, editem arquivos simultaneamente, executem comandos em um terminal integrado e utilizem assistência de IA integrada.

## Arquitetura do Projeto

O projeto é dividido em quatro componentes principais e um banco de dados relacional, todos orquestrados via Docker Compose:

1. **Frontend (React + Vite)**: Interface do usuário construída com React. Utiliza o **Monaco Editor** para edição de código avançada, **Xterm.js** para emulação de terminal e **StompJS/SockJS** para comunicação em tempo real via WebSockets.

2. **User Service (Java/Spring Boot)**: Gerencia o cadastro, autenticação de usuários e a emissão de tokens JWT. Utiliza **Flyway** para migrações do banco de dados.

3. **Session Service (Java/Spring Boot)**: Gerencia o ciclo de vida das sessões de codificação (criação, listagem e encerramento dos projetos). Interage com a API do **Google Gemini** para fornecer assistência de código por IA.

4. **Sync Service (Java/Spring Boot)**: Núcleo da colaboração em tempo real. Baseado em WebSockets, gerencia a sincronização de código entre os clientes em uma mesma sessão e controla o processamento de abas e terminais no host.

5. **PostgreSQL**: Banco de dados relacional compartilhado entre `user-service` e `session-service`.

## Pré-requisitos

Para executar o projeto, você precisará ter instalado em sua máquina:
- [Docker](https://www.docker.com/products/docker-desktop)
- [Docker Compose](https://docs.docker.com/compose/install/)

*(Nota: Como o projeto é executado usando o Docker Compose, não é estritamente necessário instalar o Java 17 ou Node.js localmente, as imagens Docker resolverão isso).*

## Configuração

Antes de rodar a aplicação, crie um arquivo chamado `.env` na raiz do projeto (no mesmo diretório de `docker-compose.yml`) com as seguintes variáveis de ambiente:

```env
# Banco de Dados
POSTGRES_DB=codesync_db
POSTGRES_USER=codesync_user
POSTGRES_PASSWORD=sua_senha_super_secreta

# Autenticação (User Service)
JWT_SECRET=uma_chave_secreta_muito_longa_e_segura_para_gerar_os_tokens_jwt

# Inteligência Artificial (Session Service)
GEMINI_API_KEY=sua_chave_de_api_do_google_gemini
GEMINI_MODEL=gemini-3.7-flash # Opcional, o padrão é gemini-3.7-flash
```

## Como Executar

### Opção 1: Produção / Nuvem / VM (Recomendado — Ultrarrápido via CI/CD)

Com a esteira de **GitHub Actions** configurada, todas as imagens (`frontend`, `user-service`, `session-service`, `sync-service`) são compiladas e publicadas automaticamente no **GitHub Container Registry (GHCR)** a cada `git push`.

Na sua VM ou servidor de produção, **você não precisa esperar nada compilar**. Basta baixar as imagens prontas e subir em ~10 segundos:

```bash
# 1. Puxar as imagens pré-compiladas do GHCR
docker compose pull

# 2. Iniciar todos os serviços em segundo plano
docker compose up -d
```

---

### Opção 2: Desenvolvimento Local (Compilação Local)

Se você estiver desenvolvendo na sua máquina local e quiser compilar o código-fonte modificado localmente:

```bash
# Compilar e subir os contêineres a partir do código-fonte local
docker compose up -d --build
```

---

### Comandos Úteis do Docker Compose

```bash
# Visualizar status e saúde de todos os contêineres
docker compose ps

# Visualizar logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f user-service

# Parar a aplicação mantendo os dados
docker compose stop

# Reiniciar um serviço específico
docker compose restart frontend

# Parar e remover os contêineres (volumes persistem)
docker compose down

# Destruir contêineres e volumes de dados (Cuidado: apaga banco de dados)
docker compose down -v
```

## Como Executar sem Docker (Manualmente)

Se desejar executar o projeto localmente sem o Docker, siga as etapas abaixo:

### 1. Pré-requisitos Locais
- **Java 17** ou superior
- **Node.js** (v18+) e **npm**
- **PostgreSQL** instalado e executando na porta `5432`

### 2. Configuração do Banco de Dados
Crie um banco de dados vazio e configure de acordo com suas credenciais nos arquivos `src/main/resources/application.properties` correspondentes de `user-service` e `session-service`.
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/codesync_db
spring.datasource.username=codesync_user
spring.datasource.password=sua_senha
```

### 3. Rodando os Microsserviços
Em terminais separados, navegue até a pasta de cada microsserviço e execute-o com o wrapper do Maven:

**User Service:**
```bash
cd user-service
./mvnw spring-boot:run
```

**Session Service:**
```bash
cd session-service
./mvnw spring-boot:run
```

**Sync Service:**
```bash
cd sync-service
./mvnw spring-boot:run
```

### 4. Rodando o Frontend
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
O Vite subirá a aplicação (geralmente em `http://localhost:5173`).

## Como Usar

1. **Conta e Autenticação**: Acesse o Frontend via `http://localhost`, crie uma nova conta ou faça login. O token JWT será guardado no seu browser.
2. **Dashboard de Sessões**: Crie um novo workspace de codificação. Uma sessão será instanciada em que os arquivos estarão prontos para edição no navegador.
3. **Editor em Tempo Real**: Na tela principal do editor, você pode criar pastas e novos códigos. Abra várias instâncias do navegador para ver o código de um cliente replicando em tempo real nos outros.
4. **Terminal Integrado**: No rodapé da tela do editor ou nas abas do side-panel, abra um terminal virtual para rodar comandos como compilação, `npm` e execução de scripts na mesma sessão isolada usando `Xterm.js`.
5. **Assistente de IA**: Acesse a modal de assistente de IA configurada com os modelos do Gemini via o portal do frontend para sugerir códigos, documentações ou refatorações do arquivo em que está trabalhando.

## Estrutura de Diretórios

- `/frontend/` - Código fonte React/Vite.
- `/user-service/` - Microsserviço Spring Boot de controle de usuário.
- `/session-service/` - Microsserviço Spring Boot de gerenciamento de metadados das sessões e IA.
- `/sync-service/` - Microsserviço Spring Boot controlador da WebSocket (Sincronização do MonacoEditor + Terminais Ativos).
- `docker-compose.yml` - Arquivo de configuração de todos os contêineres e volumes da aplicação.