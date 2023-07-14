import { Expr } from 'faunadb';
import z from 'zod';

export const animal = {
  hidden():z.ZodEffects<z.ZodAny, void, any> {
    return z.any().transform<void>((_a:any)=>{})
  },

  ref():z.ZodType<Expr> {
    return z.custom<Expr>((value) => value instanceof Expr, {
      message: "Must be a FaunaDB Expr instance",
    })
  }
}

export default animal