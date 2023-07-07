import { Expr } from 'faunadb';
import z from 'zod';

export function hidden():z.ZodEffects<z.ZodAny, void, any> {
    return z.any().transform<void>((_a:any)=>{})
  },

export function ref():z.ZodType<Expr> {
    return z.custom<Expr>((value) => value instanceof Expr, {
      message: "Must be a FaunaDB Expr instance",
    })
  },