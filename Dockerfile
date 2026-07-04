FROM python:3.12-slim

WORKDIR /app

COPY . .

ENV MENU_HOST=0.0.0.0
ENV MENU_PORT=5178
ENV MENU_DATA_DIR=/data/menu-generator

EXPOSE 5178

CMD ["python", "server.py"]
