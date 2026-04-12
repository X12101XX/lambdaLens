module LambdaLens.Stepper where

import LambdaLens.Parser (parseExpr)
import LambdaLens.Syntax
import qualified Data.Text as Text

data StepRule
  = BetaReduce String -- Beta-reduction: 函数参数
  | DeltaReduce Op -- Delta-reduction: 算术/比较
  | IfTrue -- if 走了 then
  | IfFalse -- if 走了 else
  | LetSubst String -- let 替换
  | LetRecSubst String -- letrec 展开
  deriving (Show)

data Step = Step
  { stepBefore :: Expr, -- 规约前的表达式
    stepAfter :: Expr, -- 规约后的表达式
    stepRule :: StepRule -- 触发的规约规则
  }
  deriving (Show)

-- 替换： 在表达式 e 中，将所有出现的自由变量 x 替换成 s
substitute :: String -> Expr -> Expr -> Expr
substitute x s (EVar y)
  | x == y = s
  | otherwise = EVar y
substitute x s (ELam y body)
  | x == y = ELam y body -- y 遮蔽了 x，不替换
  | otherwise = ELam y (substitute x s body)
substitute x s (EApp e1 e2) =
  EApp (substitute x s e1) (substitute x s e2)
substitute x s (EBinOp op e1 e2) =
  EBinOp op (substitute x s e1) (substitute x s e2)
substitute x s (EIf c t e) =
  EIf (substitute x s c) (substitute x s t) (substitute x s e)
substitute x s (ELet y val body)
  | x == y = ELet y (substitute x s val) body -- body 里 x 被遮蔽
  | otherwise = ELet y (substitute x s val) (substitute x s body)
substitute x s (ELetRec y val body)
  | x == y = ELetRec y val body -- y 遮蔽了 x（val 和 body 都不替换）
  | otherwise = ELetRec y (substitute x s val) (substitute x s body)
substitute _ _ e = e -- EInt, EBool 不变

-- 判断是否是值类型（也就是不可能在被规约的表达式）
isValue :: Expr -> Bool
isValue (EInt {}) = True
isValue (EBool {}) = True
isValue (ELam {}) = True
isValue _ = False

-- 算术运算的单步规约
evalOp' :: Op -> Int -> Int -> Maybe Expr
evalOp' Add a b = Just $ EInt (a + b)
evalOp' Sub a b = Just $ EInt (a - b)
evalOp' Mul a b = Just $ EInt (a * b)
evalOp' Div a b
  | b == 0 = Nothing
  | otherwise = Just $ EInt (a `div` b)
evalOp' Eq a b = Just $ EBool (a == b)
evalOp' Lt a b = Just $ EBool (a < b)
evalOp' Gt a b = Just $ EBool (a > b)

