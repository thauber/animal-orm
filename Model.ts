import { Expr, query as q } from 'faunadb';
import * as z from 'zod';
import { Field } from './Field';
import { ManyToManyField } from './ManyToManyField';
import { Client } from 'faunadb';
import { showHidden } from 'yargs';

export interface ParseOptions {
  showHidden?: boolean;
  hideTertiaryRelations?: boolean;
}

export interface ModelFieldSet extends Record<string, Field<any, any>> {}
export interface ModelZodSet extends Record<string, z.ZodTypeAny> {}

export type AdmittedFieldSchema<M extends ModelFieldSet> = {[K in keyof M]:M[K]['admit']}
export type EmittedFieldSchema<M extends ModelFieldSet> = {[K in keyof M]:M[K]['emit']}

export type EmitRelated<M extends ModelFieldSet, MM extends Model<M>> = MM['emit']
export type AdmitRelated<M extends ModelFieldSet, MM extends Model<M>> = MM['emit']

export class Model<M extends ModelFieldSet> {
  name: string;
  readonly fields: M;
  readonly zoo: ModelManager<M>;

  constructor(name: string, fields:M) {
    this.name = name;
    this.fields = fields;
    this.zoo = new ModelManager(this);
  }

  construct() {
    const queries:Expr[] = [];
    queries.push(q.CreateCollection({ name: this.name }));

    for (const key in this.fields) {
      const field = this.fields[key]
      if (field instanceof Field) {
        const fieldConstructs = field.construct(this.name, key);
        if (fieldConstructs) {
          queries.push(...fieldConstructs);
        }
      }
    }
    return q.Do(...queries);
  }

  get emit() {
    return z.object(
      Object.entries(this.fields).reduce<z.ZodRawShape>((acc, [key, field]) => {
        acc[key] = field.emit as z.ZodType
        return acc
      }, {}) as unknown as EmittedFieldSchema<M>
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


type AdmittedFields<M extends ModelFieldSet> = {[K in keyof M]:M[K]['admit'] extends z.ZodType<infer T> ? T : never}
type EmittedFields<M extends ModelFieldSet> = {[K in keyof M]:M[K]['emit'] extends z.ZodType<infer T> ? T : never}

class ModelManager<M extends ModelFieldSet>{
  readonly model: Model<M>;
  readonly client: Client;

  
  constructor (model: Model<M>) {
    this.model = model
    const faunaKey = process.env.FAUNADB_SECRET_KEY || '';
    if (!faunaKey) {
      throw new Error('FAUNADB_SECRET_KEY is not set in environment')
    }
    this.client = new Client({
      secret: faunaKey,
    });
  }

  dereference(ref: Expr) {
    const subQueries = Object.entries(this.model.fields)
      .map<[string, Expr]>(([fieldName, field]) => [fieldName, field.query(this.model.name, fieldName)]);
  
    return q.Let({
      ref: ref,
      document: q.Get(ref)
    }, {
      ...Object.fromEntries(subQueries)
    });
  }

  paginateQuery(index: string, terms: any[] = []) {
    return q.Select("data",
     q.Map(
        q.Paginate(q.Match(q.Index(index), terms)),
        q.Lambda('values', q.Let(
          { ref:q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values')) },
          this.dereference(q.Var('ref'))
        )),
      )
    )
  }

  async paginate(index: string, terms: any[] = []) {
    const results = await this.client.query(this.paginateQuery(index, terms))
    return this.model.emit.array().parse(results)
  }

  getQuery(id: string) {
    return this.dereference(q.Ref(q.Collection(this.model.name), id));
  }

  async get(id: string) {
    const instance = await this.client.query(this.getQuery(id))
    return this.model.emit.parse(instance);
  }

  createQuery(data:AdmittedFields<M>) {
    const validated = this.model.admit.parse(data);
    return q.Create(q.Collection(this.model.name), { data: validated });
  }

  async create(data:AdmittedFields<M>):Promise<EmittedFields<M>> {
    return this.model.emit.parse(this.client.query(this.createQuery(data)));
  }

  updateQuery(id:string, data:Partial<AdmittedFields<M>>) {
    const validated = this.model.admit.partial().parse(data);
    return q.Update(q.Ref(q.Collection(this.model.name), id), { data: validated });
  }

  async update(id: string, data:Partial<AdmittedFields<M>>):Promise<EmittedFields<M>> {
    return this.model.emit.parse(this.client.query(this.updateQuery(id, data)));
  }

  deleteQuery(id: string) {
    return q.Delete(q.Ref(q.Collection(this.model.name), id));
  }
  async delete(id: string):Promise<void> {
    await this.client.query(this.deleteQuery(id));
  }
}