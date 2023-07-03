import { Expr, query as q } from 'faunadb';
import * as z from 'zod';
import { Field } from './Field';
import a from './a'
import { Zoo } from './Zoo';

export interface ParseOptions {
  showHidden?: boolean;
  hideTertiaryRelations?: boolean;
}

type OptionalPropertyNames<T> =
  { [K in keyof T]-?: ({} extends { [P in K]: T[K] } ? K : never) }[keyof T];

type SpreadProperties<L, R, K extends keyof L & keyof R> =
  { [P in K]: L[P] | Exclude<R[P], undefined> };

type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

type SpreadTwo<L, R> = Id<
  & Pick<L, Exclude<keyof L, keyof R>>
  & Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>>
  & Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>>
  & SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>;

type Spread<A extends readonly [...any]> = A extends [infer L, ...infer R] ?
  SpreadTwo<L, Spread<R>> : unknown

export interface ModelFieldSet extends Record<string, Field<any, any>> {}
export interface ModelZodSet extends Record<string, z.ZodTypeAny> {}

export type AdmittedFieldSchema<M extends ModelFieldSet> = {[K in keyof M]:M[K]['admit']}
export type EmittedFieldSchema<M extends ModelFieldSet> = Spread<[{[K in keyof M]:M[K]['emit']}, {ref: z.ZodType<Expr>, ts: z.ZodNumber}]>

export type EmitRelated<M extends ModelFieldSet, MM extends Model<M>> = MM['emit']
export type AdmitRelated<M extends ModelFieldSet, MM extends Model<M>> = MM['emit']

export class Model<M extends ModelFieldSet> {
  name: string;
  readonly fields: M;
  readonly zoo: Zoo<M>;

  constructor(name: string, fields:M) {
    this.name = name;
    this.fields = fields;
    this.zoo = new Zoo(this);
  }

  deconstruct() {
    const queries:Expr[] = [];
    for (const key in this.fields) {
      const field = this.fields[key]
      if (field instanceof Field) {
        const fieldQueries = field.deconstruct(this.name, key);
        queries.push(...fieldQueries);
      }
    }
    queries.push(q.Delete(q.Collection(this.name)))
    return q.Do(...queries);
  }

  construct() {
    const tableQueries:Expr[] = [];
    const indexQueries:Expr[] = [];

    tableQueries.push(q.CreateCollection({ name: this.name }));

    for (const key in this.fields) {
      const field = this.fields[key]
      if (field instanceof Field) {
        const {tables, indexes} = field.construct(this.name, key);
        if (tables) {
          tableQueries.push(...tables);
        }
        if (indexes) {
          indexQueries.push(...indexes);
        }
      }
    }
    return {
      tables: tableQueries?.length && q.Do(...tableQueries),
      indexes: indexQueries?.length && q.Do(...indexQueries),
    };
  }

  get emit() {
    return z.object(
      {
        ...Object.entries(this.fields).reduce<z.ZodRawShape>((acc, [key, field]) => {
          acc[key] = field.emit as z.ZodType
          return acc
        }, {}),
        ref: a.ref(),
        ts: z.number(),
      } as unknown as EmittedFieldSchema<M>
    )
  }

  get admit() {
    return z.object(
      Object.entries(this.fields).reduce<z.ZodRawShape>((acc, [key, field]) => {
        acc[key] = field.admit as z.ZodType
        return acc
      }, {}) as unknown as AdmittedFieldSchema<M>
    );
  }

}