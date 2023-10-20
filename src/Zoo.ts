import { Expr, query as q, values } from 'faunadb';
import z, { objectUtil } from 'zod';
import { Model, ModelFieldSet, EmittedFieldObject  } from './Model';
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
      // Basically we do field.path(fieldName) || ["ts"] to support related fields
      // Related Fields exist in an index but not in the document itself
      // Since we don't include the field if it's path can not be found we need to
      // supply a path that will always be there if the Field doesn't have a path
      .map<[string, string[]]>(([fieldName, field]) => [fieldName, field.path(fieldName) || ["ts"]]
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

  async getBy<T extends keyof M>(fieldName: T, term: M[T]['admit'] extends z.ZodType<infer T> ? T : never) {
    const field = this.model.fields[fieldName];
    if (!field.options.unique) {
      throw new Error(`Cannot get by non-unique field ${fieldName as string}`)
    }
    const index = field.getIndexName(this.model.name, fieldName as string);
    const page = await this.paginate(index, [term])
    if (page.length > 1) {
      return page[0];
    }
    return undefined;
  }

  async paginateBy<T extends keyof M>(fieldName: T, term: M[T]['admit'] extends z.ZodType<infer T> ? T : never) {
    const field = this.model.fields[fieldName];
    if (field.options.unique) {
      throw new Error(`Cannot paginate by unique field ${fieldName as string}`)
    }
    const index = field.getIndexName(this.model.name, fieldName as string);
    return this.paginate(index, [term]);
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
    const results = await this.client.query(this.paginateQuery(index, terms));
    return this.model.emit.array().parse(results) as EmittedFieldObject<M>[];
  }

  getQuery(id: string) {
    return this.dereference(id);
  }

  async get(id: string) {
    const instance = await this.client.query(this.getQuery(id))
    return this.model.emit.parse(instance) as EmittedFieldObject<M>;
  }

  createQuery(data:AdmittedFields<M>) {
    const validated = this.model.admit.parse(data);
    return q.Create(q.Collection(this.model.name), { data: validated });
  }

  async create(data:AdmittedFields<M>) {
    const instance = await this.client.query(this.createQuery(data)) as {ref: values.Ref};
    const dereferenced = await this.client.query(this.dereference(instance.ref.id));
    return this.model.emit.parse(dereferenced) as EmittedFieldObject<M>;
  }

  updateQuery(id: string, data:Partial<AdmittedFields<M>>) {
    const validated = this.model.admit.partial().parse(data);
    return q.Update(this.refFromId(id), { data: validated });
  }

  async update(id: string, data:Partial<AdmittedFields<M>>) {
    await this.client.query(this.updateQuery(id, data));
    return this.model.emit.parse(await this.client.query(this.dereference(id))) as EmittedFieldObject<M>;
  }

  deleteQuery(id: string) {
    return q.Delete(this.refFromId(id));
  }
  async delete(id: string):Promise<void> {
    await this.client.query(this.deleteQuery(id));
  }
}