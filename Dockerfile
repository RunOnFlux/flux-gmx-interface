FROM node:16-slim

WORKDIR /app
COPY . /app

RUN apt-get update && apt-get install -y git
RUN yarn install

RUN yarn run build
RUN yarn add serve

CMD yarn serve -s build
EXPOSE 3000
