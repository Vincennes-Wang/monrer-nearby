# PROGRESS
- 状态：进行中
- 当前阶段：阶段 2 完成（index.html 上线），待真机测试
- 累计用时：1
- 线上地址：https://vincennes-wang.github.io/monrer-nearby/

## 最近一次工作（2026-10-10）
- 完成：
  - `index.html`：定位 → 最近 3 站 → 2 秒后 `location.replace` 跳转 monrer.fr，可取消。
  - 不自动跳转的情况：精度 > 500 m（显示“Précision : ~1,2 km”）；最近站 > 5 km。两种情况都列出最近 3 站，点击后跳转。
  - 用户点击的车站链接也用 `location.replace()`，从 monrer.fr 返回不会重新倒计时。
  - 定位失败（拒绝、超时、不支持）：显示可搜索的全部车站列表（名称、代码、别名，忽略大小写和重音）。
  - 车站数据加载失败：显示错误和 monrer.fr 链接（无数据，无法列出车站）。
  - 页脚：SNCF（ODbL）、IDFM（Licence Ouverte v2.0）、monrer.fr by x0r、“非 monrer.fr 官方”。
  - `tests/geo.test.mjs`、`scripts/browser_check.mjs`（headless Chrome + CDP，只用 Node 内置模块）。
  - 开启 GitHub Pages（main 分支，根目录）。
- 验证结果：
  - `node --test tests/`：5/5 通过。CLX、PLY、LDU、MVC、RSY、AUU、HSL 各自坐标返回本站；AUU–HSL 距离 281 ± 5 m；`shouldRedirect` (20, 4999) true、(20, 5001) false、(501, 100) false、(500, 100) true。
  - `node scripts/browser_check.mjs`：4/4 场景通过，加入重试后连续 4 次通过（加重试前 1 次因跨域跳转时读历史记录报错中断），控制台错误 0；所有发往 monrer.fr 的请求都被拦截。
    - CLX 精度 20 m → 2059–2092 ms 后跳转 `?s=CLX`，历史记录条数不变（2→2）。
    - AUU 精度 1200 m → 4 秒无跳转，显示“Précision : ~1,2 km”，3 个链接；点击 → `?s=AUU`，历史记录 2→2。
    - 里昂（45.7640, 4.8357）→ 无跳转，最近站 Laroche – Migennes ~264,2 km。
    - 拒绝定位 → 搜索列表 468 站，输入“auber”得到 3 个结果，含 Auber。
    - 对照实验：把 `replace` 改成 `assign` 后，历史记录变成 2→3，检查失败。说明这项检查有效。
  - Pages：页面 HTTP 200；`data/stations.json` HTTP 200，54 447 B，与本地一致。

## 下次从这里继续
1. 手机真机测试（iOS Safari、Android Chrome）：定位授权弹窗、精度、跳转、返回键行为。
2. 根据真机结果调整 500 m / 5 km 阈值或界面文字。

## 未解决问题
- 4 个站无法对比 IDFM 坐标（IDFM 中该 ZdA 无 rail 点，现为 T12）：CAZ、GBI、LJU、PV。坐标来自 SNCF，不影响使用。
- 测试用的 5 个参考站（CLX、PLY、LDU、MVC、RSY）由 Claude 选定，仓库中原来没有指定。
- 真实 GPS 精度和移动端浏览器行为只能真机验证。
