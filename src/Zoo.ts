import { Expr, query as q, values } from 'faunadb';
import z, { objectUtil } from 'zod';
import { Model, ModelFieldSet, Spread } from './Model';
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

// type AdmittedField<M extends ModelFieldSet, K extends keyof M> = M[K]['admit'] extends z.ZodType<infer T> ? T : never
// type AdmittedOptionFields<M extends ModelFieldSet> = {[K in keyof M as M[K]['admit'] extends z.ZodOptional<any> ? K : never]-?: AdmittedField<M, K>}
// type AdmittedRequiredFields<M extends ModelFieldSet> = {[K in keyof M as M[K]['admit'] extends z.ZodOptional<any> ? never : K]: AdmittedField<M, K>}

// type AdmittedFields<M extends ModelFieldSet> = Spread<[AdmittedOptionFields<M>, AdmittedRequiredFields<M>]>

type AdmittedFields<M extends ModelFieldSet> = objectUtil.addQuestionMarks<{[K in keyof M]:M[K]['admit'] extends z.ZodType<infer T> ? T : never}>

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

  refFromId(id: string) {
    return q.Ref(q.Collection(this.model.name), id);
  }

  dereferenceQuery(ref: Expr) {
    const subQueries = Object.entries(this.model.fields)
      .map<[string, Expr]>(([fieldName, field]) => [fieldName, field.query(this.model.name, fieldName)]);

    const subPaths = Object.entries(this.model.fields)
      .map<[string, string[]]>(([fieldName, field]) => [fieldName, ["data", fieldName]]
    ); 

    return q.Let({
      ref: ref,
      document: q.Get(ref)
    }, q.Merge(
        {
          id: q.Select(['ref', 'id'], q.Var('document')),
          ts: q.Select(['ts'], q.Var('document')),
          ...Object.fromEntries(subQueries)
        },
        {
          id: ["ref", "id"],
          ts: ["ts"],
          ...Object.fromEntries(subPaths)
        },
        q.Lambda(['key', 'a', 'b'], q.If(q.ContainsPath(q.Var("b"), q.Var("document")), q.Var("a"), null))
      )
    );
  }

  dereference(id: string) {
    const ref = this.refFromId(id);
    return this.dereferenceQuery(ref);
  }

  paginateQuery(index?: string, terms: any[] = []) {
    const paginate = index ? q.Paginate(q.Match(q.Index(index), terms)) : q.Paginate(q.Documents(q.Collection(this.model.name)));
    return q.Select("data",
     q.Map(
        paginate,
        q.Lambda('values',
          q.Let(
            {
              ref: index
                ? q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values'))
                : q.Var('values')
            },
            this.dereferenceQuery(q.Var('ref'))
          )
        ),
      )
    )
  }

  async paginate(index?: string, terms: any[] = []) {
    const results = await this.client.query(this.paginateQuery(index, terms))
    return this.model.emit.array().parse(results)
  }

  getQuery(id: string) {
    return this.dereference(id);
  }

  async get(id: string) {
    const instance = await this.client.query(this.getQuery(id))
    return this.model.emit.parse(instance);
  }

  createQuery(data:AdmittedFields<M>) {
    const validated = this.model.admit.parse(data);
    return q.Create(q.Collection(this.model.name), { data: validated });
  }

  async create(data:AdmittedFields<M>) {
    const instance = await this.client.query(this.createQuery(data)) as {ref: values.Ref};
    const dereferenced = await this.client.query(this.dereference(instance.ref.id));
    return this.model.emit.parse(dereferenced);
  }

  updateQuery(id: string, data:Partial<AdmittedFields<M>>) {
    const validated = this.model.admit.partial().parse(data);
    return q.Update(this.refFromId(id), { data: validated });
  }

  async update(id: string, data:Partial<AdmittedFields<M>>) {
    await this.client.query(this.updateQuery(id, data));
    return this.model.emit.parse(await this.client.query(this.dereference(id)));
  }

  deleteQuery(id: string) {
    return q.Delete(this.refFromId(id));
  }
  async delete(id: string):Promise<void> {
    await this.client.query(this.deleteQuery(id));
  }
}