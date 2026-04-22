#import "@preview/hitec:0.1.0": *

#let (
  // Metadata
  title,
  author,
  company,
  confidential,
  date,
  double-sided,
  print,
  // Layouts
  doc,
  title-page,
  title-block,
) = documentclass(
  title: [LambdaLens],
  author: "王亦凡，任睿欣，杨倚",
  company: [数信学院],
  confidential: [#sym.bar.h 项目说明书 #sym.bar.h],
  date: datetime.today(),
  double-sided: true, // Enable double-sided printing
  print: true, // Add margins to binding side for printing
)

#show: doc

#title-block() // Title block without page break
// Use this instead if you want a separate title page
// #title-page()[/* Optional cover footnote */]

#set text(
  font: (
    "Noto Serif CJK SC",
  ),
  size: 12pt,
)

= 摘要

LambdaLens 是一个用于可视化 $lambda$ 演算，逐步进行 $beta-$规约过程的教学平台。项目采用了HM类型系统，支持多种数据类型和函数定义，且有良好的前端页面，适合用于$lambda$演算的教学与函数式编程的基本演示。

= 项目背景与意义

在编程语言的发展历程中，函数式语言占据了重要的地位，而$lambda$演算作为函数式编程的理论基础，对于理解函数式编程的核心概念至关重要。然而，$lambda$演算的抽象性常常使得初学者感到疑惑，尤其是对于现代基于含类型$lambda$演算的编程语言来说。因此，开发一个能够可视化$lambda$演算过程的教学平台，可以有效帮助老师开展教学，帮助学生更好的理解$lambda$演算的核心概念和规约过程。不仅如此，现代函数式编程语言的安装也是一些计算机基础薄弱的同学都难题，开发一个在线的Lambda演算平台，也能够帮助他们在不接触现代函数式编程语言繁重的工具链的情况下，高效的学习函数式编程。并且，国内互联网上对于Lamdba演算的资料较少，此项目也解决了现代$lambda$演算教学资源匮乏的问题，具有重要的教育意义和实用价值。

= 系统总体设计

== 系统架构图

#pagebreak()
#align(center)[
  #box(
    inset: 0.8em,
    stroke: 1pt + black,
    radius: 4pt,
    align(center)[用户输入（\x -> x）],
  )

  ↓

  #box(
    inset: 0.8em,
    stroke: 1pt + black,
    radius: 4pt,
    align(center)[Parser（解析器）],
  )

  ↓

  #box(
    inset: 0.8em,
    stroke: 1pt + black,
    radius: 4pt,
    align(center)[AST（抽象语法树）],
  )

  ↓

  #box(
    inset: 0.8em,
    stroke: 1pt + black,
    radius: 4pt,
    align(center)[Evaluator（β-归约引擎）],
  )

  ↓

  #box(
    inset: 0.8em,
    stroke: 1pt + black,
    radius: 4pt,
    align(center)[API（应用程序接口）],
  )

  ↓

  #box(
    inset: 0.8em,
    stroke: 1pt + black,
    radius: 4pt,
    align(center)[Frontend（前端界面）],
  )
]



== 模块说明
本系统采用分层模块化设计，将 $lambda$ 演算表达式的解析、抽象语法树构建、β‑归约执行、可视化渲染与前端交互解耦，形成清晰的技术结构。
=== Parser 模块
==== 功能
负责将用户输入的 $lambda$ 演算表达式解析成抽象语法树（AST）。支持基本的 $lambda$ 演算语法，包括变量、函数抽象和函数应用。
==== 内部实现
- 采用递归下降解析
- 支持变量、函数抽象、函数应用
- 处理括号优先级

=== AST 模块
==== 功能
定义 $lambda$ 表达式的内部表示结构，作为系统的核心中间层。

=== Evaluator 模块
==== 功能
实现 $beta$‑规约引擎，负责执行 $lambda$ 演算表达式的规约过程，使用应用序列策略进行求值。接受AST，输出规约后的AST。
==== 内部逻辑
- 支持正常序（Normal Order）归约策略
- 实现 α‑重命名避免变量捕获
- 实现替换（Substitution）算法

