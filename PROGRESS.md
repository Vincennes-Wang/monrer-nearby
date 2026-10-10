# PROGRESS
- 状态：已完成
- 当前阶段：阶段 2 完成，真机测试通过
- 累计用时：2
- 线上地址：https://vincennes-wang.github.io/monrer-nearby/

## 最近一次工作（2026-10-10）
- 完成：
  - CLAUDE.md 开头加入 3 行 `@~/vibe-playbook/...` 引用（用户修改，Claude 验证后提交）。
  - CLAUDE.md 协作规则和交接清单与 playbook 模板对齐（加入读经验日志、修两次未解决回 Claude.ai、“发给 Claude.ai”改为可选）。
  - 用户真机测试（结果见下）。
  - README 加入“Utilisation sur iPhone”：开启 Safari 网站定位、本站设为“允许”、添加到主屏幕。
  - 测试命令改为 `node --test tests/*.test.mjs`（目录形式 `node --test tests/` 在 Node 22 上失败）。README、CLAUDE.md、本文件同步修改。
- 验证结果：
  - CLAUDE.md 引用的 3 个文件在 `~/vibe-playbook/` 中存在，本次会话已成功加载其内容。
  - 脚本比对：playbook 模板代码块与 CLAUDE.md 开头逐字一致。
  - `node --test tests/*.test.mjs`：5/5 通过（Node v26.10.0）。
  - 用户真机测试：
    - iPhone Safari / Chrome：最初定位被直接拒绝、没有弹窗，原因是 iOS“定位服务”设置。开启后弹窗出现一次，之后不再询问，定位和跳转正常。
    - 主屏幕图标：正常。点击图标会重新定位并跳转（代替“刷新”）。
    - 从 monrer.fr 返回不会回到倒计时页面。
    - 微信内置浏览器：正常。
  - 阶段 2 自动检查（上次）：`node scripts/browser_check.mjs` 4/4 通过，控制台错误 0；Pages 页面和 `data/stations.json` HTTP 200。

## 下次从这里继续
1. 无。项目已完成。如需更新车站数据：`.venv/bin/python scripts/build_stations.py --refresh`，然后运行测试和 `scripts/browser_check.mjs`。

## 未解决问题
- 4 个站无法对比 IDFM 坐标（IDFM 中该 ZdA 无 rail 点，现为 T12）：CAZ、GBI、LJU、PV。坐标来自 SNCF，不影响使用。
- 测试用的 5 个参考站（CLX、PLY、LDU、MVC、RSY）由 Claude 选定。
- Android Chrome 未做真机测试。
