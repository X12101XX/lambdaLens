module LambdaLens.TypeInfer where

import Control.Monad.Except
import Control.Monad.State
import Data.Map (Map)
import Data.Map qualified as Map
import Data.Set (Set)
import Data.Set qualified as Set
import LambdaLens.Syntax

--                    ┌─────────────┐
--    Expr ───────────▶   infer()   │
--    TypeEnv ────────▶             │
--                    │  ┌────────┐ │
--                    │  │ fresh  │ │  ← State Int 提供唯一变量
--                    │  └────────┘ │
--                    │  ┌────────┐ │
--                    │  │ unify  │ │  ← 产生 Subst
--                    │  └────────┘ │
--                    │  ┌────────────────┐
--                    │  │ instantiate    │ ← 打开 ∀（使用多态变量时）
--                    │  │ generalize     │ ← 封装 ∀（let 绑定时）
--                    │  └────────────────┘
--                    └──────┬──────┘
--                           │
--                    (Subst, Type)
--                           │
--                    ┌──────▼──────┐
--                    │  apply s t  │  ← 把积累的替换应用到最终类型
--                    └──────┬──────┘
--                           │
--                       最终 Type

-- 类型的传播机制
class Substitutable a where
  apply :: Subst -> a -> a -- 应用替换，把类型变量替换成具体的类型
  ftv :: a -> Set String -- 自由类型变量（free type variables），收集其中的自由类型变量

-- 单态类型
data Type
  = TInt -- Int
  | TBool -- Bool
  | TVar String -- 类型变量：a, b, c ...
  | TFun Type Type -- 函数类型：a -> b
  deriving (Show, Eq)

-- 多态类型
-- example：Forall ["a"] (TFun (TVar "a") (TVar "a"))
-- 表示：∀a. a → a
data Scheme = Forall [String] Type

-- 替换表
-- example: { a -> Int, b -> Bool }
-- 类型 a 可以替换成
type Subst = Map String Type

-- 类型环境：变量名到类型 Scheme 的映射
type TypeEnv = Map String Scheme

nullSubst :: Subst
nullSubst = Map.empty

emptyEnv :: TypeEnv
emptyEnv = Map.empty

-- 获取类型环境中一个变量的类型 (Type) 的自由类型变量
instance Substitutable Type where
  apply _ TInt = TInt
  apply _ TBool = TBool
  apply s (TVar a) = case Map.lookup a s of
    Just t -> t
    Nothing -> TVar a
  apply s (TFun t1 t2) = TFun (apply s t1) (apply s t2)

  ftv TInt = Set.empty
  ftv TBool = Set.empty
  ftv (TVar a) = Set.singleton a
  ftv (TFun t1 t2) = ftv t1 `Set.union` ftv t2

-- 获取类型环境中一个变量的类型 (Scheme) 的自由类型变量
instance Substitutable Scheme where
  apply s (Forall vars t) = Forall vars $ apply s' t
    where
      s' = foldr Map.delete s vars
  ftv (Forall vars t) = ftv t `Set.difference` Set.fromList vars

instance Substitutable TypeEnv where
  apply s = Map.map (apply s)
  ftv env = Set.unions $ Map.elems $ Map.map ftv env

-- 对于两个替换表 s1 和 s2，先把 s1 应用到 s2 的所有类型中，再把 s1 和更新后的 s2 合并
-- s2 的替换结果中可能包含 s1 中的类型变量，所以需要先把 s1 应用到 s2 中的类型上
composeSubst :: Subst -> Subst -> Subst
composeSubst s1 s2 = Map.map (apply s1) s2 `Map.union` s1

