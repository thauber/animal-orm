import { Expr, query as q } from 'faunadb';
import z from 'zod';
import { Model, ModelFieldSet } from './Model';
import { Client } from 'faunadb';

export default {
  hidden():z.ZodEffects<z.ZodAny, void, any> {
    return z.any().transform<void>((_a:any)=>{})
  },
  ref():z.ZodType<Expr> {
    return z.custom<Expr>((value) => value instanceof Expr, {
      message: "Must be a FaunaDB Expr instance",
    })
  },
}


type AdmittedFields<M extends ModelFieldSet> = {[K in keyof M]:M[K]['admit'] extends z.ZodType<infer T> ? T : never}

export class Zoo<M extends ModelFieldSet>{ readonly model: Model<M>; readonly client: Client;
  constructor (model: Model <M>) {
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
      ref: q.Select(['ref'], q.Var('document')),
      ts: q.Select(['ts'], q.Var('document')),
      ...Object.fromEntries(subQueries)
    });
  }

  paginateQuery(index?: string, terms: any[] = []) {
    const paginate = index ? q.Paginate(q.Match(q.Index(index), terms)) : q.Paginate(q.Documents(q.Collection(this.model.name)));
    return q.Select("data",
     q.Map(
        paginate,
        q.Lambda('values',
          q.Let(
            {
              ref:q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values'))
            },
            this.dereference(q.Var('ref'))
          )
        ),
      )
    )
  }

  async paginate(index?: string, terms: any[] = []) {
    const results = await this.client.query(this.paginateQuery(index, terms))
    return this.model.emit.array().parse(results)
  }

  getQuery(ref: Expr) {
    return this.dereference(ref);
  }

  async get(ref: Expr) {
    const instance = await this.client.query(this.getQuery(ref))
    return this.model.emit.parse(instance);
  }

  createQuery(data:AdmittedFields<M>) {
    const validated = this.model.admit.parse(data);
    return q.Create(q.Collection(this.model.name), { data: validated });
  }

  async create(data:AdmittedFields<M>) {
    const instance = await this.client.query(this.createQuery(data)) as {ref: Expr};
    const dereferenced = await this.client.query(this.dereference(instance.ref));
    return this.model.emit.parse(dereferenced);
  }

  updateQuery(ref: Expr, data:Partial<AdmittedFields<M>>) {
    const validated = this.model.admit.partial().parse(data);
    return q.Update(ref, { data: validated });
  }

  async update(ref: Expr, data:Partial<AdmittedFields<M>>) {
    await this.client.query(this.updateQuery(ref, data));
    return this.model.emit.parse(await this.client.query(this.dereference(ref)));
  }

  deleteQuery(ref: Expr) {
    return q.Delete(ref);
  }
  async delete(ref: Expr):Promise<void> {
    await this.client.query(this.deleteQuery(ref));
  }
}