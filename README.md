# 补习班拍照签到

前后端分离的本地签到应用。前端使用 Next.js，后端使用 FastAPI、SQLAlchemy 和 PostgreSQL；后端依赖由 `uv` 管理。

## 本地运行

1. 准备 PostgreSQL，并创建数据库 `check_in`。
2. 在 `backend/` 复制 `.env.example` 为 `.env`，按本地数据库和三个入口密码修改配置。
3. 启动 API：

   ```bash
   cd backend
   uv sync --group dev
   uv run alembic upgrade head
   uv run fastapi dev
   ```

   API 默认地址为 `http://localhost:8000`；数据库表由 Alembic 迁移创建。

4. 在 `frontend/` 复制 `.env.example` 为 `.env.local`，然后启动：

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. 浏览器打开 `http://localhost:3000`。摄像头仅可在 localhost 或 HTTPS 页面使用。

服务器首次部署可执行 `deploy/bootstrap-server.sh`。它会安装 PostgreSQL、创建 `checkin` 数据库用户、生成应用密码，并完成 systemd、Nginx 和迁移配置；生成的首次登录密码保存在服务器 `backend/INITIAL-CREDENTIALS.txt`，请立即妥善保存并删除该文件。

### 服务器首次接入

服务器上首次执行：

```bash
ssh myapp
git clone https://github.com/Lui-hhub/check-in.git ~/check-in
cd ~/check-in
bash deploy/bootstrap-server.sh
```

GitHub 仓库需要设置 Actions Secrets：`SSH_HOST`（服务器地址）和 `SSH_KEY`（可登录 `ubuntu` 的私钥）。之后推送 `main` 分支会先运行前后端检查，再通过 `deploy/deploy.sh` 更新服务器。域名当前沿用服务器已有的 `xn--btvt3a.online` 配置；切换完成后，旧 `tech-learn` 服务会被停用，但目录仍保留以便回滚。

人脸检测、关键点和识别权重已放入 `frontend/public/models/`，首次页面加载会从本地提供。学生和签到上传的照片均由后端验证并重新编码为最长边不超过 640px 的 JPEG。

## 功能

- 查看、签到、管理员入口使用独立环境变量密码，令牌有效期 8 小时。
- 管理员新增学生；年级、姓名、科目完全相同时，显示名称依次加 `-2`、`-3`。
- 管理员可以导入 `.xlsx` 学生名单，表头使用 `年级`、`姓名`、`补课科目`；导入后仍需逐个录入人脸照片。
- 管理员可以软删除学生；历史签到保留提交时的资料快照。
- 签到自动做人脸距离匹配，未识别时可以人工指定学生。
- 每个学生保留最近 10 次签到。
- JPEG 图片统一压缩至最长边 640px，质量 80。

## 测试

```bash
cd backend
uv run pytest
```
