module LambdaLens.Syntax where

type Name = String
type Env = [(String, Value)]

-- 抽象语法树
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

data Value
  = VInt Int
  | VBool Bool
  | VClosure String Expr Env
  deriving (Show, Eq)

