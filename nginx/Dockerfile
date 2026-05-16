# Pre-built frontend — dist/ was built on the host and copied here before docker build
FROM nginx:1.27-alpine

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY Front/dist /var/www/clause
COPY nginx/certs /etc/nginx/certs

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
