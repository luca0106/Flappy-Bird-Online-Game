# Folosește o imagine oficială Node.js ca bază
FROM node:18-alpine

# Setează directorul de lucru în container
WORKDIR /usr/src/app

# Copiază package.json și package-lock.json
COPY package*.json ./

# Instalează dependințele
RUN npm install

# Copiază restul codului sursă al aplicației
COPY . .

# Expune portul pe care rulează aplicația
EXPOSE 3000

# Comanda pentru a rula aplicația
CMD [ "node", "server.js" ]