-- 单步规约
step :: Expr -> Maybe (Expr, StepRule)
-- Beta-reduction: (\x -> body) y -> body[x := y]
step (EApp (ELam x body) arg)
  | isValue arg = Just (substitute x arg body, BetaReduce x)
  | otherwise = do
      (arg', rule) <- step arg
      Just (EApp (ELam x body) arg', rule)

-- 函数应用：先规约函数部分，再规约参数部分
step (EApp f arg)
  | not (isValue f) = do
      (f', rule) <- step f
      Just (EApp f' arg, rule)
  | not (isValue arg) = do
      (arg', rule) <- step arg
      Just (EApp f arg', rule)
  | otherwise = Nothing -- stuck: 非函数值被应用

-- Delta-reduction: 先规约左右操作数，再进行算术/比较运算
step (EBinOp op (EInt a) (EInt b)) =
  case evalOp' op a b of
    Just result -> Just (result, DeltaReduce op)
    Nothing -> Nothing -- 除以零
step (EBinOp op e1 e2)
  | not (isValue e1) = do
      (e1', rule) <- step e1
      Just (EBinOp op e1' e2, rule)
  | not (isValue e2) = do
      (e2', rule) <- step e2
      Just (EBinOp op e1 e2', rule)
  | otherwise = Nothing -- stuck

-- if: 先规约 condition，再根据 condition 的值选择分支
-- if c then t else e → if c' then t else e
step (EIf (EBool True) t _) = Just (t, IfTrue)
step (EIf (EBool False) _ e) = Just (e, IfFalse)
step (EIf c t e) = do
  (c', rule) <- step c
  Just (EIf c' t e, rule)

-- let: 先规约 val，再进行替换，let x = val in body → body[x := val]
step (ELet x val body)
  | isValue val = Just (substitute x val body, LetSubst x)
  | otherwise = do
      (val', rule) <- step val
      Just (ELet x val' body, rule)

-- letrec: 展开一层递归
-- letrec f = v in body → body[f := v[f := letrec f = v in f]]
step (ELetRec x val body)
  | isValue val =
      let selfRef = ELetRec x val (EVar x) -- "自己"的引用
          val' = substitute x selfRef val -- 在 val 里埋入自引用
       in Just (substitute x val' body, LetRecSubst x)
  | otherwise = do
      (val', rule) <- step val
      Just (ELetRec x val' body, rule)
step _ = Nothing -- 值或 stuck

-- 收集一步步规约的结果
trace :: Expr -> [Step]
trace expr = case step expr of
  Nothing -> []
  Just (expr', rule) -> Step expr expr' rule : trace expr'

-- 加上规约步数限制的 trace，防止死循环
traceWithLimit :: Int -> Expr -> [Step]
traceWithLimit 0 _ = []
traceWithLimit n expr = case step expr of
  Nothing -> []
  Just (expr', rule) -> Step expr expr' rule : traceWithLimit (n - 1) expr'

prettyExpr :: Expr -> String
prettyExpr (EInt n) = show n
prettyExpr (EBool True) = "true"
prettyExpr (EBool False) = "false"
prettyExpr (EVar x) = x
prettyExpr (ELam x body) = "(\\" ++ x ++ " -> " ++ prettyExpr body ++ ")"
prettyExpr (EApp f arg) = prettyFunc f ++ " " ++ prettyArg arg
  where
    prettyFunc e@(ELam {}) = "(" ++ prettyExpr e ++ ")"
    prettyFunc e@(ELet {}) = "(" ++ prettyExpr e ++ ")"
    prettyFunc e@(ELetRec {}) = "(" ++ prettyExpr e ++ ")"
    prettyFunc e@(EIf {}) = "(" ++ prettyExpr e ++ ")"
    prettyFunc e = prettyExpr e
    prettyArg e@(EApp {}) = "(" ++ prettyExpr e ++ ")"
    prettyArg e@(ELam {}) = "(" ++ prettyExpr e ++ ")"
    prettyArg e@(EBinOp {}) = "(" ++ prettyExpr e ++ ")"
    prettyArg e@(ELet {}) = "(" ++ prettyExpr e ++ ")"
    prettyArg e@(ELetRec {}) = "(" ++ prettyExpr e ++ ")"
    prettyArg e@(EIf {}) = "(" ++ prettyExpr e ++ ")"
    prettyArg e = prettyExpr e
prettyExpr (EBinOp op e1 e2) =
  wrapBinOp e1 ++ " " ++ prettyOp op ++ " " ++ wrapBinOp e2
  where
    wrapBinOp e@(EBinOp {}) = "(" ++ prettyExpr e ++ ")"
    wrapBinOp e@(EIf {}) = "(" ++ prettyExpr e ++ ")"
    wrapBinOp e@(ELam {}) = "(" ++ prettyExpr e ++ ")"
    wrapBinOp e = prettyExpr e
prettyExpr (EIf c t e) =
  "if " ++ prettyExpr c ++ " then " ++ prettyExpr t ++ " else " ++ prettyExpr e
prettyExpr (ELet x val body) =
  "let " ++ x ++ " = " ++ prettyExpr val ++ " in " ++ prettyExpr body
prettyExpr (ELetRec x val body) =
  "letrec " ++ x ++ " = " ++ prettyExpr val ++ " in " ++ prettyExpr body

prettyOp :: Op -> String
prettyOp Add = "+"
prettyOp Sub = "-"
prettyOp Mul = "*"
prettyOp Div = "/"
prettyOp Eq = "=="
prettyOp Lt = "<"
prettyOp Gt = ">"

prettyRule :: StepRule -> String
prettyRule (BetaReduce x) = "β-reduction: " ++ x
prettyRule (DeltaReduce op) = "δ-reduction: " ++ prettyOp op
prettyRule IfTrue = "if-true"
prettyRule IfFalse = "if-false"
prettyRule (LetSubst x) = "let 替换: " ++ x
prettyRule (LetRecSubst x) = "letrec 展开: " ++ x


traceExpr :: String -> IO ()
traceExpr input = case parseExpr (Text.pack input) of
  Left err -> putStrLn $ "解析错误: " ++ show err
  Right expr -> do
    putStrLn $ "步骤 0: " ++ prettyExpr expr
    mapM_ printStep (zip [1 ..] (traceWithLimit 100 expr))
  where
    printStep (i, Step _ after rule) = do
      putStrLn $ "  [" ++ prettyRule rule ++ "]"
      putStrLn $ "步骤 " ++ show (i :: Int) ++ ": " ++ prettyExpr after
