# 简介
LambdaLens 是一个可视化函数式语言解释器与类型推导系统。
它包含：
- 一个迷你函数式语言（λ 演算 + let + if + 基本类型）
- Hindley–Milner 类型推导（算法 W）
- β-归约过程可视化
- 类型推导树可视化
- 惰性求值与严格求值对比

# For Dev
## 第一步， 安装 Haskell 工具链 (GHCup)
### For Linux / WSL2

```bash
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
```

### For Windows

```pwsh
Set-ExecutionPolicy Bypass -Scope Process -Force;[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; try { & ([ScriptBlock]::Create((Invoke-WebRequest https://www.haskell.org/ghcup/sh/bootstrap-haskell.ps1 -UseBasicParsing))) -Interactive -DisableCurl } catch { Write-Error $_ }
```

或安装WLS2(**W**indows **S**ubsystem For **L**inux)，而后使用上面的工具链安装步骤

## 第二步，clone项目
### 使用git
```bash
git clone https://github.com/X12101XX/lambdaLens.git
```
### 使用github cli
```bash
gh repo clone X12101XX/lambdaLens
```
### 当然，你也可以使用github desktop来clone项目

## 第三步，进行开发

## 运行项目

### 使用 cabal进行编译
```bash
cabal build
cabal run lambdaLen
```
