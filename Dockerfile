FROM node:20-alpine
WORKDIR /app

# Copia os arquivos de configuração de pacotes
COPY package*.json ./

# Instala todas as dependências (incluindo as de desenvolvimento para fazer o build)
RUN npm install

# Copia o restante do código fonte
COPY . .

# Compila o TypeScript usando o tsup e gera a pasta dist/
RUN npm run build

# Porta exposta pelo container
EXPOSE 3000

# Inicia o servidor usando a build otimizada
CMD ["npm", "start"]
