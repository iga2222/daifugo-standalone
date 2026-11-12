# 大富豪 スタンドアロン版 — Render の Web Service（Docker）用
FROM oven/bun:1

WORKDIR /app

# 依存関係だけ先に入れると、コード変更時の再ビルドが速くなります
COPY package.json ./
RUN bun install

COPY . .
RUN bun run build

ENV NODE_ENV=production
# 待ち受けポートは Render が環境変数 PORT で渡します（サーバーは PORT を読みます）
EXPOSE 3000

CMD ["bun", "run", "start"]
