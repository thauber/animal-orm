import { Expr } from 'faunadb';
import z from 'zod';

function dateTimestamp ():z.ZodPipeline<z.ZodUnion<[z.ZodDate, z.ZodNumber]>, z.ZodNumber> {
  return z.union([z.date(), z.number()]).pipe(z.coerce.number());
}
dateTimestamp.optional = function ():z.ZodPipeline<z.ZodOptional<z.ZodUnion<[z.ZodDate, z.ZodNumber]>>, z.ZodOptional<z.ZodNumber>> {
  return z.union([z.date(), z.number()]).optional().pipe(z.coerce.number().optional());
}

function timestampDate ():z.ZodPipeline<z.ZodNumber, z.ZodDate> {
  return z.number().pipe(z.coerce.date());
}

timestampDate.optional = function ():z.ZodPipeline<z.ZodOptional<z.ZodNumber>, z.ZodOptional<z.ZodDate>>  {
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