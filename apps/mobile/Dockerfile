FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -- --configuration production --output-path=/app/front-dist \
    && mkdir -p /opt/contenu \
    && if [ -f /app/front-dist/browser/index.html ]; then \
         cp -a /app/front-dist/browser/. /opt/contenu/; \
       elif [ -f /app/front-dist/index.html ]; then \
         cp -a /app/front-dist/. /opt/contenu/; \
       else \
         echo 'index.html introuvable apres le build'; exit 1; \
       fi

FROM nginx:1.30-alpine
RUN apk add --no-cache ca-certificates gettext
ENV API_UPSTREAM=http://api:3000 \
    NGINX_SCHEME=http \
    NGINX_CLIENT_IP_SOURCE='$remote_addr'
COPY --from=build /opt/contenu/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "/usr/local/bin/entrypoint.sh"]
