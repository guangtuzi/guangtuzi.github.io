# 爆炸糖先生的博客 / Mr. Poprocks' Blog

一个基于 [Hexo](https://hexo.io/) 的技术博客，使用自定义 `terminal-canvas` 主题，并通过 GitHub Actions 自动发布到 GitHub Pages。

## 本地开发

需要 Node.js 20.19 或更高版本（CI 固定使用 Node.js 24 LTS）。

```bash
npm install
npm run serve
```

浏览器访问 `http://localhost:4000`。修改文章后，Hexo 会自动重新生成页面。

## 写一篇文章

在线管理后台：<https://www.poppinglab.com/admin/>

后台使用 GitHub 访问令牌登录，直接管理 `hexo-source` 分支。第一次进入时选择“使用令牌登录”，按照页面提供的 GitHub 链接创建令牌并粘贴；令牌只保存在当前浏览器中，不要写入仓库或发送给他人。后台支持中文文章、英文文章、关于页面和图片上传，保存后会自动触发发布流程。

也可以继续使用本地命令：

```bash
npm run new -- post "my-new-post"
```

文章会生成在 `source/_posts/`。建议使用英文文件名作为稳定 URL，在 front matter 中填写中文标题、分类、标签和摘要。

## 构建与发布

```bash
npm run build
```

静态文件输出到 `public/`。仓库使用两个分支，适配现有 GitHub Pages 设置：

- `hexo-source`：Hexo 源码和文章，日常只在这里编辑。
- `main`：自动生成的静态站点，GitHub Pages 直接从这里发布，不要手工编辑。

推送到 `hexo-source` 后，`.github/workflows/publish.yml` 会用 Node.js 24 构建站点，并把 `public/` 同步到 `main`。无需提交本地 `public/`，也不需要保存个人访问令牌。

## 常用配置

- 网站信息与 URL：`_config.yml`
- 主题选项：`themes/terminal-canvas/_config.yml`
- 文章：`source/_posts/`
- 独立页面：`source/about/`、`source/404.md`
- 样式与交互：`themes/terminal-canvas/source/`

> 如果仓库不是 `guangtuzi.github.io`，请同时修改 `_config.yml` 中的 `url` 和 `root`，否则静态资源路径会出错。

生产域名为 <https://www.poppinglab.com>；`source/CNAME` 会随构建产物发布到 `main`，不要删除。

原站点的 BebiWhy 法律页面已原样保留在 `/privacy.html` 与 `/terms.html`；不要在博客改版时删除这两个稳定 URL。
