# --- Estágio 1: Construção (Build) ---
# Usamos uma imagem oficial do Maven com Java 17 para compilar o nosso projeto.
# Isto mantém o nosso ambiente de construção limpo e consistente.
FROM maven:3.8.5-openjdk-17 AS build

# Define o diretório de trabalho dentro do contentor.
WORKDIR /app

# Copia primeiro o ficheiro pom.xml para aproveitar o cache de camadas do Docker.
# Se as dependências não mudarem, o Docker não as descarregará novamente.
COPY pom.xml .

# Descarrega todas as dependências do projeto.
RUN mvn dependency:go-offline

# Copia o resto do código-fonte do nosso projeto.
COPY src ./src

# Executa o comando do Maven para compilar o projeto e empacotá-lo num ficheiro .jar.
# O -DskipTests acelera a construção ao não executar os testes.
RUN mvn package -DskipTests


# --- Estágio 2: Execução (Runtime) ---
# Usamos uma imagem Java muito mais leve, que contém apenas o necessário para executar a aplicação.
# Isto resulta numa imagem final muito mais pequena e segura.
FROM eclipse-temurin:17-jre-jammy

# Define o diretório de trabalho.
WORKDIR /app

# Instala ferramentas de desenvolvimento para execução no terminal
# Python, Node.js, gcc, g++, e outras ferramentas comuns
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    gcc \
    g++ \
    make \
    bsdutils \
    && rm -rf /var/lib/apt/lists/*

# Cria links simbólicos para conveniência (python em vez de python3)
RUN ln -s /usr/bin/python3 /usr/bin/python

# Copia o ficheiro .jar que foi gerado no estágio de construção para a nossa imagem final.
# O nome do .jar é baseado no artifactId e version definidos no pom.xml.
# O wildcard (*) ajuda a apanhar o nome correto sem o especificarmos manualmente.
COPY --from=build /app/target/*.jar app.jar

# Expõe a porta em que a nossa aplicação Spring vai correr dentro do contentor.
# Nota: Isto não publica a porta para a nossa máquina, apenas a expõe.
# As portas 8080, 8081, 8082 serão definidas no docker-compose.
EXPOSE 8080

# O comando que será executado quando o contentor iniciar.
# Ele simplesmente executa a nossa aplicação Java.
ENTRYPOINT ["java", "-jar", "app.jar"]
