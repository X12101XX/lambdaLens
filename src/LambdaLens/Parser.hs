{-# LANGUAGE OverloadedStrings #-} -- 使字符串字面量的默认类型从String变为Text

module LambdaLens.Parser where

import Control.Monad.Combinators.Expr
import Data.Text (Text, cons, pack, unpack)
import Data.Void
import LambdaLens.Syntax
import Text.Megaparsec
import Text.Megaparsec.Char
import Text.Megaparsec.Char.Lexer qualified as L

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

-- pParens :: Parser Expr
-- pParens = do 
--     _ <- symbol "("
--     e <- pExpr    -- [TODO] 还未定义 pExpr
--     _ <- symbol ")"
--     return e

pAtom :: Parser Expr
pAtom = choice
    [ pInt
    , pBool
    , pVar
    -- , pParens [TODO] 由于 pExp 还未实现，所以暂时还无法实现 pParens
    ]
