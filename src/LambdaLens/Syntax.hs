module LambdaLens.Syntax where

type Name = String

-- 抽象语法树
data Expr
  = EInt Int
  | EBool Bool
  | EVar String
  | ELam String Expr
  | EApp Expr Expr
  | ELet String Expr Expr
  | EIf Expr Expr Expr
  | EBinOp Op Expr Expr
  deriving (Show, Eq)

-- 二元运算
data Op
  = Add
  | Sub
  | Mul
  | Div
  | Eq
  | Lt
  | Gt
  deriving (Show, Eq)

-- 类型
data Type
  = TInt
  | TBool
  | TVar Name
  | TFun Type Type
  deriving (Show, Eq, Ord)       

-- 多态类型
data Scheme = Forall [Name] Type
    deriving stock (Show, Eq)