# RestaurantOS - Docker Image
# Uses lightweight Nginx Alpine to serve the static site
FROM nginx:alpine

# Remove default Nginx placeholder page
RUN rm -rf /usr/share/nginx/html/*

# Copy all app files into Nginx's web root
COPY . /usr/share/nginx/html

# Copy custom Nginx config (handles routing + caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