=== API 模块
==== 功能
为前端提供统一的 HTTP 接口，屏蔽内部实现细节。

提供接口包括：
- `/api/trace`：返回 $lambda$ 演算表达式的规约过程的详细步骤。
- `/api/typecheck`：提供类型检查服务，验证 $lambda$ 表达式的类型正确性。
- `/api/eval`：提供表达式求值服务，执行 $lambda$ 演算表达式的规约。

这三个API的请求题均是
```json
{ "expr": String }
```
而他们的响应体如下：
- `/api/trace`：
  ```json
  { "steps": [...], "type": String? }
  ```
- `/api/typecheck`：
  ```json
  { "type": String }
  ```
- `/api/eval`： ```json
  { "value": String, "type": String }
  ```

==== 设计理由
实现前后端分离，便于维护和扩展，同时也为未来可能的移动端或其他平台提供接口支持。

=== Frontend 模块

= 核心技术实现

== $lambda$ 演算语法

系统采用 Haskell 风格的 λ 演算具体语法（Concrete Syntax），支持变量、函数抽象与函数应用。
基本形式如下：

-变量（Variable）：`x`
- 抽象（Abstraction）：`\x -> e`
- 应用（Application）：`f x`
- 括号（Parentheses）：`f (g x)`用于显式指定优先级

== AST 定义

#pagebreak()

```Haskell
data Expr
  = EInt Int
  | EBool Bool
  | EVar String
  | ELam String Expr
  | EApp Expr Expr
  | ELet String Expr Expr
  | ELetRec String Expr Expr
  | EIf Expr Expr Expr
  | EBinOp Op Expr Expr
  deriving (Show, Eq)

data Op
  = Add
  | Sub
  | Mul
  | Div
  | Eq
  | Lt
  | Gt
  deriving (Show, Eq)

```
本项目并没有选择较为简单的AST定义，而是选择了一个较为复杂的AST定义，支持整数、布尔值、变量、函数抽象、函数应用、let表达式、递归函数定义、条件表达式以及二元操作。这是因为现代的$lambda$演算教学不仅仅局限于纯粹的函数抽象和应用，还需要涵盖更多的语言特性，以便更好地模拟现代函数式编程语言的特性，从而提高教学的实用性和针对性。

== $beta$‑规约算法
因为现代函数式编程语言多为严格求值，所以本项目采用了应用序列（Applicative Order）策略进行 $beta$‑规约。该策略先对函数和参数进行求值，然后再进行函数应用。

本项目的 $beta$‑规约算法实现了以下功能：
- 支持应用序列（Applicative Order）策略进行规约
- 实现 α‑重命名避免变量捕获
- 实现替换（Substitution）算法
- 支持递归函数的规约
- 支持条件表达式的规约
- 支持二元操作的规约
- 支持 let 表达式的规约
- 支持 letrec 表达式的规约
- 支持类型检查，确保表达式的类型正确性

核心算法为：替换（Substitution），可以用如下的$lambda$演算表达式来表示：
```bash
(λx. e1) e2  →  e1[x := e2]
```
== HM 类型推导（Algorithm W）\
=== 简述

系统实现了 Hindley-Milner（HM）类型系统的核心算法 —— Algorithm W，用于对 $lambda$ 表达式进行自动类型推导。HM 类型系统是现代函数式语言（如 Haskell、OCaml、ML）的理论基础。本系统的 HM 类型推导模块主要用于：验证用户输入的 $lambda$ 表达式是否类型正确，并在可能的情况下推导出其最泛类型。

HM类型系统有如下特点：
- 无需类型注解即可自动推导类型
- 支持多态（Let-Polymorphism）
- 能推导出表达式的最泛类型（Principal Type）

=== 类型系统定义：
```Haskell
data Type
  = TInt
  | TBool
  | TVar String
  | TFun Type Type
  deriving (Show, Eq)
```
系统支持以下类型构造：
- 基本类型：Int、Bool
- 类型变量：a、b、t1 等
- 函数类型：τ1 → τ2

