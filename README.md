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

人脸检测、关键点和识别权重已放入 `frontend/public/models/`，首次页面加载会从本地提供。学生和签到上传的照片均由后端验证并重新编码为最长边不超过 640px 的 JPEG。

## 功能

- 查看、签到、管理员入口使用独立环境变量密码，令牌有效期 8 小时。
- 管理员新增学生；年级、姓名、科目完全相同时，显示名称依次加 `-2`、`-3`。
- 管理员可以软删除学生；历史签到保留提交时的资料快照。
- 签到自动做人脸距离匹配，未识别时可以人工指定学生。
- 每个学生保留最近 10 次签到。
- JPEG 图片统一压缩至最长边 640px，质量 80。

## 测试

```bash
cd backend
uv run pytest
```