-- 判断两个类型，有没有一个替换可以使得他们相等
-- 如果有 -> 返回这个替换表
-- 如果没有 -> 返回错误信息
unify :: Type -> Type -> Either String Subst
unify TInt TInt = Right nullSubst
unify TBool TBool = Right nullSubst
-- 以上都是完全相同的，也就意味着完全不需要替换，所以返回空的替换表
unify (TVar a) t = bind a t
unify t (TVar a) = bind a t
-- 对于一个变量var和一个类型t，如果我们想让它们相等，那么就需要把var替换成t
-- 也就是说，我们要对 var 进行绑定，绑定的结果是一个替换表 { var -> t }
unify (TFun l1 r1) (TFun l2 r2) = do
  s1 <- unify l1 l2
  s2 <- unify (apply s1 r1) (apply s1 r2)
  Right $ composeSubst s2 s1
-- 而对于两个函数类型，如果我们想让它们相等，那么就需要让它们的参数类型相等，返回类型相等
-- 也就是说，我们要先 unify 这两个函数的参数类型
-- 然后把得到的替换应用到返回类型上，再 unify 这两个返回类型
unify t1 t2 = Left $ "类型不匹配: " ++ show t1 ++ " vs " ++ show t2

-- 绑定类型变量到类型
bind :: String -> Type -> Either String Subst
bind a (TVar b) | a == b = Right nullSubst
bind a t
  | a `Set.member` ftv t = Left $ "无限类型: " ++ a ++ " 出现在 " ++ show t ++ " 中"
  | otherwise = Right $ Map.singleton a t

-- Infer Monad
-- 类型推导的环境
-- Infer Monnad 是一个两层 Monad
-- 外层是 ExceptT String，用来处理可能出现的错误
-- 内层是 State Int, 用于维护一个计数器，生成新的类型变量
type Infer a = ExceptT String (State Int) a

runInfer :: Infer a -> Either String a
runInfer m = evalState (runExceptT m) 0

-- 生成一个新的类型变量
fresh :: Infer Type
fresh = do
  n <- get
  put (n + 1)
  return $ TVar ("a" ++ show n)

-- 实例化一个 Scheme 为一个具体的 Type
instantiate :: Scheme -> Infer Type
instantiate (Forall vars t) = do
  newVars <- mapM (const fresh) vars
  let s = Map.fromList $ zip vars newVars
  return $ apply s t

-- 将一个Type泛化成一个Scheme
generalize :: TypeEnv -> Type -> Scheme
generalize env t = Forall vars t
  where
    vars = Set.toList $ ftv t `Set.difference` ftv env

-- 由于环境中的自由变量仍然在使用，所以需要减去 ftv env 中的变量

-- 主推导函数
infer :: TypeEnv -> Expr -> Infer (Subst, Type)
infer _ (EInt _) = return (nullSubst, TInt)
infer _ (EBool _) = return (nullSubst, TBool)
-- 对于以上两种字面量，类型是确定的，不需要任何的替换，所以输出空的替换表和它们对应的类型
infer env (EVar x) = case Map.lookup x env of -- 查找变量 x 的类型 Scheme
  Nothing -> throwError $ "未定义的变量: " ++ x
  Just sigma -> do
    t <- instantiate sigma
    return (nullSubst, t)
-- 对于一个变量，如果他有一个Scheme ，我们就需要把这个多态类型尝试实例化，从而使得推导可以继续进行
infer env (ELam x body) = do
  tv <- fresh -- 参数类型未知，生成 a0
  let env' = Map.insert x (Forall [] tv) env
  (s, t) <- infer env' body
  return (s, TFun (apply s tv) t)
-- 对于一个lambda表达式，首先，我们需要为他的参数生成一个 x :: a0
-- 然后，再把这个函数加入环境中，根据 a0 推导函数体 (Body) 的类型
-- 最后，函数的类型就是 a0 → body的类型
infer env (EApp func arg) = do
  tv <- fresh
  (s1, t1) <- infer env func
  (s2, t2) <- infer (apply s1 env) arg
  s3 <- liftUnify (apply s2 t1) (TFun t2 tv)
  return (composeSubst s3 (composeSubst s2 s1), apply s3 tv)
