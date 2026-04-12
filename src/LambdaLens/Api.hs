{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE DeriveGeneric #-}

module LambdaLens.Api (startServer) where

import Web.Scotty
import Data.Aeson (FromJSON, object, (.=))
import GHC.Generics (Generic)
import Network.HTTP.Types.Status (status400)

import LambdaLens.Parser (parseExpr)
import LambdaLens.TypeInfer (inferExpr, Type(..))
import LambdaLens.Eval (runEval)
import LambdaLens.Syntax
import LambdaLens.Stepper (Step (..), traceWithLimit, prettyExpr, prettyRule)

import Data.Text(pack)

-- API 请求体
-- 对应的Json示例 {"expr": "(\\x -> x + 1) 3"}
newtype ExprRequest = ExprRequest { expr :: String }
  deriving (Generic)

instance FromJSON ExprRequest

-- 辅助函数：把 Type 转成字符串，方便前端显示
prettyType :: Type -> String
prettyType TInt       = "Int"
prettyType TBool      = "Bool"
prettyType (TVar a)   = a
prettyType (TFun a b) = wrap a ++ " → " ++ prettyType b
  where
    wrap t@TFun{} = "(" ++ prettyType t ++ ")"
    wrap t        = prettyType t

-- 辅助函数：把 Value 转成字符串，方便前端显示
prettyValue :: Value -> String
prettyValue (VInt n)      = show n
prettyValue (VBool True)  = "true"
prettyValue (VBool False) = "false"
-- 由于闭包无法直接展示，我们用一个占位字符串来表示函数值
prettyValue VClosure{}    = "<function>"

-- cors 相关的辅助函数，允许跨域请求
cors :: ActionM ()
cors = do
  addHeader "Access-Control-Allow-Origin"  "*"
  addHeader "Access-Control-Allow-Methods" "POST, OPTIONS"
  addHeader "Access-Control-Allow-Headers" "Content-Type"

-- server 监听在 http://1calhost:3000
startServer :: IO ()
startServer = do
  putStrLn "LambdaLens API @ http://localhost:3000"
  putStrLn "  POST /api/trace"
  putStrLn "  POST /api/typecheck"
  putStrLn "  POST /api/eval"
  scotty 3000 $ do

    -- CORS 预检
    options (regex ".*") $ cors >> text ""

    -----------------------------------------------
    -- 单步求值追踪
    -- 请求: {"expr": "(\\x -> x + 1) 3"}
    -- 响应: {"type": "Int", "steps": [...]}
    -----------------------------------------------
    post "/api/trace" $ do
      cors
      req <- jsonData
      case parseExpr (pack (expr req)) of
        Left err -> do
          status status400
          json $ object ["error" .= show err]
        Right ast -> do
          let steps = traceWithLimit 200 ast
              initial = object
                [ "index" .= (0 :: Int)
                , "expr"  .= prettyExpr ast
                , "rule"  .= (Nothing :: Maybe String)
                ]
              rest = zipWith (\i s -> object
                [ "index" .= i
                , "expr"  .= prettyExpr (stepAfter s)
                , "rule"  .= Just (prettyRule (stepRule s))
                ]) [(1 :: Int) ..] steps
              tyResult = either (const Nothing) (Just . prettyType) (inferExpr ast)
          json $ object
            [ "steps" .= (initial : rest)
            , "type"  .= tyResult
            ]

    -----------------------------------------------
    -- 类型推导
    -- 请求: {"expr": "\\x -> x + 1"}
    -- 响应: {"type": "Int → Int"}
    -----------------------------------------------
    post "/api/typecheck" $ do
      cors
      req <- jsonData
      case parseExpr (pack (expr req)) of
        Left err -> do
          status status400
          json $ object ["error" .= show err]
        Right ast -> case inferExpr ast of
          Left err -> do
            status status400
            json $ object ["error" .= err]
          Right ty ->
            json $ object ["type" .= prettyType ty]

    -- 求值，直接获得结果和类型
    post "/api/eval" $ do
      cors
      req <- jsonData
      case parseExpr (pack (expr req)) of
        Left err -> do
          status status400
          json $ object ["error" .= show err]
        Right ast -> case inferExpr ast of
          Left err -> do
            status status400
            json $ object ["error" .= err]
          Right ty -> case runEval ast of
            Left err -> do
              status status400
              json $ object ["error" .= err]
            Right val ->
              json $ object
                [ "value" .= prettyValue val
                , "type"  .= prettyType ty
                ]
