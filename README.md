# lambdaLens

LambdaLens 是一个可视化函数式语言解释器与类型推导系统，其包含
- 一个迷你函数式语言 (lambda 演算 + let + if + 基本类型)
- Hindley–Milner 类型推导（算法 W）
- β-归约过程可视化
- 类型推导树可视化

## 项目结构
```
src/LambdaLens/
├── Syntax.hs      # AST 定义（Expr, Type, Value）
├── Parser.hs      # Megaparsec 解析器
├── TypeInfer.hs   # HM 类型推导（算法 W）
├── Eval.hs        # 大步语义求值器 (用于直接求值)
├── Stepper.hs     # 单步规约追踪
├── Visualize.hs   # 可视化输出
├── Error.hs       # 错误类型
└── Api.hs         # HTTP JSON API（Scotty）
```

## Api 
在启动服务器后，提供了以下接口：
- `POST /api/trace`
- `POST /api/eval`
- `POST /api/typecheck`

### 实例

#### `POST /api/trace` — 单步规约追踪

##### 请求：
```json
{ "expr": "(\\x -> x + 1) 3" }
```

##### 响应
```json
{
  "steps": [
    { "index": 0, "expr": "((\\x -> x + 1)) 3", "rule": null },
    { "index": 1, "expr": "3 + 1", "rule": "β-reduction: x" },
    { "index": 2, "expr": "4", "rule": "δ-reduction: +" }
  ],
  "type": "Int"
}
```

#### `POST /api/typecheck`

##### 请求：
```json
{ "expr": "(\\x -> x + 1) 3" }
```

##### 响应
```json
{ "type": "Int" }
```
#### `POST /api/eval` — 求值

##### 请求：
```json

{ "expr": "(\\x -> x + 1) 3" }
```
##### 响应：
```json
{ "value": "4", "type": "Int" }
```

#### 错误响应

所有接口在失败时返回 HTTP 400：
```json
{ "error": "Cannot unify Int with Bool" }
```

## For Dev
### 第一步，安装 Haskell 工具链 (GHCup)
#### Linux / WSL2
```bash
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
```

#### Windows
```pwsh
Set-ExecutionPolicy Bypass -Scope Process -Force;[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; try { & ([ScriptBlock]::Create((Invoke-WebRequest https://www.haskell.org/ghcup/sh/bootstrap-haskell.ps1 -UseBasicParsing))) -Interactive -DisableCurl } catch { Write-Error $_ }
```

或安装 WSL2（Windows Subsystem for Linux），再使用上面的 Linux 安装步骤。
### 第二步，clone 项目
```bash

# git
git clone https://github.com/X12101XX/lambdaLens.git

# 或 GitHub CLI
gh repo clone X12101XX/lambdaLens
```

也可以使用 GitHub Desktop 来 clone。

### 第三步，构建与运行

```bash
cabal build
cabal run lambdaLens
```

服务器启动后监听 http://localhost:3000。
### 第四步，测试 API

```bash
# 单步追踪
curl -s -X POST http://localhost:3000/api/trace \
  -H "Content-Type: application/json" \
  -d '{"expr": "(\\x -> x + 1) 3"}'

# 类型推导
curl -s -X POST http://localhost:3000/api/typecheck \
  -H "Content-Type: application/json" \
  -d '{"expr": "\\x -> x + 1"}'

# 求值
curl -s -X POST http://localhost:3000/api/eval \
  -H "Content-Type: application/json" \
  -d '{"expr": "(\\x -> x + 1) 3"}'
```