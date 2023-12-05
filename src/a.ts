import { Expr } from 'faunadb';
import z from 'zod';

function dateTimestamp () {
  return z.union([z.date(), z.number()]).pipe(z.coerce.number());
}
dateTimestamp.optional = function () {
  return z.union([z.date(), z.number()]).optional().pipe(z.coerce.number().optional());
}

function timestampDate () {
  return z.number().pipe(z.coerce.date());
}

timestampDate.optional = function () {
  return z.number().optional().pipe(z.coerce.date().optional());
}

export const animal = {
  hidden():z.ZodEffects<z.ZodAny, void, any> {
    return z.any().transform<void>((_a:any)=>{})
  },

  ref():z.ZodType<Expr> {
    return z.custom<Expr>((value) => value instanceof Expr, {
      message: "Must be a FaunaDB Expr instance",
    })
  },
  dateTimestamp,
  timestampDate,
}


export default animal