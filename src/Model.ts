import { Expr, query as q } from 'faunadb';
import z from 'zod';
import { Field } from './Field';
import { Zoo } from './Zoo';

export interface ParseOptions {
  showHidden?: boolean;
  hideTertiaryRelations?: boolean;
}

export interface ModelFieldSet extends Record<string, Field<any, any>> {}
export interface ModelZodSet extends Record<string, z.ZodTypeAny> {}

export type AdmittedFieldSchema<M extends ModelFieldSet> = {[K in keyof M]:M[K]['admit']}
export type AdmittedFieldObject<M extends ModelFieldSet> = { [K in keyof AdmittedFieldSchema<M>]: AdmittedFieldSchema<M>[K] extends z.ZodType<infer T> ? T : never }
export type EmittedFieldSchema<M extends ModelFieldSet> = {[K in keyof M]:M[K]['emit']} & {ts: z.ZodNumber, id: z.ZodString}
export type EmittedFieldObject<M extends ModelFieldSet> = { [K in keyof EmittedFieldSchema<M>]: EmittedFieldSchema<M>[K] extends z.ZodType<infer T> ? T : never }

export type Admit<MM extends Model<any>> = MM extends Model<infer M> ? AdmittedFieldObject<M> : never
export type One<MM extends Model<any>> = MM extends Model<infer M> ? EmittedFieldObject<M> : never

type ReversibleFields<R extends ModelFieldSet, M extends ModelFieldSet> = {[K in keyof R as R[K] extends ReversibleField<any, any, M> ? K : never]: R[K]}

export class Model<M extends ModelFieldSet, B extends ModelFieldSet=M> { name: string;
  readonly fields: M;
  private _zoo: Zoo<M> | undefined;

  constructor(name: string, fields:M) {
    this.name = name;
    this.fields = fields;
  }

  get zoo():Zoo<M> {
    if (!this._zoo) {
      this._zoo = new Zoo(this);
    }
    return this._zoo;
  }

  reverse<R extends ModelFieldSet, T extends Record<string, keyof ReversibleFields<R,B>>>(model:Model<R>, reverses: T) {
    const reveresedFields = Object.entries(reverses).reduce((acc, [fieldName, reversibleFieldName]) => {
      const reversibleField = model.fields[reversibleFieldName] as unknown as ReversibleField<any, any, R>
      return {...acc, [fieldName]: new ReverseField(model, reversibleFieldName as string, reversibleField)}
    }, {}) as {[K in keyof T]:Field<z.ZodUndefined, z.ZodArray<Model<R>["emit"]>>}
    return new ExtendedModel(this, reveresedFields);
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
    return q.Do(...queries || []);
  }

  index() {
    const indexQueries:Expr[] = [];

    for (const key in this.fields) {
      const field = this.fields[key]
      if (field instanceof Field) {
        const indexes = field.index(this.name, key);
        if (indexes) {
          indexQueries.push(...indexes);
        }
      }
    }
    return q.Do(indexQueries)
  }

  construct() {
    const tableQueries:Expr[] = [];

    tableQueries.push(q.CreateCollection({ name: this.name }));

    for (const key in this.fields) {
      const field = this.fields[key]
      if (field instanceof Field) {
        const tables = field.construct(this.name, key);
        if (tables) {
          tableQueries.push(...tables);
        }
      }
    }
    return q.Do(...tableQueries || [])
  }

  get emit() {
    return z.object(
      {
        ...Object.entries(this.fields).reduce<z.ZodRawShape>((acc, [key, field]) => {
          acc[key] = field.emit as z.ZodType
          return acc
        }, {}),
        id: z.string(),
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

import ReversibleField from './ReversibleField';
import { ReverseField } from './ReverseField';


export class ExtendedModel<M extends ModelFieldSet, E extends ModelFieldSet, B extends ModelFieldSet> extends Model<M & E, B> {

  constructor(extendedModel: Model<M, B>, extendedFields: E) {
    const fields = {...extendedModel.fields, ...extendedFields};
    super(extendedModel.name, fields);
  }

  deconstruct() {
    return q.Do([])
  }

  construct() {
    return q.Do([])
  }
}