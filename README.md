# TabMark (Internal)

## 项目说明
这是我们团队维护的书签新标签页扩展内部版本。

## 当前目标
- 稳定书签展示与交互体验
- 保持模块化小文件架构，便于后续迭代
- 完善自动化测试与回归流程

## 本地开发
1. 安装依赖：`npm install`
2. 在浏览器加载扩展目录：`/Users/mac/Documents/TabMark-Bookmark-New-Tab-master`
3. 执行检查：`npm run audit:imports`
4. 执行冒烟测试：`npx playwright test tests/newtab-smoke.spec.js --reporter=list`

## 目录约定
- `src/newtab/modules/`：新标签页模块化脚本
- `src/`：页面与样式资源
- `tests/`：自动化测试
- `tools/`：工程检查脚本

## 维护规范
请优先遵循仓库中的 [AGENTS.md](./AGENTS.md) 规则进行开发与重构。
