-- 使字符串字面量的默认类型从String变为Text
{-# LANGUAGE OverloadedStrings #-}

module LambdaLens.Parser where

import Control.Monad.Combinators.Expr
import Data.Text (Text, cons, pack, unpack)
import Data.Void
import LambdaLens.Syntax
import Text.Megaparsec
import Text.Megaparsec.Char
import Text.Megaparsec.Char.Lexer qualified as L

-- 此类型接受一个类型参数Result，表示解析成功时的返回类型
type Parser = Parsec Void Text

integer :: Parser Int
integer = lexeme L.decimal

sc :: Parser ()
sc = L.space space1 (L.skipLineComment "--") empty

-- 需要跳过的字符，空格
-- 行注释格式是 "--"
-- 目前，我们不使用块注释

lexeme :: Parser a -> Parser a
lexeme = L.lexeme sc

-- 对于变量名的parser
identifier :: Parser Text
identifier = lexeme $ try $ do
  name <- rawIdentifier -- 先获取这个变量的原始命名，然后再对其进行判断
  if name `elem` keywords
    then fail $ "Keyword " ++ show name ++ " 不能作为一个合法的变量名"
    else return name
  where
    rawIdentifier = do
      first <- letterChar -- parse 一个 char，保证了变量的第一个字符一定是字母
      rest <- many $ alphaNumChar <|> char '_' -- parse 0 个或多个 char 或 '_'
      return $ cons first $ pack rest
    keywords = ["let", "in", "if", "then", "else", "true", "false"]

-- 对 Atom 的 parsers
-- 我们要解析的Atom
-- Int, Bool, Var, Parens, symbol
symbol :: Text -> Parser Text
symbol = L.symbol sc

pInt :: Parser Expr
pInt = EInt <$> integer

pBool :: Parser Expr
pBool = (EBool True <$ symbol "true") <|> (EBool False <$ symbol "false")

pVar :: Parser Expr
pVar = EVar . unpack <$> identifier

pParens :: Parser Expr
pParens = do
  _ <- symbol "("
  e <- pExpr -- [TODO] 还未定义 pExpr
  _ <- symbol ")"
  return e

pAtom :: Parser Expr
pAtom =
  choice
    [ pInt,
      pBool,
      pVar,
      pParens
    ]

-- 所有运算符的表，按照优先级从高到低排列
operatorTable :: [[Operator Parser Expr]]
operatorTable =
  [ [ binary "*" Mul,
      binary "/" Div
    ],
    [ binary "+" Add,
      binary "-" Sub
    ],
    [ binary "==" Eq,
      binary "<" Lt,
      binary ">" Gt
    ]
  ]

-- 中缀左结合运算符
binary :: Text -> Op -> Operator Parser Expr
binary name op = InfixL (EBinOp op <$ symbol name)

-- 解析表达式
pExpr :: Parser Expr
pExpr =
  choice
    [ -- 对于 let, if, lambda 这些表达式
      -- 我们可以确定他们不会引发歧义，所以不需要使用try
      pLet,
      pIf,
      pLambda,
      makeExprParser pAtom operatorTable
    ]

-- 解析 let 表达式
pLet :: Parser Expr
pLet = do
  _ <- symbol "let"
  varName <- identifier
  _ <- symbol "="
  varExpr <- pExpr
  _ <- symbol "in"
  ELet (unpack varName) varExpr <$> pExpr

-- 解析 if 表达式
pIf :: Parser Expr
pIf = do
  _ <- symbol "if"
  cond <- pExpr
  _ <- symbol "then"
  thenBranch <- pExpr
  _ <- symbol "else"
  EIf cond thenBranch <$> pExpr

-- 解析 lambda 表达式
pLambda :: Parser Expr
pLambda = do
  _ <- symbol "\\"
  x <- identifier
  _ <- symbol "->"
  ELam (unpack x) <$> pExpr

-- 从终端接收文本，解析文本成AST，如果解析失败，返回错误信息
parseExpr :: Text -> Either (ParseErrorBundle Text Void) Expr
parseExpr = parse (sc *> pExpr <* eof) "<stdin>" 