-- 对于一个函数应用，首先，返回类型是未知的，我们将其通过fresh 生成一个类型变量 a1
-- 然后 ，对函数的类型进行推导，得到一个类型 t1 和一个替换表 s1
-- 接着，对参数的类型进行推导，得到一个类型 t2 和一个替换表 s2
-- 最后，我们需要 unify 函数的类型 t1 和 参数类型 t2 → a1，得到一个替换表 s3
-- 这样，函数应用的类型就是 a1，替换表是 s3 组合 s2 组合 s1
-- 此时，a1 就应该可以确定了，于是我们需要把替换表 s3 应用到 a1 上，得到最终的类型
-- 虽然，根据上面的描述，应当应用的是 s3 组合 s2 组合 s1
-- 但是，tv 是刚刚 fresh 生成的，s1 和 s2 也不可能对 tv 进行改写，所以直接应用 s3 即可
infer env (ELet x val body) = do
  (s1, t1) <- infer env val
  let env' = apply s1 env
      scheme = generalize env' t1
      env'' = Map.insert x scheme env'
  (s2, t2) <- infer env'' body
  return (composeSubst s2 s1, t2)
-- let 的 x 是多态的
-- 所以，需要先推导 val 的类型，得到一个类型 t1 和一个替换表 s1
-- 然后，把 s1 应用到环境中，得到一个新的环境 env'
-- 接着，把 t1 泛化成一个 Scheme，插入到新的环境中，得到 env''
-- 最后，在新的环境中推导 body 的类型，得到一个类型 t2 和一个替换表 s2
-- let 表达式的类型就是 body 的类型
-- 值得注意的是 x 在此刻仍然是多态的，x 的具体类型只有在 body 中 被使用的时候才会被确定
infer env (EIf cond then_ else_) = do
  (s1, t1) <- infer env cond
  (s2, t2) <- infer (apply s1 env) then_
  (s3, t3) <- infer (apply (composeSubst s2 s1) env) else_
  s4 <- liftUnify (apply s3 (apply s2 t1)) TBool -- 条件必须是 Bool
  s5 <- liftUnify (apply s4 (apply s3 t2)) (apply s4 t3) -- 两分支类型相同
  let s = foldl1 composeSubst [s5, s4, s3, s2, s1]
  return (s, apply s5 (apply s4 (apply s3 t2)))
-- if 中有两个约束
-- 1. if 的 condition 必须是 Bool 类型
-- 2. then 分支和 else 分支必须是同一类型
-- 因此，我们需要先 unify 条件的类型和 Bool，得到一个替换表 s4
-- 然后，把 s4 应用到 then 分支的类型和 else 分支
-- 进行 unify，得到一个替换表 s5
infer env (EBinOp op l r) = do
  (s1, t1) <- infer env l
  (s2, t2) <- infer (apply s1 env) r
  let s12 = composeSubst s2 s1
  s3 <- liftUnify (apply s2 t1) TInt -- 左操作数必须是 Int
  s4 <- liftUnify (apply s3 t2) TInt -- 右操作数必须是 Int
  let s = foldl1 composeSubst [s4, s3, s12]
      resultType = case op of
        Eq -> TBool
        Lt -> TBool
        Gt -> TBool
        _ -> TInt -- Add, Sub, Mul, Div
  return (s, resultType)
-- 这里是已经经过简化的版本，实际上对于不同的二元运算符，我们需要有不同的约束
-- 例如，对于 Add, Sub, Mul, Div，我们需要约束左右操作数都是 Int，结果也是 Int
-- 而对于 Eq, Lt, Gt，我们需要约束左右操作数都是 Int，结果是 Bool
-- 但是，为了简化代码，我们在这里统一约束左右操作数都是 Int，结果的类型根据运算符来决定



liftUnify :: Type -> Type -> Infer Subst
liftUnify t1 t2 = case unify t1 t2 of
  Left err -> throwError err
  Right s -> return s

inferExpr :: Expr -> Either String Type
inferExpr expr = runInfer $ do
  (s, t) <- infer emptyEnv expr
  return $ apply s t