除以上静态类型，系统也支持多态类型(Scheme):
```haskell
data Scheme = Forall [String] Type
```

=== Substitutable 类型类
为了统一处理类型变量替换，本系统实现了 Substitutable 类型类：
```haskell
class Substitutable a where
  apply :: Subst -> a -> a
  ftv   :: a -> Set String

```
该类型类支持：
- 对 Type、Scheme、TypeEnv 进行替换
- 计算自由类型变量（Free Type Variables）

这是 Algorithm W 的基础设施。

=== 替换（Substitution）与合一（Unification）

系统实现了 Robinson 合一算法，用于求解类型约束：

```haskell
unify :: Type -> Type -> Either String Subst
```

支持：
- 基本类型匹配
- 类型变量绑定（bind）
- 函数类型的递归合一
- 无限类型检查（Occurs Check）

替换组合使用：
```haskell
composeSubst :: Subst -> Subst -> Subst
```
用于合成多个替换，确保类型推导过程中替换的一致性。

=== 实例化与泛化
==== 实例化（Instantiation）
将多态类型 $forall$a. a $->$ a 转换为具体类型：
```haskell
instantiate :: Scheme -> Infer Type
```
=== 泛化（Generalization）
在 `let x = e1 in e2` 中，将 `e1` 的类型泛化为 `Scheme`：
```haskell
generalize :: TypeEnv -> Type -> Scheme
```
```haskell
x = \y -> y
```
对于上述表达式，得到的泛化类型为：
```haskell
x : ∀a. a → a
```

=== 模块价值

HM 类型推导模块为系统提供：

- 静态类型检查能力
- 自动类型推导能力
- 多态支持（Let-Polymorphism）
- 递归函数类型推导（LetRec）
- 与$lambda$演算归约引擎的深度结合

大幅度提升了系统的理论深度

= 数据结构设计
为了支持 λ 演算的解析、规约、类型推导与可视化，本系统设计了一套结构清晰、语义严谨的数据结构体系。本节将介绍系统中最核心的四类数据结构：Type、Scheme、Subst、TypeEnv，它们共同构成 HM 类型推导与 $beta$‑规约的基础。

== Type：静态类型
`Type`是系统中表示类型的核心数据结构，定义如下：
```Haskell
data Type
  = TInt
  | TBool
  | TVar String
  | TFun Type Type
  deriving (Show, Eq)
```

== Scheme：多态类型（
`Scheme ` 用于表示 HM 类型系统中的多态类型，定义如下：
```haskell
data Scheme = Forall [String] Type
```
== Subst：替换表
`Subst` 是类型推导中最关键的数据结构之一，用于记录类型变量的替换关系，定义如下：
```haskell
type Subst = Map String Type
```

= 创新点
== 可视化$lambda$演算规约
传统的$lambda$演算教学通常依赖手工推导，学生难以直观理解$beta$‑规约的动态过程。本项目通过可视化引擎，将每一步规约过程直观显示，并附有规约过程。这使得抽象的 λ 演算规约过程变得可观察、可追踪、可理解，大幅提升教学效果。

== 支持部分现代函数式编程语言特性的$lambda$演算
传统的$lambda$演算教学通常局限于纯粹的函数抽象和应用，而现代函数式编程语言（如 Haskell、OCaml）引入了更多的语言特性，如 let 表达式、递归函数定义、条件表达式以及二元操作等。本项目的$lambda$演算教学平台支持这些现代函数式编程语言的特性，使得教学内容更贴近实际编程语言的特性，从而提高教学的实用性和针对性。

== HM 类型系统的实现
虽然 HM 类型系统是不实现依赖类型的函数式编程语言的核心类型系统，但在$lambda$演算教学平台中，常见的多为无类型$lambda$演算，而 HM 类型系统的引入使得教学平台能够支持类型检查和类型推导功能，帮助学生理解类型系统的概念和作用，并且为未来可能的依赖类型系统的引入奠定扎实了基础。
