module LambdaLens.Eval where

import Control.Monad.Error.Class
import Control.Monad.Reader
import LambdaLens.Syntax

type Eval a = ReaderT Env (Either String) a

runEval :: Expr -> Either String Value
runEval expr = runReaderT (eval expr) []

-- 对二元用运算求值
evalOp :: Op -> Value -> Value -> Eval Value
evalOp op (VInt a) (VInt b) = case op of
  Add -> pure $ VInt (a + b)
  Sub -> pure $ VInt (a - b)
  Mul -> pure $ VInt (a * b)
  Div
    | b == 0 -> throwError "除以零"
    | otherwise -> pure $ VInt (a `div` b)
  Eq -> pure $ VBool (a == b)
  Lt -> pure $ VBool (a < b)
  Gt -> pure $ VBool (a > b)
evalOp _ _ _ = throwError "类型错误: 期望整数值"

-- 求值
eval :: Expr -> Eval Value
eval (EInt b) = return $ VInt b
eval (EBool b) = return $ VBool b
eval (EVar x) = do
  env <- ask
  case lookup x env of
    Just v -> return v
    Nothing -> throwError $ "未定义的变量: " ++ x
eval (EBinOp op e1 e2) = do
  v1 <- eval e1
  v2 <- eval e2
  evalOp op v1 v2
eval (ELet x e1 e2) = do
  v1 <- eval e1
  local ((x, v1) :) (eval e2)
eval (ELetRec x val body) = do
  env <- ask
  let env' = (x, v) : env
      v = case runReaderT (eval val) env' of
            Right result -> result
            Left err     -> error err
  local (const env') (eval body)
eval (EIf cond eThen eElse) = do
  vCond <- eval cond
  case vCond of
    VBool True -> eval eThen
    VBool False -> eval eElse
    _ -> throwError "条件表达式必须是Bool类型"
eval (ELam param body) = do
  asks $ VClosure param body
eval (EApp e1 e2) = do
  v1 <- eval e1
  v2 <- eval e2
  case v1 of
    VClosure param body closureEnv -> local (const ((param, v2) : closureEnv)) (eval body)
    _ -> throwError "不能调用非函数值"
