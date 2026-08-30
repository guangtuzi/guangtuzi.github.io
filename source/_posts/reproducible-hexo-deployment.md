---
title: 让 Hexo 发布变得可复现：从本地命令到 GitHub Actions
lang: zh-CN
translation: /en/posts/reproducible-hexo-deployment/
date: 2026-08-27 19:30:00
updated: 2026-08-28 18:00:00
categories:
  - 工程实践
tags:
  - Hexo
  - GitHub Actions
  - CI/CD
description: 不提交 public 目录，也不维护 gh-pages 分支；用锁文件和官方 Pages Actions 建立一条稳定、可审计的发布流水线。
featured: true
---

一个静态博客的部署不应该依赖“某台电脑上刚好能运行”的环境。理想状态是：任何人拿到仓库，都能用同一条命令得到相同结构的站点；每次发布都能追溯到一次明确的提交。

这篇文章以 Hexo 和 GitHub Pages 为例，拆解一条足够简单、又适合长期维护的发布链路。

<!-- more -->

## 先确定构建边界

仓库只保存三类东西：

- Markdown 内容与静态资源
- Hexo、主题和插件的配置
- 依赖锁文件与 CI 工作流

构建结果 `public/` 不进入 Git。它可以由源码重新生成，提交它只会制造重复历史和合并冲突。

```gitignore
node_modules/
public/
db.json
```

## 锁定依赖，而不是锁定某台电脑

本地第一次安装使用 `npm install`，并提交生成的 `package-lock.json`。CI 则使用：

```bash
npm ci
npm run build
```

`npm ci` 会严格按照锁文件安装依赖；如果 `package.json` 和锁文件不一致，它会直接失败。这种失败很有价值，因为它把不一致暴露在发布之前。

`package.json` 里只需要保留一条清晰的构建入口：

```json
{
  "scripts": {
    "build": "hexo clean && hexo generate"
  }
}
```

先清理旧产物，可以避免被 Hexo 缓存或已经删除的页面干扰结果。

## 让 Actions 只做三件事

一条易于理解的流水线通常比“聪明”的流水线更可靠：

1. 安装锁定的依赖；
2. 生成 `public/`；
3. 将它作为 Pages artifact 部署。

```yaml
- uses: actions/setup-node@v7
  with:
    node-version: 24
    cache: npm
- run: npm ci
- run: npm run build
- uses: actions/upload-pages-artifact@v5
  with:
    path: ./public
```

部署任务使用 GitHub 提供的短期身份令牌，不需要在仓库里保存个人访问令牌，也不需要额外维护 `gh-pages` 分支。

## 配置最常见的错误：`root`

GitHub Pages 有两种常见地址：

- 用户站点：`https://user.github.io/`，对应 `root: /`
- 项目站点：`https://user.github.io/repository/`，对应 `root: /repository/`

如果 `root` 写错，HTML 往往能打开，但 CSS、JavaScript 和文章链接会全部指向错误位置。主题中的静态资源应该统一经过 Hexo 的 `url_for()` 处理，而不是手写绝对路径。

## 发布前做一个最小验证

本地执行构建后，至少检查：

```bash
npm run build
npx hexo server
```

- 首页、文章页和 404 页是否生成；
- CSS、JavaScript、favicon 是否返回 200；
- `sitemap.xml` 和 `atom.xml` 是否存在；
- 页面内是否残留本机路径或开发地址；
- 移动端菜单、深浅色切换和代码复制是否可用。

## 结论

可复现部署的核心不是堆叠工具，而是缩小隐含状态：用锁文件固定依赖，用单一命令定义构建，用短期令牌完成部署，并让生成结果随时可以丢弃和重建。

当发布流程足够无聊，写作者才可以把注意力还给内容。
