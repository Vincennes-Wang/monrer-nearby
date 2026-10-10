# PROGRESS
- 状态：进行中
- 当前阶段：阶段 1 完成（data/stations.json），阶段 2（index.html）未开始
- 累计用时：约 0.7
- 线上地址：

## 最近一次工作（2026-10-10）
- 完成：
  - `scripts/build_stations.py` 生成 `data/stations.json`（468 站）和 `data/unmatched.txt`（8 个代码）。
  - 匹配方式：monrer 代码 → rer-web `pa_id` → UIC8 → SNCF 坐标；无 SNCF 结果时用 IDFM `arrets` rail 坐标。不用 trigramme 单独匹配（8 个代码会配错站）。
  - 移除 monrer.fr 返回 404 的 8 个代码（无 TRAIN 行）：NC9、ND0、NC8、SSJ、SGM、BEL、MPJ、NIO。
  - CLAUDE.md 加入协作规则；README 写明数据来源和许可证。
- 验证结果：
  - 488 个 monrer 代码 → 476 个 `pa_id`（12 个别名代码）→ 411 SNCF + 57 IDFM + 8 移除。无坐标的有效代码：0。
  - IDFM 与 SNCF 坐标对比 407/411 站：中位数 54 m，p95 150 m，最大 348 m，无 > 1 km。
  - 用户实测：8 个移除代码在 monrer.fr 全部返回 404。

## 下次从这里继续
1. 阶段 2：写 `index.html`（定位、最近 3 站、2 秒跳转、取消、失败时可搜索列表、页脚署名）。
2. 写 `tests/geo.test.mjs`，运行 `node --test tests/`。
3. 用 `python3 -m http.server` 和本机 headless Chrome 检查页面无报错。

## 未解决问题
- 4 个站无法对比 IDFM 坐标（IDFM 中该 ZdA 无 rail 点，现为 T12）：CAZ、GBI、LJU、PV。坐标来自 SNCF，不影响使用。
- GitHub Pages 尚未开启。
